var _ = require('lodash');
var async = require('async');
var marshallers = require('./marshallers');

var dateFactor = 16 * 32;

/**
 * Converts a `Date` to a three-byte integer.
 * @param  {Date} value The `Date` to convert.
 * @return {Integer}    The converted date.
 */
function serializeIntegerDate(value) {
  // Convert Date to a three-byte integer
  // packed as YYYY×16×32 + MM×32 + DD.
  return value.getUTCFullYear() * dateFactor
    + value.getUTCMonth() * 32 + value.getUTCDate();
}

/**
 * Converts a packed three-byte integer date into a `Date`.
 * @param  {Integer} value The packed date to convert.
 * @return {Date}          The converted `Date`.
 */
function unserializeIntegerDate(value) {
  value = parseInt(value);

  // Unpack three-byte integer as a Date.
  var day = value % 32;
  value -= day;
  var month = (value % dateFactor) / 32;
  value -= month;
  var year = Math.floor(value / dateFactor);

  return new Date(year, month, day);
}

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
    date: serializeIntegerDate
  },
  unserializers: {
    date: unserializeIntegerDate
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

/**
 * CassandraDatastore
 */
function CassandraDatastore(options) {
  this.client = options.client;
}

CassandraDatastore.marshaller = _.merge({}, marshallers.BasicMarshaller, {
  serializers: {
    // Use the raw boolean value in cassandra.
    date: serializeIntegerDate,
    boolean: marshallers.noop
  },
  unserializers: {
    datetime: marshallers.noop,
    date: unserializeIntegerDate
  }
});

function addQuotes(text) {
  return '"' + text + '"';
}

CassandraDatastore.generateTuple = function(values, quote) {
  if (quote) {
    var values = _.map(values, addQuotes);
  }
  return '(' + values.join(',') + ')';
}

CassandraDatastore.generatePlaceholder = function(n) {
  return CassandraDatastore.generateTuple(
    _.times(n, function() {return '?';})
  );
}

CassandraDatastore.generateSetPlaceholder = function(attributes) {
  return _.map(attributes, function(attribute) {
    return addQuotes(attribute) + ' = ?'
  }).join(',');
}

CassandraDatastore.prototype.getConnection = function(cb) {
  var self = this;
  if (this.connected) {
    cb();
  } else {
    this.cassandra.connect(function(err) {
      if (!err) {
        self.connected = true;
      }
      cb(err);
    });
  }
}

/**
 * Fetch from cassandra.
 */
CassandraDatastore.prototype.fetch = function(
  options, pkValue, attributes, cb
) {
  var self = this;
  var query = 'SELECT ' + _.map(attributes, function(name) {
    return '"' + name + '"';
  }).join(',') + ' FROM ' + options.table + ' WHERE ' + options.pkAttribute +
    ' = ?';

  this.getConnection(function(err) {
    if (err) {
      cb(err);
    } else {
      self.cassandra.cql(query, [pkValue], function(err, data) {
        if (err) {
          cb(err);
        } else if (data.length) {
          var fetchedAttributes = {};
          data[0].forEach(function(name, value, timestamp, ttl) {
            fetchedAttributes[name] = value;
          });

          var unserializedAttributes = marshallers.unserialize(
            CassandraDatastore.marshaller,
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
  });
}

/**
 * Insert or update a model in cassandra.
 */
CassandraDatastore.prototype.save = function(options, attributes, cb) {
  // Insert the model.
  var self = this;

  // Serialize the attributes before save.
  var serializedAttributes = marshallers.serialize(
    CassandraDatastore.marshaller,
    attributes,
    options.attributes // Use this model option to find the types.
  );

  this.getConnection(function(err) {
    if (err) {
      cb(err);
    } else {
      // Insert the model. Cassandra inserts will also works as updates.
      var keys = _.keys(serializedAttributes);
      var keyText = CassandraDatastore.generateTuple(keys, true);
      var values = _.values(serializedAttributes);
      var placeholder = CassandraDatastore.generatePlaceholder(values.length);

      self.cassandra.cql(
        'INSERT INTO ' + options.table + ' ' + keyText + ' VALUES ' +
        placeholder, values
      , function(err) {
        if (err) {
          cb(err);
        } else {
          self.saveIndexes(options, serializedAttributes, cb);
        }
      });
    }
  });
}

CassandraDatastore.prototype.saveIndexes = function(options, attributes, cb) {
  var self = this;

  this.getConnection(function(err) {
    if (err) {
      cb(err);
    } else {
      var columns = ['attr', 'pk'];
      var columnsText = CassandraDatastore.generateTuple(columns, true);

      async.each(options.indexes, function(index, cb) {
        if (attributes.hasOwnProperty(index)) {
          var indexTable = options.table + '_by_' + index;
          self.cassandra.cql(
            'INSERT INTO ' + indexTable + ' ' + columnsText + ' VALUES ' +
              CassandraDatastore.generatePlaceholder(columns.length),
            [attributes[index], attributes[options.pkAttribute]]
          , cb);
        } else {
          cb();
        }
      }, cb);
    }
  });
}

/**
 * Get the id of model matching the given query.
 */
CassandraDatastore.prototype.find = function(options, query, cb) {
  var self = this;

  // This will support multiple keys with boolean combinators in the future.
  var attribute = _.keys(query)[0];
  var queryValue = query[attribute];

  // Prepend an underscore to the index attribute.
  var indexFamily = options.table + '_by_' + attribute;

  this.getConnection(function(err) {
    if (err) {
      cb(err);
    } else {
      self.cassandra.cql('SELECT pk FROM ' + indexFamily + ' WHERE attr=?', [
        queryValue
      ], function(err, value) {
        if (err) {
          cb(err);
        } else {
          if (value.length === 0) {
            cb(null, null);
          } else {
            var type = options.attributes[attribute].type;
            cb(null, CassandraDatastore.marshaller.unserializers[type](value));
          }
        }
      });
    }
  });
}

CassandraDatastore.prototype.destroy = function(options, cb) {

}

module.exports = {
  RedisDatastore: RedisDatastore,
  CassandraDatastore: CassandraDatastore
};
