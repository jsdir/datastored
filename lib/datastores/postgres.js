var util = require('util');

var _ = require('lodash');
var msgpack = require('msgpack');

var utils = require('../utils');
var marshallers = require('../marshallers');

function PostgresStore(client, options) {
  this.client = client;
  this.options = _.extend({}, {table: 'instances'}, options);
}

PostgresStore.prototype.reset = function(cb) {
  this.client.query(util.format('TRUNCATE %s;', this.options.table), cb);
};

/**
 * PostgresHashStore
 */

function PostgresHashStore() {
  PostgresHashStore.super_.apply(this, arguments);
}

util.inherits(PostgresHashStore, PostgresStore);

PostgresHashStore.prototype.save = function(options, cb) {
  var self = this;
  // If the instance already exists, update it.
  this._fetch(options, function(err, data) {
    if (err) {return cb(err);}
    var existingData = data || {};
    var optionsData = options.data;

    // Initialize counters to 0 if inserting.
    if (options.insert) {
      _.each(options.counters, function(counter) {
        optionsData[counter] = 0;
      });
    } else {
      // Increment counters if requested.
      _.extend(optionsData, _.mapValues(options.incr, function(value, name) {
        return optionsData[name] + value;
      }));
    }

    var hashData = utils.updateHash(existingData, optionsData);
    var serializedBody = marshallers.serializeData(
      marshallers.JSONMarshaller,
      options.types,
      hashData.data
    );
    var body = msgpack.pack(serializedBody);
    var query;
    if (options.insert) {
      // Insert
      query = util.format('INSERT INTO %s (body, id) VALUES ($1, $2);',
        self.options.table);
    } else {
      // Update
      query = util.format('UPDATE %s SET body = $1 WHERE id = $2;',
        self.options.table);
    }
    var values = [body, utils.serializeId(options.id)];
    self.client.query(query, values, cb);
  });
};

PostgresHashStore.prototype.fetch = function(options, cb) {
  this._fetch(options, function(err, data) {
    if (err) {return cb(err);}
    if (data) {
      return cb(null, _.pick(data, options.attributes));
    }
    cb(null, null);
  });
};

PostgresHashStore.prototype._fetch = function(options, cb) {
  var query = util.format('SELECT body FROM %s WHERE id = $1;',
    this.options.table);
  var values = [utils.serializeId(options.id)];
  this.client.query(query, values, function(err, result) {
    if (err) {return cb(err);}
    if (result.rows.length === 0) {
      // No hash was found.
      return cb(null, null);
    }

    var serializedBody = msgpack.unpack(result.rows[0].body);
    var body = marshallers.unserializeData(
      marshallers.JSONMarshaller,
      options.types,
      serializedBody
    ).data;
    cb(null, body);
  });
};

exports.PostgresHashStore = PostgresHashStore;
