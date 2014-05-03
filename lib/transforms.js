var _ = require('lodash');
var valids = require('valids');

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
  return null;
}

module.exports = {
  /**
   * Validates all input against the rules defined for the model attributes.
   * @type {Transform}
   */
  validate: {
    save: function(attributes, model, cb) {
      var messages = {};
      var valid = true;

      // Iterate through the model's attributes and rules.
      for (var name in model.options.attributes) {
        var attribute = model.options.attributes[name];

        // Rules are optional.
        if (attribute.rules && attributes.hasOwnProperty(name)) {
          var value = attributes[name];
          var message = validateAttribute(name, value, attribute.rules);
          if (message) {
            messages[name] = message;
            valid = false;
          }
        }
      }

      if (valid) {
        cb();
      } else {
        cb(messages);
      }
    }
  }
};
