var _ = require('lodash');

function getCollectionKeys(collection) {
  return [collection.column, collection.modelId, collection.relationName];
}

function MemoryDatastore() {
  this.reset();
}

/**
 * Datastore implementation methods
 */

/**
 * Finds a model's id from an index property.
 *
 * options.column
 * options.index
 * options.value
 */
MemoryDatastore.prototype.find = function(options, cb) {
  var key = [options.column, options.index, options.value];
  cb(null, this._getValue(this.indexes, key));
};

/**
 * Saves a row and its indexes. Updates if the record already exists.
 *
 * options.id:      "value"
 * options.column:  "columnName"
 * options.data:  {attributeName: value, ...}
 * options.types:   {attributeName: type, ...}
 * options.indexes: [attributeName, ...]
 * options.replaceIndexValues: {attributeName: value, ...}
 */
MemoryDatastore.prototype.save = function(options, cb) {
  var self = this;

  // Save the row data.
  var key = [options.column, options.id];
  this._setValue(this.data, key, options.data);

  // Delete any null values.
  var row = this._getValue(this.data, key);
  _.each(options.data, function(value, name) {
    if (value === null) {delete row[name];}
  });

  // Destroy indexes that are to be replaced.
  _.each(options.replaceIndexValues, function(value, name) {
    var key = [options.column, name, value];
    self._delValue(self.indexes, key);
  });

  // Save the indexes.
  _.each(options.indexes, function(index) {
    var key = [options.column, index, options.data[index]];
    self._setValue(self.indexes, key, options.id);
  });

  cb();
};

/**
 * Fetches a row's attributes by id.
 *
 * options.column
 * options.ids
 * options.attributes: [attributeName, ...]
 * options.types: {attributeName: type, ...}
 */
MemoryDatastore.prototype.fetch = function(options, cb) {
  var self = this;
  cb(null, _.object(_.map(options.ids, function(id) {
    var data = self._getValue(self.data, [options.column, id]);
    if (data) {
      return [id, _.pick(data, options.attributes)];
    } else {
      return [id, null];
    }
  })));
};

/**
 * Destroys model and its indexes. The model is destroy from its partitions if
 * it has one.
 *
 * options.column
 * options.ids
 * options.indexes: {attributeName: attributeValue, ...}
 * options.destroyIndexes
 */
MemoryDatastore.prototype.destroy = function(options, cb) {
  if (options.destroyIndexes) {

  }

  var _this = this;

  // Delete the row data.
  this._deleteValue(this.data, [options.column, options.id]);

  // Delete the indexes.
  _.each(options.indexes, function(value, name) {
    _this._deleteValue(_this.indexes, [_this.column, name, value]);
  });

  cb();
};

/**
 * Increments a row attribute by `options.amount`. `options.amount` can be
 * negative.
 *
 * options.column
 * options.id
 * options.attribute
 * options.amount
 *
 * @param  {[type]}   options [description]
 * @param  {Function} cb      [description]
 * @return {[type]}           [description]
 */
MemoryDatastore.prototype.incr = function(options, cb) {
  var data = this._getValue(this.data, [options.column, options.id]);
  data[options.attribute] += options.amount;
  cb();
}

/**
 * collection.column
 * collection.id
 * collection.relationName
 * collection.type
 *
 * @param  {[type]}   options [description]
 * @param  {Function} cb      [description]
 * @return {[type]}           [description]
 */
MemoryDatastore.prototype.getCollectionSize = function(collection, cb) {
  var data = this._getValue(this.data, getCollectionKeys(collection));
  cb(null, (collection.type === 'zset' ? _.size(data) : data.length));
};

/**
 * collection.column
 * collection.id
 * collection.relationName
 * collection.type: {'list', 'set', 'zset'}
 * collection.scoreType: optional for `zset`
 * @param  {[type]}   option [description]
 * @param  {Function} cb     [description]
 * @return {[type]}          [description]
 */
MemoryDatastore.prototype.createCollection = function(collection, cb) {
  // Use the right data structure for the collection.
  var initialCollection = [];
  if (collection.type === 'zset') {
    initialCollection = {};
  }

  // Set the initial collection.
  this._setValue(this.data, getCollectionKeys(collection), initialCollection);

  cb();
};

/**
 * options.column
 * options.id
 * options.attribute
 * @return {[type]} [description]
 */
MemoryDatastore.prototype.destroyCollection = function(collection, cb) {
  // Delete the collection.
  this._deleteValue(this.data, getCollectionKeys(collection));
};

/**
 * options.column
 * options.id
 * options.attribute
 * options.type
 * options.scoreType: optional
 * @param {[type]}   options [description]
 * @param {Function} cb      [description]
 */
MemoryDatastore.prototype.addToCollection = function(collection, values, cb) {
  var data = this._getValue(this.data, getCollectionKeys(collection));

  _.each(values, function(value) {
    if (collection.type === 'zset') {
      data[value.name] = value.score;
    } else {
      data.insert(value, options.index);
    }
  });

  cb();
};

MemoryDatastore.prototype.removeFromCollection = function(collection, values, cb) {
  var data = this._getValue(this.data, getCollectionKeys(collection));

  _.each(value, function(value) {
    if (collection.type === 'zset') {
      delete data[value];
    } else {
      data.splice(_.indexOf(data, value), 1);
    }
  });

  cb();
};

MemoryDatastore.prototype.isMember = function(collection, value, cb) {
  var data = this._getValue(this.data, getCollectionKeys(collection));
  var values = (collection.type === 'zset') ? _.values(data) : data;
  cb(null, _.contains(values, value));
};

MemoryDatastore.prototype.reset = function(cb) {
  this.data = {};
  this.indexes = {};
  if (cb) {cb();}
};

MemoryDatastore.prototype._getValue = function(object, keys) {
  return _.reduce(keys, function(object, key) {
    return (object || {})[key];
  }, object);
};

MemoryDatastore.prototype._setValue = function(object, keys, value) {
  var lastKey = _.last(keys);
  var keys = _.initial(keys);
  _.reduce(keys, function(object, key) {
    if (!object[key]) {
      object[key] = {};
    }
    return object[key];
  }, object)[lastKey] = value;
};

MemoryDatastore.prototype._delValue = function(object, keys) {
  var lastKey = _.last(keys);
  var keys = _.initial(keys);
  delete _.reduce(keys, function(object, key) {
    return object[key];
  }, object)[lastKey];
};

module.exports = MemoryDatastore;
