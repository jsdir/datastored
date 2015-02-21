var _ = require('lodash');
var _s = require('underscore.string');
var RSVP = require('rsvp');

var utils = require('../utils');
var Instance = require('../instance');

function isInstance(instance) {
  return _.has(instance, 'id');
}

function getAttrLink(model, attrName) {
  var link;
  var handlers = model.orm._linkHandlers;

  if (handlers && handlers[model.type] && handlers[model.type][attrName]) {
    link = handlers[model.type][attrName].link;
  } else if (handlers && handlers[undefined] && handlers[undefined][attrName]) {
    link = handlers[undefined][attrName].link;
  }
  return link;
}

function HasOne(assocOptions) {

  var type = assocOptions.type;

  return function(orm, attrName) {

    var idMethods = utils.getIdMethods(assocOptions, orm.models);

    function embedJoin(instance, data) {
      var id = idMethods.toId(instance);
      return JSON.stringify(_.extend({}, data, {id: id}));
    }

    return {
      // The id value type sent to the HashStore is determined by the
      // association being single or multi-type.
      type: (type && !assocOptions.join) ? orm.models[type]._props.id.type : 'string',
      hashStores: assocOptions.hashStores,
      required: assocOptions.required,
      guarded: assocOptions.guarded,
      hidden: assocOptions.hidden,
      input: function(name, value, options) {
        if (isInstance(value)) {
          // Check instance type.
          if (type && type !== value.model.type) {
            var typeName = _s.quote(type);
            throw new Error('expected instance to have type ' + typeName);
          }
        } else if (_.isObject(value)) {
          // Check that association is single-type for attribute hashes.
          if (!type) {
            throw new Error('cannot save nested instances in multi-type ' +
              'associations');
          }

          // Create a new instance the value's attributes.
          var model = orm.models[type];
          var instance = new model._constructor(model, {data: value}, options);
          instance._generateId();
          return instance;
        } else if (!_.isNull(value)) {
          throw new Error('HasOne associations can only be set with an ' +
            'instance object, attribute hash, or "null"');
        }

        return value;
      },
      output: function(name, value, options) {
        var attrOptions = options.attributes[name];
        // Return the instance unless user transforms are used.
        if (!options.user) {return value;}
        // If the association was specified alone, return its id.
        if (attrOptions === true) {return value.getId(options);}
        // Recursively get the attributes from the association target.
        return value.get(attrOptions, _.extend({}, options, {single: false}));
      },
      save: function(name, instance, options, cb) {
        var data, link = assocOptions.link;
        var self = this;
        var unlinkInstance = _.isNull(instance);

        var instanceTag = this.type + ';' + this.getId({user: true});
        var savedInstance = _.contains(options.savedInstances || [], instanceTag);
        var saveOpts = {savedInstances: (options.savedInstances || []).concat(instanceTag)};

        if (!link) {
          // Load externally defined handler.
          link = getAttrLink(this.model, attrName);
        }

        // Load existing instance.

        (this.saved ? this.fetch(name, {reload: false}) : RSVP.resolve(null))
          .then(function(existingInstance) {
            var promises = [];

            if (existingInstance && options.updateJoin) {
              var updatedData = existingInstance
                .get(assocOptions.join, {single: false, ids: false});
              _.extend(updatedData, options.updateJoin);
              return embedJoin(existingInstance, updatedData);
            }

            // Unlink any existing instances.
            if (existingInstance && link && !savedInstance) {
              data = {};
              data[link] = null;
              promises.push(existingInstance.save(data, saveOpts));
            }

            if (unlinkInstance) {
              return RSVP.all(promises).then(function() {
                return null;
              });
            }

            // An instance is being set.
            data = {};
            if (link) {
              // Link the new instance.
              data[link] = self;
            }

            // Make sure the instance is saved before linking.
            if (!instance.saved) {
              _.extend(data, instance._data);
            }
            if (!_.isEmpty(data) && !savedInstance) {
              promises.push(instance.save(data, saveOpts));
            }

            return RSVP.all(promises).then(function() {
              return instance;
            });
          })
          .then(function(instance) {
            if (options.updateJoin) {
              return cb(null, instance);
            }

            if (unlinkInstance) {
              return cb(null, null);
            }

            if (assocOptions.join) {
              instance.fetch(assocOptions.join, {
                reload: false, ids: false, single: false
              }).then(function(data) {
                cb(null, embedJoin(instance, data));
              }).catch(cb);
            } else {
              cb(null, idMethods.toId(instance));
            }
          }).catch(cb);
      },
      fetch: function(name, value, options, cb) {
        var instance;
        if (assocOptions.join) {
          var data = JSON.parse(value);
          var attributes = _.omit(data, 'id');
          instance = idMethods.fromId(data.id);
          _.extend(instance._data, attributes);
        } else {
          instance = idMethods.fromId(value);
        }

        if (type && options.attributes[name] !== true) {
          // Recursive fetching.
          return instance.fetch(options.attributes[name])
            .then(function(exists) {
              cb(null, instance);
            }).catch(cb);
        }
        cb(null, instance);
      },
      initialize: function() {
        var self = this;

        if (assocOptions.link) {
          // Add link handler to related association.
          var handlers = {};
          handlers[assocOptions.type] = {};
          handlers[assocOptions.type][assocOptions.link] = {
            type: this.type,
            link: attrName
          };

          this.orm._linkHandlers = _.extend(
            {},
            this.orm._linkHandlers || {},
            handlers
          );
        }

        if (assocOptions.join) {
          this.orm.events.on('save', function(instance, data) {
            if (type && instance.type !== type) {
              return;
            }
            var changedData = _.pick(data, assocOptions.join);
            if (_.isEmpty(changedData)) {
              return;
            }

            var link = assocOptions.link || getAttrLink(self, attrName);
            // TODO: reload is not necessary, but type checking is broken
            return instance.fetch(link, {reload: true}).then(function(instance) {
              if (!instance) {
                return;
              }
              var data = {};
              data[attrName] = null;
              return instance.save(data, {updateJoin: changedData});
            });
          });
        }
      }
    };
  };
}

module.exports = HasOne;
