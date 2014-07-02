var _ = require('lodash');
var async = require('async');
var marshallers = require('./marshallers');

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

module.exports = CassandraDatastore;
