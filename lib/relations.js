var _ = require('lodash-contrib');
var async = require('async');

function setupLinks(model) {
  model
}

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
      });

      if (this.relationOptions.link) {
        // Add property links.
        _.updatePath(this.orm.links.properties, function(props) {
          return _.union(props, joinedProperties);
        }, [relatedModel, this.relationOptions.link], []);
      }
    }

    return options;
  },
  beforeInput: function(data) {
    // Validate relatedModel type.
    var instance = this.value;
    var relatedModel = this.relation.relatedModel;
    if (instance && relatedModel !== instance.model.name) {
      throw new Error('relation "' + this.name + '" was set with a model of ' +
        'an invalid type');
    }
  },
  beforeSave: function(data, cb) {
    // Convert to model id for saving. If the child has changed attributes or
    // is not saved, the child will be saved before the parent, and the id
    // will be loaded into the parent.
    var model = this.value;
    if (model) {
      if (model.isNew || model.isChanged()) {
        // Save the child model.
        model.save(function(err) {
          if (err) {return cb(err);}
          data[this.name] = model.getId(true);
          cb(null, data);
          return;
        });
      } else {
        data[this.name] = model.getId(true);
      }
    }

    cb(null, data);
  },
  beforeFetch: function(attributes) {
    // Include joined properties as extra properties to fetch.
    //
    // Scopes:
    //   "relation": id only
    //   "relation.property_name": single joined property
    //   "relation.*": all joined properties

    // attributes, relation.options
    var joinedProperties = this.relationOptions.joinedProperties;
    var fetchAttributes = attributes;
    if (joinedPropNames) {
      // Fetch joined properties if they are used.
      fetchAttributes = [];
      _.each(attributes, function(name) {
        var match = name.match(/^(.*)\.\*$/);
        if (match) {
          var prefix = match[1];
          fetchAttributes.push(_.map(joinedProperties, function(prop) {
            return prefix + '.' + prop;
          }));
        } else {
          fetchAttributes.push(name);
        }
      });

    }

    return fetchAttributes;
  },
  afterFetch: function(options, data, cb) {
    if (relationName in data) {
      // Convert fetched ids to a model.
      var id = data[relationName];
      var model = orm.models[relatedModel].get(id);
      data[relationName] = model;

      // Set fetched joined properties on the related model.
      _.each(data, function(value, key) {
        var match = key.match('name.*');
        if (match) {
          model.values[match] = value;
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
  initialize: function(options) {
    setupLinks(this);
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
    requireProperties(this.options, [
      'parentRelation', 'childrenRelation', 'link'
    ]);
  },
  afterInput: function(value) {
    throw new Error('cannot directly set a Tree relation');
  }
};

var callbacks = {
  initialize: function(options) {
    this.orm.links = {properties: {}};
    var orm = this.orm;
    _.each(options.relations, function(relation, name) {
      // Validate relation options.
      // Require a "relatedModel" for each relation.
      if (!relation.relatedModel) {
        throw new Error('relation "' + name + '" requires a "relatedModel" ' +
          'option');
      }

      // Run "initialize" callback on relations.
      var initialize = relation.type.initialize;
      if (initialize) {
        options = initialize.call({
          relation: relation, name: name, orm: orm
        }, options);
      }
    });

    return options;
  },
  beforeInput: function(data, cb) {
    var model = this.model;
    _.each(model.options.relations, function(relation, name) {
      // Run "beforeInput" callback on relations.
      var beforeInput = relation.type.beforeInput;
      if (beforeInput && (name in data)) {
        beforeInput.call({
          relation: relation,
          name: name,
          value: data[name],
          orm: model.orm
        });
      }
    });
    cb(null, data);
  },
  afterInput: function(data, cb) {
    _.each(this.model.options.relations, function(relation, name) {
      if (relation.type.afterInput && (name in data)) {
        relation.type.afterInput(data[name]);
      }
    });
    cb(null, data);
  },
  beforeSave: function(options, data, cb) {
    var model = this.model;
    _.each(model.options.relations, function(relation, name) {
      var beforeSave = relation.type.beforeSave;
      if (beforeSave) {
        beforeSave.call({
          relation: relation,
          name: name,
          value: data[name],
          orm: model.orm
        }, options, data, cb);
      }
    });
    cb(null, options, data);
  },
  afterSave: function(options, data, cb) {
    // Update backrefs from model.propLinks -> model.links.
    // Parent object can be model or collection. Have an abstraction that can
    // remove the related model. model.destroy, collection.remove(model)
          /* orm.propLinks = {
        childModelName: {
          childJoinedPropName: [joinedProperty, joinedProperty ...]
        }
      }; */

    /*
    orm.links.properties[this.model.name (relatedModel)][localRelationName "link"] == ['propertyName']
      for localRelationName in orm.links.properties[this.model.name (relatedModel)]
        if localRelationName.properties in _.keys(data)
          model = this.get(localRelationName);
          model.set(intersection);
          model.save(async)
    */
    cb(null, options, data);
  },/*
  afterFetch: function(options, data, cb) {
    cb(null, options, data);
  }*/
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
