var _ = require('lodash');
var async = require('async');

var datastores = require('./lib/datastores');
var validate = require('./lib/validate');


function requireProperties(obj, properties) {
  return _.object(_.each(properties, function (property) {
    if (obj.hasOwnProperty(property)) {
      return [property, obj[property]];
    } else {
      throw new Error('Object "' + obj + '" does not have the property "' +
        property + '".')
    }
  }));
}

function transform(options, attributes, chain) {
  return _.reduce(chain, function(existing, transform) {
    return transform(existing, options);
  }, attributes);
}

function transformAsync(options, attributes, chain, cb) {
  async.reduce(chain, attributes, function(existing, transform, cb) {
    transform(existing, options, cb);
  }, cb);
}

/**
 * Groups transforms and adds them to the existing transforms while
 * preserving order based on the type of chain.
 */
function parseTransforms(existing, transforms) {
  var parsed = _.clone(existing);

  (transforms || []).forEach(function(transformSet) {

    for (var chainName in transformSet) {
      var transform = transformSet[chainName];

      // Create the new chain if necessary.
      if (!parsed.hasOwnProperty(chainName)) {
        parsed[chainName] = [];
      }

      // Reverse order for outgoing chains.
      if (chainName === 'output' || chainName === 'save') {
        parsed[chainName].unshift(transform);
      } else {
        parsed[chainName].push(transform);
      }
    }
  });

  return parsed;
}


function Orm(options) {
  if (!options.redis) {
    throw new Error('no `RedisClient` given to datastored');
  }

  if (!options.cassandra) {
    throw new Error('no helenus `ConnectionPool` given to datastored');
  }

  if (!options.generateId) {
    throw new Error('no `generateId` method given to datastored');
  }

  // Initialize datastores.
  this.redis = new datastores.RedisDatastore({
    redis: options.redis,
    keyspace: options.redisKeyspace || 'orm'
  });

  this.cassandra = new datastores.CassandraDatastore({
    cassandra: options.cassandra
  });

  this.options = options;
  this.models = {};
};

// Accessibility helpers.
Orm.marshallers = require('./lib/marshallers');
Orm.transforms = require('./lib/transforms');

Orm.prototype.model = function(name, options, behaviors) {

  var self = this;
  // TODO: behaviors

  var options = Orm.parseOptions(options || {});

  var model = function(attributes, transform) {
    return Model.call(this, attributes, transform);
  }

  model.prototype = Object.create(Model.prototype);
  model.prototype.options = options;
  model.prototype.orm = this;

  // Assign static methods.
  if (options.hasOwnProperty('staticMethods')) {
    for (var name in options.staticMethods) {
      model[name] = options.staticMethods[name];
    }
  }

  // Assign instance methods.
  if (options.hasOwnProperty('methods')) {
    for (var name in options.methods) {
      model.prototype[name] = options.methods[name];
    }
  }

  // Set transforms.
  model.transform = function(attributes, chain, cb) {
    var transforms = options.transforms[chain] || [];

    if (chain === 'save') {
      transformAsync(options, attributes, transforms, cb);
    } else if (options.transforms.hasOwnProperty(chain)) {
      return transform(options, attributes, transforms);
    } else {
      return attributes;
    }
  }

  model.prototype.transform = model.transform;

  // Assign default static methods.
  /**
   * Find a single model by a primary key (id) or an index. It can be used
   * with the database or the caching layer. "query" supports basic boolean
   * operators too.
   * @param  {Object}   query An object that maps attribute to value.
   * @param  {Function} cb    Called with a found model or null.
   */
  model.find = function(query, cb) {
    // Since we accept user input here, we need to use the input transform
    // chain.
    // WARNING: This will work as long as the query is a single-dimensional
    // array. Once boolean operators are introduced, we will need a different
    // solution.
    query = model.transform(query, 'input');
    // Since all indexes are persisted to both backends, check redis first.
    self.redis.find(options, query, function(redisErr, redisPk) {
      if (redisErr || redisPk === null) {
        if (redisErr) {
          // TODO: report this error
          console.trace(redisErr);
        }
        self.cassandra.find(options, query, function(cassandraErr, pk) {
          if (cassandraErr) {
            cb(cassandraErr);
          } else if (pk !== null) {
            // TODO: restore to redis.
            var instance = new model(pk);
            cb(null, instance);
          } else {
            cb();
          }
        });
      } else if (redisPk !== null) {
        var instance = new model(redisPk);
        cb(null, instance);
      }
    });
  }

  this.models[name] = model;

  return model;
}

