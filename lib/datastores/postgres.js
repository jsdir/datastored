var util = require('util');

var _ = require('lodash');
var msgpack = require('msgpack');

var utils = require('../utils');

function PostgresStore(client, options) {
  this.client = client;
  this.options = _.default(options, {table: 'instances'});
}

PostgresStore.prototype.reset = function(cb) {
  this.client.query('TRUNCATE *', cb);
};

/**
 * PostgresHashStore
 */

function PostgresHashStore() {
  PostgresHashStore.super_.apply(this, arguments);
}

util.inherits(PostgresHashStore, PostgresStore);

PostgresHashStore.prototype.save = function(options, cb) {
  // If the instance already exists, update it.
  this._fetch(options, function(err, data) {
    if (err) {return cb(err);}
    var existingData = data || {};
    var bodyData = utils.updateHash(existingData, options.data);
    var body = msgpack.pack(bodyData);
    var query = util.format('INSERT INTO %s (id, body) VALUES ($1, $2)',
      this.options.table);
    var values = [options.id, body];
    this.client.query(query, values, cb);
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
  var query = util.format('SELECT body FROM %s WHERE id = $1',
    this.options.table);
  var values = [options.id];
  this.client.query(query, values, function(err, res) {
    if (err) {return cb(err);}
    if (result.rows.length === 0) {
      // No hash was found.
      return cb(null, null);
    }

    cb(null, msgpack.unpack(result.rows[0].body));
  });
};

exports.PostgresHashStore = PostgresHashStore;
