var _ = require('lodash');
var validator = require('validator');

function noop(value) {return value;}

function unserializeDate(value, cb) {
  value = validator.toInt(value);
  if (_.isNaN(value)) {return cb('invalid date');}
  return new Date(value);
}

function mapMethod(method) {
  return function(marshaller, attributes, types) {
    return _.object(_.map(attributes, function(value, name) {
      var type = types[name];
      if (!_.isNull(value)) {
        value = marshaller[method][type](value);
      }
      return [name, value];
    }));
  }
}

function unserialize(options, cb) {
  for (name in options.data) {
    var value = options.value[name];
  }
  return _.object(_.map(options.data, function(value, name) {
    var type = options.types[name].type;
    /*if (_.isFunction(type)) {

    }*/
    return [name, marshaller[method][type](value)];
  }));
}

var JSONMarshaller = {
  serializers: {
    integer: noop,
    string: validator.toString,
    boolean: function(value) {return value ? 'true' : 'false';},
    datetime: function(value) {return value.getTime();},
    date: function(value) {return value.toJSON().split('T')[0];},
  },
  unserializers: {
    integer: validator.toInt,
    string: validator.toString,
    boolean: validator.toBoolean,
    datetime: unserializeDate,
    date: unserializeDate,
  }
};

module.exports = {
  JSONMarshaller: JSONMarshaller,
  serialize: mapMethod('serializers'),
  unserialize: mapMethod('unserializers'),
  noop: noop
};
