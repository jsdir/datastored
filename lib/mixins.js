var _ = require('lodash');

var marshallers = require('./marshallers');

var Core = {
  input: function(data, applyUserTransforms) {
    var self = this;
    return _.reduce(data, function(result, value, name) {
      var attribute = self._getAttribute(name);
      if (!(attribute.guarded || attribute.virtual)) {
        result[name] = value;
      }
      return result;
    }, {});
  },
  output: function(data, options, applyUserTransforms) {
    var self = this;
    return _.reduce(data, function(result, value, name) {
      var attribute = self._getAttribute(name);
      if (!(applyUserTransforms && attribute.hidden)) {
        result[name] = value;
      }
      return result;
    }, {});
  },
  save: function(data, cb) {
    // Only check for required variables on initial save.
    if (!this.saved) {
      var attributeNames = _.keys(this.model._attributes);
      var name = _.find(attributeNames, function(name) {
        return (name === null || name === undefined);
      });
      if (name) {return cb('attribute "' + name + '" is required');}
    }
    cb(null, data);
  }
};

var marshaller = marshallers.JSONMarshaller;

var Serialize = {
  input: function(data, applyUserTransforms) {
    if (applyUserTransforms) {
      var result = marshallers.unserializeData(marshaller,
        this.model._attributeTypes, data);
      // Store errors that should be thrown.
      this._errors = result.errors;
      data = result.data;
    }
    return data;
  },
  output: function(data, options, applyUserTransforms) {
    if (applyUserTransforms) {
      data = marshallers.serializeData(marshaller, this.model._attributeTypes,
        data);
    }
    return data;
  },
  save: function(data, cb) {
    // Fail if there were errors when unserializing.
    cb(this._errors, data);
  }
}

module.exports = {
  Core: Core,
  Serialize: Serialize
};
