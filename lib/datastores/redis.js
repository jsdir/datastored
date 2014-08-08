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
  var key = this._getKey('h', options.column, options.id);

  async.series([
    function(cb) {
      // Check for duplicate indexes.
      async.map(options.indexes, function(index, cb) {
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
    function(cb) {
      // Save the row data.
      self.redis.hmset(key, marshallers.serialize(
        marshaller, options.data, options.types
      ), cb);
    },
    function(cb) {
      // Delete any null values.
      var nullAttrs = _.filter(_.keys(options.data), function(name) {
        return options.data[name] === null;
      });
      if (nullAttrs) {
        self.redis.hdel(key, nullAttrs, cb);
      } else {
        cb();
      }
    },
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

RedisDatastore.prototype.fetch = function(options, cb) {
  var self = this;

  async.map(options.ids, function(id, cb) {
    var key = self._getKey('h', options.column, id);
    var attrs = options.attributes;
    var data = self.redis.hmget(key, attrs, function(err, values) {
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

RedisDatastore.prototype.incr = function(options, cb) {
  var key = this._getKey('h', options.column, options.id);
  this.redis.hincrby(key, options.attribute, options.amount, cb);
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

function save(data, options, cb) {
  // Update or insert the model.
  var key = this.getKey(options.column, options.id);

  this.redis.hmset(key, marshallers.serialize(
    RedisDatastore.marshaller,
    options.propertyData,
    options.instance // Use this model option to find the types.
  ), function(err) {
    if (err) {
      return cb(err);
    }
    // save indexes
    options.indexData
    // i:column:<property_name>:<property_value> = "id"
  });
}

function fetch(attributes, options, cb) {
  // attributes include properties and relations

  // Relational targets can be loaded two ways:
  //   - through a scope: this will initialize the target data structure with
  //   ids only. This is useful if the children ids are also in the model row.
  //   (HasOne, HasMany?)
  //   - calling fetch on the relational target: target.fetch(scope)
  //     - this has to fetch the children ids according to set filter, limit,
  //       and offset, done when fetching through a scope. Then the ids are
  //       converted to objects and fetched individually.
  // calls back with:
  //  - property values
  //  - relations delimited by:
  //    - HasOne: id or null (property-like)
  //    - HasMany:
  //      - SET: list of ids
  //      - LIST: list of ids
  //      - ZSET: list of ids (for now) in the future, a predefined limit,
  //      offset, sort, and/or filter may be applied
  //    - Tree:
  //      The tree is an abstraction over models with the same type by using
  //      recursion through a common HasMany relation.
  //      - get a tree of ids joined by children:
  //        [{id: 1, children: {}}, {id: 2, children: {}}]
  //      - models in a tree must store their respective depth
  //
  // Collection.fetch(scope)
  //   - fetch resets all parameters after the parameters are applied to the
  //   query. This allows for:
  //
  //     collection.order().limit(10).offset(20).fetch(...)
  //
  //   collection.ordered = true/false
  //
  //   if order is used, clear the list
  //   - a list of models is kept
  //
  // joined attributes
  //
  // model is removed from all relational targets when deleted.
  //   HasOne: replace with null
  //     backrefs: store backref in implicit hasmany
  //   HasMany: remove from the list
  //     backrefs: store backref in implicit hasmany
  //   Tree: remove node and all node's descendants from the tree
  //     backrefs: store backref in implicit hasmany
  //
  // In both redis and cassandra, trees can be stored as lists:
  //
  //   <relation_name>:['a', 'a:aa', 'a:ab', 'a:ab:abc', 'b']
  //
  // When returning the SliceRange:
  //   - tree does not have `reverse` or `sort` options
  //   - tree does have limit and offset options
  //
  // In cassandra, `HasMany` collections can be stored as columns:
  //
  //   <relation_name>:<child_id>
  //
  // This would end up sorting by id, which would consequently sort by time
  // created.
  //
  // Additional `HasMany` sorting methods can use:
  //
  //   custom score:
  //   <relation_name>:<sort_value> = <child_id>
  //
  // Cassandra supports searches by primary key with ordering by another
  // primary key.
  //
  // save and fetch both add/remove indexes
  //
}

function destroy(options, cb) {
  // delete hash and indexes
  // delete collection relations
}

function addToCollection(score, offset) {
  // can be set, list, or zset
  // column:id:<relation_name> = {}
}

function removeFromCollection(options, offset) {
  // column:id:<relation_name>
}

function checkColumn(name) {
  // return bool if lowercase, alphanumeric, no space or colons.
}

/*

Datastore

  - findByIndex(column, indexName, indexValue) -> id or null

  - fetch(column, id or [id, id], attributes)
    - fetches and unserializes properties in `attributes`
    - fetches `HasOne` relations as (id or null)
    - fetches `HasMany` relations as [id, id]
    - fetches `Tree` relations as [{id: a, children: []}, {id: b}]

  - fetchCollection(column, id, relationName, sort, limit, offset)

  - getCollectionCount(column, id, relationName) -> `Integer`

  - addToCollection(column, id, relationName)

  - removeFromCollection(column, id, relationName)

  - clearCollection(column, id, relationName)

  - save(column, id, data)
    - data = serialize(properties) + `HasOne` relational targets
    - atomically save the property/relation hash (only HasOne in the set)
      - two data inputs:
        - properties (gets serialized)
        - raw
    - atomically save indexes if new

  - destroy(column, id)
    - atomically delete indexes
    - atomically delete hash

Persistence

  - saving props:   datastore.save
  - saving HasOne:  datastore.save
  - saving HasMany: collection.*
  - saving Tree:    ?

  - fetching props:   datastore.fetch
  - fetching HasOne:  datastore.fetch
  - fetching HasMany: fetchCollection
  - fetching Tree:    ?
 */