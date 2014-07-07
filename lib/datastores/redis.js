var _ = require('lodash');
var async = require('async');
var marshallers = require('../marshallers');
var utils = require('../utils');

/**
 * RedisDatastore
 */
function RedisDatastore(options) {
  this.redis = options.client;
  this.keyspace = options.keyspace;
}

RedisDatastore.marshaller = _.merge({}, marshallers.BasicMarshaller, {
  serializers: {
    boolean: function(value) {return value ? 1 : 0;},
    datetime: function(value) {return value.getTime();},
    date: utils.serializeIntegerDate
  },
  unserializers: {
    date: utils.unserializeIntegerDate
  }
});

/**
 * Construct a redis key from the given parameters.
 */
RedisDatastore.prototype.getKey = function() {
  var parts = [this.keyspace].concat(_.values(arguments));
  // Delimit the arguments with a colon.
  return parts.join(':');
}

/**
 * Fetch from redis.
 */
RedisDatastore.prototype.fetch = function(options, pkValue, attributes, cb) {
  var key = this.getKey(options.table, pkValue);
  // Use redis HMGET to fetch the needed keys only.
  this.redis.hmget(key, attributes, function(err, values) {
    if (err) {
      cb(err);
    } else if (values) {
      // Create attribute object from attributes and the fetched values.
      var fetchedAttributes = _.object(_.zip(attributes, values));
      // Unserialize the attributes after fetch.
      var unserializedAttributes = marshallers.unserialize(
        RedisDatastore.marshaller,
        fetchedAttributes,
        options.attributes // Use this model option to find the types.
      );
      cb(null, unserializedAttributes);
    } else {
      // No model found.
      cb();
    }
  });
}

/**
 * Insert or update a model in redis.
 * @param  {Object}   attributes
 */
RedisDatastore.prototype.save = function(options, attributes, cb) {
  var self = this;
  // Update or insert the model.
  var key = this.getKey(options.table, attributes[options.pkAttribute]);

  // Serialize the attributes before save.
  var serializedAttributes = marshallers.serialize(
    RedisDatastore.marshaller,
    attributes,
    options.attributes // Use this model option to find the types.
  );

  this.redis.hmset(key, serializedAttributes, function(err) {
    if (err) {
      cb(err);
    } else {
      self.saveIndexes(options, serializedAttributes, cb);
    }
  });
}

RedisDatastore.prototype.saveIndexes = function(options, attributes, cb) {
  var self = this;

  async.each(options.indexes, function(index, cb) {
    if (attributes.hasOwnProperty(index)) {
      self.redis.set(self.getKey(options.table, 'i', index, attributes[index]),
        attributes[options.pkAttribute], cb)
    } else {
      cb();
    }
  }, cb);
}

/**
 * Returns the id of model matching the given query.
 */
RedisDatastore.prototype.find = function(options, query, cb) {
  // This will support multiple keys with boolean combinators in the future.
  var attribute = _.keys(query)[0];
  var queryValue = query[attribute];

  // Prepend an underscore to the index attribute.
  var key = this.getKey(options.table, 'i', attribute, queryValue);
  this.redis.get(key, function(err, value) {
    if (err) {
      cb(err);
    } else if (value === null) {
      cb(null, value);
    } else {
      var type = options.attributes[attribute].type;
      cb(null, RedisDatastore.marshaller.unserializers[type](value));
    }
  });
};

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

};

module.exports = RedisDatastore;
