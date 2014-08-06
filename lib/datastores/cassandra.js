var _ = require('lodash');
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
  /*
  options.column
  options.index
  options.value
  */
  var indexFamily = options.column + '_by_' + options.index;

  this._execute('SELECT pk FROM ' + indexFamily + ' WHERE v=?', [
    options.value
  ], function(err, results) {
    if (err) {return cb(err);}
    if (results.rows.length > 0) {
      cb(null, results.rows[0].pk);
    } else {
      cb();
    }
  });
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

CassandraDatastore.generateTuple = function(values, quote) {
  if (quote) {
    var values = _.map(values, addQuotes);
  }
  return '(' + values.join(',') + ')';
};

CassandraDatastore.generatePlaceholder = function(n) {
  return CassandraDatastore.generateTuple(
    _.times(n, function() {return '?';})
  );
};

CassandraDatastore.generateSetPlaceholder = function(attributes) {
  return _.map(attributes, function(attribute) {
    return addQuotes(attribute) + ' = ?'
  }).join(',');
};

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
};

CassandraDatastore.prototype.saveIndexes = function(options, attributes, cb) {
  var self = this;

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
};

CassandraDatastore.prototype.destroy = function(options, cb) {

};

module.exports = CassandraDatastore;
