function getKey(key) {
  return key.join(':');
}

function MemoryHashStore() {
  this._data = {};
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

function MemoryIndexStore() {
  this._data = {};
}

MemoryIndexStore.prototype.get = function(key, cb) {
  cb(null, this._data[getKey(key)]);
};

MemoryIndexStore.prototype.set = function(key, typedValue, cb) {
  this._data[getKey(key)] = typedValue.value;
  cb();
};

MemoryIndexStore.prototype.incr = function(key, attribute, amount, cb) {
  var valueKey = getKey(key);
  if (!_.has(this._data, valueKey)) {
    this._data[valueKey] = 0;
  }
  this._data[valueKey] += amount;
  cb();
};

MemoryIndexStore.prototype.del = function(key, cb) {
  delete this._data[getKey(key)];
  cb();
};

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

module.exports = {
  MemoryHashStore: MemoryHashStore,
  MemoryIndexStore: MemoryIndexStore,
  MemoryCollectionStore: MemoryCollectionStore
};