Orm.prototype.use = function(name) {
  if (!this.models.hasOwnProperty(name)) {
    throw new Error('model "' + name + '" has not been defined');
  }
  return this.models[name];
}

Orm.prototype.setRedisKeyspace = function(keyspace) {
  this.redis.keyspace = keyspace;
}

Orm.defaultTransformList = [];

Orm.defaultTransforms = parseTransforms({}, Orm.defaultTransformList);

Orm.parseOptions = function(options) {
  options.cachedAttributes = [];
  options.indexes = [];

  // Load attributes.
  for (var name in (options.attributes || {})) {
    var attribute = options.attributes[name];

    // Ensure that attribute has a type.
    if (!attribute.type) {
      throw new Error('attribute "' + name + '" must have a type');
    }

    // Find the primary key attribute.
    if (attribute.primary || attribute.index) {
      // Add to caches attributes by default.
      if (attribute.cache !== false) {
        options.cachedAttributes.push(name);
      } else if (attribute.primary) {
        throw new Error('the primary key "' + name + '" must be cached')
      } else if (attribute.index) {
        throw new Error('the index "' + name + '" must be cached')
      }
    }

    if (attribute.primary) {
      // Only one primary key can be defined per model.
      if (options.pkAttribute) {
        throw new Error('there must only be one primary key attribute');
      }
      options.pkAttribute = name;
    }

    if (attribute.index) {
      options.indexes.push(name);
    }
  }

  // Fail if the model was defined without a primary key.
  if (!options.pkAttribute) {
    throw new Error('a primary key attribute is required');
  }

  // Load transforms.
  options.transforms = parseTransforms(Orm.defaultTransforms,
    options.transforms || [])

  return options;
}


function Model(data, transform) {
  this.data = {};
  this.isNew = true;
  this.changedAttributes = [];

  // Load initial data.
  if (data) {
    if (_.isObject(data)) {
      // Initial attributes were given.
      this.set(data, transform);
    } else {
      // A primary key was given.
      this.isNew = false;
      this.set(this.options.pkAttribute, data, transform);
    }
  }
}

Model.prototype.get = function(attributes, transform) {
  var attribute;

  if (!_.isArray(attributes)) {
    var attribute = attributes;
    attributes = [attributes]
  }

  // Trim the data down to the attributes and their value.
  var data = _.pick(this.data, attributes);
  if (transform !== false) {
    data = this.transform(data, 'output');
  }

  if (attribute) {
    return data[attribute];
  } else {
    return data;
  }
}

Model.prototype.set = function(data, transform) {
  // TODO: Set values that changed. Don't include the primary key.
  // TODO: Block guarded attributes from being changed.

  if (!_.isObject(data)) {
    // Only one attribute is being set.
    var setData = {};
    setData[arguments[0]] = arguments[1];
    transform = arguments[2];
  } else {
    var setData = data;
  }

  setData = _.pick(setData, _.keys(this.options.attributes));

  if (transform !== false) {
    setData = this.transform(setData, 'input');
  }

  // Update data and set changed attributes.
  for (var attribute in setData) {
    var value = setData[attribute];
    // Only change if the attribute value is different.
    if (!_.isEqual(this.data[attribute], value)) {
      // Set the new value.
      this.data[attribute] = value;
      // Add the attribute to changed attributes if it is not there already.
      if (!_.contains(this.changedAttributes, attribute)) {
        this.changedAttributes.push(attribute);
      }
    }

    // If the primary key is being set, the model is not new and already
    // exists.
    if (attribute === this.options.pkAttribute) {
      this.isNew = false;
    }
  }

  return this;
}

/**
 * Insert the model with all attributes if the primary key is not set.
 * Update the model with changed attributes if the primary key is set.
 */
