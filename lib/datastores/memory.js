var util = require('util');

var _ = require('lodash');

var utils = require('../utils');

function MemoryStore() {
  this._resetData();
}

MemoryStore.prototype.reset = function(cb) {
  this._resetData();
  cb();
};

MemoryStore.prototype._resetData = function() {
  this._data = {};
};

/**
 * MemoryHashStore
 */

function MemoryHashStore() {
  MemoryHashStore.super_.apply(this, arguments);
}

util.inherits(MemoryHashStore, MemoryStore);

MemoryHashStore.prototype.save = function(options, cb) {
  var key = utils.getHashKey(options);
  var existingData = this._data[key] || {};
  this._data[key] = utils.updateHash(existingData, options.data).data;
  cb();
};

MemoryHashStore.prototype.fetch = function(options, cb) {
  var key = utils.getHashKey(options);
  var data = this._data[key];
  if (data) {
    return cb(null, _.pick(data, options.attributes));
  }
  cb(null, null);
};

exports.MemoryHashStore = MemoryHashStore;

/**
 * MemoryIndexStore
 */

function MemoryIndexStore() {
  MemoryIndexStore.super_.apply(this, arguments);
}

util.inherits(MemoryIndexStore, MemoryStore);

MemoryIndexStore.prototype.get = function(options, cb) {
  var key = utils.getIndexKey(options);
  cb(null, this._data[key] || null);
};

MemoryIndexStore.prototype.set = function(options, cb) {
  var key = utils.getIndexKey(options);
  var exists = (key in this._data);
  if (!exists) {
    this._data[key] = options.id;
  }
  cb(null, exists);
};

MemoryIndexStore.prototype.del = function(options, cb) {
  var key = utils.getIndexKey(options);
  delete this._data[key];
  cb();
};

exports.MemoryIndexStore = MemoryIndexStore;

/*
MemoryIndexStore.prototype.incr = function(key, attribute, amount, cb) {
  var valueKey = getKey(key);
  if (!_.has(this._data, valueKey)) {
    this._data[valueKey] = 0;
  }
  this._data[valueKey] += amount;
  cb();
};
*/
