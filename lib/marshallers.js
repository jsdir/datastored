var _ = require('lodash');
var validator = require('validator');

function unserializeDate(value) {
  var date = new Date(value);
  // Return an error if the date is invalid.
  if (isNaN(date.getTime())) {
    return {error: 'Invalid date'};
  } else {
    return {value: date};
  }
}

function toInt(value) {
  // Do not cast bignums.
  if (_.isObject(value)) {
    return value;
  }
  return validator.toInt(value);
}

function toString(value) {
  if (_.isObject(value)) {
    return value;
  }
  return validator.toString(value);
}

function noop(value) {
  return value;
}

function wrapValue(func) {
  return function(value) {
    return {value: func(value)};
  };
}

function serializeData(marshaller, types, data) {
  return _.mapValues(data, function(value, name) {
    var type = types[name];
    return marshaller.serializers[type](value);
  });
}

function unserializeData(marshaller, types, data) {
  return _.reduce(data, function(result, value, name) {
    var type = types[name];
    var unserializedResult = marshaller.unserializers[type](value);
    if (unserializedResult.error) {
      result.errors[name] = unserializedResult.error;
    } else {
      result.data[name] = unserializedResult.value;
    }
    return result;
  }, {data: {}, errors: {}});
}

var JSONMarshaller = {
  serializers: {
    integer: noop,
    float: noop,
    string: noop,
    boolean: noop,
    datetime: function(value) {return value.toJSON();},
    date: function(value) {return value.toJSON().split('T')[0];}
  },
  unserializers: {
    integer: wrapValue(toInt),
    float: wrapValue(validator.toFloat),
    string: wrapValue(toString),
    boolean: wrapValue(validator.toBoolean),
    datetime: unserializeDate,
    date: unserializeDate
  }
};

module.exports = {
  JSONMarshaller: JSONMarshaller,
  serializeData: serializeData,
  unserializeData: unserializeData
};
