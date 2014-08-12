var util = require('util');

var _ = require('lodash');
var async = require('async');
var valids = require('valids');

var utils = require('./utils');
//var relations = require('./relations');
var marshallers = require('./marshallers');

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
  cb(null, marshallers.unserialize(
    this.model.orm.marshaller, values, this.model.attributeTypes
  ));
}

function serialize(values) {
  return marshallers.serialize(
    this.model.orm.marshaller, values, this.model.attributeTypes
  );
}

function validate(options, data, cb) {
  var messages = {};
  var requiredAttributes = this.model.attrGroups.required;
  var names = _.keys(data);

  if (this.isNew()) {
    _.each(_.difference(requiredAttributes, names), function(name) {
      messages[name] = util.format('attribute "%s" is required', name);
    });
  }

  valids.validate(data, {
    schema: _.pick(this.model.options.properties, names)
  }, function(validationMessages) {
    if (validationMessages) {_.extend(messages, validationMessages);}
    if (_.isEmpty(messages)) {
      cb(null, options, data);
    } else {
      cb(messages);
    }
  });
}

var ModelMixin = {
  callbacks: {
    afterInput: async.compose(unserialize),
    beforeOutput: _.compose(hideHiddenValues, serialize),
    beforeSave: validate
  }
};

function Model(name, orm, options) {
  var self = this;
  this.name = name;
  this.orm = orm;

  // Merge mixins.
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
  var initialMixins = [ModelMixin/*, relations.RelationMixin*/];
  var mixins = initialMixins.concat(this.options.mixins || []);

  // Apply mixins.
  _.each(mixins, function(mixin) {
    _.each(mixin, function(prop, name) {
      var data = self.options[name];
      if (!data) {
        self.options[name] = {};
        data = self.options[name];
      }

      if (name === 'callbacks') {
        mergeCallbacks(data, prop);
      } else if (_.isObject(prop)) {
        _.extend(data, prop);
      } else {
        self.options[name] = prop;
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

  this.attributeTypes = _.mapValues(this.attributes, function(options) {
    return options.type;
  });

  // Options are `true` if they can be used by properties and relations.
  // Options are `false` if they can only be used by properties.
  var groupOptions = {
    immutable: true,
    hidden: true,
    cache: true,
    cacheOnly: true,
    required: true,
    primary: false,
    index: false
  };
  var attributeNames = _.keys(this.attributes);

  this.attrGroups = _.object(_.map(groupOptions, function(all, option) {
    return [option, _.filter(attributeNames, function(name) {
      if (all || _.has(self.options.properties, name)) {
        return self.attributes[name][option];
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

  // Ensure that only cached properties can be indexed.
  _.each(this.attrGroups.index, function(name) {
    var options = self.attributes[name];
    if (!options.cache && !options.cacheOnly) {
      throw new Error('only cached properties can be indexed');
    }
  });

  // Ensure that only cached props can have type counter.
  _.each(this.attributeTypes, function(type, name) {
    var options = self.attributes[name];
    if (type === 'counter' && !options.cache && !options.cacheOnly) {
      throw new Error('only cached properties can have type "counter"');
    }
  });

  // Set defaults.
  this.defaults = {};
  this.incrProperties = [];
  _.each(this.options.properties, function(options, name) {
    if (options.default) {
      self.defaults[name] = options.default;
    } else if (options.counter && options.type === 'integer') {
      self.defaults[name] = 0;
    } else if (options.counter && options.type === 'float') {
      self.defaults[name] = 0.0;
    }
  });

  var propNames = _.keys(this.options.properties);
  this.incrProperties = _.filter(propNames, function(name) {
    var options = self.options.properties[name];
    if (options.counter) {
      if (options.type === 'integer') {
        self.defaults[name] = 0;
        return true;
      } else if (options.type === 'float') {
        self.defaults[name] = 0.0;
        return true;
      } else {
        throw new Error('only properties of types "integer" and "float" ' +
          'can be counters');
      }
    }
  });

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
  instance.set(this.defaults, true);
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
    var values = {};
    values[name] = value;
  } else {
    // Set multiple attributes.
    var values = name;
    raw = value;
  }

  // Remove id value if it exists and the model is not new.
  if (!this.isNew()) {
    values = _.omit(values, this.model.pkProperty);
  }

  if (!raw) {
    // Remove immutable values.
    values = _.omit(values, _.intersection(
      _.keys(this.values), this.model.attrGroups.immutable
    ));
  }

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

Instance.prototype.fetch = function(options, scope, cb) {
  var self = this;
  var datastores = this._getDatastores();
  var id = this._requireId(true);

  if (_.isFunction(scope)) {
    cb = scope;
    scope = options;
    options = null;
  }

  // Fail if model errors exist.
  if (!_.isEmpty(this.errors)) {return cb(this.errors);}

  var attributes = _.without(this._getScopeAttributes(scope), this.pkProperty);

  this._composeCallbacks(['beforeFetch', function(options, attributes, cb) {
    // Determine what datastores to use.
    var attrGroups = self.model.attrGroups;
    var uncached = _.difference(
      attributes, attrGroups.cache, attrGroups.cacheOnly
    );

    if (uncached.length > 0) {
      var datastoreAttributes = {
        cassandra: _.union(uncached, attrGroups.cache),
        redis: attrGroups.cacheOnly
      }
    } else {
      var datastoreAttributes = {
        cassandra: [],
        redis: attributes
      };
    }

    var datastoreOptions = {
      ids: [id],
      column: self.model.options.table,
      type: self.model.attributeTypes
    };

    async.parallel(_.object(_.map(['redis', 'cassandra'], function(datastore) {
      return [datastore, function(cb) {
        datastores[datastore].fetch(_.extend({}, datastoreOptions, {
          attributes: datastoreAttributes[datastore]
        }), cb);
      }];
    })), function(err, results) {
      if (err) {return cb(err);}
      if (_.any([results.redis, results.cassandra], _.isNull)) {
        return cb('model no found');
      };
      var data = _.merge(results.redis, results.cassandra)[id];
      _.extend(self.values, data);
      cb();
    });
  }, 'afterFetch'], async.compose)(options, attributes, cb);
};

Instance.prototype.save = function(options, cb) {
  var self = this;

  if (_.isFunction(options)) {
    cb = options;
    options = {};
  }

  // Fail if model errors exist.
  if (!_.isEmpty(this.errors)) {return cb(this.errors);}

  // Return if no attributes were changed.
  if (this.changedAttributes.length == 0) {return cb();}

  var changedData = _.pick(this.values, this.changedAttributes);

  this._composeCallbacks(['beforeSave', function(options, data, cb) {
    // Generate object id if new.
    if (self.isNew()) {
      self.model.orm.generateId(function(err, value) {
        self.set(self.model.pkProperty, value, true);
        self._saveToDatastores(options, data, cb);
      });
    } else {
      self._saveToDatastores(options, data, cb);
    }
  }, 'afterSave'], async.compose)(options, changedData, function(err) {
    if (err) {return cb(err);}
    self._resetState();
    cb();
  });

  // Allow chaining.
  return this;
};

Instance.prototype.destroy = function(options, cb) {
  // TODO: options.refsOnly = false
  var id = this._requireId();

  if (_.isFunction(options)) {
    cb = options;
    options = {};
  }

  if (this.errors) {
    return cb(this.errors);
  }

  this._composeCallbacks(['beforeDestroy', function(options, cb) {
    self.datastores.destroy({id: id}, cb);
  }, 'afterDestroy'], async.compose)(options, cb);
};

Instance.prototype.incr = function(name, amount) {
  if (!_.contains(this.model.incrProperties, name)) {
    throw new Error('only counters can be incremented');
  }
  this._changeIncrements(name, amount);
};

Instance.prototype.decr = function(name, amount) {
  if (!_.contains(this.model.incrProperties, name)) {
    throw new Error('only counters can be decremented');
  }
  this._changeIncrements(name, -amount);
};

Instance.prototype.toObject = function(scope, raw) {
  var idObject = {};
  idObject[this.model.pkProperty] = this.getId(raw);
  return _.extend(this.get(this._getScopeAttributes(scope), raw), idObject);
};

/**
 * @return {*} The value of the instance's primary key.
 */
Instance.prototype.getId = function(raw) {
  return this.get(this.model.pkProperty, raw);
};

Instance.prototype.isNew = function() {
  return _.isUndefined(this.getId());
};

Instance.prototype._saveToDatastores = function(options, data, cb) {
  var self = this;

  // Determine what datastores to use.
  var datastores = this._getDatastores();

  var attrGroups = this.model.attrGroups;
  var uncached = _.difference(
    _.keys(data), attrGroups.cache, attrGroups.cacheOnly
  );

  var datastoreAttributes = {
    cassandra: _.union(attrGroups.cache, uncached),
    redis: _.union(attrGroups.cache, attrGroups.cacheOnly)
  };

  var datastoreOptions = {
    id: this.getId(),
    column: this.model.options.table,
    types: this.model.attributeTypes
    // indexes: this.model.attrGroups.index,
  };

  async.parallel(_.map(['redis', 'cassandra'], function(datastore) {
    return function(cb) {
      var attributes = datastoreAttributes[datastore];
      if (attributes.length > 0) {
        datastores[datastore].save(_.extend({}, datastoreOptions, {
          data: _.pick(data, attributes),
          increments: _.pick(self.increments, attributes)
        }), cb);
      } else {
        cb();
      }
    }
  }), function(err) {
    cb(err, options, data);
  });
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

Instance.prototype._getScopeAttributes = function(scope) {
  if (_.isString(scope)) {
    return this.model.options.scopes[scope];
  }
  return scope;
};

Instance.prototype._getDatastores = function() {
  return this.model.orm.datastores;
};

Instance.prototype._runInputCallbacks = function(values, cb) {
  this._runCallbacks(['beforeInput', 'afterInput'], async.compose, values, cb);
};

Instance.prototype._changeIncrements = function(name, amount) {
  if (!_.contains(_.keys(this.increments), name)) {
    this.increments[name] = 0;
  }
  this.increments[name] += amount;
  this.changedAttributes = _.union(
    this.changedAttributes, [name]
  );
};

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

Instance.prototype._requireId = function() {
  if (!this.isNew()) {
    return this.getId(true);
  } else {
    throw new Error('the model primary key "' + this.model.pkProperty +
      '" must be set');
  }
};

module.exports = {
  Model: Model,
  Instance: Instance
};
