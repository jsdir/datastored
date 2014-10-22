var path = require('path');
var fs = require('fs');

var _ = require('lodash');
var async = require('async');

var marshallers = require('../marshallers');
var utils = require('../utils');

var scriptPath = path.join(__dirname, 'scripts', 'redis.lua');
var script = fs.readFileSync(scriptPath, 'utf8');

var RedisMarshaller = _.merge({}, marshallers.JSONMarshaller, {
  serializers: {
    boolean: function(value) {return value ? 1 : 0;},
    datetime: function(value) {return value.getTime();},
    date: utils.serializeIntegerDate
  },
  unserializers: {
    date: utils.unserializeIntegerDate
  }
});

var marshaller = marshallers.createInstance(RedisMarshaller);
var serialize = marshaller.serialize;

function RedisDatastore(options) {
  var self = this;

  this.redis = options.client;
  this.keyspace = options.keyspace;

  this.scriptSha = utils.Deferred();
  this.redis.script('load', script, function(err, sha) {
    if (err) {throw err;}
    self.scriptSha.resolve(sha);
  });
}

/**
 * Datastore implementation methods
 */
RedisDatastore.prototype.find = function(options, cb) {
  var value = serialize(options.value, options.types, options.index);
  var key = this._getKey('i', options.table, options.index, value);
  this.redis.get(key, cb);
};

RedisDatastore.prototype.save = function(options, cb) {
  var self = this;
  var idValue = serialize(options.id, options.types, options.idName);

  async.series([
    function(cb) {
      // Check for duplicate indexes.
      async.map(options.indexes || [], function(index, cb) {
        var indexValue = serialize(options.data[index], options.types, index);
        var key = self._getKey('i', options.table, index, indexValue);
        self.redis.setnx(key, idValue, cb);
      }, function(err, results) {
        if (err) {return cb(err);}
        if (_.all(results, _.identity)) {
          cb();
        } else {
          cb('index already exists');
        }
      });
    },
    function(cb) {self._saveData(options, idValue, cb);},
    function(cb) {
      // Destroy indexes that were replaced.
      async.each(_.keys(options.replaceIndexValues), function(name) {
        var value = options.replaceIndexValues[name];
        var serializedValue = serialize(value, options.types, name);
        var key = self._getKey('i', options.table, name, serializedValue);
        self.redis.del(key, function(err) {
          if (err) {return cb(err);}
          // Add the index value to a list of replaced index values for this
          // id.
          var key = self._getKey('r', options.table, idValue, name);
          self.redis.sadd(key, serializedValue, cb);
        });
      }, cb);
    }
  ], cb);
};

RedisDatastore.prototype.fetch = function(options, cb) {
  var key = this._getHashKey(options);

  this.redis.hmget(key, options.attributes, function(err, values) {
    if (err) {return cb(err);}
    if (_.all(values, function(value) {return value === null;})) {
      // If the values returned are all `null`, the row was not fetched.
      cb();
    } else {
      // Remove null values.
      var data = _.pick(_.object(options.attributes, values), function(value) {
        return value !== null;
      });

      // Unserialize the data. Don not include the id since the id is already
      // set on the instance that is fetching.
      cb(null, marshaller.unserializeData(data, options.types));
    }
  });
};

RedisDatastore.prototype.destroy = function(options, cb) {
  var self = this;

  async.parallel([
    function(cb) {
      // Delete the row data.
      self.redis.del(self._getHashKey(options), cb);
    }/*,
    function(cb) {
      // Delete the indexes.
      if (options.indexValues) {
        var names = _.keys(options.indexValues.values);
        async.each(names, function(name, cb) {
          var values = options.indexValues.values[name];

          async.series([
            function(cb) {
              if (_.contains(options.indexValues.replaceIndexes, name)) {
                // Add previously replaced index values.
                async.each(options.ids, function(id, cb) {
                  var key = self._getKey('r', options.table, id, name);
                  self.redis.smembers(key, function(err, replacedValues) {
                    if (err) {return cb(err);}
                    values = values.concat(replacedValues);
                    self.redis.del(key, cb);
                  });
                }, cb);
              } else {
                cb();
              }
            },
            function(cb) {
              // Delete all values.
              async.each(values, function(value, cb) {
                var key = self._getKey('i', options.table, name, value);
                self.redis.del(key, cb)
              }, cb);
            }
          ], cb);
        }, cb);
      } else {
        cb();
      }
    }*/
  ], cb);
};

// Collections

