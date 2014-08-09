var util = require('util');

var _ = require('lodash');
var async = require('async');

var marshallers = require('../marshallers');
var utils = require('../utils');

var marshaller = _.merge({}, marshallers.JSONMarshaller, {
  serializers: {
    date: utils.serializeIntegerDate,
    // Use the raw boolean value in cassandra.
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

  var nullAttrs = _.filter(_.keys(options.data), function(name) {
    return options.data[name] === null;
  });

  async.series([
    /*function(cb) {
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
    },*/
    function(cb) {
      // Serialize the attributes before save.
      var values = marshallers.serialize(
        marshaller, _.omit(options.data, nullAttrs), options.types
      );

      var keys = _.keys(values);
      var valueList = _.values(values);
      keys.push('id');
      keys = _.map(keys, quote);
      valueList.push(options.id);

      // Save the row data.
      var query = util.format('INSERT INTO %s %s VALUES %s', options.column,
        makeParens(keys), makeParams(valueList.length));
      self._execute(query, valueList, cb);
    },
    function(cb) {
      // Delete any null values.
      if (nullAttrs.length > 0) {
        var query = util.format('DELETE %s FROM %s WHERE id = ?',
          makeNames(_.map(nullAttrs, quote)), options.column);
        self._execute(query, [options.id], cb);
      } else {
        cb();
      }
    }
  ], cb);
};

CassandraDatastore.prototype.fetch = function(options, cb) {
  var self = this;

  async.map(options.ids, function(id, cb) {
    var query = util.format('SELECT %s FROM %s WHERE id IN %s',
      makeNames(_.map(options.attributes, quote)), options.column,
      makeParams(options.ids.length));
    self._execute(query, options.ids, function(err, data) {
      if (err) {return cb(err);}
      if (data.rows.length == 0) {
        cb(null, [id, null]);
      } else {
        var row = data.rows[0];
        var attrs = _.filter(_.keys(row), function(key) {
          return _.contains(options.attributes, key) && !_.isNull(row[key]);
        });
        cb(null, [id, marshallers.unserialize(
          marshaller, _.pick(row, attrs), options.types
        )]);
      }
    });
  }, function(err, data) {
    if (err) {return cb(err);}
    cb(null, _.object(data));
  });
};

CassandraDatastore.prototype.destroy = function(options, cb) {
  var query = util.format('DELETE FROM %s WHERE id IN %s', options.column,
    makeParams(options.ids.length));
  this._execute(query, options.ids, cb);
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
