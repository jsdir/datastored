exports.getIndexKey = function(options) {
  return [
    options.keyspace,
    options.attributeName,
    options.attributeValue
  ].join(':');
};

exports.getHashKey = function(options) {
  return options.keyspace + ':' + options.id;
};
