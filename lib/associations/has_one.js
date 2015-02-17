var _ = require('lodash');
var _s = require('underscore.string');
var RSVP = require('rsvp');

var utils = require('../utils');
var Instance = require('../instance');

function isInstance(instance) {
  return _.has(instance, 'id');
}

function HasOne(assocOptions) {

  var type = assocOptions.type;

  return function(orm) {

    // TODO: check assocOptions for links, if there are links, attach them to
    // the orm models. the link attribute can be created with an option that it is a
    // reverse link... assocOptions. Here, we can react inside this attribute.
    var idMethods = utils.getIdMethods(assocOptions, orm.models);

    return {
      // The id value type sent to the HashStore is determined by the
      // association being single or multi-type.
      type: type || assocOptions.join ? orm.models[type]._props.id.type : 'string',
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
        var data;
        var self = this;
        var unlinkInstance = _.isNull(instance);
        var existingInstance = this.get(name);

        (function() {
          var promises = [];

          // Always unlink the existing instance.
          if (existingInstance && assocOptions.link) {
            data = {};
            data[assocOptions.link] = null;
            promises.push(existingInstance.save(data));
          }

          // The instance is being unlinked.
          if (unlinkInstance) {
            return RSVP.all(promises).then(function() {return null;});
          }

          // An instance is being set.
          data = {};
          if (assocOptions.link) {
            // Link the new instance.
            data[assocOptions.link] = self;
          }

          // Make sure the instance is saved before linking.
          if (!instance.saved) {
            _.extend(data, instance._data);
          }

          if (!_.isEmpty(data)) {
            promises.push(instance.save(data));
          }

          return RSVP.all(promises).then(function() {
            return instance;
          });
        })().then(function(instance) {
          if (unlinkInstance) {
            return cb(null, null);
          }

          var id = idMethods.toId(instance);
          if (assocOptions.join) {
            // TODO: load the joined attributes
            // instance.fetch(options.join)
            cb(null, JSON.stringify(
              _.extend(
                instance.get(assocOptions.join, {ids: false, single: false}),
                {id: id}
              )
            ));
          } else {
            cb(null, id);
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
          instance.fetch(options.attributes[name]).then(function(exists) {
            cb(null, instance);
          }).catch(cb);
          return;
        }
        cb(null, instance);
      }
    };
  };
}

module.exports = HasOne;
