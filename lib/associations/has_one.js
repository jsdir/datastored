var _ = require('lodash');
var _s = require('underscore.string');
var RSVP = require('rsvp');

var utils = require('../utils');
var Instance = require('../instance');

function isInstance(instance) {
  return _.has(instance, 'id');
}

function getDestLink(index, type, attrName) {
  if (index[type] && index[type][attrName]) {
    return index[type][attrName];
  }
  if (index[undefined] && index[undefined][attrName]) {
    return index[undefined][attrName];
  }
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
      ignoreIOType: true,
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
        var self = this;
        var nullInstance = _.isNull(instance);

        // Fetch the existing instance if it is not alreacy fetched.
        var existing = this.saved ?
          this.fetch(name, {reload: false})
          : RSVP.resolve(null);

        options.savedInstances = (options.savedInstances || []).concat(this.model.type);
        // Count saves to avoid an infinite save loop.
        options.saveCount = (options.saveCount || 0) + 1;

        if (options.updateJoin) {
          return existing.then(function(existingInstance) {
            if (existingInstance) {
              var updatedData = existingInstance
                .get(assocOptions.join, {single: false, ids: false});
              _.extend(updatedData, options.updateJoin);
              cb(null, embedJoin(existingInstance, updatedData));
            } else {
              return cb(null, null);
            }
          }).catch(cb);
        }

        existing.then(function(existingInstance) {
          return RSVP.all(_.map(self.model._linkHandlers, function(handler) {
            if (handler.attrName === name) {
              var promises = [];
              // TODO: optimize recursive saves
              if (existingInstance && !(options.saveCount > 2 && _.contains(options.savedInstances, existingInstance.model.type))) {
                // Unlink the old instance.
                promises.push(handler.func.call(self, existingInstance, false, options));
              }
              if (!nullInstance && !(options.saveCount > 2 && _.contains(options.savedInstances, instance.model.type))) {
                // If a new isntance is being assigned, link it.
                promises.push(handler.func.call(self, instance, true, options));
              }
              return RSVP.all(promises);
            }
          }));
        }).then(function() {
          if (nullInstance) {
            return cb(null, null);
          }

          if (assocOptions.join) {
            return instance.fetch(assocOptions.join, {
              reload: false, ids: false, single: false
            }).then(function(data) {
              cb(null, embedJoin(instance, data));
            }).catch(cb);
          }

          cb(null, idMethods.toId(instance));
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
        // Add save handler.
        this._saveHandlers = this._saveHandlers || {};
        this._saveHandlers[attrName] = function(instance, added, options) {
          var data = {};
          data[attrName] = added ? instance : null;
          return this.save(data, options);
        };

        // Register link handler. Add it to the index for other associations to use.
        var linkAttrs = this.orm._linkAttrs || {};
        var attrIndex = this.orm._attrIndex || {};
        this.orm._linkAttrs = linkAttrs;
        this.orm._attrIndex = attrIndex;

        // Add to link attributes if the attribute has a link.
        if (assocOptions.link) {
          var type = assocOptions.type || undefined;
          linkAttrs[type] = linkAttrs[type] || {};
          linkAttrs[type][assocOptions.link] = {type: this.type, attrName: attrName, join: assocOptions.join};
        }

        // Add all attributes to attribute index.
        attrIndex[this.type] = attrIndex[this.type] || {};
        attrIndex[this.type][attrName] = {type: this.type, attrName: attrName};

        // Check to see if this attrribute is the other part of an existing link.
        var destLink;
        if (assocOptions.link) {
          destLink = getDestLink(attrIndex, assocOptions.type, assocOptions.link);
        } else {
          destLink = getDestLink(linkAttrs, this.type, attrName);
        }

        if (destLink) {
          // Add local attribute handler.
          this._linkHandlers = this._linkHandlers || [];
          this._linkHandlers.push({attrName: attrName, func: function(instance, added, options) {
            return instance.model._saveHandlers[destLink.attrName]
              .call(instance, this, added, options);
          }});

          // Add destination attribute handler.
          var model = this.orm.models[destLink.type];
          model._linkHandlers = model._linkHandlers || [];
          model._linkHandlers.push({attrName: destLink.attrName, func: function(instance, added, options) {
            return instance.model._saveHandlers[attrName]
              .call(instance, this, added, options);
          }});

          // Sync joined links.
          _.each([
            {join: destLink.join, targetModel: this, linkAttr: attrName, destLinkAttr: destLink.attrName},
            {join: assocOptions.join, targetModel: model, linkAttr: destLink.attrName, destLinkAttr: attrName}
          ], function(assoc) {

            if (!assoc.join) {
              return;
            }

            assoc.targetModel._joinHandlers = assoc.targetModel._joinHandlers || [];
            assoc.targetModel._joinHandlers.push({join: assoc.join, func: function(instance, data) {
              var changedData = _.pick(data, assoc.join);
              if (_.isEmpty(changedData)) {
                return;
              }

              return instance.fetch(assoc.linkAttr, {reload: true})
                .then(function(fetchedInstance) {
                  if (!fetchedInstance) {
                    return;
                  }
                  var data = {};
                  data[assoc.destLinkAttr] = null;
                  return fetchedInstance.save(data, {
                    updateJoin: changedData
                  });
                });
            }});
          });
        }
      }
    };
  };
}

module.exports = HasOne;
