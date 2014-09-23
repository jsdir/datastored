var _ = require('lodash');
var async = require('async');

var utils = require('./utils');

// Collection for `HasMany` and `Tree` relations.

function Collection(options, isTree) {
  this.relationName = options.relationName;
  this.relation = options.relation;
  this.instance = options.instance;
  this.orm = options.orm;
  this.isTree = isTree;

  // Set the appropriate datastore based on caching option.
  if this.relation.cached {
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
  if (!_.isArray(instances)) {
    instances = [instances];
  }

  // Use the options to determine the datastore collection to add to.
  this.datastore.addToCollection(_.extend({
    ids: _.map(instances, function(instance) {
      return instance.getId(true);
    })
  }, this.datastoreOptions), cb);
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
  var scopeAttributes = getScopeAttributes(scope);

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
    // TODO: support fetching collections with scope that includes other
    // relations (HasMany, HasOne, Tree)
    // Fetch tree.
    // TODO: Add attribute_list to datastoreOptions if a scope is defined.
    // also add <child_attr_name>
    this.datastore.fetchTree(this.datastoreOptions, function(err, data) {
      if (err) {return cb(err);}
      // Reset this Collection's fetch options for further use.
      self._resetFetchOptions();
      /* data:
      [{
        id: 0
        data: {elements from attribute_list if defined}
        children: [{
          ...
        }]
      }, ...]
      */
      // Callback with an instance tree.
      // start at leaves and give children to parent.
      cb(null, _.recursiveMap(data, 'children', function(instance) {
        return self.getInstance(instance.id).set(instance.data)
        // also set instance.children
        // it may be overridden in the future.
        // TODO: also set the child elements as a collection.
      }));
    });
  } else {
    // Fetch one-dimensional collection.
    // Immediate tree children can be fetched with `datastore.fetchCollection`
    this.datastore.fetchCollection(_.extend({
      offset: this.fetchOptions.offset,
      limit: this.fetchOptions.limit
    }, this.datastoreOptions), function(err, ids) {
      if (err) {return cb(err);}
      // Reset this collection's fetch options for further use.
      self._resetFetchOptions();
      // Convert fetched ids into instances.
      var instances = _.map(ids, function(id) {return self.getInstance(id);});
      if (scope) {
        // Fetch attributes if a scope is defined.
        cb(null, async.map(instances, function(instance, cb) {
          instance.fetch(scope, function(err, fetched) {
            if (err) {return cb(err);}
            if (fetched) {
              cb(null, instance.toObject(scope););
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

Collection.prototype.fetchObjects = function(scope, options, cb) {
  var self = this;
  this.fetch(scope, options, function(err, instances) {
    if (err) {return cb(err);}
    if (self.isTree) {
      // Construct object from instance relations and relation options.
      var data = instance.toObject(scope);
      data[self.relation.childrenAttrName] = recursiveChildren()
      cb(null, /*recursive*/data);
    } else {
      cb(null, _.map(instances, function(instance) {
        return instance.toObject(scope);
      }));
    }
  });
};

Collection.prototype._resetFetchOptions = function() {
  this.fetchOptions = {reverse: false};
};

Collection.prototype._getInstance = function(id) {
  return self.orm.models[self.relation.relatedModel].get(id, true);
};

// Relation Types

var HasOne = {
  initializeRelation: function(name, relation) {
    if (relation.joinedProperties) {
      // Index joined attributes?

      // If the relatedModel has a link, store the backref with the target in
      // the registry.
      if (relation.link) {
        // Add property links.
        // link relation.relatedModel
      }
    }
  },
  onInput: function(instance) {
    // Fail if the instance type does not match `relation.relatedModel`
    if (instance.model.name !== relation.relatedModel) {
      throw new Error('relation "' + relationName + '" was set with a ' +
        'model of an invalid type');
    }

    // Set the child link to the parent.
    if (this.relation.link) {
      instance.set(this.relation.link, this.parentInstance);
    }
  },
  onSave: function(options, data, cb) {
    // Convert to model id for saving. If the child has changed attributes or
    // is not saved, the child will be saved before the parent, and the id
    // will be loaded into the parent.
    var self = this;
    var instance = this.value;
    var savedInstances = options.savedInstances || [];

    if (instance && !_.contains(savedInstances, instance)) {
      if (instance.isNew || instance.isChanged()) {
        // Save the child model.
        var saveOptions = {savedInstances: savedInstances.concat(instance)};
        instance.save(saveOptions, function(err) {
          if (err) {return cb(err);}
          data[self.relationName] = instance.getId(true);
          cb(null, options, data);
        });
      } else {
        data[this.relationName] = instance.getId(true);
        cb(null, options, data);
      }
    } else {
      cb(null, options, data);
    }
  },
  getFetchProperties: function(props) {
    // Include joined properties as extra properties to fetch.
    //
    // Scopes:
    //   "relation": id only
    //   "relation.property_name": single joined property
    //   "relation.*": all joined properties
    var joinedProperties = this.relationOptions.joinedProperties;
    var props = attributes;
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
    return props;
  },
  onFetch: function(data) {
    var relationName = this.relationName;
    if (relationName in data) {
      // Convert fetched ids to a model.
      var id = data[relationName];
      var model = this.orm.models[this.relationOptions.relatedModel].get(id);
      data[relationName] = model;

      // Set fetched joined properties on the related model.
      _.each(data, function(value, name) {
        var exp = new RegExp('^' + relationName + '\.(.*)$');
        var match = name.match(exp);
        if (match) {
          model.values[match[1]] = value;
          delete data[name];
        }
      });
    }
  }
};

var HasMany = {
  initializeRelation: function(name, relation) {
    // TODO: Throw error until uncached relations are implemented.
    if (!relation.cached) {
      throw new Error('all HasMany relations must be cached for now');
    }
  },
  getDefaultValue: function() {
    return new Collection(this);
  },
  onInput: function() {
    // Prevent the attribute from being directly mutated.
    throw new Error('cannot directly set a HasMany relation');
  }/*,
  afterOutput: function(values) {
    // TODO: counts
  },
  beforeFetch: function(options, attributes, cb) {
    // TODO: counts
    // Include counters as extra properties to fetch.
    // Fetch counts if they are used.
    if (this.options.counterCache) {
      // Fetch count for HasMany if listed in attributes.
      if (_.contains(attributes, this.name)) {
        scope.properties.push(this.name + '_count');
      }
    }
  },
  afterFetch: function(options, values, cb) {
    // Set the counters on the target collections.
    // LATER: counts
    // Set the counts if they are used.
    if (this.options.counterCache) {
      var countName = this.name + '_count';
      // Set count if listed in attributes.
      if (countName in values) {
        this.attributes[this.name].count = values[countName];
        values = _.omit(values, countName)
      }
    }
    cb(null, options, values);
  }*/
};

var Tree = {
  initializeRelation: function(name, relation) {
    utils.requireAttributes(relation, [
      'parentRelation', 'childrenRelation', 'link'
    ]);

    // TODO: create parent,children,link attributes on relatedModel
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

    // Initialize orm link registry.
    orm.links = orm.links || {properties: {}};

    _.each(options.relations, function(relation, name) {
      // Validate relation options.
      if (!relation.relatedModel) {
        throw new Error('relation "' + name + '" requires a "relatedModel" ' +
          'option');
      }

      // Run "initialize" callback on relations.
      var initialize = relation.type.initialize;
      if (initialize) {
        initialize.call({
          relationName: name, relationOptions: relation, orm: orm
        });
      }
    });

    return options;
  },
  beforeInput: function(data, cb) {
    var self = this;
    var model = this.model;
    _.each(model.options.relations, function(relation, name) {
      // Run "beforeInput" callback on relations.
      if (relation.type.beforeInput && (name in data)) {
        relation.type.beforeInput.call({
          relationName: name,
          relationOptions: relation,
          value: data[name],
          instance: self
        });
      }
    });

    cb(null, data);
  },
  afterInput: function(data, cb) {
    _.each(this.model.options.relations, function(relation, name) {
      if (relation.type.afterInput && (name in data)) {
        relation.type.afterInput.call({value: data[name]});
      }
    });
    cb(null, data);
  },
  beforeSave: function(options, data, cb) {
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
  },
  afterSave: function(options, data, cb) {
    var self = this;
    var dataKeys = _.keys(data);
    var relations = this.model.orm.links.properties[this.model.name];
    var relationNames = _.keys(relations);
    async.each(relationNames, function(relationName, cb) {
      var joinedProperties = relations[relationName];
      var updatedProps = _.intersection(dataKeys, joinedProperties);
      if (updatedProps.length > 0) {
        self.fetch([relationName], function(err) {
          if (err) {return cb(err);}
          var parent = self.get(relationName);
          var updatedData = _.pick(data, updatedProps);

          parent.set(_.object(_.map(updatedData, function(value, name) {
            return [relationName + '.' + name, value];
          })), true).save(cb);
        })
      } else {
        cb();
      }
    }, function(err) {
      if (err) {return cb(err);}
      cb(null, options, data);
    });
  },
  beforeFetch: function(options, attributes, cb) {
    _.each(this.model.options.relations, function(relation, name) {
      var beforeFetch = relation.type.beforeFetch;
      if (beforeFetch) {
        attributes = beforeFetch.call({
          relationName: name, relationOptions: relation
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
        }, data);
      }
    });
    cb(null, options, data);
  },
  defaults: function(defaults) {
    _.each(this.options.relations, function(relation, name) {
      var getDefaultValue = relation.type.getDefault;
      if (getDefaultValue) {
        defaults[name] = getDefaultValue.call({

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
