function MemoryHashStore() {
  this._resetData();
}

MemoryHashStore.prototype.save = function(key, values, cb) {
  // Delete null values from this._data
  var data = {};
  this._data[keyspace + ':' + id] = 0;
  cb();
};

MemoryHashStore.prototype.fetch = function(key, attributes, cb) {
  cb(null, _.pick(this._data[getKey(key)], attributes));
};

MemoryHashStore.prototype.fetch = function(key, attributes, cb) {
  cb(null, _.pick(this._data[getKey(key)], attributes));
};

MemoryHashStore.prototype.reset = function(cb) {
  this._resetData();
  cb();
};

MemoryHashStore.prototype._resetData = function() {
  this._data = {};
};

function getIndexKey(options) {
  return [
    options.keyspace,
    options.attributeName,
    options.attributeValue
  ].join(':');
}

function MemoryIndexStore() {
  this._resetData();
}

MemoryIndexStore.prototype.get = function(options, cb) {
  cb(null, this._data[getIndexKey(options)] || null);
};

MemoryIndexStore.prototype.set = function(options, cb) {
  var key = getIndexKey(options);
  var exists = (key in this._data);
  if (!exists) {
    this._data[getIndexKey(options)] = options.id;
  }
  cb(null, exists);
};

MemoryIndexStore.prototype.del = function(options, cb) {
  delete this._data[getIndexKey(options)];
  cb();
};

MemoryIndexStore.prototype.reset = function(cb) {
  this._resetData();
  cb();
};

MemoryIndexStore.prototype._resetData = function() {
  this._data = {};
};

/*
MemoryIndexStore.prototype.incr = function(key, attribute, amount, cb) {
  var valueKey = getKey(key);
  if (!_.has(this._data, valueKey)) {
    this._data[valueKey] = 0;
  }
  this._data[valueKey] += amount;
  cb();
};*/

/*
function MemoryCollectionStore() {
  this._data = {};
}

MemoryCollectionStore.prototype.add = function(key, id, cb) {
  // add element (single/multi type, id value) to key
  this._data[getKey(key)] = this._data[getKey(key)] || [];
  this._data[getKey(key)].push(value);
  cb();
};

MemoryCollectionStore.prototype.fetch = function(options, cb) {
  // fetch range
};
*/

module.exports = {
  MemoryHashStore: MemoryHashStore,
  MemoryIndexStore: MemoryIndexStore
  // MemoryCollectionStore: MemoryCollectionStore
};
