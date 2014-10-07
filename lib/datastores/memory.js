var _ = require('lodash');

function getCollectionKeys(collection) {
  return [collection.table, collection.modelId, collection.relationName];
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
 * options.table
 * options.index: "indexName"
 * options.value
 * options.types
 */
MemoryDatastore.prototype.find = function(options, cb) {
  var key = [options.table, options.index, options.value];
  cb(null, this._getValue(this.indexes, key) || null);
};

/**
 * Saves a row and its indexes. Updates if the record already exists.
 *
 * options.id:      "value"
 * options.idName:  "id property name"
 * options.table:   "table name"
 * options.data:    {attributeName: value, ...}
 * options.types:   {attributeName: type, ...}
 * options.indexes: [attributeName, ...]
 * options.increments: {attributeName: value, ...}
 * options.replaceIndexValues: {attributeName: value, ...}
 */
MemoryDatastore.prototype.save = function(options, cb) {
  var self = this;

  // Check for duplicate indexes.
  if (_.any(options.indexes, function(index) {
    var key = [options.table, index, options.data[index]];
    return self._getValue(self.indexes, key) !== undefined;
  })) {
    return cb('index already exists');
  }

  // Save the row data.
  var key = [options.table, options.id];
  var storedData = this._getValue(this.data, key);
  if (!storedData) {
    storedData = {};
    this._setValue(this.data, key, storedData)
  }
  _.extend(storedData, options.data);

  // Increment values.
  if (options.increments) {
    _.each(options.increments, function(value, attribute) {
      var data = self._getValue(self.data, key);
      data[attribute] += value;
    });
  }

  // Delete any null values.
  var row = this._getValue(this.data, key);
  _.each(options.data, function(value, name) {
    if (value === null) {delete row[name];}
  });

  // Destroy indexes that are to be replaced.
  _.each(options.replaceIndexValues, function(value, name) {
    var key = [options.table, name, value];
    self._delValue(self.indexes, key);
    // Add the index value to a list of replaced index values for this id.
    var key = [options.table, options.id, name];
    var replacedValues = self._getValue(self.replacedValues, key);
    if (!replacedValues) {
      replacedValues = [];
      self._setValue(self.replacedValues, key, replacedValues);
    }
    replacedValues.push(value);
  });

  // Save the indexes.
  _.each(options.indexes, function(index) {
    var key = [options.table, index, options.data[index]];
    self._setValue(self.indexes, key, options.id);
  });

  cb();
};

/**
 * Fetches a row's attributes by id.
 *
 * options.table
 * options.id
 * options.idName
 * options.attributes: [attributeName, ...]
 * options.types: {attributeName: type, ...}
 */
MemoryDatastore.prototype.fetch = function(options, cb) {
  var data = this._getValue(this.data, [options.table, options.id]);
  if (data) {
    cb(null, _.pick(data, options.attributes));
  } else {
    cb();
  }
};

/**
 * Destroys model and its indexes. The model is destroy from its partitions if
 * it has one.
 *
 * options.table
 * options.id
 * options.idName
 * options.types
 * options.indexValues: {attributeName: attributeValue, ...}
 * # options.destroyIndexes
 */
MemoryDatastore.prototype.destroy = function(options, cb) {
  var self = this;

  // Delete the row data.
  self._delValue(self.data, [options.table, options.id]);

  /*
  // Delete the indexes.
  if (options.indexValues) {
    _.each(options.indexValues.values, function(values, name) {
      if (_.contains(options.indexValues.replaceIndexes, name)) {
        // Add previously replaced index values.
        _.each(options.ids, function(id) {
          var key = [options.table, id, name];
          var replacedValues = self._getValue(self.replacedValues, key);
          values = values.concat(replacedValues);
          self._delValue(self.replacedValues, key);
        });
      }

      // Delete all values.
      _.each(values, function(value) {
        var key = [options.table, name, value];
        self._delValue(self.indexes, key);
      });
    });
  };*/

  cb();
};

/**
 * options.table
 * options.id
 * options.idName
 * options.types
 *
 * options.childRelationName
 * options.instances
 * options.multiTypes
 */
MemoryDatastore.prototype.addToCollection = function(options, cb) {
  /*var data = this._getValue(this.data, getCollectionKeys(collection));

  _.each(values, function(value) {
    if (collection.type === 'zset') {
      data[value.name] = value.score;
    } else {
      data.insert(value, options.index);
    }
  });*/

  cb();
};

/**
 * options.table
 * options.id
 * options.idName
 * options.types
 *
 * options.childRelationName
 * options.limit
 * options.offset
 */
MemoryDatastore.prototype.fetchCollection = function() {

};

MemoryDatastore.prototype.fetchTree = function() {

};


MemoryDatastore.prototype.reset = function(cb) {
  this.data = {};
  this.indexes = {};
  this.replacedValues = {};
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
