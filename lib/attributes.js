var util = require('util');

var _ = require('lodash');

function checkOptions(type, attribute) {
  // Check that at least one datastore is defined.
  if (!attribute.datastores && !attribute.indexDatastore) {
    throw new Error('no datastores have been defined for the attribute');
  }

  if (attribute.indexDatastore) {
    checkAttributeIndex(type, attribute);
  }
}

function checkAttributeIndex(type, attribute) {
  if (!attribute.indexDatastore.indexStore) {
    throw new Error('datastore does not support indexing');
  }

  if (attribute.hasMutableValue === false) {
    throw new Error('attribute must have a value in order to index');
  }

  if(!_.contains(['string', 'integer'], type)) {
    throw new Error('only strings and integers can be indexed');
  }
}

function fromTypeName(type) {
  return function(options) {
    checkOptions(type, options);
    return {
      type: type,
      indexDatastore: options.indexDatastore,
      replaceIndex: options.replaceIndex,
      required: options.required,
      rules: options.rules,
      datastores: options.datastores,
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

module.exports = {
  String: fromTypeName('string'),
  Boolean: fromTypeName('boolean'),
  Integer: fromTypeName('integer'),
  Float: fromTypeName('float'),
  Date: fromTypeName('date'),
  Datetime: fromTypeName('datetime')
};
