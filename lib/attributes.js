var util = require('util');

var _ = require('lodash');

function checkOptions(type, attribute) {
  // Check that at least one datastore is defined.
  if (!attribute.hashStores && !attribute.indexStore) {
    throw new Error('no datastores have been defined for the attribute');
  }

  if (attribute.indexStore) {
    checkAttributeIndex(type, attribute);
  }
}

function checkAttributeIndex(type, attribute) {
  /*
  TODO: validate in instance loop
  if (attribute.hasMutableValue === false) {
    throw new Error('attribute must have a value in order to index');
  }
  */

  if(!_.contains(['string', 'integer'], type)) {
    throw new Error('only strings and integers can be indexed');
  }
}

function fromTypeName(type) {
  return function(options) {
    checkOptions(type, options);
    return {
      type: type,
      indexStore: options.indexStore,
      hashStores: options.hashStores,
      replaceIndex: options.replaceIndex,
      required: options.required,
      rules: options.rules,
      hasMutableValue: true,
      input: function(value) {
        if (options.guarded) {
          return undefined;
        }
        return value;
      },
      output: function(value) {
        if (options.hidden) {
          return undefined;
        }
        return value;
      }
    };
  };
}

function Enum(values, options) {
  return {
    save: function(value, cb) {
      var index = _.indexOf(values, value);
      if (index === -1) {
        return cb('value "' + value + '" not found in Enum');
      }
    },
    fetch: function(value) {
      return values[value];
    }
  };
}

module.exports = {
  String: fromTypeName('string'),
  Boolean: fromTypeName('boolean'),
  Integer: fromTypeName('integer'),
  Float: fromTypeName('float'),
  Date: fromTypeName('date'),
  Datetime: fromTypeName('datetime'),
  Enum: Enum
};