Model.prototype.save = function(cb) {
  // Only save when attributes have changed.
  var self = this;

  if (this.changedAttributes.length === 0) {
    // No attributes have changed; still successful.
    cb();
  } else {
    // Get data only from changed attributes.
    var changedData = _.pick(this.data, this.changedAttributes);
    this.transform(changedData, 'save', function(err, data) {
      if (err) {
        cb(err);
      } else if (self.isNew) {
        // Generate an id for the new model.
        self.orm.options.generateId(function(err, id) {
          if (err) {
            cb(err);
          } else {
            // Set the new id.
            data[self.options.pkAttribute] = id;
            self.saveToDatastores(data, cb);
          }
        });
      } else {
        self.saveToDatastores(data, cb);
      }
    });
  }
}

Model.prototype.saveToDatastores = function(data, cb) {
  var self = this;

  // Save to cassandra first.
  this.orm.cassandra.save(this.options, data, function(err) {
    if (err) {
      cb(err);
    } else {
      // Save to redis. This is run asynchronously parallel to the return
      // callback since there is no need to wait or get the status of redis
      // for the user and it makes saving much faster by assuming that nothing
      // failed when the data was saved to redis.

      self.orm.redis.save(self.options, data, function(err) {
        if (err) {
          // Log this entry
        }
      });

      self.isNew = false;
      self.changedAttributes = [];
      cb();
    }
  });
}

Model.prototype.getPk = function() {
  if (this.data.hasOwnProperty(this.options.pkAttribute)) {
    return this.data[this.options.pkAttribute];
  }
}

Model.prototype.getScope = function(name) {
  if (this.options.scopes && this.options.scopes.hasOwnProperty(name)) {
    return this.options.scopes[name]
  } else {
    throw new Error('scope "' + name + '" has not been defined');
  }
}

Model.prototype.fetch = function(scopeRequest, cb) {
  var self = this;

  // Require the primary key before fetching.
  var pkValue = this.getPk();
  if (!pkValue) {
    var err = new Error('the primary key must be set in order to fetch');
    return cb(err);
  }

  // Determine which datastore to query first based on the request.
  if (scopeRequest) {
    var scope = this.getScope(scopeRequest.name);
    var attributes = scope.attributes;
  } else {
    // Fetch all attributes excluding the primary key attribute.
    var attributes = _.without(_.keys(this.options.attributes),
      this.options.pkAttribute);
  }

  // Difference gets the array of variables that are not cached.
  var difference = _.difference(attributes, this.options.cachedAttributes);

  if (difference.length) {
    // Since some of the required attributes are exclusively in cassandra,
    // fetch from cassandra.
    this.fetchFromCassandra(pkValue, attributes, cb);
  } else {
    // The cache has all of the required attributes.
    this.orm.redis.fetch(pkValue, attributes, function(err, data) {
      if (err) {
        // Redis failed. Fall back to cassandra.
        // TODO: log this error
        self.fetchFromCassandra(pkValue, attributes, cb);
      } else if (!data) {
        // The item either does not exist at all or it just doesn't exist in
        // redis. We will assume that the items exists. Fall back to cassandra
        // and update redis with the new value if found.
        self.fetchFromCassandra(pkValue, attributes, function(err) {
          if (err) {
            cb(err);
          } else {
            // Restore data to redis. fetchFromCassandra already transformed
            // the data and set it in the model.
            _.pick(self.data, attributes);
            self.transform(_.pick(self.data, attributes), 'save', function(err, data) {
              if (err) {
                // TODO: log the error
              } else {
                self.orm.redis.save(data, function(err) {
                  if (err) {
                    // TODO: log this error.
                  }
                });
              }
            });
            cb();
          }
        });
      } else {
        // Redis has the item.
        self.set(self.transform(data, 'fetch'), false);
        cb();
      }
    });
  }
}

Model.prototype.fetchFromCassandra = function(pkValue, attributes, cb) {
  var self = this;
  this.orm.cassandra.fetch(this.options, pkValue, attributes,
    function(err, data) {
    if (err) {
      cb(err);
    } else {
      var transformedData = self.transform(data, 'fetch');
      self.set(transformedData, false);
      cb(null, transformedData);
    }
  });
}

Model.prototype.show = function(scope) {
  var transformedAttributes = this.transform(this.data, 'output');//, scope);
  if (scope == null) {
    return transformedAttributes;
  } else {
    return _.pick(transformedAttributes, this.getScope(scope));
  }
}

module.exports = Orm;
