var validator = require('validator');

var noop = function(value) {return value;}

var unserializeDate = function(value) {return new Date(value);}

var JSONMarshaller = {
  serializers: {
    integer: validator.toString,
    string: validator.toString,
    boolean: function(value) {return value ? 'true' : 'false';},
    datetime: function(value) {return value.toJSON();},
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

module.exports = {
  noop: noop,
  JSONMarshaller: JSONMarshaller
};
