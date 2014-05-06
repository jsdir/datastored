var _ = require('lodash');
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
  return value.getUTCFullYear() * 16 * 32
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

function RedisDatastore(ormOptions, modelOptions) {
  this.redis = ormOptions.redis;
  this.keyspace = ormOptions.redisKeyspace;
  this.options = modelOptions;
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
RedisDatastore.prototype.fetch = function(pkValue, attributes, cb) {

  var key = this.getKey(this.options.table, pkValue);
  var options = this.options;

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
      cb();
    }
  });
}

/**
 * Insert or update a model in redis.
 * @param  {Object}   attributes
 */
RedisDatastore.prototype.save = function(attributes, cb) {
  // Update or insert the model.
  var table = this.options.table;
  var pkAttribute = this.options.pkAttribute;
  // Remove the primary key from the attributes.
  var key = this.getKey(table, attributes[pkAttribute]);

  // Serialize the attributes before save.
  var serializedAttributes = marshallers.serialize(
    RedisDatastore.marshaller,
    attributes,
    this.options.attributes // Use this model option to find the types.
  );
  //delete attributes[pkAttribute];
  this.redis.hmset(key, serializedAttributes, function(err) {
    cb(err, null);
  });
}

/**
 * Returns the id of model matching the given query.
 */
RedisDatastore.prototype.getFromIndex = function(table, scope, query, cb) {
  // This will support multiple keys with boolean combinators in the future.
  var attribute = _.keys(query)[0];
  var queryValue = query[attribute];

  // key: prefix:_table:index:value
  // Prepend an underscore to the index attribute.
  var key = this.getKey('_' + table, attribute, queryValue);
  this.redis.get(key, cb);
};

/**
 * CassandraDatastore
 */

function CassandraDatastore(ormOptions, modelOptions) {
  this.cassandra = ormOptions.cassandra;
  this.options = modelOptions;
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

CassandraDatastore.generateTuple = function(values) {
  return '(' + values.join(',') + ')';
}

CassandraDatastore.generatePlaceholder = function(n) {
  return CassandraDatastore.generateTuple(
    _.times(n, function() {return '?';})
  );
}

CassandraDatastore.generateSetPlaceholder = function(attributes) {
  return _.map(attributes, function(attribute) {
    return '"' + attribute + '" = ?'
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
CassandraDatastore.prototype.fetch = function(pkValue, attributes, cb) {
  var self = this;
  var options = this.options;
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
        } else if (data) {
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
          cb();
        }
      });
    }
  });
}

/**
 * Insert or update a model in cassandra.
 */
CassandraDatastore.prototype.save = function(attributes, cb) {
  // Insert the model.
  var self = this;
  var table = this.options.table;
  var pkAttribute = this.options.pkAttribute;
  //var val = attributes[pkAttribute];
  //delete attributes[pkAttribute];

  // Serialize the attributes before save.
  var serializedAttributes = marshallers.serialize(
    CassandraDatastore.marshaller,
    attributes,
    this.options.attributes // Use this model option to find the types.
  );

  this.getConnection(function(err) {
    if (err) {
      cb(err);
    } else {
      // Insert the model. Cassandra inserts will also works as updates.
      var keys = CassandraDatastore.generateTuple(_.keys(serializedAttributes));
      var values = _.values(serializedAttributes);
      var placeholder = CassandraDatastore.generatePlaceholder(values.length);

      self.cassandra.cql(
        'INSERT INTO ' + table + keys + 'VALUES ' + placeholder, values
      , cb);
    }
  });
}

/**
 * Get the id of model matching the given query.
 */
CassandraDatastore.prototype.getFromIndex = function(table, query, cb) {
  // This will support multiple keys with boolean combinators in the future.
  var attribute = _.keys(query)[0];
  var queryValue = query[attribute];

  // Prepend an underscore to the index attribute.
  var indexFamily = '_' + table;

  this.cassandra.cql('SELECT id FROM ? WHERE ? = ?', [
    indexFamily, attribute, queryValue
  ], cb);
};

module.exports = {
  RedisDatastore: RedisDatastore,
  CassandraDatastore: CassandraDatastore
};
