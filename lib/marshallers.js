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
    datetime: function(value) {return value.toJSON();},
    date: function(value) {return value.toJSON().split('T')[0];}
  },
  unserializers: {
    integer: validator.toInt,
    string: validator.toString,
    boolean: validator.toBoolean,
    datetime: unserializeDate,
    date: unserializeDate
  }
};

function transform(funcs) {
  return function(value, types, name) {
    // `types` can be a {name: type} object or a string.
    // `name` is optional.
    var type = types;
    if (_.isString(name)) {
      var type = types[name]
    }
    return funcs[type](value);
  }
}

function transformData(funcs) {
  return function(data, attributes) {
    return _.object(_.map(data, function(value, name) {
      var type = attributes[name].type;
      if (!_.isNull(value) && type) {
        value = funcs[type](value);
      }
      return [name, value];
    }));
  }
}

function createInstance(marshaller) {
  return {
    serialize: transform(marshaller.serializers),
    unserialize: transform(marshaller.unserializers),
    serializeData: transformData(marshaller.serializers),
    unserializeData: transformData(marshaller.unserializers)
  }
}

module.exports = {
  JSONMarshaller: JSONMarshaller,
  createInstance: createInstance,
  noop: noop
};
