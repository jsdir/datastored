var _ = require('lodash');
var async = require('async');

var HasOne = {
  /**
   * Make sure that the set value is of the model type or null.
   */
  afterInput: function(values, cb) {
    // Check model type.
    var model = values[this.name];

    var relatedModels = this.options.relatedModel;
    if (!_.isArray(relatedModels)) {
      relatedModels = [relatedModels];
    }

    if (model && !_.contains(relatedModels, model.name)) {
      throw new Error('relation "' + name + '" was set with a model of an ' +
        'invalid type');
    }
    cb(null, values);
  },
  /**
   * Scopes.
   * If the target model is loaded, show the id. If the model has a scope that
   * includes joined properties, include those in the output.
   */
  afterOutput: function(values, scope) {
    // type if necessary
    // some way to show scope for joined models through HasOne?
    var model = values[this.name];
    if (model) {
      // Output the model pk.
      values[this.name] = model.getPkValue(true);
    }
    return values;
  },
  /**
   * Include joined properties as extra properties to fetch.
   */
  beforeFetch: function(options, attributes, cb) {
    var relationName = this.name;
    if (this.options.joinedProperties) {
      // Fetch joined properties if they are used.
      attributes.push(_.map(this.options.joinedProperties, function(property) {
        return relationName + ':' + property;
      }));
    }
    cb(null, options, attributes);
  },
  /**
   * Set the joined properties on the target model.
   */
  afterFetch: function(options, values, cb) {
    var id = values[this.name];
    if (id) {
      values[this.name] = this.orm.models[this.options.relatedModel].get(id);
    }

    var joinedProperties = this.options.joinedProperties;
    var relationName = this.name;
    if (joinedProperties) {
      _.each(joinedProperties, function(property) {
        var value = values[relationName + ':' + property];
        if (value) {

        }
      });
      values = _.omit(values, this.options.joinedProperties);
    }

    cb(null, options, values);
  }
};

var HasMany = {
  /**
   * Create the Instance with a stub Collection.
   */
  create: function() {
    return new Collection(this.instance, this);
  },
  initialize: function(options) {
    if (this.options.through) {
      // Ensure through exists and is HasMany
      // Ensure throughRelation exists and is HasOne
      // Add throughBackref to this.relations[through]
    }
  },
  /**
   * Prevent the attribute from being mutated.
   */
  afterInput: function(values, cb) {
    throw new Error('cannot set a HasMany relation');
  },
  afterOutput: function(values) {
    // TODO: use scope?
    if (this.options.counterCache) {
      // Make sure that the counts hash exists.
      if (!values.counts) {
        values.counts = {};
      }
      values.counts[this.name] = this.attributes[this.name].count;
    }
    return _.omit(values, this.name);
  },
  /**
   * Include counters as extra properties to fetch.
   */
  beforeFetch: function(options, attributes, cb) {
    // Fetch counts if they are used.
    if (this.options.counterCache) {
      // Fetch count for HasMany if listed in attributes.
      if (_.contains(attributes, this.name)) {
        scope.properties.push(this.name + '_count');
      }
    }
  },
  /**
   * Set the counters on the target collections.
   */
  afterFetch: function(options, values, cb) {
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
  }
};

var Tree = {
  create: function() {
    return new TreeCollection();
  },
  afterInput: function() {
    throw new Error('cannot set a Tree relation');
  },
  beforeDestroy: function() {
    // destroy descendants if dependent
  }
};

var RelationMixin = {
  initialize: function(options) {
    var model = this;
    var models = model.orm.models;

    _.each(options.relations, function(relation, name) {
      if (relation.backrefs !== false) {
        // Require "relatedModel" and "relatedName"
        if (!relation.relatedModel) {
          throw new Error('relation "' + name + '" requires an option ' +
            '"relatedModel"');
        }
        if (!relation.relatedName) {
          throw new Error('relation "' + name + '" requires an option ' +
            '"relatedName"');
        }

        // Handle if "relatedModels" is defined as an array.
        var relatedModels = relatedModel;
        if (_.isString(relatedModels)) {
          relatedModels = [relatedModels];
        }

        _.each(relatedModels, function(modelName) {
          // Set initial backrefs map.
          var relatedModel = models[modelName];
          relatedModel._backrefs = relatedModel._backrefs || {};

          // Save the backref.
          relatedModel._backrefs[relation.relatedName] = {
            model: model, relation: name
          };
        });
      }
    });

    return options;
  },
  create: function(values) {
    var self = this;
    return _.each(this.options.relations, function(relation, name) {
      var create = relation.type.create;
      if (create) {
        create.call(self);
      }
    });
    return values;
  },
  afterInput: function(values, cb) {
    _.each(this.options.relations, function(relation, name) {
      var afterInput = relation.type.afterInput;
      if (afterInput) {
        afterInput.call(this);
      }
    });
  },
  afterOutput: function(values) {
    _.each(afterOuput);
    return values;
  },
  beforeFetch: function(options, attributes, cb) {
    _.each(beforeFetch);
    // add joined attributes to the fetch attributes list
  },
  afterFetch: function(options, values, cb) {
    var _this = this;

    _.each(this._hasOneRelationNames, function(name) {
      var value = values[name];
      if (_.isObject(value)) {

      } else if (value) {

      }
    });
    // since fetch outputs values directly into values, each attributes is
    // an individual flow
    // receive null, id, or hash with attributes:
    //   this.attributes[name] == options
    //   convert into normal model representations
    //   Set hashes directly as the model values, no mutation.
  },
  /**
   * TODO: get beforeSave and afterSave to function as a transaction?
   * Save changed properties recursively.
   *   - Use options to indicate whether to save relations recursively or not.
   *   - Prevent circular save.
   */
  beforeSave: function(options, values, cb) {
    // save the HasOne descendants
    async.each(this.options.relations, function(relation, name) {
      var value = _this.values[name];
      if (value) {
        value.save(cb, self, name); // send the parent and the referencing link
      }
    }, function() {

    });
  },
  /**
   * Update joined properties on parent models.
   */
  afterSave: function(options, values, cb) {
    // V update joinedProperties if this is a child model.
    // iterate through backrefs > relation > options
    //   if intersection options.joinedAttributes, this.changedProperties
    //     instantiate the parent through the backref
    //     set the changed/joined attributes directly and save the parent
    //       how to send the new attributes to the datastore without loading
    //       the child model stub. call the datastore directly without going through callbacks?
  },
  /**
   * Destroy backrefs for all relations.
   */
  beforeDestroy: function(options, cb) {
    // have commands executed atomically
    var _this = this;

    // Destroy backrefs.
    var backrefs = this.model._backrefs;
    var backrefNames = _.keys(backrefs);

    this.fetch(backrefNames, function(err) {
      if (err) {return cb(err);}

      // Destroy each backref.
      async.each(backrefNames, function(name, cb) {
        var backref = backrefs[name];
        var parent = _this.get(name);

        parent.set(backref.relation, null).save(cb);
      }, function(err) {
        if (err) {return cb(err);}

        // Destroy dependent relations.
        var relationNames = _.keys(_this.options.relations);
        async.each(relationNames, function(relationName, cb) {
          var relation = relationNames[relationName];
          if (relation.dependent) {
            // ?
            // TODO: use a loaded hash to keep track of hasone relations that are legitimately null.
            var child = _this.get(name);
            if (child) {
              child.destroy(cb);
            }
          }
        }, cb);
      });
    });
  }
};

