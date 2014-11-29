var _ = require('lodash');
var async = require('async');
var RSVP = require('rsvp');

var utils = require('./utils');

function Instance(model, data, applyUserTransforms) {
  this.id = null;
  this._deferredId = RSVP.defer();
  this.model = model;

  if (data.data) {
    var initialData = model._transforms.input.call(
      this, data.data, applyUserTransforms
    );
    this.data = _.extend({}, model._getDefaults(), initialData);
  } else {
    this.data = {};
  }

  // Generate or set the id.
  if (_.isUndefined(data.id)) {
    this._generateId();
  } else {
    this.id = data.id;
    this._deferredId.resolve(data.id);
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
  var syncData = _.pick(this.data, groups.sync);
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
    var asyncData = _.pick(this.data, groups.sync);

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

Instance.prototype.save = function(attributes) {
  var self = this;
  // Wait for id if it is being generated.
  return this._onId(function(id) {
    self.model._transforms.save.call(self, attributes, function(err, data) {
      var indexTypes = self._getIndexTypes(data);
    });
  });
};

Instance.prototype.getId = function(applyUserTransforms) {
  return this.model._transforms.output(this.id, {}, applyUserTransforms);
};

Instance.prototype.isNew = function() {
  return this.id === null;
};

Instance.prototype._getAttribute = function(name) {
  return this.model._attributes[name];
};

Instance.prototype._save = function(data, options, cb) {
  // Get datastores to save to (hashStore and indexStore).
  var self = this;
  var attributes = this.model.options.attributes;

  this._asyncTransform('save', options, data, function(err, options, data) {
    if (err) {return cb(err);}



    async.series([
      function(cb) {
        // Remove replaced indexes.
        if (self.isNew) {
          cb();
        } else {
          if (replaceIndexes.length > 0) {
            // Fetch the values of indexes to be replaced.
            var names = _.pluck(replaceIndexes, 'attributeName');
            self.fetch(names, function(err) {
              if (err) {return cb(err);}
              // Remove old indexes.
              async.each(replaceIndexes, function(replaceIndex, cb) {
                replaceIndex.indexStore.del({
                  keyspace: self.model.options.keyspace,
                  attributeName: replaceIndex.attributeName,
                  attributeValue: self.get(replaceIndex.attributeName, true),
                  types: self.model._attributeTypes
                }, cb);
              }, cb);
            });
          } else {
            cb();
          }
        }
      },
      function(cb) {
        // Set indexes. Fail if an index is already set.
        async.each(indexes, function(index, cb) {
          index.indexStore.set({
            keyspace: self.model.options.keyspace,
            attributeName: index.attributeName,
            attributeValue: index.attributeValue,
            id: self.getId(true),
            types: self.model._attributeTypes
          }, function(err, exists) {
            cb(exists ? 'instance with index already exists' : null);
          });
        }, cb);
      },
      function(cb) {
        // Set attributes in hashStores.
        var dataKeys = _.keys(data);
        async.each(self.model._hashStoreGroups, function(group, cb) {
          var datastoreAttributes = _.intersection(group.attributes, dataKeys);

          if (datastoreAttributes.length > 0) {
            // Only save if the datastore it has the attributes.
            group.hashStore.save({
              keyspace: self.model.options.keyspace,
              id: self.getId(true),
              data: _.pick(data, datastoreAttributes),
              types: self.model._attributeTypes
            }, cb);
          } else {
            cb();
          }
        }, cb);
      }
    ], cb);
  });
};

Instance.prototype._generateId = function() {
  this.model.orm.generateId(this.model.type, utils.toCb(this._deferredId));
};

Instance.prototype._requireSaved = function() {
  if (this.isNew()) {
    throw new Error('the instance must be saved');
  }
};

module.exports = Instance;
