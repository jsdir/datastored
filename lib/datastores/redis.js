var _ = require('lodash');
var async = require('async');

var marshallers = require('../marshallers');
var utils = require('../utils');

var marshaller = _.merge({}, marshallers.BasicMarshaller, {
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
  // TODO: set indexes first with redis.setnx

  var self = this;
  var key = this._getKey(options.column, options.id);
  var replaceIndexValues = null;

  // Serialize the attributes before save.
  var values = marshallers.serialize(
    marshaller, options.values, options.types
  );

  async.series([
    function(cb) {
      // Get values of indexes to replace.
      if (options.replaceIndexes.length > 0) {
        replaceIndexValues = this.fetch
        return cb();
      }
      cb();
    },
    function(cb) {
      // Save the row data.
      this.redis.hmset(key, values, function(err) {
        if (err) {return cb(err);}
        self._saveIndexes(options, values, cb);
      });
    },
    function(cb) {
      // Destroy indexes that are to be replaced.
      if (replaceIndexValues) {
        _.each(replaceIndexValues, function(value, name) {
          var keys = [options.column, name, value];
          self._delValue(self.indexes, keys);
        });
      }
    },
    function(cb) {
      // Save the indexes.
      _.each(options.indexes, function(index) {
        var keys = [options.column, index, options.values[index]];
        self._setValue(self.indexes, keys, options.id);
      });
    }
  ], cb);
};

RedisDatastore.prototype.fetch = function(options, cb) {
  var self = this;
  async.map(options.ids, function(id, cb) {
    var key = this.getKey(options.column, id);
    self.redis.hmget(key, options.attributes, function(err, values) {
      if (err) {return cb(err);}
      cb(null, marshallers.unserialize(
        masrshaller, _.object(options.attributes, values), options.types
      ));
    });
  }, cb);
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
  if (options.destroyIndexes) {

  }
};

RedisDatastore.prototype.incr = function(options, cb) {
  var key = this.getKey(options.column, options.id);
  this.redis.hincrby(key, options.attribute, options.amount, cb);
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