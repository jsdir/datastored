var _ = require('lodash');
var async = require('async');

function mergeFuncs(dest, src) {
  var reverseCallbacks = ['beforeOutput', 'afterOutput'];

  for (var name in src) {
    if (name in dest) {
      if (name === 'initialize') {
        // Synchronous function.
        dest[name] = _.compose(dest[name], src[name]);
      } else if (_.contains(name, reverseCallbacks)) {
        // Reverse synchronous function.
        dest[name] = _.compose(src[name], dest[name]);
      } else {
        // Asynchronous callback.
        dest[name] = async.compose(dest[name], src[name]);
      }
    } else {
      // Set the initial function.
      dest[name] = src[name];
    }
  }
  return dest;
}

function getCallbacks(options) {
  var mixins = options.mixins || [];
  return _.reduce(options.concat(mixins), function(callbacks, partial) {
    if (partial.callbacks) {
      return mergeFuncs(callbacks, partial.callbacks);
    }
    return callbacks;
  }, {});
}

function removeImmutableValues(values, cb) {
  // All values must be settable when the model is new.
  if (!this.isNew) {
    values = _.omit(values, this.attrGroups.immutable);
  }
  cb(null, values);
}

function hideHiddenValues(values) {
  return _.omit(values, this.attrGroups.hidden);
}

function unserialize(values, cb) {
  return this.model.orm.marshaller.unserialize(values, cb);
}

function serialize(values) {
  return this.model.orm.marshaller.serialize(values);
}

var ModelMixin = {
  initialize: function(options) {
    var attributes = this.attributes;
    var attributeNames = _.keys(attributes);
    var groupOptions = ['immutable', 'hidden'];
    this.attrGroups = _.object(_.map(groupOptions, function(groupOption) {
      return [groupOption, _.groupBy(attributeNames, function(name) {
        return attributes[name][groupOption];
      })];
    }));
  },
  callbacks: {
    afterInput: async.compose(removeImmutableValues, unserialize),
    beforeOutput: async.compose(hideHiddenValues, serialize)
  }
};

function Model(name, orm, options) {
  this.name = name;
  this.orm = orm;
  this.options = _.extend({}, options, ModelMixin); // TODO: merge correctly

  // Load the callback and mutator chains.
  this.callbacks = getCallbacks(options);

  // Clone the Model base class.
  this.instance = _.clone(Instance);

  // Set static methods.
  _.extend(this, options.staticMethods);

  // Set instance methods.
  _.extend(this.instance.prototype, options.methods);

  // Set attributes.
  this.attributes = _.union(this.options.properties, this.options.relations);
}

/**
 * Constructs a new `Instance` from the given data.
 * @param  {object}   data
 * @param  {boolean}  raw
 * @return {Instance}
 */
Model.prototype.create = function(attributes, raw) {
  var instance = new this.instance(this);
  instance.set(attributes, raw);
  return instance;
};

function Instance(model) {
  this.model = model;
  this.values = {};
  this.changedAttributes = [];
  this.errors = {};
  this.isValid = true;
}

Instance.prototype.get = function(attributes, raw) {
  var single = false;

  if (_.isString(attributes)) {
    attributes = [attributes];
    single = true;
  }

  var values = _.pick(this.values, attributes);
  var callbacks = ['beforeOutput', 'afterOutput'];
  var callback = this._composeCallbacks(callbacks, _.compose);
  if (callback) {
    values = callback(values);
  }

  if (single) {
    return values[attributes];
  } else {
    return values;
  }
};

Instance.prototype.set = function(name, value, raw) {
  var changedValues;

  if (arguments.length > 2) {
    // Set a single attribute.
    var values = _.object([[name, value]]);
  } else {
    // Set multiple attributes.
    var values = name;
    raw = value;
  }

  if (raw) {
    // Overwrite existing values if they exist.
    changedValues = values;
  } else {
    var _this = this;
    var callbacks = ['beforeInput', 'afterInput'];
    var callback = this._composeCallbacks(callbacks, async.compose);

    if (callback) {
      callback(values, function(err, values) {
        if (err) {
          // Overwrite existing error messages if they exist.
          _.extend(_this.errors, err);
        } else {
          changedValues = values;
        }
      });
    } else {
      // No related callbacks were defined.
      changedValues = values;
    }
  }

  // Set changed attributes.
  if (changedValues) {
    _.extend(this.values, changedValues);
    this.changedAttributes = _.union(
      this.changedAttributes, _.keys(changedValues)
    );
  }

  // Allow chaining.
  return this;
};

Instance.prototype._getCallback = function(name) {
  return this.model.callbacks[name];
};

Instance.prototype._composeCallbacks = function(callbacks, func) {
  callbacks = _.compact(_.map(callbacks, _.bind(this._getCallback, this)));
  if (callbacks.length > 0) {
    return func.apply(null, callbacks)
  }
};

module.exports = {
  Model: Model,
  Instance: Instance
};
