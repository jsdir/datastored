var _ = require('lodash');
var validator = require('validator');

var noop = function(value) {return value;}

var unserializeDate = function(value) {return new Date(parseInt(value));}

var BasicMarshaller = {
  serializers: {
    integer: noop,
    string: validator.toString,
    boolean: function(value) {return value ? 'true' : 'false';},
    datetime: function(value) {return value.getTime();},
    date: function(value) {return value.toJSON().split('T')[0];}
  },
  unserializers: {
    integer: validator.toInt,
    string: noop,
    boolean: function(value) {return validator.toBoolean(value);},
    datetime: unserializeDate,
    date: unserializeDate
  }
};

function mapMethod(method) {
  return function(marshaller, attributes, types) {
    return _.object(_.map(attributes, function(value, name) {
      var type = types[name].type;
      return [name, marshaller[method][type](value)];
    }));
  }
}

module.exports = {
  noop: noop,
  BasicMarshaller: BasicMarshaller,
  serialize: mapMethod('serializers'),
  unserialize: mapMethod('unserializers')
};
