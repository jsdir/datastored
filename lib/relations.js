var _ = require('lodash');
var async = require('async');

var HasOne = {
  initialize: function() {
    var joinedProperties = this.relationOptions.joinedProperties;
    var relatedModel = this.relationOptions.relatedModel;

    if (joinedProperties) {
      // Validate joined properties.
      this.orm._onModel(relatedModel, function(model) {
        var modelProps = _.keys(model.options.properties);
        var invalidProps = _.difference(joinedProperties, modelProps);
        if (invalidProps.length > 0) {
          throw new Error('relation "' + this.relationName + '" property "' +
            invalidProps + '" is not a valid property');
        }

        // Add joined properties to parent properties.
        _.each(joinedProperties, function(name) {
          // Only include type and ensure immutability.
          parentModel.options.properties[this.relationName + '.' + name] = {
            type: model.options.properties[name].type,
            immutable: true
          };
        });
      });

      if (this.relationOptions.link) {
        // Add property links.
        var links = this.orm.links;
        links.properties = _.updatePath(links.properties, function(props) {
          return _.union(props, joinedProperties);
        }, [relatedModel, this.relationOptions.link], {});
      }
    }
  },
  beforeInput: function() {
    // Validate relatedModel type.
    var instance = this.value;
    var relatedModel = this.relationOptions.relatedModel;
    if (instance && relatedModel !== instance.model.name) {
      throw new Error('relation "' + this.relationName + '" was set with a ' +
        'model of an invalid type');
    }

    // Set child link if it exists.
    if (this.relationOptions.link) {
      instance.set(this.relationOptions.link, this.instance);
    }
  },
  beforeSave: function(options, data, cb) {
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
  beforeFetch: function(attributes) {
    // Include joined properties as extra properties to fetch.
    //
    // Scopes:
    //   "relation": id only
    //   "relation.property_name": single joined property
    //   "relation.*": all joined properties
    var joinedProperties = this.relationOptions.joinedProperties;
    var fetchAttributes = attributes;
    if (joinedProperties) {
      // Fetch joined properties if they are used.
      fetchAttributes = [];
      _.each(attributes, function(name) {
        var match = name.match(/^(.*)\.\*$/);
        if (match) {
          var prefix = match[1];
          fetchAttributes = fetchAttributes.concat(_.map(joinedProperties, function(prop) {
            return prefix + '.' + prop;
          }));
        } else {
          fetchAttributes.push(name);
        }
      });
    }
    return fetchAttributes;
  },
  afterFetch: function(data) {
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
  getDefaultValue: function() {
    return new Collection(this);
  },
  initialize: function() {
    // TODO: Throw error until uncached relations are implemented.
    if (!this.relationOptions.cached) {
      throw new Error('all HasMany relations must be cached for now');
    }
    // setupLinks(this);
  },
  afterInput: function(value) {
    // Prevent the attribute from being mutated.
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
  getDefaultValue: function() {
    return new Collection(this, true);
  },
  initialize: function() {
    utils.requireAttributes(this.relationOptions, [
      'parentRelation', 'childrenRelation', 'link'
    ]);
  },
  afterInput: function(value) {
    throw new Error('cannot directly set a Tree relation');
  }
};

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

function Collection(options, isTree) {
  this.options = options;

  this.options.name;
  this.options.relation;
  this.options.instance;

  // this.count = 0;

  this.datastore = this.options.relation.cache ? orm.datastores.redis : orm.datastores.cassandra;
  this._resetFetchOptions();

  // this._resetModels();
  // TODO: capacity only for lists.
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

Collection.prototype.add = function(models, cb) {
  if (!_.isArray(models)) {
    models = [models];
  }

  this.datastore.addToCollection({
    id: this.instance.getId(true),
    models: _.map(models, function(model) {return model.getId(true);}),
    table: this.model.table
  }, cb);
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
  if (_.isCallback(scope)) {
    cb = scope;
    scope = null;
    options = {};
  }

  if (_.isCallback(options)) {
    cb = options;
    options = scope;
  }

  if (this.options.tree && options.recursive) {
    // Fetch tree.
    this.datastore.fetchTree({

    }, function(err, models) {
      if (err) {return cb(err);}
      // TODO: assign fetched models data to owned models.
    });
  } else {
    // Fetch linear collection.
    this.datastore.fetchCollection({
      id: this.instance.getId(true),
      table: this.model.table,
      offset: this.fetchOptions.offset,
      limit: this.fetchOptions.limit
    }, function(err, ids) {
      if (err) {return cb(err);}
      this._resetFetchOptions();
      cb(null, _.map(ids, function(id) {
        return orm.models[relation.relatedModel].get(id, true);
      }));
    });
  }
};

Collection.prototype.fetchObjects = function(scope, options, cb) {
  var self = this;
  this.fetch(scope, options, function(err, models) {
    if (self.options.tree) {
      // Reconstruct from tree.
      cb;
    } else {
      async.map(models, function(model, cb) {
        model.fetch(scope, function(err) {
          if (err) {return cb(err);}
          cb(null, model.toObject(scope));
        });
      }, cb);
    }
  });
};

Collection.prototype._resetFetchOptions = function() {
  this.fetchOptions = {reverse: false};
};

module.exports = {
  HasOne: HasOne,
  HasMany: HasMany,
  Tree: Tree,
  RelationMixin: RelationMixin
};
