var _ = require('lodash');
var validator = require('validator');

function unserializeDate(value, cb) {
  value = validator.toInt(value);
  if isNaN(value) {
    cb('invalid date');
  }
  return new Date(value);
}

function mapMethod(method) {
  return function(marshaller, attributes, types) {
    return _.object(_.map(attributes, function(value, name) {
      var type = types[name].type;
      return [name, marshaller[method][type](value)];
    }));
  }
}

function unserialize(options, cb) {
  for (name in options.data) {
    var value = options.value[name];
  }
  return _.object(_.map(options.data, function(value, name) {
    var type = options.types[name].type;
    if (_.isFunction(type)) {

    }
    return [name, marshaller[method][type](value)];
  }));
  options.marshaller
  options.data
  options.types
}



var BasicMarshaller = {
  serializers: {
    integer: noop,
    string: validator.toString,
    boolean: function(value) {return value ? 'true' : 'false';},
    datetime: function(value) {return value.getTime();},
    date: function(value) {return value.toJSON().split('T')[0];},
    geolocation: validateGeotag
  },
  unserializers: {
    integer: validator.toInt,
    string: noop,
    boolean: function(value) {return validator.toBoolean(value);},
    datetime: unserializeDate,
    date: unserializeDate,
    geolocation: noError(JSON.parse)
  }
};

function enum(values) {
  values
}

var JSONMarshaller = {
  serializers: {
    integer: noop,
    string: validator.toString,
    boolean: function(value) {return value ? 'true' : 'false';},
    datetime: function(value) {return value.getTime();},
    date: function(value) {return value.toJSON().split('T')[0];},
    geolocation: validateGeotag
  },
  unserializers: {
    integer: validator.toInt,
    string: validator.toString,
    boolean: validator.toBoolean,
    datetime: unserializeDate,
    date: unserializeDate,
    geolocation: noError(JSON.parse)
  }
};

module.exports = {
  noop: noop,
  noError: noError,
  BasicMarshaller: BasicMarshaller,
  JSONMarshaller: JSONMarshaller,
  serialize: mapMethod('serializers'),
  unserialize: mapMethod('unserializers')
};