function Collection(instance, relation) {
  this.relation = relation;
  this.count = 0;

  this.datastore = this.relation.options.cache ? this.redis : this.cassandra;

  this._resetModels();
  this._resetFetchOptions();

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

Collection.prototype.add = function(model, score, cb) {
  this.models.push(model);
  this.deletedModels = _.without(this.deletedModels, model);
  this.addedModels.push(model);
  this.count += 1;
};

Collection.prototype.remove = function(model) {
  this.models = _.without(this.models, model);
  this.addedModels = _.without(this.addedModels, model);
  this.deletedModels.push(model);
  this.count -= 1;
};

Collection.prototype.has = function(models, cb) {
  this.datastore.has(this.collection, cb);
};

Collection.prototype.fetch = function(scope, cb) {
  var self = this;
  this.datastore.fetch(this.fetchOptions);

  // Reset models on reverse.
  if (this.fetchOptions.reset) {
    this._resetModels();
  }

  this._resetFetchOptions();
  func(function(err, results) {
    self.relation.options
  });
};

Collection.prototype.save = function(cb) {
  context.relationName
  context.relation
  context.model
  relation.name
  // collection also needs parent model and relationName
  // should this data be provided with the save method?
  var self = this;

  async.series([
    function(cb) {
      // Save all models in the collection.
      async.each(self.models, function(model, cb) {
        model.save(cb);
      }, cb);
    },
    function(cb) {
      // Save model primary keys to datastore.
      // Add ids as a batch.
      var ids = getIds(self.addedModels);
      context.model.factory.saveToDatastores(function(datastore) {
        datastore.addToCollection(context.model, relation.name, ids);
        self.addedModels = [];
        // then
        datadata.removeFromCollection
        self.deletedModels = [];
      }, context.relation.cache, cb);
    }
  ], cb);

  // After save, check this.model.relation[this.relation] for "throughBackrefs"
  // Get added or removed models into array.
  // Check that each item has a relations[throughRelation] loaded. It can be
  // null; it just needs to be loaded.
  // Save the targets of these relations to throughBackrefs setter.
};

Collection.prototype._resetFetchOptions = function() {
  this.fetchOptions = {reverse: false, reset: false};
};

Collection.prototype._resetModels = function() {
  this.models = [];
}

function TreeCollection(relation) {
  this.relation = relation;
  // no limit, offset for now
  // options.cache / nocache

  // TODO: level limit
  // TODO: global count and local count
  //   tree needs a meta SET of members?
  //   each member of a tree needs a pointer to the root ancestor's parent/relation
  //   child knows that it is the descendant of an ancestor tree through
  //   (tree?)backrefs. Tree requires three relations on the child: children, parent,
  //   and root?

  this.context = {
    column: this.instance.model.column,
    id: this.instance.id
  };

  if (this.options.cache) {
    this.datastore = this.datastores.redis;
  } else {
    this.datastore = this.datastores.cassandra;
    // use merkle trees
  }
}

TreeCollection.prototype.fetch = function(options, cb) {
  // allow options.slice only if not cached for now
  options.includeLeaves = true; // default

  if (this.options.cache) {

  }

  // fetches ids linearly and builds nested models
  this.datastore.fetchTree(this.context, function(err, data) {
    if (err) {return cb(err);}
    async.parallel(_.keys(data), function(id, cb) {
      this.options.relatedModel
      var model;
      model.fetch([this.options.entrypointRelation], cb);
    }, function(err) {
      if (err) {return cb(err);}
      cb(null, data);
    });
  });
};

TreeCollection.prototype.save = function(cb) {

};

TreeCollection.prototype.toObject = function(scope) {

};

module.exports = {
  HasOne: HasOne,
  HasMany: HasMany,
  Tree: Tree,
  RelationMixin: RelationMixin
};
