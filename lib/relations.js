var _ = require('lodash');
var async = require('async');

var utils = require('./utils');

function getInstance(options, id) {
  return options.orm.models[options.relation.relatedModel].get(id, true);
};

// Collection for `HasMany` and `Tree` relations.

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
            childObject[childAttribute] = getChildren(child.children)
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
    // Immediate tree children can be fetched with `datastore.fetchCollection`
    this.datastore.fetchCollection(_.extend({
      offset: this.fetchOptions.offset,
      limit: this.fetchOptions.limit,
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
  this.fetchOptions = {reverse: false};
};

// Relation Types

var HasOne = {
  initializeRelation: function() {
    var self = this;
    // If a relation link exists, store the link in the orm.
    if (this.relation.joinedProperties && this.relation.link) {
      // Set the property links when the related model exists.
      this.orm._onModel(this.relation.relatedModel, function(model) {
        // Set default property links.
        model.propertyLinks = model.propertyLinks || {};
        model.propertyLinks[self.relationName] =
          self.relation.joinedProperties;
      });
    }
  },
  beforeInput: function(instance) {
    // Fail if the instance type does not match `relatedModel`
    if (instance.model.name !== this.relation.relatedModel) {
      throw new Error('relation "' + this.relationName + '" was set with a ' +
        'model of an invalid type');
    }

    if (this.relation.link) {
      // Unset child link relation.
      var lastValue = this.instance.get(this.relationName);
      if (lastValue) {
        lastValue.set(this.relation.link, null);
      }

      if (instance) {
        // Set child link relation to parent.
        instance.set(this.relation.link, this.instance);
      }
    }
  },
  beforeSave: function(instance, cb) {
    // Convert instances into raw ids for saving. If the child has changed
    // attributes or is not saved, the child will be saved before the parent.

    if (instance) {
      instance.save(function(err) {
        if (err) {return cb(err);}
        // Callback with the raw id.
        cb(null, instance.getId(true))
      });
    } else {
      cb();
    }

    // TODO: Keep track of instances that have already been saved. This will
    // prevent an infinite loop.
  },
  afterSave: function() {
    // TODO: Update joined properties on related models based on the newly changed
    // attributes.
  },
  getFetchKeys: function(keys) {
    // TODO: Include joined properties as extra properties to fetch.
    //
    // Scopes:
    //   "relation": id only
    //   "relation.property_name": single joined property
    //   "relation.*": all joined properties
    var joinedProperties = this.relation.joinedProperties;

    if (joinedProperties) {
      // Fetch joined properties if they are used.
      props = [];
      _.each(attributes, function(name) {
        var match = name.match(/^(.*)\.\*$/);
        if (match) {
          var prefix = match[1];
          props = props.concat(_.map(joinedProperties, function(prop) {
            return prefix + '.' + prop;
          }));
        } else {
          props.push(name);
        }
      });
    }
    return keys;
  },
  onFetch: function(id, data) {
    var self = this;
    var instance = getInstance(this, id);

    // Set fetched joined properties on the related model.
    _.each(data, function(value, name) {
      var exp = new RegExp('^' + self.relationName + '\.(.*)$');
      var match = name.match(exp);
      if (match) {
        // TODO: a better interface to set data without changed attributes?
        instance.get(this.relationName).values[match[1]] = value;
      }
    });

    return instance;
  }
};

var HasMany = {
  initializeRelation: function() {
    // TODO: Throw error until uncached relations are implemented.
    if (!this.relation.cached) {
      throw new Error('all HasMany relations must be cached for now');
    }
  },
  getDefaultValue: function() {
    return new Collection(this);
  },
  onInput: function() {
    // Prevent the attribute from being directly mutated.
    throw new Error('cannot directly set a HasMany relation');
  }
};

var Tree = {
  initializeRelation: function() {
    utils.requireAttributes(this.relation, [
      'parentRelation', 'childrenRelation', 'link'
    ]);
  },
  getDefaultValue: function() {
    return new Collection(this, true);
  },
  onInput: function() {
    // Prevent the attribute from being directly mutated.
    throw new Error('cannot directly set a Tree relation');
  }
};

// Mixin Definition

var callbacks = {
  initialize: function(options) {
    var orm = this.orm;

    _.each(options.relations, function(relation, name) {
      // Validate relation options.
      if (!relation.relatedModel) {
        throw new Error('relation "' + name + '" requires a "relatedModel" ' +
          'option');
      }

      // Initialize the relations.
      if (relation.type.initializeRelation) {
        relation.type.initializeRelation.call({
          relationName: name, relation: relation, orm: orm
        });
      }
    });

    return options;
  },
  beforeInput: function(data, cb) {
    var self = this;

    // Run `onInput` callback on relations.
    _.each(this.model.options.relations, function(relation, name) {
      if (relation.type.beforeInput && (name in data)) {
        relation.type.beforeInput.call({
          relationName: name, relation: relation, instance: self
        }, data[name]);
      }
    });

    cb(null, data);
  },
  /*
  beforeSave: function(options, data, cb) {
    // Only run callback if data[value] exists
    var keys = _.keys(data);
    async.each(keys, function(key, cb) {

    }, function(err) {
      // if (err)
    });

    var self = this;
    return cb(null, options, _.object(_.map(data, function(value, key) {
      // Iterate through relations being saved.
      if (key in self.model.options.relations) {
        var relation = self.model.options.relations[key];
        if (relation.type.onSave) {
          relation.type.onSave.call({

          }, self, cb);
        }
      }
      return [key, value];
    })));

    var self = this;
    var names = _.keys(this.model.options.relations);

    // Iterate through parent relations and save children.
    async.each(names, function(name, cb) {
      var relation = self.model.options.relations[name];
      var beforeSave = relation.type.beforeSave;
      if (beforeSave) {
        beforeSave.call({
          relationName: name, relationOptions: relation, value: data[name]
        }, options, data, cb);
      } else {
        cb();
      }
    }, function(err) {
      if (err) {return cb(err);}
      cb(null, options, data);
    });
  },*/
  beforeFetch: function(options, attributes, cb) {
    // Run `getFetchKeys` on relations to combine the keys that should be
    // requested from the datastore.
    _.each(this.model.options.relations, function(relation, name) {
      if (relation.type.getFetchKeys) {
        attributes = relation.type.getFetchKeys.call({
          relationName: name, relation: relation
        }, attributes);
      }
    });

    cb(null, options, attributes);
  },
  afterFetch: function(options, data, cb) {
    var orm = this.model.orm;
    _.each(this.model.options.relations, function(relation, name) {
      var afterFetch = relation.type.afterFetch;
      if (afterFetch) {
        afterFetch.call({
          relationName: name, relationOptions: relation, orm: orm
        }, data[value], data);
      }
    });

    cb(null, options, data);
  },
  defaults: function(defaults) {
    var instance = this;
    // Run `getDefaultValue` on relations to combine the default attributes.
    _.each(this.model.options.relations, function(relation, name) {
      if (relation.type.getDefault) {
        defaults[name] = relation.type.getDefaultValue.call({
          relationName: name,
          relation: relation,
          instance: instance,
          orm: instance.model.orm
        });
      }
    });

    return defaults;
  }
};

var RelationMixin = {
  callbacks: callbacks
};

module.exports = {
  HasOne: HasOne,
  HasMany: HasMany,
  Tree: Tree,
  RelationMixin: RelationMixin
};
