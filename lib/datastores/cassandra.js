var util = require('util');

var _ = require('lodash');
var _s = require('underscore.string')
var async = require('async');

var marshallers = require('../marshallers');
var utils = require('../utils');

var CassandraMarshaller = _.merge({}, marshallers.JSONMarshaller, {
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

var marshaller = marshallers.createInstance(CassandraMarshaller);
var serialize = marshaller.serialize;

function serialize(value, types, name) {
  // `types` can be a {name: type} object or a string.
  var type = types;
  if (_.isString(name)) {
    var type = types[name]
  }
  return marshaller.serializers[type](value)
}

function makeParens(values, quote) {
  if (quote) {values = _.map(values, _s.quote);}
  return '(' + values.join(',') + ')';
};

function makeParams(amount) {
  return makeParens(_.times(amount, function() {return '?';}));
};

function makeNames(values) {
  return values.join(',');
}

function CassandraDatastore(options) {
  this.client = options.client;
  this.tables = options.tables;
  this.schema = {};
  this._resetQueries();
}

// Schema generation methods

CassandraDatastore.prototype.register = function(cf, type, options) {
  /*
  if (type === 'cf') {
    this.schema[options.cf] = {};
  } else if (type === 'column') {

  } else if (type === 'index') {
    // pk, v
    // options.table + '_by_' + options.index
  }
  // row key type
  // row key validator (sort?)
  // static columns
  //   name: type
  // dynamic columns
  //   construction: comparator
  */
};

CassandraDatastore.prototype.getSchema = function() {
  return this.schema;
};

// Datastore implementation methods

CassandraDatastore.prototype.find = function(options, cb) {
  throw new Error('indexes are not yet implemented for CassandraDatastore');
  /*
  var indexFamily = options.table + '_by_' + options.index;
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

  var idValue = serialize(options.id, options.types, options.idName);
  var nullAttrs = _.filter(_.keys(options.data), function(name) {
    return options.data[name] === null;
  });

  async.parallel([
    /*function(cb) {
      // Check for duplicate indexes.
      async.map(options.indexes, function(index, cb) {
        var query = util.format('SELECT KEY FROM %s WHERE %s = ?',
          options.table, index);
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
      if (!options.data) {return cb();}

      // Serialize the attributes before save.
      var data = marshaller.serializeData(
        _.omit(options.data, nullAttrs), options.types
      );

      if (_.isEmpty(data)) {return cb();}

      var queryValues = _.zip(_.map(_.keys(data), function(attribute) {
        var value = data[attribute];
        return [_s.quote(attribute) + ' = ?', value];
      }));

      // Save the row data.
      var query = util.format('UPDATE "%s" SET %s WHERE id = ?', options.table,
        queryValues[0].join(','));
      self._execute(query, queryValues[1].concat([idValue]), cb);
    },
    function(cb) {
      if (nullAttrs.length === 0) {return cb();}

      // Delete any null values.
      var query = util.format('DELETE %s FROM "%s" WHERE id = ?',
        makeNames(_.map(nullAttrs, _s.quote)), options.table);
      self._execute(query, [idValue], cb);
    }
  ], cb);
};

CassandraDatastore.prototype.fetch = function(options, cb) {
  /*
    id: options.id,
    table: options.table,
    attributes: options.attributes,
    types: options.types
   */

  var idValue = marshaller.serialize(options.id, options.types, options.idName);

  // TDOO: uncomment for absense test.
  // ids = ["random"].concat(ids);

  var query = util.format('SELECT %s FROM "%s" WHERE id = ?',
    makeNames(_.map(options.attributes, _s.quote)), options.table);

  // Execute as standalone query since Cassandra does not support batching
  // SELECT statements.
  this.client.execute(query, [idValue], {prepare: true}, function(err, res) {
    if (err) {return cb(err);}
    if (res.rows.length === 0) {
      cb();
    } else {
      var row = res.rows[0];
      // Remove null values.
      var rawData = _.pick(row, options.attributes);
      var data =_.transform(rawData, function(res, v, k) {
        if (v !== null) {
          res[k] = v
        };
      });

      cb(null,  marshaller.unserializeData(data, options.types));
    }
  });
};

CassandraDatastore.prototype.destroy = function(options, cb) {
  /*
    id: options.id, table: options.table
   */
  this._queries.destroy.push({options: options, cb: cb});
  this._handleQueries();
};

CassandraDatastore.prototype.reset = function(cb) {
  var self = this;
  async.each(this.tables, function(table, cb) {
    var query = util.format('TRUNCATE "%s"', table);
    self.client.execute(query, cb);
  }, cb);
};

CassandraDatastore.prototype._handleQueries = function() {
  // Only schedule query execution if not done so already.
  if (!this._willHandleQueries) {
    this._willHandleQueries = true;
    process.nextTick(this._executeQueries.bind(this));
  }
};

CassandraDatastore.prototype._executeQueries = function() {
  // Execute the queued queries in batch.

  // Include base queries.
  var baseQueries = this._queries.base;

  // Group destroy queries by table name.
  var destroyQueries = _.map(_.groupBy(this._queries.destroy, function(query) {
    return query.options.table;
  }), function(queries, table) {
    var ids = _.map(queries, function(query) {
      return serialize(query.options.id, query.options.types, query.options.idName);
    });

    return {
      query: util.format('DELETE FROM "%s" WHERE id IN %s', table, makeParams(ids.length)),
      params: ids,
      cb: function(err) {
        _.each(queries, function(query) {query.cb(err);});
      }
    };
  });

  this._sendQueries(this._queries.base.concat(destroyQueries));
  this._resetQueries();
};

CassandraDatastore.prototype._sendQueries = function(queries) {
  // TODO: batch queries when using batching prepared queries is supported
  /*
  if (queries.length > 1) {
    // Execute queries in batch.
    this.client.batch(queries, function(err, results) {
      _.each(queries, function(query, i) {
        if (err) {return query.cb(err);}
        query.cb(null, results[i]);
      });
    });
  } else {
    // Execute single query.
    var query = queries[0];
    this.client.execute(query.query, query.params, {prepare: true}, query.cb);
  }
  */
  var self = this;
  _.each(queries, function(query) {
    self.client.execute(query.query, query.params, {prepare: true}, query.cb);
  });
};

CassandraDatastore.prototype._resetQueries = function() {
  this._queries = {base: [], destroy: []};
  this._willHandleQueries = false;
};

/*
CassandraDatastore.prototype._saveIndexes = function(options, values, cb) {
  var self = this;
  var columns = makeParens(columns, ['pk', 'v']);

  async.each(options.indexes, function(index, cb) {
    if (_.has(values, index)) {
      var indexFamily = options.table + '_by_' + index;
      var query = utils.format('INSERT INTO "%s" %s VALUES %s',
        indexFamily, columns, makeParams(2));
      self._execute(query, [values[index], options.id], {prepare: true}, cb);
    } else {
      cb();
    }
  }, cb);
};
*/

CassandraDatastore.prototype._execute = function(query, params, cb) {
  // `params` is optional.
  if (_.isFunction(params)) {
    cb = params;
    params = null;
  }
  this._queries.base.push({query: query, params: params, cb: cb});
  this._handleQueries();
};

module.exports = CassandraDatastore;
