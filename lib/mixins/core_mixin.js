var _ = require('lodash');

var CoreMixin = {
  input: function(data, applyUserTransforms) {
    return _.mapValues(data, function(value, name) {
      var attribute = this._getAttribute(name);
      return (attribute.guarded || attribute.virtual) ? undefined : value;
    });
  },
  output: function(data, options, applyUserTransforms) {
    return _.mapValues(data, function(value, name) {
      var attribute = this._getAttribute(name);
      return (applyUserTransforms && attribute.hidden) ? undefined : value;
    });
  },
  save: function(data, cb) {
    // Only check for required variables on initial save.
    if (this.isNew()) {
      var attributeNames = _.keys(this.model._attributes);
      var name = _.find(attributeNames, function(name) {
        return (name === null || name === undefined);
      });
      if (name) {return cb('attribute "' + name + '" is required');}
    }
    cb(null, data);
  }
};

module.exports = CoreMixin;
