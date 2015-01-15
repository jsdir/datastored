var _ = require('lodash');
var async = require('async');
var RSVP = require('rsvp');

var utils = require('./utils');

function parseAttributeRequest(attributes) {
  if (_.isString(attributes)) {
    attributes = [attributes]
  }

  if (_.isArray(attributes)) {
    attributes = utils.mapObjectValue(attributes, true);
  }

  return attributes;
}

function Instance(model, modelData, options) {
  var normOptions = options || {};

  this.id = null;
  this._data = {};
  this.model = model;
  this.saved = false;
  this._deferredId = RSVP.defer();

  if (modelData) {
    if (_.has(modelData, 'id')) {
      this.saved = true;
      this.id = model._transforms.input
        .call(this, {id: modelData.id}, normOptions).id;
      this._deferredId.resolve(this.id);
    }

    if (modelData.data) {
      this._data = model._transforms.input
        .call(this, this._filterData(modelData.data), normOptions);
    }
  } else {
    // New instance.
    this._generateId();
  }
}

Instance.prototype.get = function(attributes, applyUserTransforms) {
  var self = this;

  // Accept a single attribute string or an array of multiple attributes.
  var singleAttribute = null;

  // Handle different attribute declarations.
  if (_.isString(attributes)) {
    singleAttribute = attributes;
    attributes = {};
    attributes[singleAttribute] = true;
  } else if (_.isArray(attributes)) {
    attributes = _.object(_.map(attributes, function(name) {
      return [name, true];
    }));
  }

  // Filter out any undefined attributes.
  attributes = _.pick(attributes, this.model._attributeNames)

  // Check if any of the attributes have an async output method.
  var groups = _.groupBy(_.keys(attributes), function(name) {
    return self._getAttribute(name).outputAsync ? 'async' : 'sync';
  });

  // Transform the sync data.
  var syncData = _.pick(this._data, groups.sync);
  var transformedSyncData = this.model._transforms.output.call(
    this, syncData, attributes, applyUserTransforms
  );

  if (_.isEmpty(groups.async)) {
    // Since no attributes with async output methods were requested,
    // immediately return the sync values.
    // Handle single and multiple returned values.
    return singleAttribute
      ? transformedSyncData[singleAttribute]
      : transformedSyncData;
  } else {
    var asyncData = _.pick(this._data, groups.sync);

    return new Promise(function(resolve, reject) {
      this.model._transform.outputAsync.call(
        this, asyncData, attributes, applyUserTransforms, function(err, data) {
          if (err) {return reject(err);}
          // Resolve with transformed sync data.
          resolve(_.extend(data, transformedSyncData));
        }
      );
    });
  }
};

Instance.prototype.fetch = function(attributes, options) {
  var self = this;
  var transforms = this.model._transforms;
  var normOptions = _.defaults({}, options, {reload: false, output: true});

  // Instance must be saved in order to fetch.
  this._requireSaved();

  // Parse the attribute request.
  var reqAttributes = parseAttributeRequest(attributes);
  var reqAttributeNames = _.filter(_.keys(reqAttributes), function(name) {
    // Load attributes if set to reload or if the attribute is not already
    // loaded.
    return (normOptions.reload || _.isUndefined(self._data[name]));
  });

  // Get all virtual attributes.
  var virtualAttributeNames = _.filter(reqAttributeNames, function(name) {
    return self._getAttribute(name).virtual;
  });

  // Fetch attributes from hashStores.
  var groups = utils.groupByHashStore(reqAttributeNames,
    this.model._hashStoreGroups);

  // Iterate and fetch from each attribute group.
  return RSVP.all(_.map(groups, function(group) {
    var attributeNames = _.isPlainObject(attributes)
      ? _.keys(attributes)
      : attributes;
    var fetchAttributes = _.intersection(attributeNames, group.attributes);
    if (fetchAttributes.length === 0) {
      return RSVP.resolve();
    }

    return new RSVP.Promise(function(resolve, reject) {
      group.hashStore.fetch({
        keyspace: self.model._props.keyspace,
        id: self.id,
        attributes: fetchAttributes,
        types: self.model._attributeTypes
      }, function(err, data) {
        if (err) {return reject(err);}
        resolve(data);
      });
    });
  })).then(function(results) {
    // Combine starting data for virtual attributes.
    results.push(utils.mapObjectValue(virtualAttributeNames, null));


    // Combine all of the results.
    var data = _.extend.apply(_.extend, results);

    // Resolve with `false` if any of the attributes was not found.
    if (_.isNull(data)) {return false;}

    return new RSVP.Promise(function(resolve, reject) {
      // Embed attributes within the transform options.
      var fetchOptions = _.extend({}, normOptions, {attributes: attributes});

      transforms.fetch.call(self, data, fetchOptions, function(err, data) {
        if (err) {return reject(err);}

        // Set the fetched values. Only set non-virtual attributes.
        _.extend(self._data, _.omit(data, virtualAttributeNames));

        if (normOptions.output) {
          // Transform all data, including virtual attributes.
          resolve(transforms.output.call(self, data, fetchOptions));
        } else {
          // Resolve with `true` since the instance was found.
          resolve(true);
        }
      });
    });
  });
};

