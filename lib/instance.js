var _ = require('lodash');
var async = require('async');

function Instance(model) {
  this.model = model;
  this.values = {};
  this.isNew = true;
  this._resetState();

  // TODO: Is this more efficient than cloning the class in Model?
  if (this.model.options.methods) {
    _.extend(this, this.model.options.methods);
  }
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
  var self = this;

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
  if (!this.isNew) {
    values = _.omit(values, this.model.pkProperty);
  }

  if (!raw) {
    // Remove immutable values.
    values = _.omit(values, _.intersection(
      _.keys(this.values), this.model.attrGroups.immutable
    ));
  }

  values = _.pick(values, _.keys(this.model.attributes));

  if (raw) {
    // Overwrite existing values if they exist.
    changedValues = values;
  } else {
    this._runInputCallbacks(values, function(err, values) {
      if (err) {
        // Overwrite existing error messages if they exist.
        _.extend(self.errors, err);
      } else {
        // Set changed attributes.
        changedValues = values;
      }
    });
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
  var datastores = this.model._getDatastores();
  var id = this._requireSaved();

  if (_.isFunction(scope)) {
    cb = scope;
    scope = options;
    options = {};
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
      type: self.model.propertyTypes
    };

    async.parallel(_.object(_.map(['redis', 'cassandra'], function(datastore) {
      return [datastore, function(cb) {
        datastores[datastore].fetch(_.extend({}, datastoreOptions, {
          attributes: datastoreAttributes[datastore]
        }), cb);
      }];
    })), function(err, results) {
      if (err) {return cb(err);}
      if (_.all([results.redis[id], results.cassandra[id]], _.isNull)) {
        return cb(null, options, {});
        // return cb(null, false);
      };

      var data = _.merge(results.redis, results.cassandra)[id];
      cb(null, options, data);
      // cb(null, true);
    });
  }, 'afterFetch'], async.compose)(options, attributes, function(
    err, options, data
  ) {
    if (err) {return cb(err);}
    _.extend(self.values, data);
    cb(null, !_.isEmpty(data));
  });
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
  if (!this.isChanged()) {return cb();}

  var changedData = _.pick(this.values, this.changedAttributes);

  this._composeCallbacks(['beforeSave', function(options, data, cb) {
    self._saveToDatastores(options, data, cb);
  }, 'afterSave'], async.compose)(options, changedData, cb);

  // Allow chaining.
  return this;
};

Instance.prototype.destroy = function(options, cb) {
  // TODO: options.refsOnly = false
  var id = this._requireSaved();

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

Instance.prototype.isChanged = function() {
  return this.changedAttributes.length > 0
};

Instance.prototype._saveToDatastores = function(options, data, cb) {
  var self = this;
  var attrGroups = this.model.attrGroups;

  var indexes = _.intersection(this.model.attrGroups.index, _.keys(data));

  var datastoreOptions = {
    column: this.model.options.table,
    types: this.model.propertyTypes,
    indexes: indexes
  };

  // Gather replaced index values.
  if (!this.isNew) {
    var replaceIndexes = _.intersection(indexes, this.model.replaceIndexes);
    if (replaceIndexes.length > 0) {
      this.fetch(replaceIndexes, function(err) {
        if (err) {return cb(err);}
        datastoreOptions.replaceIndexValues = self.get(replaceIndexes, true);
        self._saveWithDatastoreOptions(datastoreOptions, options, data, cb);
      });
      return;
    }
  }

  this._saveWithDatastoreOptions(datastoreOptions, options, data, cb);
};

Instance.prototype._saveWithDatastoreOptions = function(datastoreOptions,
  options, data, cb) {

  var self = this;
  var datastores = this.model._getDatastores();
  var attrGroups = this.model.attrGroups;
  var uncached = _.difference(
    _.keys(data), attrGroups.cache, attrGroups.cacheOnly
  );
  var datastoreAttributes = {
    cassandra: _.union(attrGroups.cache, uncached),
    redis: _.union(attrGroups.cache, attrGroups.cacheOnly)
  };

  function saveToDatastore() {
    datastoreOptions.id = self.getId(true);
    async.parallel(_.map(['redis', 'cassandra'], function(datastore) {
      return function(cb) {
        var attributes = datastoreAttributes[datastore];
        if (attributes.length > 0) {
          datastores[datastore].save(_.extend({}, datastoreOptions, {
            data: _.pick(data, attributes),
            increments: _.pick(self.increments, attributes)
          }), function(err) {
            cb(err, options, data);
          });
          return;
        }
        cb(null, options, data);
      }
    }), function(err) {
      if (!err) {
        self._resetState();
      }
      cb(err, options, data);
    });
  }

  // Generate object id if new.
  if (self.isNew) {
    this._generateId(function(err) {
      if (err) {return cb(err);}
      self.isNew = false;
      saveToDatastore();
    });
    return;
  }

  saveToDatastore();
};

Instance.prototype._generateId = function(cb) {
  var self = this;
  this.model.orm.generateId(function(err, value) {
    if (err) {return cb(err);}
    self.set(self.model.pkProperty, value, true);
    cb();
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
  var self = this;
  callbacks = _.compact(_.map(callbacks.reverse(), function(name) {
    if (_.isFunction(name)) {
      return name;
    }
    return self._getCallback(name);
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

Instance.prototype._requireSaved = function() {
  if (this.isNew) {
    throw new Error('the model must be saved');
  }
  return this.getId(true);
};

module.exports = Instance;
