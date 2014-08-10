var _ = require('lodash');
var async = require('async');

var marshallers = require('../marshallers');
var utils = require('../utils');

var marshaller = _.merge({}, marshallers.JSONMarshaller, {
  serializers: {
    boolean: function(value) {return value ? 1 : 0;},
    datetime: function(value) {return value.getTime();},
    date: utils.serializeIntegerDate
  },
  unserializers: {
    date: utils.unserializeIntegerDate
  }
});

function RedisDatastore(options) {
  this.redis = options.client;
  this.keyspace = options.keyspace;
}

/**
 * Datastore implementation methods
 */
RedisDatastore.prototype.find = function(options, cb) {
  var key = this._getKey('i', options.column, options.index, options.value);
  this.redis.get(key, cb);
};

RedisDatastore.prototype.save = function(options, cb) {
  var self = this;

  async.series([
    function(cb) {
      // Check for duplicate indexes.
      async.map(options.indexes || [], function(index, cb) {
        var key = self._getKey(
          'i', options.column, index, options.data[index]
        );
        self.redis.setnx(key, options.id, cb);
      }, function(err, results) {
        if (err) {return cb(err);}
        if (_.all(results, _.identity)) {
          cb();
        } else {
          cb('index already exists');
        }
      });
    },
    function(cb) {self._saveData(options, cb);},
    function(cb) {
      // Destroy indexes that were replaced.
      async.each(_.keys(options.replaceIndexValues), function(name) {
        var value = options.replaceIndexValues[name];
        var key = self._getKey('i', options.column, name, value);
        self.redis.del(key, function(err) {
          if (err) {return cb(err);}
          // Add the index value to a list of replaced index values for this
          // id.
          var key = self._getKey('r', options.column, options.id, name);
          self.redis.sadd(key, value, cb);
        });
      }, cb);
    }
  ], cb);
};

RedisDatastore.prototype._saveData = function(options, cb) {
  var self = this;
  var key = this._getKey('h', options.column, options.id);

  var nullAttrs = _.filter(_.keys(options.data), function(name) {
    return options.data[name] === null;
  });

  async.parallel([
    function(cb) {
      if (!options.data) {return cb();}

      // Serialize the attributes before save.
      var data = marshallers.serialize(
        marshaller, _.omit(options.data, nullAttrs), options.types
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
      if (nullAttrs.length == 0) {return cb();}
      self.redis.hdel(key, nullAttrs, cb);
    }
  ], cb);
};

RedisDatastore.prototype.fetch = function(options, cb) {
  var self = this;

  async.map(options.ids, function(id, cb) {
    var key = self._getKey('h', options.column, id);
    var attrs = options.attributes;
    self.redis.hmget(key, attrs, function(err, values) {
      if (err) {return cb(err);}
      if (_.all(values, function(value) {return value === null;})) {
        cb(null, [id, null]);
      } else {
        var joinedValues = _.object(options.attributes, values);
        // Remove null values.
        _.each(joinedValues, function(value, key) {
          if(value === null) {
            delete joinedValues[key];
          }
        });
        cb(null, [id, marshallers.unserialize(
          marshaller, joinedValues, options.types
        )]);
      }
    });
  }, function(err, data) {
    if (err) {return cb(err);}
    cb(null, _.object(data));
  });
}

RedisDatastore.prototype.addToCollection = function(model, relationName) {
  // sorting
  //  - setting a new popularity on an image should change it's score in the zset.
  // ns:<model.type>:<pk>:<relationName> = {LIST, SET, ZSET}
  this.redis
};

RedisDatastore.prototype.destroyFromCollection = function() {
  // Also destroy from sort sets.
};

RedisDatastore.prototype.fetchCollection = function(options, childAttributes) {
  // get list of ids (sorted?)
  async.map(ids, function(pk) {

  });
};

RedisDatastore.prototype.fetchByPks = function(pks, attributes) {
  async.map(pks, redis.hgetall(attributes), function () {

  });
  // returns map ordered as
}

RedisDatastore.prototype.destroy = function(options, cb) {
  var self = this;

  async.parallel([
    function(cb) {
      // Delete the row data.
      async.each(options.ids, function(id, cb) {
        var key = self._getKey('h', options.column, id);
        self.redis.del(key, cb);
      }, cb);
    },
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
                  var key = self._getKey('r', options.column, id, name);
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
                var key = self._getKey('i', options.column, name, value);
                self.redis.del(key, cb)
              }, cb);
            }
          ], cb);
        }, cb);
      } else {
        cb();
      }
    }
  ], cb);
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
      var key = self.getKey('i', options.column, index, values[index]);
      self.redis.set(key, options.id, cb)
    } else {
      cb();
    }
  }, cb);
};

module.exports = RedisDatastore;
