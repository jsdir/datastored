function Collection(options, isTree) {
  this.relationName = options.relationName;
  this.relation = options.relation;
  this.instance = options.instance;
  this.orm = options.orm;
  this.isTree = isTree;

  // Set the appropriate datastore based on caching option.
  if (this.relation.cached) {
    this.datastore = this.orm.datastores.redis;
  } else {
    this.datastore = this.orm.datastores.cassandra;
  }

  // Get base datastore options.
  this.datastoreOptions = {
    id: this.instance.getId(true),
    table: this.instance.model.table,
    relationName: this.relationName
  };

  // Reset before use.
  this._resetFetchOptions();
}

Collection.prototype.limit = function(amount) {
  this.fetchOptions.limit = amount;
  return this;
};

Collection.prototype.offset = function(amount) {
  this.fetchOptions.offset = amount;
  return this;
};

Collection.prototype.reverse = function() {
  this.fetchOptions.reverse = !this.fetchOptions.reverse;
  return this;
};

Collection.prototype.add = function(instances, cb) {
  var self = this;

  // Support single instance.
  if (!_.isArray(instances)) {
    instances = [instances];
  }

  // Save changed instances before they are added.
  async.each(instances, function(instance, cb) {
    instance.save(cb);
  }, function(err) {
    if (err) {return cb(err);}
    // Use the options to determine the datastore collection to add to.
    self.datastore.addToCollection(_.extend({
      ids: _.map(instances, function(instance) {
        return instance.getId(true);
      })
    }, self.datastoreOptions), cb);
  });
};

/*
Collection.prototype.remove = function(model, cb) {
  this.datastore.removeFromCollection({
    id: this.instance.getId(),
    table: this.model.table,

  });
};

Collection.prototype.has = function(models, cb) {
  this.datastore.has(this.collection, cb);
};
*/

Collection.prototype.fetch = function(scope, options, cb) {
  var self = this;
  var scopeAttributes = this.instance._getScopeAttributes(scope);

  // Only `cb` is required.
  if (_.isFunction(scope)) {
    cb = scope;
    scope = null;
    options = {};
  } else if (_.isFunction(options)) {
    cb = options;
    options = scope;
  }

  if (this.isTree && options.recursive) {
    // Fetch tree.
    // Add scope attributes to datastoreOptions if scope was defined.
    this.datastore.fetchTree(_.extend({
      childrenRelation: this.relation.childrenRelation,
      childTable: models[this.relation.childrenRelation].table,
      childAttributes: scopeAttributes
    }, this.datastoreOptions), function(err, data) {
      if (err) {return cb(err);}
      // Reset the collection fetch options for further use.
      self._resetFetchOptions();

      function getChildren(data) {
        return _.map(data, function(child) {
          var childObject = model.create(child.data).toObject(scope);
          childObject[pkAttribute] = child.id;

          // Recursively add children.
          if (child.children) {
            childObject[childAttribute] = getChildren(child.children);
          }

          return childObject;
        });
      }

      cb(null, getChildren(data));
      /* data:
      [{
        id: 0
        data: {elements from attribute_list if defined}
        children: [{
          ...
        }]
      }, ...]
      */
    });
  } else {
    // a way to represent fetch scenarios:
    //   null: id only
    //   string or array: scope attributes
    //
    // TODO: output iter toObject with scope for now.
    //
    // Fetch one-dimensional collection.
    // Immediate tree children can be fetched with `datastore.fetchCollection
    var end = -1;
    if (this.fetchOptions.limit !== null) {
      end = this.fetchOptions.offset + this.fetchOptions.limit
    }

    this.datastore.fetchCollection(_.extend({
      start: this.fetchOptions.offset,
      end: end,
      childAttributes: scopeAttributes
    }, this.datastoreOptions), function(err, ids) {
      if (err) {return cb(err);}
      // Reset this collection's fetch options for further use.
      self._resetFetchOptions();
      // Convert fetched ids into instances.
      var instances = _.map(ids, function(id) {return getInstance(self, id);});
      if (scope) {
        // Fetch attributes if a scope is defined.
        cb(null, async.map(instances, function(instance, cb) {
          instance.fetch(scope, function(err, fetched) {
            if (err) {return cb(err);}
            if (fetched) {
              cb(null, instance.toObject(scope));
            } else {
              cb();
            }
          });
          // return self.orm.models[self.relation.relatedModel].get(id, true);
        }));
      } else {
        // Return the initial instances if no scope is defined.
        cb(null, instances);
      }
    });
  }
};

Collection.prototype._resetFetchOptions = function() {
  this.fetchOptions = {reverse: false, offset: 0, limit: null};
};

Collection.prototype.get = function(options) {
  // options.push
};

module.exports = Collection;