RedisDatastore.prototype.addToCollection = function(options, cb) {
  // ns:<model.type>:<pk>:<relationName> = {LIST, SET, ZSET}

  // Serialize the ids.
  var ids = _.map(options.instances, function(instance) {
    var idValue = serialize(instance.id, instance.idType);
    if (instance.modelType) {
      idValue = instance.modelType + ';' + idValue;
    }
    return idValue;
  });

  var args = [this._getCollectionKey(options)].concat(ids).concat(cb);
  this.redis.rpush.apply(this.redis, args);
};

// RedisDatastore.prototype.removeFromCollection = function(options, cb) {};

RedisDatastore.prototype.fetchCollection = function(options, cb) {
  // TOOD: types
  var key = this._getCollectionKey(options);

  this.redis.lrange(key, options.start, options.end, function(err, ids) {
    if (err) {return cb(err);}
    cb(null, _.map(ids || [], function(idValue) {
      var data = {};

      if (options.multiType) {
        var parts = idValue.split(';');
        data.type = parseInt(parts[0]);
        var id = parts[1];
      } else {
        var id = idValue;
        data.id = marshaller.unserialize(id, options.childIdType);
      }

      return data;
    }));
  });
};

RedisDatastore.prototype.fetchTree = function(options, cb) {
  var self = this;
  this.scriptSha.then(function(sha) {
    var args = [sha, 5,
      self._getCollectionKey(options),
      self._getKey('h', options.childTable),
      options.childrenRelation,
      options.includeLeaves,
      options.maxLevels || 0
    ];

    // Add child attributes as arbitrary arguments to redis EVALSHA.
    args.concat(options.childAttributes);
    args.push(function(err, data) {
      if (err) {return cb(err);}
      // Unserialize row data and ids.
      cb(null, recursiveMap(data, self._unserializeNode));
    });

    // Run with arguments.
    self.redis.evalsha.apply(self.redis.evalsha, args);
  });
};

RedisDatastore.prototype.reset = function(cb) {
  var redis = this.redis;
  redis.keys(this.keyspace + ':*', function(err, keys) {
    if (err) {return cb(err);}
    async.each(keys, function(key, cb) {
      redis.del(key, cb);
    }, cb);
  })
};

// Utils


RedisDatastore.prototype._saveData = function(options, idValue, cb) {
  var self = this;
  var key = this._getKey('h', options.table, idValue);

  var nullAttrs = _.filter(_.keys(options.data), function(name) {
    return options.data[name] === null;
  });

  async.parallel([
    function(cb) {
      if (!options.data) {return cb();}

      // Serialize the attributes before save.
      var data = marshaller.serializeData(
        _.omit(options.data, nullAttrs), options.types
      );

      if (_.isEmpty(data)) {return cb();}

      // Save the row data.
      self.redis.hmset(key, data, cb);
    },
    function(cb) {
      // Increment values.
      if (!options.increments) {return cb();}
      async.each(_.keys(options.increments), function(attribute, cb) {
        var amount = options.increments[attribute];
        self.redis.hincrby(key, attribute, amount, cb);
      }, cb);
    },
    function(cb) {
      // Delete any null values.
      if (nullAttrs.length === 0) {return cb();}
      self.redis.hdel(key, nullAttrs, cb);
    }
  ], cb);
};

RedisDatastore.prototype._unserializeNode = function(options, node) {
  // unserialize id and data
  // share unserialize code with fetchCollection
};

RedisDatastore.prototype._getIdValue = function(options) {
  return serialize(options.id, options.types, options.idName);
};

RedisDatastore.prototype._getCollectionKey = function(options) {
  var idValue = this._getIdValue(options);
  return this._getKey('h', options.table, idValue, options.relationName);
};

RedisDatastore.prototype._getHashKey = function(options) {
  var idValue = this._getIdValue(options);
  return this._getKey('h', options.table, idValue);
};

RedisDatastore.prototype._getKey = function() {
  // Construct a redis key from the given parameters.
  var initialParts = [];
  if (this.keyspace) {
    initialParts = [this.keyspace];
  }
  var parts = initialParts.concat(_.values(arguments));
  // Delimit the arguments with a colon.
  return parts.join(':');
};

RedisDatastore.prototype._saveIndexes = function(options, values, cb) {
  var self = this;

  async.each(options.indexes, function(index, cb) {
    if (_.has(values, index)) {
      var indexValue = serialize(values[index], options.types, index);
      var value = serialize(options.idType, options.types, options.id);
      var key = self.getKey('i', options.table, index, indexValue);
      self.redis.set(key, options.id, cb)
    } else {
      cb();
    }
  }, cb);
};

module.exports = RedisDatastore;