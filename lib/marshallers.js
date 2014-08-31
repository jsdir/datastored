var _ = require('lodash-contrib');
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
      if (!_.isNull(value) && type) {
        value = marshaller[method][type](value);
      }
      return [name, value];
    }));
  }
}

var JSONMarshaller = {
  serializers: {
    integer: noop,
    string: validator.toString,
    boolean: noop,
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
