var util = require('util');

var _ = require('lodash');

var utils = require('./utils');

function checkOptions(type, attribute) {
  // Check that at least one datastore is defined.
  if (!attribute.hashStores && !attribute.indexStore) {
    throw new Error('no datastores have been defined for the attribute');
  }

  if (attribute.indexStore) {
    checkAttributeIndex(type, attribute);
  }
}

function idIdType(type) {
  return _.contains(['string', 'integer'], type);
}

function checkAttributeIndex(type, attribute) {
  if(!idIdType(type)) {
    throw new Error('only strings and integers can be indexed');
  }
}

function deserialize(value, type) {
  return 'des(' + value + ')';
}

function fromType(type) {
  return function(options) {
    checkOptions(type, options);
    return {
      required: options.required,
      hashStores: options.hashStores,
      indexStore: options.indexStore,
      replaceIndex: options.replaceIndex,
      guarded: options.guarded,
      hidden: options.hidden,
      defaultValue: options.defaultValue,
      type: type,
      input: function(value, userMode) {
        return userMode ? deserialize(value, type) : value;
      },
      output: function(value, userMode) {
        return userMode ? serialize(value, type) : value;
      },
      save: function(value, cb) {
        valids.validate(value, options.rules, function(message) {
          if (message) {return cb(message);}
          cb(null, value);
        });
      }
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
  String: fromType('string'),
  Boolean: fromType('boolean'),
  Integer: fromType('integer'),
  Float: fromType('float'),
  Date: fromType('date'),
  Datetime: fromType('datetime'),
  Enum: Enum,
  Id: Id
};
