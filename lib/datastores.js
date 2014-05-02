var _ = require('lodash');
var databases = require('./databases');
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
  // Unpack three-byte integer as a Date.
  var day = value % 32;
  value -= day;
  var month = (value % dateFactor) / 32;
  value -= month;
  var year = value / dateFactor;
  return new Date(year, month, day);
}


function Datastore() {}


/**
 * RedisDatastore
 */

function RedisDatastore(options) {
  this.options = options;
}

RedisDatastore.marshaller = _.merge(marshallers.JSONMarshaller, {
  serializers: {
    boolean: function(value) {return value ? 1 : 0},
    datetime: function(value) {return value.getTime()},
    date: serializeIntegerDate
  },
  unserializers: {
    date: unserializeIntegerDate
  }
});

/**
 * Construct a redis key from the given parameters.
 */
RedisDatastore.getKey = function() {
  var parts = [this.options.prefix].concat(_.values(arguments));
  // Delimit the arguments with a colon.
  return parts.join(':');
}

/**
 * Fetch from redis.
 */
RedisDatastore.prototype.fetch = function(
  family, pkAttribute, pkValue, attributes, cb
) {
  // pkValue, attributes, cb
  var key = RedisDatastore.getKey(family, pkValue);
  databases.redis.hmget(key, attributes, function(err, values) {
    if (err) {cb(err);} else {
      if (values) {
        // Create attribute object from attributes and the fetched values.
        cb(null, _.object(_.zip(attributes, values)));
      } else {
        cb(null, null);
      }
    }
  });
}

/**
 * Insert or update a model in redis.
 * @param  {String}   family Column family to use
 * @param  {String}   pkAttribute The attribute to use as the primary key on insert
 * @param  {Object}   attributes
 */
RedisDatastore.prototype.save = function(family, pkAttribute, attributes, cb) {
  // Update or insert the model.
  // Remove the primary key from the attributes.
  var key = RedisDatastore.getKey(family, attributes[pkAttribute]);
  delete attributes[pkAttribute];
  databases.redis.hmset(key, attributes, function(err) {
    cb(err, null);
  });
}

/**
 * Returns the id of model matching the given query.
 */
RedisDatastore.prototype.getFromIndex = function(family, scope, query, cb) {
  // This will support multiple keys with boolean combinators in the future.
  var attribute = _.keys(query)[0];
  var queryValue = query[attribute];

  // key: prefix:_family:index:value
  // Prepend an underscore to the index attribute.
  var key = this.getKey('_' + family, attribute, queryValue);
  this.redis.get(key, cb);
};


/**
 * CassandraDatastore
 */

function CassandraDatastore(options) {
  this.options = options;
}

CassandraDatastore.cassandra = databases.cassandra;

CassandraDatastore.marshaller = _.merge(marshallers.JSONMarshaller, {
  serializers: {
    // Use the raw boolean value in cassandra.
    boolean: marshallers.noop,
    datetime: marshallers.noop,
    date: serializeIntegerDate
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

CassandraDatastore.generateSetPlaceholder = function(n) {
  return _.times(n, function() {return '? = ?';}).join(', ');
}

/**
 * Fetch from cassandra.
 */
CassandraDatastore.prototype.fetch = function(
  family, pkAttribute, pkValue, attributes, cb
) {
  databases.cassandra.connect(function(err) {
    if (err) {
      cb(err);
    } else {
      databases.cassandra.cql('SELECT ' + attributes.join(',')
        + ' FROM ' + family + ' WHERE ' + pkAttribute + ' = ?', [pkValue]
      , cb);
    }
  });
}

/**
 * Insert or update a model in cassandra.
 * @param  {[String]}   family      Column family to use
 * @param  {[String]}   pkAttribute The attribute to use as the primary key on
 *                                  insert
 * @param  {[Object]}   attributes
 */
CassandraDatastore.prototype.save = function(
  family, pkAttribute, attributes, cb
) {
  /*CassandraDatastore.cassandra.on('error', function(err) {
    console.error(err.stack);
  });*/
  databases.cassandra.connect(function(err) {
    if (pkAttribute) {
      // Update the model.
      var pairs = _.pairs(attributes);
      var placeholder = CassandraDatastore.generateSetPlaceholder(pairs.length);
      databases.cassandra.cql(
        'UPDATE ' + family + ' SET ' + placeholder + ' WHERE ? = ?',
        [family]
          .concat(_.flatten(pairs))
          .concat([pkAttribute, attributes[pkAttribute]])
      , function(err) {
        cb(err, null);
      });
    } else {
      // Insert the model.
      var keys = CassandraDatastore.generateTuple(_.keys(attributes));
      var values = _.values(attributes);
      var placeholder = CassandraDatastore.generatePlaceholder(values.length);

      databases.cassandra.cql(
        'INSERT INTO ' + family + keys + 'VALUES ' + placeholder,
        values
      , cb);
    }
  });
}

/**
 * Get the id of model matching the given query.
 */
CassandraDatastore.prototype.getFromIndex = function(family, query, cb) {
  // This will support multiple keys with boolean combinators in the future.
  var attribute = _.keys(query)[0];
  var queryValue = query[attribute];

  // Prepend an underscore to the index attribute.
  var indexFamily = '_' + family;

  databases.cassandra.cql('SELECT id FROM ? WHERE ? = ?', [
    indexFamily, attribute, queryValue
  ], cb);
};

module.exports = {
  RedisDatastore: RedisDatastore,
  CassandraDatastore: CassandraDatastore
};
