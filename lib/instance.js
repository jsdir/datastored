var _ = require('lodash');
var async = require('async');
var RSVP = require('rsvp');

var utils = require('./utils');

function Instance(model, data, applyUserTransforms) {
  /*
  Constructed with:

  - nothing (id generated on save)
  - id
  - id + data
   */

  var self = this;

  this.id = null;
  this.model = model;
  this.saved = false;
  this._deferredId = RSVP.defer();

  if (data.data) {
    this._data = model._transforms.input
      .call(this, data.data, applyUserTransforms);
  } else {
    this._data = {};
  }

  // Generate or set the id.
  if (data.id == null) {
    this._generateId();
  } else {
    this.saved = true;
    this.id = model._transforms.input
      .call(this, {id: data.id}, applyUserTransforms).id;
    this._deferredId.resolve(this.id);
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
    attributes[singleAttribute] = null;
  } else if (_.isArray(attributes)) {
    attributes = _.object(attributes, null);
  }

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

Instance.prototype.fetch = function(attributes) {
  var self = this;
  this._requireSaved();

  // Fetch attributes.
  var promise = new Promise();

  // Fetch attributes from hashStores.
  var self = this;
  var groups = utils.groupByHashStore(attributes, this.model._hashStoreGroups);
  async.map(groups, function(group, cb) {
    fetchAttributes = _.intersection(attributes, group.attributes);
    if (fetchAttributes.length > 0) {
      group.hashStore.fetch({
        keyspace: self.model.options.keyspace,
        id: self.getId(true),
        attributes: fetchAttributes,
        types: self.model._attributeTypes
      }, cb);
    } else {
      cb();
    }
  }, function(err, results) {
    if (err) {return cb(err);}
    // Combine all of the results.
    cb(null, _.extend.apply(_.extend, results));

    this.model._transforms.fetch.call(
      this
    );

    // hold...
    // Set the fetched values.
    _.extend(self.values, data);

    // Call back with a boolean indicating whether new data was fetched or not.
    cb(null, !_.isEmpty(data));
  });

  return promise;
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

Instance.prototype.save = function(data, applyUserTransforms) {
  var self = this;
  var transforms = self.model._transforms;

  var inputData = transforms.input.call(self, data, applyUserTransforms);
  // Add defaults if the instance has not been saved yet.
  if (!self.saved) {
    inputData = _.extend({}, this.model._getDefaults(), inputData);
  }

  return new RSVP.Promise(function(resolve, reject) {
    // Wait for the id if it is being generated.
    self._deferredId.promise.then(function(id) {
      transforms.save.call(self, inputData, function(err, data) {
        if (err) {return reject(err);}
        resolve(data);
      });
    }).catch(reject);
  })
    .then(function(data) {
      return self._persistData(data);
    })
    .then(function() {
      // Since the model has been successfully saved, apply changes to the
      // instance.
      _.extend(self._data, inputData);
      self.saved = true;
      return self;
    });
};

Instance.prototype.getId = function(applyUserTransforms) {
  return this.model._transforms.output.call(
    this, {id: this.id}, null, applyUserTransforms
  ).id;
};

Instance.prototype._getAttribute = function(name) {
  return this.model._attributes[name];
};

Instance.prototype._persistData = function(data) {
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
    .then(this._removeReplacedIndexes(indexes))
    .then(this._setIndexes(indexes))
    .then(this._setAttributes(data));
};

Instance.prototype._removeReplacedIndexes = function( indexes) {
  var self = this;

  // Only remove replaced indexes if the instance has replace indexes and is
  // not new.
  if (!this.saved || indexes.replace.length === 0) {
    return RSVP.resolve();
  }

  // Fetch the values of indexes to be replaced.
  var names = _.pluck(indexes.replace, 'attributeName');

  // Remove old indexes. First, fetch the current index values in order to find
  // them.
  return this.fetch(names).then(function(instance) {
    return RSVP.all(_.map(replaceIndexes, function(replaceIndex) {
      return replaceIndex.indexStore.del({
        keyspace: self._props.keyspace,
        attributeName: replaceIndex.attributeName,
        attributeValue: self.get(replaceIndex.attributeName),
        types: self.model._attributeTypes
      }, cb); // to promise
    }));
  });
};

Instance.prototype._setIndexes = function(indexes) {
  var self = this;
  // Set indexes. Fail if an index is already set.
  return RSVP.all(_.map(indexes.indexes, function(index) {
    return new RSVP.Promise(function(resolve, reject) {
      index.indexStore.set({
        keyspace: self.model._props.keyspace,
        attributeName: index.attributeName,
        attributeValue: index.attributeValue,
        id: self.getId(),
        types: self.model._attributeTypes
      }, function(err, exists) {
        if (err) {return reject();}
        if (exists) {return reject('instance with index already exists');}
        resolve();
      });
    });
  }));
};

Instance.prototype._setAttributes = function(data) {
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
          id: self.getId(),
          data: _.pick(data, datastoreAttributes),
          types: self.model._attributeTypes
        }, function(err) {
          if (err) {return reject();}
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
  });
};

Instance.prototype._requireSaved = function() {
  if (!this.saved) {
    throw new Error('the instance must be saved');
  }
};

module.exports = Instance;
