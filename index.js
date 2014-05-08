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

/*
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
}*/

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

  // Set defaults.
  options.redisKeyspace = options.redisKeyspace || 'orm';

  this.options = options;
  this.models = {};
};

// Accessibility helpers.
Orm.marshallers = require('./lib/marshallers');
Orm.transforms = require('./lib/transforms');

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

  return model;
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
  options.cachedAttributes = [];

  // Load attributes.
  for (var name in (options.attributes || {})) {
    var attribute = options.attributes[name];

    // Ensure that attribute has a type.
    if (!attribute.type) {
      throw new Error('attribute "' + name + '" must have a type');
    }

    // Find the primary key attribute.
    if (attribute.primary) {

      // Only one primary key can be defined per model.
      if (options.pkAttribute) {
        throw new Error('there must only be one primary key attribute');
      }

      // Get cached attributes.
      if (attribute.cache !== false) {
        options.cachedAttributes.push(name);
      }

      options.pkAttribute = name;
    } else if (attribute.cache) {
      options.cachedAttributes.push(name);
    }
  }

  // Fail if the model was defined without a primary key.
  if (!options.pkAttribute) {
    throw new Error('a primary key attribute is required');
  }

  // Fail if the model was defined with a primary key attribute cache set to
  // false.
  if (!_.contains(options.cachedAttributes, options.pkAttribute)) {
    throw new Error('the primary key "' + options.pkAttribute +
      '" must be cached')
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
  var ormOptions = this.orm.options;
  this.redis = new datastores.RedisDatastore(ormOptions, this.options);
  this.cassandra = new datastores.CassandraDatastore(ormOptions, this.options);
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
      } else {
        self.saveToDatastores(data, cb);
      }
    });
  }
}

Model.prototype.saveToDatastores = function(data, cb) {
  var self = this;

  if (this.isNew) {
    // Generate an id for the new model.
    this.orm.options.generateId(function(err, id) {
      if (err) {
        cb(err);
      } else {
        // Set the new id.
        data[self.options.pkAttribute] = id;
      }
    });
  }

  // Save to cassandra first.
  this.cassandra.save(data, function(err) {
    if (err) {
      cb(err);
    } else {
      // Save to redis. This is run asynchronously parallel to the return
      // callback since there is no need to wait or get the status of redis
      // for the user and it makes saving much faster by assuming that nothing
      // failed when the data was saved to redis.
      self.redis.save(data, function(err) {
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
  if (this.options.scopes && this.options.scopes.getOwnProperty(name)) {
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
    throw new Orm.OrmError('the primary key must be set in order to fetch');
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
    this.redis.fetch(pkValue, attributes, function(err, data) {
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
                self.redis.save(data, function(err) {
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
  this.cassandra.fetch(pkValue, attributes, function(err, data) {
    if (err) {
      cb(err);
    } else {
      var transformedData = self.transform(data, 'fetch');
      self.set(transformedData, false);
      cb(null, transformedData);
    }
  });
}

Model.prototype.show = function() {
  return this.transform(this.data, 'output');//, scope);
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
      if (err) {
        cb(err);
      } else if (transformChain.length > index) {
        index += 1;
        transformChain[index - 1](attrs, self, applyTransform);
      } else {
        cb(null, attrs);
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
