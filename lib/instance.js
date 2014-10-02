var _ = require('lodash');
var async = require('async');

var utils = require('./utils');

function Instance(model) {
  this.model = model;
  this.values = {};
  this.isNew = true;
  this._resetValueState();
}

Instance.prototype.get = function(attributes, raw) {
  // Accept a single attribute string or an array of multiple attributes.
  var single = false;

  if (_.isString(attributes)) {
    attributes = [attributes];
    single = true;
  }

  // Run values through output callbacks if requested.
  var values = _.pick(this.values, attributes);
  if (!raw) {
    var callbacks = ['beforeOutput', 'afterOutput'];
    var callback = this._composeCallbacks(callbacks, _.compose);
    if (callback) {
      values = callback(values);
    }
  }

  // Return the result based on the attributes that were given.
  if (single) {
    return values[attributes];
  } else {
    return values;
  }
};

Instance.prototype.set = function(name, value, raw) {
  var self = this;
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

  // Remove id value if the instance is not new.
  if (!this.isNew) {
    values = _.omit(values, this.model.pkProperty);
  }

  if (!raw) {
    // Remove immutable values.
    values = _.omit(values, _.intersection(
      _.keys(this.values), this.model.attrGroups.immutable
    ));
  }

  // Only set defined values.
  values = _.pick(values, _.keys(this.model.attributes));

  if (raw) {
    // Overwrite existing values if they exist.
    changedValues = values;
  } else {
    // Run attributes through input callbacks.
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
    // Exclude id from changed attributes.
    var changed = _.without(_.keys(changedValues), this.model.pkProperty);
    this.changedAttributes = _.union(this.changedAttributes, changed);
  }

  // Chain methods.
  return this;
};

Instance.prototype.fetch = function(options, scope, cb) {
  var self = this;
  this._requireSaved();

  // `options` is optional.
  if (_.isFunction(scope)) {
    cb = scope;
    scope = options;
    options = {};
  }

  // Fail if model errors exist.
  if (!_.isEmpty(this.errors)) {return cb(this.errors);}

  // Do not fetch the id since we already have it.
  var attributes = _.without(this._getScopeAttributes(scope), this.pkProperty);

  // Run attributes through fetch callbacks.
  var fetchAttributes = this._fetchAttributes.bind(this);
  var callbacks = ['beforeFetch', fetchAttributes, 'afterFetch'];
  var fetchCb = this._composeCallbacks(callbacks, async.compose);
  fetchCb(options, attributes, function(err, options, data) {
    if (err) {return cb(err);}

    // Set the fetched values.
    _.extend(self.values, data);

    // Call back with a boolean indicating whether new data was fetched or not.
    cb(null, !_.isEmpty(data));
  });

  // Chain methods.
  return this;
};

Instance.prototype.save = function(options, cb) {
  var self = this;

  // `options` is optional.
  if (_.isFunction(options)) {
    cb = options;
    options = {};
  }

  // Fail if model errors exist.
  if (!_.isEmpty(this.errors)) {return cb(this.errors);}

  // Return if no attributes were changed.
  if (!this.isChanged()) {return cb();}

  // Wait for id if it is being generated.
  this._onId(function(err) {
    // Run attributes through save callbacks.
    var saveData = self._saveData.bind(self);
    var callbacks = ['beforeSave', saveData, 'afterSave'];
    var saveCb = self._composeCallbacks(callbacks, async.compose);
    saveCb(options, _.pick(self.values, self.changedAttributes), cb);
  });

  // Allow chaining.
  return this;
};

/*
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
*/

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
  var data = this.get(this._getScopeAttributes(scope), raw);
  // Add id property to the output data.
  data[this.model.pkProperty] = this.getId(raw);
  return data;
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

Instance.prototype._fetchAttributes = function(options, attributes, cb) {
  var datastores = this.model._getDatastores();
  var id = this.getId(true);

  // Determine what datastore to use based on attribute caching.
  var attrGroups = this.model.attrGroups;
  var uncached = _.difference(
    attributes, attrGroups.cache, attrGroups.cacheOnly
  );

  if (uncached.length > 0) {
    // Uncached attributes are being requested. Fetch uncached attributes and
    // `cached` attributes from cassandra. Also, fetch any `cacheOnly`
    // attributes from redis.
    var datastoreAttributes = {
      cassandra: _.union(uncached, attrGroups.cache),
      redis: attrGroups.cacheOnly
    }
  } else {
    // All attributes being requested are `cached` or `cacheOnly`. Fetch all
    // from redis. Nothing needs to be fetched from cassandra.
    var datastoreAttributes = {
      cassandra: [],
      redis: attributes
    };
  }

  var datastoreOptions = {
    ids: [id],
    column: this.model.options.table,
    type: this.model.propertyTypes
  };

  // Fetch the attributes from both of the datastores.
  async.parallel(_.object(_.map(['redis', 'cassandra'], function(datastore) {
    return [datastore, function(cb) {
      datastores[datastore].fetch(_.extend({}, datastoreOptions, {
        attributes: datastoreAttributes[datastore]
      }), cb);
    }];
  })), function(err, results) {
    if (err) {return cb(err);}

    // Return `null` if no results were found.
    if (_.all([results.redis[id], results.cassandra[id]], _.isNull)) {
      return cb(null, options, {});
    };

    // Call back with data.
    cb(null, options, _.merge(results.redis, results.cassandra)[id]);
  });
};

Instance.prototype._saveData = function(options, data, cb) {
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

  //function saveToDatastore() {
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
      self.isNew = false;
      self._resetValueState();
    }
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

/**
 * Reset value-related state. This will not reset reset the values.
 */
Instance.prototype._resetValueState = function() {
  this.errors = {};
  this.changedAttributes = [];
  this.increments = {};
};

Instance.prototype._generateId = function() {
  var self = this;
  // Generate id asynchronously.
  this._idPromise = utils.Deferred();
  this.model.orm.generateId(function(err, id) {
    if (err) {return self._idPromise.resolve(err);}
    // Set the instance id.
    self.set(self.model.pkProperty, id, true);
    // Resolve the promise.
    self._idPromise.resolve(null, id)
  });
};

Instance.prototype._onId = function(cb) {
  if (this.getId(true) !== null) {
    // id exists or was manually input.
    cb();
  } else {
    // id is generated.
    this._idPromise.then(cb);
  }
};

Instance.prototype._requireSaved = function() {
  if (this.isNew) {
    throw new Error('the model must be saved');
  }
  return this.getId(true);
};

module.exports = Instance;
