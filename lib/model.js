var _ = require('lodash');
var async = require('async');

function mergeCallbacks(dest, src) {
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
  callbacks: {
    afterInput: async.compose(removeImmutableValues, unserialize),
    beforeOutput: async.compose(hideHiddenValues, serialize)
  }
};

function Model(name, orm, options) {
  this.name = name;
  this.orm = orm;

  // Merge mixins.
  var _this = this;
  this.options = _.clone(options);
  _.each(this.options.mixins, function(mixin) {
    _.each(mixin, function(prop, name) {
      if (name === 'callbacks') {
        mergeCallbacks(_this.options[name], prop);
      } else if (_.isObject(prop)) {
        _.extend(_this.options[name], prop);
      } else {
        _this.options[name] = prop;
      }
    });
  });

  // Clone the Model base class.
  this.instance = _.clone(Instance);

  // Set static methods.
  _.extend(this, options.staticMethods);

  // Set instance methods.
  _.extend(this.instance.prototype, options.methods);

  // Set attributes.
  this.attributes = _.union(this.options.properties, this.options.relations);

  var attributeNames = _.keys(attributes);
  var groupOptions = ['primary', 'immutable', 'hidden'];
  this.attrGroups = _.object(_.map(groupOptions, function(groupOption) {
    return [groupOption, _.groupBy(attributeNames, function(name) {
      return attributes[name][groupOption];
    })];
  }));

  // Get the primary key propery.
  var primaries = this.attrGroups.primary;
  if (primaries) {
    if (primaries.length == 1) {
      this.pkProperty = _.first(primaries);
    } else {
      throw new Error('multiple primary key properties defined: ' + primaries);
    }
  } else {
    throw new Error('no primary key property defined');
  }

  if (!(this.pkProperty in this.options.properties)) {
    throw Error('primary key attribute "' + this.pkProperty +
      '" is not a property');
  }

  // Run through `initialize` callback.
  var callback = this._getCallback('initialize');
  if (callback) {
    this.options = callback(this.options);
  }
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
  this._resetState();
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

Instance.prototype.fetch = function(options, cb) {
  if (this.errors) {
    cb(this.errors);
  } else {
    var beforeFetch = this._getCallback('beforeFetch');
    if (beforeFetch) {
      beforeFetch(function(err, attributes) {
        if (err) {cb(err);}
        datastore.fetch(attributes, function(err, data) {

        });
      });
    }
  }
};

Instance.prototype.save = function(options, cb) {
  // TODO: If successful:
  this._resetState();
  return this;
};

Instance.prototype.destroy = function(options, cb) {
  var pk = this._requirePk();

  var beforeDestroy = this._getCallback('beforeDestroy');
  var afterDestroy = this._getCallback('afterDestroy');

  if (beforeDestroy)
  // require pk
  if (arguments.length == 1) {
    cb = req;
  }

  datastore.destroy()
  this.useDatastores
};

Instance.prototype.incr = function(name, amount) {
  this._changeIncrements(name, amount);
};

Instance.prototype.decr = function(name, amount) {
  this._changeIncrements(name, -amount);
};

/**
 * @return {*} The value of the instance's primary key.
 */
Instance.prototype.getPk = function() {
  return this.attributes[this.model.attrGroups.pkAttribute];
};

Instance.prototype._changeIncrements = function(name, amount) {
  if (!(name in this.increments)) {
    this.increments[name] = 0;
  }
  this.increments[name] += amount;
}

Instance.prototype._getCallback = function(name) {
  return this.model.options.callbacks[name];
};

Instance.prototype._composeCallbacks = function(callbacks, func) {
  callbacks = _.compact(_.map(callbacks, _.bind(this._getCallback, this)));
  if (callbacks.length > 0) {
    return func.apply(null, callbacks)
  }
};

Instance.prototype._resetState = function() {
  this.errors = {};
  this.changedAttributes = [];
  this.increments = {};
};

Instance.prototype._requirePk = function() {
  var pk = this.getPk();
  if (pk) {
    return pk;
  } else {
    throw new Error('the model primary key must be set');
  }
};

module.exports = {
  Model: Model,
  Instance: Instance
};
