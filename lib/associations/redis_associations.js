var _ = require('lodash');
var async = require('async');
var RSVP = require('rsvp');

var utils = require('../utils');

function getTree(params, cb) {
  function getTreeFromData(data) {
    return _.map(data, function(instance) {
      var children = [];
      if (instance.c && instance.c.length > 0) {
        children = getTreeFromData(instance.c);
      }
      return {
        instance: params.idMethods.fromId(instance.i),
        children: children
      };
    });
  }

  function fetchTreeAttributes(treeData, cb) {
    async.map(treeData, function(item, cb) {
      item.instance.fetch(params.valueOptions.attributes, params.valueOptions)
        .then(function() {
          if (item.children) {
            return fetchTreeAttributes(item.children, cb);
          }
          cb();
        }).catch(cb);
    }, cb);
  }

  function getUserTree(treeItems) {
    return _.map(treeItems, function(item) {
      var children = {};
      children[params.childrenAttribute] = getUserTree(item.children);
      return _.extend({},
        item.instance.get(params.valueOptions.attributes, params.valueOptions),
        children);
    });
  }

  return function(err, data) {
    if (err) {return cb(err);}
    var treeData = getTreeFromData(data);

    fetchTreeAttributes(treeData, function(err) {
      if (err) {return cb(err);}
      // Decide the format to return the results in.
      if (params.valueOptions.user) {
        // Return user-formatted data.
        cb(null, getUserTree(treeData));
      } else {
        // Return the instance objects if not in user mode.
        cb(null, treeData);
      }
    });
  };
}

function createRedisAssociation(type) {
  return function(options) {
    function executeCommands(name, value, attrOptions, cb) {
      var self = this;
      // Get the association redis key.
      var key = [this.model._props.keyspace, utils.serializeId(this.id), name]
        .join(';');
      var models = this.model.orm.models;
      var idMethods = utils.getIdMethods(options, models);

      // Get options about how to save/fetch instances in the association.
      var valueOptions = value || attrOptions.attributes[name];

      if (valueOptions && valueOptions.tree) {
        // A tree fetch was requested.
        if (!options.type) {
          throw new Error('related model type required for trees');
        }
        if (!options.tree.childrenAttribute) {
          throw new Error('childrenAttribute required for trees');
        }

        var childModel = models[options.type];
        var params = _.extend(options.tree, {
          rootKey: key,
          childKeyspace: childModel._props.keyspace,
          idMethods: idMethods,
          type: type
        });

        options.store.fetchTree(params, getTree({
          childModel: childModel,
          valueOptions: valueOptions,
          idMethods: idMethods,
          childrenAttribute: options.tree.childrenAttribute
        }, cb));
      } else {
        options.store.execute(type, idMethods, {
          key: key, query: valueOptions
        }, function(err, result) {
          if (err) {return cb(err);}
          var promise = RSVP.resolve();
          var data = {};

          if (options.link) {
            if (result.action === 'add') {
              promise = RSVP.map(result.instances, function(instance) {
                data = {};
                data[options.link] = self;
                return instance.save(data);
              });
            } else if (result.action === 'remove') {
              promise = RSVP.map(result.instances, function(instance) {
                data = {};
                data[options.link] = null;
                return instance.save(data);
              });
            }
          }

          promise.then(function() {
            cb(null, result.data);
          }).catch(cb);
        });
      }
    }

    return {
      virtual: true,
      fetch: executeCommands,
      save: executeCommands,
      ignoreIOType: true,
      initialize: function() {
        // Setup links

        // Setup trees
        //// joined attrs
        ////

        // Do not sync link targets for lists since they are not unique sets.
        if (type === 'list') {
          return;
        }

        this.orm.events.on('association:changeTarget', function(params) {
          // params.instance
          // params.attribute
          // params.target
          // params.action link, unlink

          if (options.type && params.target.type !== options.type) {
            return;
          }

          // return if corresponding values do not match / ...

          var data = {};
          // Use add/remove opitons specific to the type of set. Zset autoset
          data = addAttr;
          data = removeAttr;
          return params.target.save(data);
        });
      }
    };
  };
}

exports.RedisList = createRedisAssociation('list');
exports.RedisSet = createRedisAssociation('set');
exports.RedisZSet = createRedisAssociation('zset');
