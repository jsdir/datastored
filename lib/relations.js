var async = require('async');

var HasOne = {
  initialize: function(options) {
    if (!options.relatedModel) {
      throw new Error('undefined relatedModel');
    }
  },
  afterInput: function(values, cb) {
    // Check model type.
    if (this.relatedModel) {
      throw new Error('relation "' + name + '" was set with a model of an ' +
        'invalid type');
    }
    cb(null, values);
  },
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
  beforeFetch: function(options, scope, cb) {
    var relationName = this.name;
    if (this.options.joinedProperties) {
      // Fetch joined properties if they are used.
      scope.push(_.map(this.options.joinedProperties, function(property) {
        return relationName + ':' + property;
      }));
    }
    cb(null, options, scope);
  },
  afterFetch: function(options, values, cb) {
    this.orm.models[]
    this.options.relatedModel
    // output initialized model with the pk
    // merge the fetched joined attributes back into the joined model
    cb(null, options, values);
  },
  _getJoinedProperties: function() {

  }
};

var HasMany = {
  initialize: function(options) {

  },
  create: function() {
    return new Collection(this);
  },
  afterInput: function() {
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
  beforeFetch: function(options, attributes, cb) {
    // Fetch counts if they are used.
    if (this.options.counterCache) {
      // Fetch count for HasMany if listed in attributes.
      if (_.contains(attributes, this.name)) {
        scope.properties.push(this.name + '_count');
      }
    }
  },
  afterFetch: function(options, values, cb) {
    // Set the counts if they are used.
    if (this.options.counterCache) {
      var countName = this.name + '_count';
      // Set count if listed in attributes.
      if (countName in values) {
        this.attributes[this.name]._setCount(values[countName]);
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

      // TODO: check options for HasMany
    });

    return options;
  },
  create: function() {
    var self = this;
    return _.each(this.options.relations, function(relation, name) {
      var create = relation.type.create;
      if (create) {
        create.call(self);
      }
    });
  },
  afterInput: function(values, cb) {
    // Ensure correct model types are set.
    // relation.afterInput()
    // 

    var relations = this.options.relations;
    if (relations) {
      _.each(values, function(value, name) {
        if (name in relations) {
          var relation = relations[name];
        }
      });
    }
    _.each(this.options.relations, function(relation, name) {
      var afterInput = relation.type.afterInput;
      afterInput();
    });
    /*
    _.each(this.options.relations, function(relation, name) {
      var value = values[name];
      var relatedModels = getRelatedModels(relation.relatedModels);

      if (relation.type === HasOne) {
        if (value || _.contains(relatedModels, value.model.name)) {
          cb(values);
        } else {
          throw new Error('relation "' + name + '" was set with a model of an' +
            'invalid type');
        }
      } else if (relation.type === HasMany) {
        if (value) {
          throw new Error('cannot set a HasMany relation');
        }
      }
    });*/
  },
  afterOutput: function(values) {
    /*var _this = this;

    _.each(this._hasOneRelationNames, function(name) {
      var model = _.this.get(name);
      if (model) {
        var relation = _this.model.attributes[name];
        var id = model.getPkValue(true);

        if (relation.joinedProperties) {
          // Convert HasOne relations with joined attributes into hashes.
          values[name] = {id: id};
          // TODO: get joined properties from "model"
          _.extend(values[name], model.getJoinedProperties());
        } else {
          // Convert HasOne relational targets into ids.
          values[name] = id;
        }
      }
    });

    // Omit HasMany relations.
    values = _.omit(values, this._hasManyRelationNames);
    */
    return values;
  },
  beforeFetch: function(options, scope, cb) {
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
  // get beforeSave and afterSave to function as a transaction?
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
  afterSave: function(options, values, cb) {
    // V update joinedProperties if this is a child model.
    // iterate through backrefs > relation > options
    //   if intersection options.joinedAttributes, this.changedProperties
    //     instantiate the parent through the backref
    //     set the changed/joined attributes directly and save the parent
    //       how to send the new attributes to the datastore without loading
    //       the child model stub. call the datastore directly without going through callbacks?
  },
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

function Collection(relation) {
  this.relation = relation;
  this.count = 0;

  this.datastore = this.relation.options.cache ? this.redis : this.cassandra

  this._resetModels();
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
}

Collection.prototype.add = function(model, score) {
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

Collection.prototype.fetch = function() {
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

Collection.prototype.save = function(cb, context) {
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
};

Collection.prototype._resetFetchOptions = function() {
  this.fetchOptions = {reverse: false, reset: false};
};

Collection.prototype._resetModels = function() {
  this.models = [];
}

function TreeCollection(relation) {
  this.relation = relation;
}

module.exports = {
  HasOne: HasOne,
  HasMany: HasMany,
  Tree: Tree,
  RelationMixin: RelationMixin
};
