var _ = require('lodash');

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

function failoverRead(redisCb, cassandraCb, restore, cb) {
  redisCb(function(redisErr, redisItem) {
    if (redisItem === null) {
      // Either redis failed or the item was not found. Assume that the item is
      // in cassandra.
      cassandraCb(function(cassandraErr, cassandraItem) {
        if (cassandraErr) {
          // Apparently both persistence layers failed. This is not good.
          cb([redisErr, cassandraErr]);
        } else {
          // Handle the valid response from cassandra.
          if (cassandraItem && restore) {
            // Restore the item to redis.
            restore(cassandraItem);
          }
          cb(null, cassandraItem);
        }
      });
    } else {
      cb(null, redisItem);
    }
  });
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
  this.options = options;
  this.models = {};

  if (!options.redis) {
    throw new Error('no `RedisClient` given to datastored');
  } else {
    this.redis = options.redis;
  }

  if (!options.cassandra) {
    throw new Error('no helenus `ConnectionPool` given to datastored');
  } else {
    this.cassandra = options.cassandra;
  }

  if (!options.generateId) {
    throw new Error('no `generateId` method given to datastored');
  } else {
    this.generateId = options.generateId;
  }
};

Orm.validate = validate;

Orm.prototype.model = function(name, options, behaviors) {

  // TODO: behaviors

  var options = Orm.parseOptions(options || {});

  var model = function(attributes, transform) {
    return Model.call(this, attributes, transform);
  }

  model.prototype = Object.create(Model.prototype);
  model.prototype.options = options;
  model.prototype.orm = this;

  this.models[name] = model;
}

Orm.prototype.use = function(name) {
  if (!this.models.hasOwnProperty(name)) {
    throw new Error('model "' + name + '" has not been defined');
  }
  return this.models[name];
}

Orm.transforms = {

  culling: {
    /**
     * Culling
     *
     * This transform will delete unknown fields.
     */
    input: function(attributes, model) {
      return _.pick(attributes, _.keys(model.attributes).concat('id'));
    }
  },

  escapeHtml: {
    input: function(attributes, model) {
      for (attribute in model.attributes) {
        var options = model.attributes[attribute];
        if (options.escapeHtml != false && options.type === 'string') {
          if (attributes.hasOwnProperty(attribute)) {
            attributes[attribute] = validator.escape(attributes[attribute]);
          }
        }
      }
      return attributes;
    }
  },

  validation: {
    /**
     * Validation
     */
    input: function(attributes, model) {
      // Validate attributes.
      debugger;
      var messages = Orm.validate(attributes, model.attributes);
      if (messages) {
        // Model is invalid.
        throw new Orm.ValidationError(messages);
      }
      return attributes;
    }
  },

  types: {
    /**
     * Attribute types
     *
     * These transforms handle serializing attributes from their types and
     * unserializing attributes to their types.
     */
    input: function(attributes, model) {
      // Unserialize for input.
      for (var attribute in model.attributes) {
        var options = model.attributes[attribute];
        if (attributes.hasOwnProperty(attribute)) {
          var type = 'string';
          if (options.hasOwnProperty('type')) {
            type = options.type;
          }
          attributes[attribute] = Orm.unserialize(type, attributes[attribute]);
        }
      }
      return attributes;
    },
    output: function(attributes, model) {
      // Serialize for output.
      for (var attribute in model.attributes) {
        var options = model.attributes[attribute];
        if (attributes.hasOwnProperty(attribute)) {
          var type = 'string';
          if (options.hasOwnProperty('type')) {
            type = options.type;
          }
          attributes[attribute] = Orm.serialize(type, attributes[attribute]);
        }
      }
      return attributes;
    },
    fetch: function(attributes) {
      // serialize for database
    }
  }
};

Orm.defaultTransformList = [
  /*
  Orm.transforms.culling,
  Orm.transforms.escapeHtml,
  Orm.transforms.validation,
  Orm.transforms.types
  */
];

Orm.defaultTransforms = parseTransforms({}, Orm.defaultTransformList);

Orm.parseOptions = function(options) {
  // Load attributes.
  for (var name in (options.attributes || {})) {
    var attribute = options.attributes[name];

    // Find the primary key attribute.
    if (attribute.primary) {
      options.pkAttribute = name;
    }
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

  this.initializeDatastores();
}

Model.prototype.initializeDatastores = function() {
  // Create datastores.
  this.redis = new datastores.RedisDatastore(this.options);
  this.cassandra = new datastores.CassandraDatastore(this.options);
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
    var data = _.pick(this.data, this.changedAttributes);

    if (this.isNew) {
      // Generate an id for the new model.
      this.orm.generateId(function(err, id) {
        if (err) {
          cb(err);
        } else {
          // Set the new id.
          data[self.options.pkAttribute] = id;
          // Insert to cassandra first.
          self.orm.cassandra.insert(data, function(err) {
            if (err) {
              cb(err);
            } else {
              // Insert to redis.
              self.orm.redis.insert(data, function(err) {
                if (err) {
                  // Log this entry
                }
              });
              self.isNew = false;
              self.changedAttributes = false;
              cb();
            }
          });
        }
      });
    } else {
      // Update cassandra first.
      self.orm.cassandra.update(data, function(err) {
        if (err) {
          cb(err);
        } else {
          // Update redis asynchronously then call the callback. As of now,
          // there is no need to wait or get the status of redis for the user.
          self.orm.redis.update(data, function(err) {
            if (err) {
              // Log this entry
            }
          });
          self.changedAttributes = false;
          cb();
        }
      });
    }
  }
}

