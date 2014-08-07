var util = require('util');

var _ = require('lodash');
var _s = require('underscore.string')
var async = require('async');

var marshallers = require('../marshallers');
var utils = require('../utils.js');

var marshaller = _.merge({}, marshallers.BasicMarshaller, {
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
  if (quote) {values = _.map(values, _s.quote);}
  return '(' + values.join(',') + ')';
};

function makeParams(amount) {
  return makeParens(_.times(amount, function() {return '?';}));
};

/*
CassandraDatastore.generateSetPlaceholder = function(attributes) {
  return _.map(attributes, function(attribute) {
    return addQuotes(attribute) + ' = ?'
  }).join(',');
};
 */

function CassandraDatastore(options) {
  this.client = options.client;
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
  var indexFamily = options.column + '_by_' + options.index;
  var query = util.format('SELECT pk FROM %s WHERE v=?', indexFamily);
  this._execute(query, [options.value], function(err, results) {
    if (err) {return cb(err);}
    if (results.rows.length > 0) {
      cb(null, results.rows[0].pk);
    } else {
      cb();
    }
  });
};

CassandraDatastore.prototype.save = function(options, cb) {
  var self = this;

  // Serialize the attributes before save.
  var values = marshallers.serialize(
    marshaller, options.values, options.types
  );

  var keys = _.keys(values);
  var valueList = _.values(values);

  // Insert the model. Cassandra inserts will also works as updates.
  var query = util.format('INSERT INTO %s %s VALUES %s',
    options.column, makeParens(keys), makeParams(valueList.length));

  this._execute(query, valueList, function(err) {
    if (err) {return cb(err);}
    self._saveIndexes(options, values, cb);
  });
};

CassandraDatastore.prototype.fetch = function(options, cb) {
  var self = this;
  var query = 'SELECT ' + _.map(attributes, function(name) {
    return '"' + name + '"';
  }).join(',') + ' FROM ' + options.table + ' WHERE ' + options.pkAttribute +
    ' = ?';

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

CassandraDatastore._execute = function() {
  var self = this;
  this.queries.push(_.values(arguments));

  if (!scheduledBatch) {
    process.nextTick(function() {
      self._executeQueries(self.queries);
    });
    this.scheduledBatch = true;
  }
};

CassandraDatastore._executeQueries = function(queries) {
  if (queries.length > 1) {
    // Execute queries in batch.
    this.client.executeBatch(_.map(queries, function(query) {
      return {query: query[0], params: query[1]};
    }), function(err, results) {
      _.each(queries, function(query, i) {
        var cb = _.last(query);
        if (err) {
          cb(err);
        } else {
          cb(null, results[i])
        }
      });
    });
  } else {
    // Execute single query.
    var query = queries[0];
    this.client.execute.apply(this.client.execute, query);
  }
};

module.exports = CassandraDatastore;
