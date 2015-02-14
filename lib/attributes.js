var util = require('util');

var _ = require('lodash');

var utils = require('./utils');

function idIdType(type) {
  return _.contains(['string', 'integer'], type);
}

function checkAttributeIndex(type, attribute) {
  if(!idIdType(type)) {
    throw new Error('only strings and integers can be indexed');
  }
}

function checkOptions(type, attribute) {
  // Check that at least one datastore is defined.
  if (!attribute.hashStores && !attribute.indexStore) {
    throw new Error('no datastores have been defined for the attribute');
  }

  if (attribute.indexStore) {
    checkAttributeIndex(type, attribute);
  }
}

function getAttributeWithType(type) {
  return function(options) {
    checkOptions(type, options);
    return {
      required: options.required,
      hashStores: options.hashStores,
      indexStore: options.indexStore,
      replaceIndex: options.replaceIndex,
      guarded: options.guarded,
      hidden: options.hidden,
      constraints: options.constraints,
      defaultValue: options.defaultValue,
      type: type,

      input: options.input,
      output: options.output,
      save: options.save,
      fetch: options.fetch
    };
  };
}

exports.Enum = function(enumValues, options) {
  var invert = _.invert(enumValues);
  return getAttributeWithType('integer')(_.extend({
    save: function(name, value, options, cb) {
      if (!_.has(enumValues, value)) {
        return cb('value "' + value + '" not found in Enum ' + name);
      }
      cb(null, value);
    },
    fetch: function(name, value, options, cb) {
      return invert[value];
    }
  }, options));
};

exports.Id = function(options) {
  utils.requireAttribute(options, 'type');
  // Check that id is of the correct type.
  if (!idIdType(options.type)) {
    throw new Error('"id" must have type "string" or "integer"');
  }
  return {type: options.type};
};

exports.Counter = function(options) {
  checkOptions(null, options);
  return {
    counter: true,
    type: 'integer',
    defaultValue: 0,
    guarded: true,
    hashStores: options.hashStores,
    save: function(name, value, options, cb) {
      // Combine query into a single relative value.
      var amount = 0;
      if (options) {
        if (options.incr) {
          amount += options.incr;
        }
        if (options.decr) {
          amount -= options.decr;
        }
      }
      cb(null, amount);
    }
  };
};

exports.String = getAttributeWithType('string');
exports.Boolean = getAttributeWithType('boolean');
exports.Integer = getAttributeWithType('integer');
exports.Float = getAttributeWithType('float');
exports.Date = getAttributeWithType('date');
exports.Datetime = getAttributeWithType('datetime');
