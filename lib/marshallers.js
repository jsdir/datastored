var _ = require('lodash');
var validator = require('validator');

function noop(value) {
  return value;
}

function noError(func) {
  return function(value) {
    return [null, func(value)];
  }
}

function unserializeDate(value) {
  return new Date(parseInt(value));
}

function inRange(value, min, max) {
  return (min <= value && value <= max);
}

function validateGeotag(value) {
  var invalidResult = ['invalid geolocation'];
  if (!_.isNumber(value.lat) || !_.isNumber(value.lon)) {
    return invalidResult;
  }
  if (!inRange(value.lat, 0, 90) || !inRange(value.lon, 0, 90)) {
    return invalidResult;
  }
  return [null, JSON.stringify(_.pick(value, ['lat', 'lon']))];
}

function mapMethod(method) {
  return function(marshaller, attributes, types) {
    return _.object(_.map(attributes, function(value, name) {
      var type = types[name].type;
      return [name, marshaller[method][type](value)];
    }));
  }
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

module.exports = {
  noop: noop,
  noError: noError,
  BasicMarshaller: BasicMarshaller,
  serialize: mapMethod('serializers'),
  unserialize: mapMethod('unserializers')
};