Instance.prototype.save = function(data, options) {
  var self = this;
  var normOptions = options || {};
  var inputData = this.model._transforms.input
    .call(this, this._filterData(data), normOptions);

  // Add defaults if the instance has not been saved yet.
  if (!this.saved) {
    inputData = _.extend({}, this.model._getDefaults(), inputData);
  }

  // Wait for the id.
  return self._deferredId.promise
    .then(function(id) {
      return self._persistData(inputData, normOptions);
    })
    .then(function() {
      // Since the model has been successfully saved, apply changes to the
      // instance.
      _.extend(self._data, inputData);
      self.saved = true;
      return self;
    });
};

Instance.prototype.getId = function(options) {
  return this.model._transforms.output.call(
    this, {id: this.id}, options || {}
  ).id;
};

Instance.prototype._filterData = function(data) {
  return _.pick(data, this.model._attributeNames);
};

Instance.prototype._getIndexTypes = function(data) {
  var self = this;
  return _.reduce(data, function(result, value, name) {
    var attribute = self._getAttribute(name);

    if (attribute.indexStore) {
      // Add to index list if the attribute has an indexStore.
      result.indexes.push({
        indexStore: attribute.indexStore,
        attributeName: name,
        attributeValue: value
      });

      if (attribute.replaceIndex) {
        // Add to replace list if the attribute index is replaceable.
        result.replace.push({
          indexStore: attribute.indexStore,
          attributeName: name
        });
      }
    }

    return result;
  }, {indexes: [], replace: []});
};

Instance.prototype._getAttribute = function(name) {
  if (name === 'id') {
    return this.model._props.id;
  }
  return this.model._attributes[name];
};

Instance.prototype._persistData = function(data, options) {
  // Get datastores to save to (hashStore and indexStore).
  var self = this;
  var indexes = _.reduce(data, function(result, value, name) {
    var attribute = self._getAttribute(name);
    if (attribute.indexStore) {
      result.indexes.push({
        indexStore: attribute.indexStore,
        attributeName: name,
        attributeValue: value
      });

      if (attribute.replaceIndex) {
        result.replace.push({
          indexStore: attribute.indexStore,
          attributeName: name
        });
      }
    }
    return result;
  }, {indexes: [], replace: []});

  return RSVP.resolve()
    .then(function() {
      return self._removeReplacedIndexes(indexes)
    })
    .then(function() {
      return self._saveIndexes(indexes)
    })
    .then(function() {
      return new RSVP.Promise(function(resolve, reject) {
        self.model._transforms.save
          .call(self, data, options, function(err, saveData) {
            if (err) {return reject(err);}
            resolve(saveData);
          });
      });
    })
    .then(function(saveData) {
      return self._saveAttributes(saveData);
    });
};

Instance.prototype._removeReplacedIndexes = function(indexes) {
  var self = this;

  // Only remove replaced indexes if the instance has replace indexes and is
  // not new.
  if (!this.saved || indexes.replace.length === 0) {
    return new RSVP.resolve();
  }

  // Fetch the values of indexes to be replaced.
  var names = _.pluck(indexes.replace, 'attributeName');

  // Remove old indexes. First, fetch the current index values in order to find
  // them.
  return this.fetch(names, {reload: true}).then(function() {
    return RSVP.all(_.map(indexes.replace, function(replaceIndex) {
      return new RSVP.Promise(function(resolve, reject) {
        replaceIndex.indexStore.del({
          keyspace: self.model._props.keyspace,
          attributeName: replaceIndex.attributeName,
          attributeValue: self.get(replaceIndex.attributeName),
          types: self.model._attributeTypes
        }, function(err) {
          if (err) {return reject(err);}
          resolve();
        });
      });
    }));
  });
};

Instance.prototype._saveIndexes = function(indexes) {
  var self = this;
  // Set indexes. Fail if an index is already set.
  return RSVP.all(_.map(indexes.indexes, function(index) {
    return new RSVP.Promise(function(resolve, reject) {
      index.indexStore.set({
        keyspace: self.model._props.keyspace,
        attributeName: index.attributeName,
        attributeValue: index.attributeValue,
        id: self.id,
        types: self.model._attributeTypes
      }, function(err, exists) {
        if (err) {return reject(err);}
        if (exists) {
          return reject(new Error('instance with index already exists'));
        }
        resolve();
      });
    });
  }));
};

Instance.prototype._saveAttributes = function(data) {
  var self = this;
  // Set attributes in hashStores.
  var dataKeys = _.keys(data);
  return RSVP.all(_.map(this.model._hashStoreGroups, function(group) {
    return new RSVP.Promise(function(resolve, reject) {
      var datastoreAttributes = _.intersection(group.attributes, dataKeys);

      if (datastoreAttributes.length > 0) {
        // Only save if the datastore it has the attributes.
        group.hashStore.save({
          keyspace: self.model._props.keyspace,
          id: self.id,
          data: _.pick(data, datastoreAttributes),
          types: self.model._attributeTypes
        }, function(err) {
          if (err) {return reject(err);}
          resolve();
        });
      } else {
        resolve();
      }
    });
  }));
};

Instance.prototype._generateId = function() {
  var self = this;
  this.model.orm.generateId(this.model.type, function(err, id) {
    if (err) {return this._deferredId.reject(err);}
    self.id = id;
    self._deferredId.resolve(id);
    /*
    if (self.id === null) {
      self.id = id;
      self._deferredId.resolve(id);
    }
     */
  });
};

Instance.prototype._requireSaved = function() {
  if (!this.saved) {
    throw new Error('the instance must be saved');
  }
};

module.exports = Instance;
