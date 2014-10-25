var _ = require('lodash');
var valids = require('valids');

var ValidationMixin = {
  asyncTransform: {
    save: function(options, data, cb) {
      var attributes = this.model._attributes;
      var schema = _.reduce(attributes, function(result, attribute, name) {
        if (attribute.rules) {
          result[name] = {rules: attribute.rules};
        }
        return result;
      }, {});

      valids.validate(data, {schema: schema}, function(messages) {
        if (messages) {return cb(messages);}
        cb(null, options, data);
      });
    }
  }
};

module.exports = ValidationMixin;
