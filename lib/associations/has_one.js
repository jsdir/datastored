var _ = require('lodash');
var _s = require('underscore.string');

var Instance = require('../instance');

function isInstance(instance) {
  return _.has(instance, 'id');
}

function HasOne(attrOptions) {

  return function(orm) {

    return {
      // The id value type sent to the HashStore is determined by the
      // association being single or multi-type.
      type: attrOptions.type ? orm.models[attrOptions.type]._props.id.type : 'string',
      hashStores: attrOptions.hashStores,
      required: attrOptions.required,
      guarded: attrOptions.guarded,
      hidden: attrOptions.hidden,
      input: function(name, value, applyUserTransforms) {
        if (isInstance(value)) {
          // Check instance type.
          if (attrOptions.type && attrOptions.type !== value.model.type) {
            var typeName = _s.quote(attrOptions.type);
            throw new Error('expected instance to have type ' + typeName);
          }
        } else if (_.isObject(value)) {
          // Check that single-type for attribute hashes.
          if (!attrOptions.type) {
            throw new Error('cannot save nested instances in multi-type associations');
          }
          var instance = orm.models[attrOptions.type]._newInstance({id: null});
          instance._inputData = value;
          return instance;
        } else if (!_.isNull(value)) {
          throw new Error('HasOne associations can only be set with an ' +
            'instance object, attribute hash, or "null"');
        }

        return value;
      },
      output: function(name, value, options, applyUserTransforms) {
        var attrOptions = options[name];
        if (!applyUserTransforms) {return value;}
        if (attrOptions === true) {return value.getId(applyUserTransforms);}
        return value.get(options[name], applyUserTransforms);
      },
      save: function(name, instance, cb) {
        if (_.isNull(instance)) {
          cb(null, null);
        } else if (instance.saved) {
          // Save the instance id.
          var id = instance.id;
          cb(null, attrOptions.type ? id : instance.model.type + ';' + id);
        } else {
          // Save instance then save the id.
          instance.save(instance._inputData).then(function(instance) {
            cb(null, instance.id);
          }).catch(cb);
        }
      },
      fetch: function(name, value, options, cb) {
        if (attrOptions.type) {
          var instance = orm.models[attrOptions.type].withId(value);
          if (options[name]) {
            instance.fetch(options[name]).then(function(exists) {
              cb(null, instance);
            }).catch(cb);
          } else {
            cb(null, instance);
          }
        } else {
          var parts = value.split(/;(.+)?/);
          cb(null, orm.models[parts[0]].withId(parts[1]));
        }
      }
    };
  }
}

module.exports = HasOne;
