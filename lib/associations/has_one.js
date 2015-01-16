var _ = require('lodash');
var _s = require('underscore.string');

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

    return {
      // The id value type sent to the HashStore is determined by the
      // association being single or multi-type.
      type: type
        ? orm.models[type]._props.id.type
        : 'string',
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
      save: function(name, value, options, cb) {
        // Save unsaved children and convert children to ids.
        // TODO: deal with maintaining links with current child and
        // preexisting child here.
        if (_.isNull(value)) {
          // Detach the target instance.
          cb(null, null);
        } else if (value.saved) {
          // Save the instance id.
          var id = value.id;
          cb(null, type ? id : value.model.type + ';' + id);
        } else {
          // Save instance then save the id.
          value.save(value._data).then(function(instance) {
            cb(null, instance.id);
          }).catch(cb);
        }
      },
      fetch: function(name, value, options, cb) {
        if (type) {
          var instance = orm.models[type].withId(value);
          if (options.attributes[name] !== true) {
            instance.fetch(options.attributes[name]).then(function(exists) {
              cb(null, instance);
            }).catch(cb);
          } else {
            //  console.log(123, instance);
            cb(null, instance);
          }
        } else {
          // Since the association supports multiple types, find the
          // instance's type by id introspection.
          var parts = value.split(/;(.+)?/);
          cb(null, orm.models[parts[0]].withId(parts[1]));
        }
      }
    };
  }
}

module.exports = HasOne;
