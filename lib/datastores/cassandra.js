var util = require('util');

var _ = require('lodash');
var async = require('async');

var marshallers = require('../marshallers');
var utils = require('../utils');

var marshaller = _.merge({}, marshallers.JSONMarshaller, {
  serializers: {
    // Use the raw boolean value in cassandra.
    date: utils.serializeIntegerDate,
    boolean: marshallers.noop
  },
  unserializers: {
    datetime: marshallers.noop,
    date: utils.unserializeIntegerDate
  }
});

function makeParens(values, quote) {
  if (quote) {values = _.map(values, quote);}
  return '(' + values.join(',') + ')';
};

function makeParams(amount) {
  return makeParens(_.times(amount, function() {return '?';}));
};

function makeNames(values) {
  return values.join(',');
}

function quote(text) {
  return '"' + text + '"';
}

/*
CassandraDatastore.generateSetPlaceholder = function(attributes) {
  return _.map(attributes, function(attribute) {
    return addQuotes(attribute) + ' = ?'
  }).join(',');
};
 */

function CassandraDatastore(options) {
  this.client = options.client;
  this.columns = options.columns;
  this.queries = [];
  this.scheduledBatch = false;
  this.schema = {};
}

/**
 * Schema generation methods
 */
CassandraDatastore.prototype.register = function(cf, type, options) {
  if (type === 'cf') {
    this.schema[options.cf] = {};
  } else if (type === 'column') {

  } else if (type === 'index') {
    // pk, v
    // options.column + '_by_' + options.index
  }
  // row key type
  // row key validator (sort?)
  // static columns
  //   name: type
  // dynamic columns
  //   construction: comparator
};

CassandraDatastore.prototype.getSchema = function() {
  return this.schema;
};

/**
 * Datastore implementation methods
 */
CassandraDatastore.prototype.find = function(options, cb) {
  throw new Error('indexes are not yet implemented for CassandraDatastore');
  /*
  var indexFamily = options.column + '_by_' + options.index;
  var query = util.format('SELECT pk FROM %s WHERE v=?', indexFamily);
  this._execute(query, [options.value], function(err, results) {
    if (err) {return cb(err);}
    if (results.rows.length > 0) {
      cb(null, results.rows[0].pk);
    } else {
      cb();
    }
  });*/
};

CassandraDatastore.prototype.save = function(options, cb) {
  var self = this;

  async.series([
    function(cb) {
      // Check for duplicate indexes.
      async.map(options.indexes, function(index, cb) {
        var query = util.format('SELECT KEY FROM %s WHERE %s = ?',
          options.column, index);
        self._execute(query, [options.data[index]], cb);
      }, function(err, results) {
        if (err) {return cb(err);}
        if (_.all(results, _.identity)) {
          cb();
        } else {
          cb('index already exists');
        }
      }, cb);
    },
    function(cb) {
      // Serialize the attributes before save.
      var values = marshallers.serialize(
        marshaller, options.data, options.types
      );

      var keys = _.keys(values);
      var valueList = _.values(values);
      keys.push('id');
      valueList.push(options.id);

      // Save the row data.
      var query = util.format('INSERT INTO %s %s VALUES %s', options.column,
        makeParens(keys), makeParams(valueList.length));
      self._execute(query, valueList, cb);
    },
    function(cb) {
      // Delete any null values.
      var nullAttrs = _.filter(_.keys(options.data), function(name) {
        return options.data[name] === null;
      });
      if (nullAttrs.length > 0) {
        var query = 'DELETE a, b FROM users WHERE KEY = ?';
        console.log(nullAttrs);
        cb();
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

CassandraDatastore.prototype.fetch = function(options, cb) {
  var self = this;

  async.map(options.ids, function(id, cb) {
    var query = util.format('SELECT %s FROM %s WHERE id IN %s',
      makeNames(options.attributes), options.column,
      makeParams(options.ids.length));
    self._execute(query, options.ids, function(err, data) {
      if (err) {return cb(err);}
      console.log(data.rows);
      cb();
    });
  }, cb);

  /*

  this._execute(query, options.attributes, options.ids, function(err, data) {
    if (err) {return cb(err);}
    if (data.length) {
      cb();
    } else {
      // No models found.
      cb();
    }
  });

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
  });*/
};

CassandraDatastore.prototype.destroy = function(options, cb) {
  // Destroy indexes before destroying the model.
  this.fetch(options.indexes, function() {

  });

  var query = util.format('DELETE FROM %s WHERE KEY IN %s', options.column,
    makeParams(options.ids.length));
  this._execute(query, options.ids, function(err) {
    if (err) {return cb(err);}

  });
};

CassandraDatastore.prototype.incr = function(options, cb) {
  var query = util.format('UPDATE %s SET %s = %s + ? WHERE KEY = ?',
    options.column, options.attribute, options.attribute);
  this._execute(query, [options.amount, options.id], cb);
};

CassandraDatastore.prototype.reset = function(cb) {
  var self = this;
  async.each(this.columns, function(column, cb) {
    var query = util.format('TRUNCATE %s;', column);
    self._execute(query, cb);
  }, cb);
};

CassandraDatastore.prototype._saveIndexes = function(options, values, cb) {
  var self = this;
  var columns = makeParens(columns, ['pk', 'v']);

  async.each(options.indexes, function(index, cb) {
    if (_.has(values, index)) {
      var indexFamily = options.column + '_by_' + index;
      var query = utils.format('INSERT INTO %s %s VALUES %s',
        indexFamily, columns, makeParams(2));
      self._execute(query, [values[index], options.id], cb);
    } else {
      cb();
    }
  }, cb);
};

CassandraDatastore.prototype._execute = function() {
  var self = this;
  this.queries.push(_.values(arguments));

  if (!this.scheduledBatch) {
    process.nextTick(function() {
      self._executeQueries(self.queries);
      self.queries = [];
      self.scheduledBatch = false;
    });
    this.scheduledBatch = true;
  }
};

CassandraDatastore.prototype._executeQueries = function(queries) {
  console.log(this.queries);
  if (queries.length > 1) {
    // Execute queries in batch.
    this.client.executeBatch(_.map(queries, function(query) {
      return {query: query[0], params: query[1]};
    }), function(err, results) {
      _.each(queries, function(query, i) {
        var cb = _.last(query);
        if (err) {return cb(err);}
        cb(null, results[i])
      });
    });
  } else {
    // Execute single query.
    var query = queries[0];
    this.client.execute.apply(this.client, query);
  }
};

module.exports = CassandraDatastore;
