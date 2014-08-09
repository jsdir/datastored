var _ = require('lodash');
var async = require('async');

var utils = require('./utils');
var relations = require('./relations');

function mergeCallbacks(dest, src) {
  var reverseCallbacks = ['beforeOutput', 'afterOutput'];

  for (var name in src) {
    if (name in dest) {
      if (name === 'initialize') {
        // Synchronous function.
        dest[name] = _.compose(dest[name], src[name]);
      } else if (_.contains(reverseCallbacks, name)) {
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

function hideHiddenValues(values) {
  return _.omit(values, this.model.attrGroups.hidden);
}

function unserialize(values, cb) {
  return this.model.orm.marshaller.unserialize(values, cb);
}

function serialize(values) {
  return this.model.orm.marshaller.serialize(values);
}

var ModelMixin = {
  callbacks: {
    //afterInput: async.compose(/*removeImmutableValues, */unserialize),
    beforeOutput: _.compose(hideHiddenValues/*, serialize*/)
  }
};

function Model(name, orm, options) {
  this.name = name;
  this.orm = orm;

  // Merge mixins.
  var _this = this;
  this.options = _.clone(options);

  // Validate options.
  // Require a column option.
  utils.requireAttributes(this.options, ['table']);

  // Validate properties.
  if (this.options.properties) {
    _.each(this.options.properties, function(options, name) {
      if (!options.type) {
        throw new Error('property "' + name + '" requires a type');
      }
    });
  }

  // Construct mixin list.
  var initialMixins = [ModelMixin, relations.RelationMixin];
  var mixins = initialMixins.concat(this.options.mixins || []);

  // Apply mixins.
  _.each(mixins, function(mixin) {
    _.each(mixin, function(prop, name) {
      var data = _this.options[name];
      if (!data) {
        _this.options[name] = {};
        data = _this.options[name];
      }

      if (name === 'callbacks') {
        mergeCallbacks(data, prop);
      } else if (_.isObject(prop)) {
        _.extend(data, prop);
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
  this.attributes = _.extend(
    {}, this.options.properties, this.options.relations
  );

  var _this = this;
  // Options are `true` if they can be used by properties and relations.
  // Options are `false` if they can only be used by properties.
  var groupOptions = {
    immutable: true, hidden: true, primary: false, index: false
  };
  var attributeNames = _.keys(_this.attributes);

  this.attrGroups = _.object(_.map(groupOptions, function(all, option) {
    return [option, _.filter(attributeNames, function(name) {
      if (all || _.has(_this.options.properties, name)) {
        return _this.attributes[name][option];
      }
    })];
  }));

  // Validate the primary key property.
  var primaries = this.attrGroups.primary;
  if (primaries.length > 1) {
    throw new Error('multiple primary key properties defined: ' + primaries);
  } else if (primaries.length == 1) {
    this.pkProperty = _.first(primaries);
  } else {
    throw new Error('no primary key property defined');
  }

  // Check that the primary key property is actually a property.
  if (!(this.pkProperty in this.options.properties)) {
    throw new Error('primary key attribute "' + this.pkProperty +
      '" is not a property');
  }

  // Check that the primary key property has a valid type.
  var validTypes = ['string', 'integer'];
  if (!_.contains(validTypes, this.attributes[this.pkProperty].type)) {
    throw new Error('primary key property "' + this.pkProperty +
      '" must have string or integer type');
  }

  // Check that the primary key property is not hidden.
  if (_.contains(this.attrGroups.hidden, this.pkProperty)) {
    throw new Error('primary key property "' + this.pkProperty + '" ' +
      'cannot be hidden');
  }

  // Make the primary key property immutable.
  if (!_.contains(this.attrGroups.immutable, this.pkProperty)) {
    this.attrGroups.immutable.push(this.pkProperty);
  }

  // Run through `initialize` callback.
  var initialize = this._getCallback('initialize');
  if (initialize) {
    this.options = initialize(this.options);
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
  if (attributes) {
    instance.set(attributes, raw);
  }
  return instance;
};

Model.prototype.get = function(pkValue, raw) {
  return this.create(_.object([[this.pkProperty, pkValue]]), raw);
};


Model.prototype.find = function(name, value, raw, cb) {
  // Check that the attribute is an index.
  if (!_.contains(this.attrGroups.index, name)) {
    throw new Error('attribute "' + name + '" is not an index');
  }

  var values = {};
  values[name] = value;

  if (!raw) {
    this._runInputCallbacks(values, function(err, inputValues) {
      if (err) {
        cb(err);
      } else {
        values = inputValues;
      }
    });
  }
};

Model.prototype.fetchByPks = function(ids, raw, cb) {
  if (_.isFunction(raw)) {
    cb = raw;
    raw = false;
  }
};

Model.prototype._getCallback = function(name, object) {
  if (this.options.callbacks) {
    var callback = this.options.callbacks[name];
    if (callback) {
      return _.bind(callback, object || this);
    }
  }
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

  if (!raw) {
    var callbacks = ['beforeOutput', 'afterOutput'];
    var callback = this._composeCallbacks(callbacks, _.compose);
    if (callback) {
      values = callback(values);
    }
  }

  if (single) {
    return values[attributes];
  } else {
    return values;
  }
};

Instance.prototype.set = function(name, value, raw) {
  var changedValues;

  if (_.isString(name)) {
    // Set a single attribute.
    var values = _.object([[name, value]]);
  } else {
    // Set multiple attributes.
    var values = name;
    raw = value;
  }

  // Remove immutable values.
  values = _.omit(values, _.intersection(
    _.keys(this.values), this.model.attrGroups.immutable
  ));

  var unknownNames = _.difference(
    _.keys(values), _.keys(this.model.attributes)
  );

  if (unknownNames.length == 0) {
    if (raw) {
      // Overwrite existing values if they exist.
      changedValues = values;
    } else {
      var _this = this;
      this._runInputCallbacks(values, function(err, values) {
        if (err) {
          // Overwrite existing error messages if they exist.
          _.extend(_this.errors, err);
        } else {
          // Set changed attributes.
          changedValues = values;
        }
      });
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
  var pkValue = this._requirePkValue();

  if (_.isFunction(options)) {
    cb = options;
    options = null;
  }

  if (this.errors) {
    return cb(this.errors);
  }

  var attributes = options.scope; //attributes or all
  this._composeCallbacks(['beforeFetch', function(options, attributes, cb) {
    _this.datastores.fetch({id: pkValue, attributes: attributes}, cb);
  }, 'afterFetch'], async.compose)(options, attributes, cb);
};

Instance.prototype.save = function(options, cb) {
  if (_.isFunction(options)) {
    cb = options;
    options = {};
  }

  if (this.errors) {
    return cb(this.errors);
  }

  this._composeCallbacks(['beforeSave', function(options, values, cb) {
    options = {
      id: this.getPkValue(),
      instance: this,
      increments: this.increments
    };
    datastore.save(options, cb);
    // TODO: choose whether or not to save the data in redis. only save
    // "cached" values to redis. all data is saved to cassandra. saving to
    // cassandra is done first, the cache loading can fail with a successful
    // save.
  }, 'afterSave'], async.compose)(options, changedValues, function(err) {
    if (err) {
      return cb(err);
    } else {
      this._resetState();
      cb();
    }
  });

  // Allow chaining.
  return this;
};

Instance.prototype.destroy = function(options, cb) {
  // TODO: options.refsOnly = false
  var pkValue = this._requirePkValue();

  if (_.isFunction(options)) {
    cb = options;
    options = {};
  }

  if (this.errors) {
    return cb(this.errors);
  }

  this._composeCallbacks(['beforeDestroy', function(options, dCb) {
    _this.datastores.destroy({id: pkValue}, dCb);
  }, 'afterDestroy'], async.compose)(options, cb);
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
Instance.prototype.getPkValue = function(raw) {
  return this.get(this.model.pkProperty, raw);
};

Instance.prototype._runCallbacks = function(callbacks, func, values, cb) {
  var callback = this._composeCallbacks(callbacks, func);
  if (callback) {
    callback(values, cb);
  } else {
    // None of the callbacks were defined.
    cb(null, values);
  }
};

Instance.prototype._runInputCallbacks = function(values, cb) {
  this._runCallbacks(['beforeInput', 'afterInput'], async.compose, values, cb);
};

Instance.prototype._changeIncrements = function(name, amount) {
  if (!(name in this.increments)) {
    this.increments[name] = 0;
  }
  this.increments[name] += amount;
}

Instance.prototype._getCallback = function(name) {
  return this.model._getCallback(name, this);
};

Instance.prototype._composeCallbacks = function(callbacks, func) {
  var _this = this;
  callbacks = _.compact(_.map(callbacks.reverse(), function(name) {
    if (_.isFunction(name)) {
      return name;
    }
    return _this._getCallback(name);
  }));

  if (callbacks.length > 0) {
    return func.apply(null, callbacks)
  }
};

Instance.prototype._resetState = function() {
  this.errors = {};
  this.changedAttributes = [];
  this.increments = {};
};

Instance.prototype._requirePkValue = function() {
  var value = this.getPkValue();
  if (value) {
    return value;
  } else {
    throw new Error('the model primary key "' + this.model.pkProperty +
      '" must be set');
  }
};

module.exports = {
  Model: Model,
  Instance: Instance
};
