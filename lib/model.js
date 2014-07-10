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

function removeImmutableValues(values) {
  if (this.isNew) {
    // All values must be settable when the model is new.
    return values;
  }
  return {values: _.omit(values, this.propGroups.immutable)};
}

function hideHiddenValues(values) {
  return _.omit(values, this.propGroups.hidden);
}

function unserialize(values) {
  return this.model.orm.marshaller.unserialize(values);
}

function serialize(values) {
  return this.model.orm.marshaller.serialize(values);
}

var ModelMixin = {
  initialize: function(options) {
    var props = this.props;
    var propNames = _.keys(props);
    var groupOptions = ['immutable', 'hidden'];
    this.propGroups = _.object(_.map(groupOptions, function(groupOption) {
      return [groupOption, _.groupBy(propNames, function(name) {
        return props[name][groupOption];
      })];
    }));
  },
  callbacks: {
    afterInput: async.compose(removeImmutableValues, unserialize),
    beforeOutput: _.compose(hideHiddenValues, serialize)
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

  // Set properties.
  this.props = _.union(this.options.attributes, this.options.relations);
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
  this.errors = {};
  this.isValid = true;
}

Instance.prototype.get = function(attributes, raw) {
  var single = false;

  if (_.isString(attributes)) {
    attributes = [attributes];
    single = true;
  }

  var values = this._runSyncCallbacks([
    'beforeOutput', 'afterOutput'
  ], _.pick(this.values, attributes));

  if (single) {
    return values[attributes];
  } else {
    return values;
  }
};

Instance.prototype.set = function(name, value, raw) {
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
    _.extend(this.values, values);
  } else {
    // Overwrite existing error messages if they exist.
    _.merge(this, this._runSyncCallbacks([
      'beforeInput', 'afterInput'
    ], values));
  }

  // Allow chaining.
  return this;
};

Instance.prototype._runCallback = function(name) {
  var callback = this.model.callbacks[name];
  if (callback) {
    // Separate sync from async.
    return callback.apply(arguments);
  }
  return this;
};

Instance.prototype._runSyncCallbacks = function(names, args) {
  var _this = this;

  _.every(names, function(name) {
    var result = _this._runCallback(name, args);
    if (result.errors) {
      return false;
    }
    args = result.values;
    return true;
  });

  return args;
};

module.exports = {
  Model: Model,
  Instance: Instance
};
