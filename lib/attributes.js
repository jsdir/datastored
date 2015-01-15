var util = require('util');

var _ = require('lodash');

var utils = require('./utils');

function idIdType(type) {
  return _.contains(['string', 'integer'], type);
}

function checkAttributeIndex(type, attribute) {
  if(!idIdType(type)) {
    throw new Error('only strings and integers can be indexed');
  }
}

function checkOptions(type, attribute) {
  // Check that at least one datastore is defined.
  if (!attribute.hashStores && !attribute.indexStore) {
    throw new Error('no datastores have been defined for the attribute');
  }

  if (attribute.indexStore) {
    checkAttributeIndex(type, attribute);
  }
}

function getAttributeWithType(type) {
  return function(options) {
    checkOptions(type, options);
    return {
      required: options.required,
      hashStores: options.hashStores,
      indexStore: options.indexStore,
      replaceIndex: options.replaceIndex,
      guarded: options.guarded,
      hidden: options.hidden,
      rules: options.rules,
      defaultValue: options.defaultValue,
      type: type,

      input: options.input,
      output: options.output,
      outputAsync: options.outputAsync,
      save: options.save,
      fetch: options.fetch
    };
  };
}

function Enum(values, options) {
  return fromType('integer')(_.extend({
    save: function(value, cb) {
      var index = _.indexOf(values, value);
      if (index === -1) {
        return cb('value "' + value + '" not found in Enum');
      } else {
        cb(null, value);
      }
    },
    fetch: function(value) {
      return values[value];
    }
  }, options));
}

function Id(options) {
  utils.requireAttribute(options, 'type');
  // Check that id is of the correct type.
  if (!idIdType(options.type)) {
    throw new Error('"id" must have type "string" or "integer"');
  }
  return {type: options.type}
}

module.exports = {
  String: getAttributeWithType('string'),
  Boolean: getAttributeWithType('boolean'),
  Integer: getAttributeWithType('integer'),
  Float: getAttributeWithType('float'),
  Date: getAttributeWithType('date'),
  Datetime: getAttributeWithType('datetime'),
  Enum: Enum,
  Id: Id
};