Model.prototype.fetch = function(cb) {
  // TODO: (scopeRequest, cb)

  // Require the primary key before fetching.
  if (!this.data.hasOwnProperty(this.options.pkAttribute)) {
    throw new Orm.OrmError('the primary key must be set in order to fetch');
  }

  // TODO: Determine which datastore to query first based on the request.

  var scopeOptions = this.options.scopes[scope.name];
  scopeOptions.showPermissions = scopeOptions.showPermissions || false;

  // "userId" is the raw id
  if (_.isObject(scope.user)) {
    scopeOptions.userId = scope.user.getId();
  } else {
    scopeOptions.userId = scope.user;
  }

  var attributes = _.union(scopeOptions.attributes, ['id', 'user']);
  var difference = _.difference(attributes, this._cachedAttributes);

  if (difference.length === 0) {
    // The cache has all of the required attributes.
    datastores.redis.fetch(this, scopeOptions, function(err, data) {
      if (err) {
        // Redis failed. Fall back to cassandra.
        // TODO: log this error
        this._fetchFromDb(attributes, cb)
      } else if (data === null) {
        // The item either does not exist at all or it just doesn't exist in
        // redis. We will assume that the items exists. Fall back to cassandra
        // and update redis with the new value if found.
        this._fetchFromDb(attributes, cb, true)
      } else {
        // Redis has the item.
        data
      }
    });
  } else {
    // The cache does not have all of the required attributes. Use cassandra.
    this._fetchFromDb(attributes, cb);
  }

  func = function(cb) {
    cassandra.getItem(itemFromClosure, cb)
  }
  /*
  Determine from scope whether or not to use redis.
   */
  if (useRedis) {
    // cb is called with (err, item or null)
    failoverRead(function(cb) {
      datastores.redis.fetch(this.family, 5)
      redis.getItem(itemFromClosure, cb);
    }, func, function(item) {
      // Place "item" back in redis.
    }, function(err, item) {
      if (err) {
        // Both databases failed.
        // wakeUp(Jason, "now");
      } else {

      }
    });
  } else {
    func(function(err, item) {

    });
  }
}

Model.prototype.show = function(scope) {
  return this.transform(this.data, 'output', scope);
}

/**
 * Find a single model by a primary key (id) or an index. It can be used
 * with the database or the caching layer. "query" supports basic boolean
 * operators too.
 * @param  {Object}   scope The scope to use for finding the model.
 * @param  {Object}   query An object that maps attribute to value.
 * @param  {Function} cb    Called with a found model or null.
 */
Model.prototype.find = function(scope, query, cb) {
  this.indexes

  failover(function(failoverCb) {
    datastores.redis.getFromIndex(scope, query, function(err, modelId) {
      if (err) {
        failoverCb(err);
      } else {
        if (modelId === null) {
          // Couldn't find the model in redis. Try cassandra.
          failoverCb(null);
        } else {
          // The model was found.
          var model = this.
          cb(null, 8)
        }
      }
    });
  }, function(failoverCb) {
    datastores.cassandra.getFromIndex(scope, query, failoverCb);
  }, function(err, result) {
    // A model was found or both fetches resulted in an error.
    if (err) {
      cb(err);
    } else {

    }
  });
}

Model.prototype.search = function(query, cb) {
  // expects paginated query and returns objects. This only uses the
  // indexer. If you want to use the cache or the database, set up some
  // secondary keys and use "#find()".
  indexer.search({

  }, function(err, results) {
    callback(err, results);
  });
  callback(null, {"hello": "world"})
}

Model.prototype.transform = function(attributes, chain, cb) {
  var self = this;
  var transformChain = this.options.transforms[chain] || [];

  // Since the save method is asynchronous, asynchronous transforms can be
  // used in the save transform chain.
  if (chain === 'save') {
    // Return a callback for save chain.
    var index = 0;
    var applyTransform = function(err, attrs) {
      if (transformChain.length > index) {
        index += 1;
        transformChain[index - 1](attrs, self, applyTransform);
      } else {
        cb(attrs);
      }
    }
    applyTransform(null, attributes);
  } else if (this.options.transforms.hasOwnProperty(chain)) {
    transformChain.forEach(function(transform) {
      attributes = transform(attributes, self);
    });
    return attributes;
  }

  return attributes;
}

module.exports = Orm;
