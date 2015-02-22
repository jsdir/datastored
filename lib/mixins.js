var _ = require('lodash');
var async = require('async');
var validate = require('validate.js');
var debug = require('debug')('datastored:mixins');

var utils = require('./utils');
var marshallers = require('./marshallers');

var marshaller = marshallers.JSONMarshaller;

function filterAttributes(instance, data, func) {
  return _.reduce(data, function(result, value, name) {
    var attribute = instance._getAttribute(name);
    if (func(attribute)) {
      result[name] = value;
    }
    return result;
  }, {});
}

exports.Core = {
  input: function(data, options) {
    debug('Core.input:', data, options);
    var self = this;
    return filterAttributes(this, data, function(attribute) {
      return !(options.user && attribute.guarded && self.saved);
    });
  },
  output: function(data, options) {
    debug('Core.output:', data, options);
    var output = filterAttributes(this, data, function(attribute) {
      return !(options.user && attribute.hidden);
    });
    if (output && options.type) {
      output.type = this.model.type;
    }
    return output;
  },
  save: function(data, options, cb) {
    debug('Save.output:', data, options);
    // Only check for required variables on initial save.
    if (!this.saved) {
      var attributes = this.model._attributes;
      // Get name of any invalid attributes.
      var name = _.find(this.model._attributeNames, function(name) {
        var attribute = attributes[name];
        return (attribute.required && _.isUndefined(data[name]));
      });
      if (name) {
        var err = {};
        err[name] = 'attribute "' + name + '" is required';
        return cb(err);
      }
    }

    // Validate attributes.
    var constraints = _.mapValues(this.model._attributes, 'constraints');
    validate.async(data, constraints).then(function() {
      cb(null, data);
    }, function(err) {
      // https://github.com/mochajs/mocha/issues/1128
      _.defer(function() {
        cb(err);
      });
    });
  }
};

exports.Serialize = {
  input: function(data, options) {
    if (options.user) {
      var result = marshallers.unserializeData(marshaller,
        this.model._attributeTypes, _.omit(data, this.model._ignoreIOTypes));
      // Store errors that should be thrown.
      this._errors = result.errors;
      data = _.extend({}, data, result.data);
    }
    return data;
  },
  output: function(data, options) {
    if (options.user) {
      var result = marshallers.serializeData(
        marshaller,
        this.model._attributeTypes,
        _.omit(data, this.model._ignoreIOTypes)
      );
      data = _.extend({}, data, result);
    }
    return data;
  },
  save: function(data, options, cb) {
    // Fail if there were errors when serializing.
    cb(_.isEmpty(this._errors) ? null : this._errors, data);
  }
};

exports.AttributeTransforms = {
  input: function(data, options) {
    var self = this;
    return _.mapValues(data, function(value, name) {
      var attribute = self._getAttribute(name);
      if (attribute.input) {
        value = attribute.input.call(self, name, value, options);
      }
      return value;
    });
  },
  output: function(data, options) {
    var self = this;
    return _.mapValues(data, function(value, name) {
      var attribute = self._getAttribute(name);
      if (attribute && attribute.output) {
        value = attribute.output.call(self, name, value, options);
      }
      return value;
    });
  },
  fetch: function(data, options, cb) {
    var self = this;
    utils.mapValues(data, function(value, name, cb) {
      var attribute = self._getAttribute(name);
      if (attribute.fetch) {
        attribute.fetch.call(self, name, data[name], options, cb);
      } else {
        cb(null, value);
      }
    }, cb);
  },
  save: function(data, options, cb) {
    var self = this;
    utils.mapValues(data, function(value, name, cb) {
      var attribute = self._getAttribute(name);
      if (attribute.save) {
        attribute.save.call(self, name, data[name], options, cb);
      } else {
        cb(null, value);
      }
    }, cb);
  }
};
