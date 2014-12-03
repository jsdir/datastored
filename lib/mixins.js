var _ = require('lodash');
var async = require('async');

var utils = require('./utils');
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
      data = marshallers
        .serializeData(marshaller, this.model._attributeTypes, data);
    }
    return data;
  },
  save: function(data, cb) {
    // Fail if there were errors when unserializing.
    cb(this._errors, data);
  }
}

var AttributeTransforms = {
  input: function(data, applyUserTransforms) {
    var self = this;
    return _.mapValues(data, function(value, name) {
      var attribute = self._getAttribute(name);
      if (attribute.input) {
        value = attribute.input(value, applyUserTransforms);
      }
      return value;
    });
  },
  output: function(data, options, applyUserTransforms) {
    var self = this;
    return _.mapValues(data, function(value, name) {
      var attribute = self._getAttribute(name);
      if (attribute.output) {
        value = attribute.output(value, options, applyUserTransforms);
      }
      return value;
    });
  },
  outputAsync: function(data, options, applyUserTransforms, cb) {
    var self = this;
    utils.mapValues(data, function(value, name, cb) {
      var attribute = self._getAttribute(name);
      if (attribute.outputAsync) {
        attribute.outputAsync(data[name], options, applyUserTransforms, cb);
      } else {
        cb(null, value);
      }
    }, cb);
  },
  fetch: function(data, cb) {
    var self = this;
    utils.mapValues(data, function(value, name, cb) {
      var attribute = self._getAttribute(name);
      if (attribute.fetch) {
        attribute.fetch(data[name], cb);
      } else {
        cb(null, value);
      }
    }, cb);
  },
  save: function(data, cb) {
    var self = this;
    utils.mapValues(data, function(value, name, cb) {
      var attribute = self._getAttribute(name);
      if (attribute.save) {
        attribute.save(data[name], cb);
      } else {
        cb(null, value);
      }
    }, cb);
  }
};

module.exports = {
  Core: Core,
  Serialize: Serialize,
  AttributeTransforms: AttributeTransforms
};
