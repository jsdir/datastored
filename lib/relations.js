var _ = require('lodash');
var async = require('async');

function initializeLinks(relationName, relation, orm) {
  // setupLinks will validate the links and save them to the model class
  if (relation.link) {
    var relatedModel = orm.models[relation.relatedModel]
    relatedModel.links[relation.link] = relationName;
  }
}

var HasOne = {
  initialize: function(options) {
    // Initialize links and validate joined properties.
    initializeLinks(this.name, this.relation, this.orm);

    var props = this.relation.joinedProperties;
    if (props) {
      var relatedModel = this.orm.models[this.relation.relatedModel];
      var relatedPropNames = _.keys(relatedModel.options.properties);
      var difference = _.difference(props, relatedPropNames);
      if (difference.length > 0) {
        throw new Error('relation "' + this.name + '" property "' +
          difference + '" is not a valid property');
      }

      // for each joined property of related model
      relatedModel.propLinks[joinedProperty] = relation.link;
    }

    return options;
  },
  beforeInput: function(data) {
    // Validate relatedModel type.
    var instance = this.value;
    var relatedModel = this.relation.relatedModel;

    /*
    if (!_.isArray(relatedModels)) {
      relatedModels = [relatedModels];
    }
    */

    if (instance && relatedModel !== instance.model.name) {
      throw new Error('relation "' + this.name + '" was set with a model of ' +
        'an invalid type');
    }
  },
  beforeSave: function(options, data, cb) {
    // Convert to model id for saving.

    // Get the related model id.
    var model = this.value;
    if (model) {
      // If the model is not saved yet, save it.
      data[this.name] = model.getId();
    }
    cb(null, options, data);
  },
  beforeFetch: function(options, attributes, cb) {
    // Include joined properties as extra properties to fetch.

    var relationName = this.name;
    if (this.options.joinedProperties) {
      // Fetch joined properties if they are used.
      attributes.push(_.map(this.options.joinedProperties, function(property) {
        return relationName + ':' + property;
      }));
    }
    cb(null, options, attributes);
  },
  afterFetch: function(options, data, cb) {
    // Convert fetched ids to a model.

    // Set fetched joined properties on the related model.


    // convert the id to an initialized model.
    attr = model.get(id);
    cb(null, options, data);

    // Also set the joined properties on the target model
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
    return new Collection(this);
  },
  initialize: function(options) {
    initializeLinks(this.name, this.relation, this.orm);
    return options;
  },
  // Prevent the attribute from being mutated.
  afterInput: function(values, cb) {
    throw new Error('cannot set a HasMany relation');
  },
  afterOutput: function(values) {
    // TODO: remove the relation from output
    // LATER: Only get "counts.<relation_name>"
    // Make an exception for get to fetch collections even if not raw

    /*
    // TODO: use scope?
    if (this.options.counterCache) {
      // Make sure that the counts hash exists.
      if (!values.counts) {
        values.counts = {};
      }
      values.counts[this.name] = this.attributes[this.name].count;
    }
    return _.omit(values, this.name);
    */
  },
  beforeFetch: function(options, attributes, cb) {
    // LATER: counts
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
  }
};

var Tree = {
  create: function() {
    return new Collection();
  },
  initialize: function() {
    // require:
    //  - parentRelation
    //  - childrenRelation
    //  - link: (Tree attribute)
    //
    // extras:
    //  - maxLevels
    //
    // Tree differences with HasMany:
    // All children get a root parent context,
    // on any descendant "childrenRelation.add", validate that maxLevels is not
    // being exceeded.
    // TODO: allow dynamic parent switching?
    //
    // Extra collection methods:
    //   add collection option for recursive fetching
    //
  },
  afterInput: function() {
    throw new Error('cannot set a Tree relation');
  }
};

var callbacks = {
  initialize: function(options) {
    // Validate relation options and run the initialize callback.

    var orm = this.orm;
    _.each(options.relations, function(relation, name) {
      // Require a "relatedModel" for each relation.
      if (!relation.relatedModel) {
        throw new Error('relation "' + name + '" requires a "relatedModel" ' +
          'option');
      }

      // Ensure that the related model exists.
      orm._requireModel(relation.relatedModel);

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
    var parentRelations = _.pick(this.model.propLinks, _.keys(data));
    if (parentRelations.length > 0) {
      this.fetch(parentRelations, function(err) {
        if (err) {return cb(err);}
        _.each(parentRelations, function(parentRelation) {
          self.get(parentRelation).set(key, value);
          self.save(cb);
          cb(null, options, data);
        });
      });
    }
  },
  afterFetch: function(options, data, cb) {
    cb(null, options, data);
  }
};

var RelationMixin = {
  callbacks: callbacks
};

function Collection(options) {
  this.options = options;

  this.options.name;
  this.options.relation;
  this.options.instance;
  this.options.tree;

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
