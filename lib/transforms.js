var _ = require('lodash');
var valids = require('valids');

var marshallers = require('./marshallers');

var validators = ['required', 'min', 'max', 'in', 'email', 'postal_code'];

function validateAttributeRule(name, value, rule) {
  if (_.contains(validators, rule.name)) {
    // Ignore validators not included in the array above.
    return valids[rule.name](name, value, rule.param);
  }
}

function validateAttribute(attibuteName, value, rules) {
  for (var name in rules) {
    var message = validateAttributeRule(attibuteName, value, {
      name: name, param: rules[name]
    });
    if (message) {
      return message;
    }
  }
}

function getArray(attributes) {
  if (_.isString(attributes)) {
    attributes = [attributes];
  }
  return attributes;
}

module.exports = {
  /**
   * Returns a transform that marshals the input and output with the given
   * marshaller.
   * @param  {Marshaller} marshaller
   * @return {Transform}
   */
  marshal: function(marshaller) {
    return {
      input: function(attributes, options) {
        return marshallers.unserialize(marshaller, attributes,
          options.attributes);
      },
      output: function(attributes, options) {
        return marshallers.serialize(marshaller, attributes,
          options.attributes);
      }
    };
  },

  /**
   * Returns a transform that hides an attribute from the output transform
   * chain. This can be used to hide certain attributes from the user while
   * still being able to fetch them.
   * @param  {string or array} hiddenAttributes
   * @return {Transform}
   */
  hide: function(attributes) {
    attributes = getArray(attributes);
    return {
      output: function(transformAttributes) {
        return _.omit(transformAttributes, attributes);
      }
    };
  },

  /**
   * Returns a transform that changes the given attributes to lowercase.
   * @param  {string or array} hiddenAttributes
   * @return {Transform}
   */
  lowercase: function(attributes) {
    attributes = getArray(attributes);
    return {
      input: function(transformAttributes) {
        return _.object(_.map(transformAttributes, function(value, key) {
          if (_.contains(attributes, key)) {
            value = value.toLowerCase();
          }
          return [key, value];
        }));
      }
    };
  },

  /**
   * Returns a transform that swaps attribute values on input.
   * @param  {string or array} attributes
   * @return {Transform}
   */
  alias: function(attributes, aliases) {
    attributes = getArray(attributes);
    return {
      input: function(transformAttributes) {
        return _.object(_.map(transformAttributes, function(value, key) {
          if (_.contains(attributes, key)) {
            value = aliases[value] || value;
          }
          return [key, value];
        }));
      }
    };
  }
};
