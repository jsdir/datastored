var util = require('util');

var _ = require('lodash');

function checkOptions(type, attribute) {
  // Check that at least one datastore is defined.
  if (!attribute.datastores || _.isEmpty(attribute.datastores)) {
    throw new Error('no datastores have been defined for the attribute');
  }

  if (attribute.index) {
    checkAttributeIndex(type, attribute);
  }
}

function fromTypeName(type) {
  return function(options) {
    checkOptions(type, options);
    return {type: type};
  };
}

function checkAttributeIndex(type, attribute) {
  // Check that all datastores are compatible with indexing.
  var incompatible = _.filter(attribute.datastores, function(datastore) {
    return !datastore.indexStore;
  });

  if (incompatible.length > 0) {
    throw new Error(util.format('datastores %s cannot be used to index',
      incompatible));
  }

  if (attribute.hasValue === false) {
    throw new Error('attribute must have a value in order to index');
  }

  if(!_.contains(['string', 'integer'], type)) {
    throw new Error('only strings and integers can be indexed');
  }
}

module.exports = {
  String: fromTypeName('string'),
  Boolean: fromTypeName('boolean'),
  Integer: fromTypeName('integer'),
  Float: fromTypeName('float'),
  Date: fromTypeName('date'),
  Datetime: fromTypeName('datetime')
};
