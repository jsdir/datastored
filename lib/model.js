var _ = require('lodash');
var async = require('async');

var transforms = require('./transforms');
var utils = require('./utils');

// All models will have the following base transforms.
var modelTransforms = [
  { // Validates all input against the attributes rules in the schema.
    save: function(attributes, options, cb) {
      var messages = {};
      var valid = true;

      // Iterate through the model's attributes and rules.
      for (var name in options.schema) {
        var attribute = options.schema[name];

        // Rules are optional.
        if (attribute.rules && attributes.hasOwnProperty(name)) {
          var value = attributes[name];
          var message = validateAttribute(name, value, attribute.rules);
          if (message) {
            messages[name] = message;
            valid = false;
          }
        }
      }

      if (valid) {
        cb(null, attributes);
      } else {
        cb(messages);
      }
    }
  },
  { // Validates relation rules.
    save: function(attributes, options) {
      _.each(options.relations, function(relation, name) {
        // Have the relation type validate the value.
        relation.type.validate(relation, name, attributes[name]);
      });
    }
  },
  { // Hide hidden attributes.
    output: function(attributes, options) {
      return _.omit(attributes, _.filter(_.keys(options.schema), function(n) {
        return options.schema[n].hidden;
      }));
    }
  },
  { // Enforce attribute immutability.
    input: function(attributes, options) {
      return _.omit(attributes, _.filter(_.keys(options.schema), function(n) {
        return options.schema[n].immutable;
      }));
    }
  }
];

/**
 * Groups transforms and adds them to the existing transforms while
 * preserving order based on the type of chain.
 */
function parseTransforms(transforms) {
  var transformsByChain = {};

  _.each(transforms, function(transform) {
    _.each(transform, function(func, chain) {
      // Create the new chain if necessary.
      if (!transformsByChain.hasOwnProperty(chain)) {
        transformsByChain[chain] = [];
      }

      if (chain === 'output' || chain === 'save') {
        // Reverse order for outgoing chains.
        transformsByChain[chain].unshift(func);
      } else {
        transformsByChain[chain].push(func);
      }
    });
  });

  return transformsByChain;
}

function Model(modelConstructor) {
  this.modelConstructor = modelConstructor;
  this.options = modelConstructor.options;
  this.attributes = this.getInitialAttributes();
  this.changedAttributes = [];
}

Model.prototype.getInitialAttributes = function() {
  var self = this;
  // Initialize relational attributes with their default values.
  return _.object(_.map(this.options.relations, function(relation, name) {
    var initialValue = null;
    if (relation.type.getInitialValue) {
      initialValue = relation.type.getInitialValue({
        relationName: name,
        relation: relation,
        model: self
      });
    }
    return [name, initialValue];
  }));
};

Model.prototype.getPk = function() {
  return this.attributes[this.modelConstructor.pkAttribute];
};

Model.prototype.set = function(name, value, raw) {
  if (raw === null) {
    // Set attributes.
    var attributes = name;
    raw = value;
  } else {
    // Use a single attribute.
    var attributes = _.object([[name, value]]);
  }

  // Raw should default to `true`.
  if (raw !== false) {
    raw = true;
  }

  this.beforeSet(attributes, function(err, attributes) {
    if (err) {
      throw new Error(err);
    } else {
      var data = _.pick(attributes, this.relationAndAttributeNames);
    }
  });

  /*
  // Apply all `set` methods from the mixins.
  // async.
  var composed = _.compose.apply(this.modelConstructor.mixins.set);
  var attributes = composed(attributes);
  */

  // Only set attributes that are defined or are relations.
  var data = _.pick(attributes, this.relationAndAttributeNames);
  //attributes = this.getAssociatedAttributes(attributes);

  if (!raw) {
    // TODO: only transform properties
    data = this.transform(this._unserialize(data), 'input');
  }

  // Set changed attributes.
  this.changedAttributes = _.union(this.changedAttributes, _.keys(data));

  // Return the model for chaining.
  return this;
};

Model.prototype.get = function(attributes, raw) {
  var single = false;
  if (_.isString(attributes)) {
    attributes = [attributes];
    single = true;
  }

  // Fail if requesting attributes that do not exist.
  var difference = _.difference(attributes, this.relationAndAttributeNames);
  if (difference.length > 0) {
    throw new Error('undefined attribute `' + difference[0] + '`');
  }

  var data = _.pick(this.attributes, attributes);

  if (!raw) {
    data = this._serialize(this.transform(data, 'output'));
  }

  if (single) {
    return data[attributes];
  } else {
    return data;
  }
};

Model.prototype.toObject = function(scope, raw) {
  if (scope) {
    var attributes = this._getScope(scope);
    return this.get(attributes, raw);
  } else {
    return this.get(this.relationAndAttributeNames, raw);
  }
};

Model.prototype.save = function(req, scope, cb) {
  // Only save changed attributes and relational models.
  async.each(this.relations, function(relation, cb) {

  });

  // Get referencing models and their linking relations.
  var changedProperties = this.getChangedProperties();
  // get all attributes that changedProperties includes, just iterate through backrefs like destroy does.
  // foreach attribute fetch (like destroy):
  //   target.set(properties).save()
  this.modelConstructor._joined

  async.each(this.options.relations, function(relation, name) {
    var value = attributes[name];
    if (value) {
      value.save(cb, self, name); // send the parent and the referencing link
    }
  }, function() {
    // Save the current model's attributes. Include relational attributes.
    // merge relational attributes from existing relational attribute values:
    //
    // (methods for getting the identifiers should be in relations.js)
    // HasOne: value.getPk()
    // HasMany: none?
    // BelongsTo: value.getPk()
    // HasAndBelongsToMany
  });

  // async both:
  // iterate through relation targets and save()
  // if attributes changed:
  //   save to datastore

  if (self.isNew) { // self.changed
    cb();
  } else {
    // Recursively save models and relational constructs.
    var attributes = this.attributes;
    async.each(this.options.relations, function(relation, name) {
      var value = attributes[name];
      if (value) {
        value.save(cb, self, name); // send the parent and the referencing link
      }
    });

    // after the children are saved to the datastores, collect their references
    // and load them into the current model.

    // relation.foo(relational attribute value)

    if (nothingChanged) {
      cb(null, this);
    } else {
      var self = this;
      this.transform(this.attributes, 'save', function(err, attributes) {
        self.modelConstructor.saveToDatastores(function(datastore) {
          datastore.save(attributes);
        }, cb);
        self.
      });
    }
  }
};

Model.prototype.fetch = function(req, scope, cb) {
  var self = this;
  var pk = this._requirePk();

  // Keep the access request optional.
  if (cb === null) {
    cb = scope;
    scope = req;
    req = null;
  }

  // Filter the attributes by including all properties and all relations that
  // are set to use attributes.
  var attributes = _.filter(this._getScope(scope), function(name) {
    if (name in this.options.relations) {
      var relation = this.options.relations[name];
      return relation.type.useProperties;
    }
    return true;
  });

  // Add associated attributes.
  var attributes = this._getAssocAttributes();

  this.modelConstructor._fetchFromDatastores(function(datastore, cb) {
    datastore.fetch(self.modelConstructor.name, pk, attributes, cb);
  }, function(err, data, restore) {
    if (err) {
      return cb(err);
    } else if (data) {
      // The model was found.
      // No fetch pipeline for now.
      // TODO: unserialize with datastore transform
      self._onDatastoreFetch(req, self._unserialize(data), function(err, data) {
        if (err) {return cb(err);}
        // Populate model with data.
        _.each(data, function(value, name) {
          var fetchedAttributes = {};
          if (name in self.options.relations) {
            // Attribute is a relation. Convert it into a usable object.
            var relation = self.options.relations[name];
            var unserializeRelation = relation.type.unserializeRelation;
            fetchedAttributes[name] = unserializeRelation(self, name, value);
          } else {
            // Attribute is a property.
            fetchedAttributes[name] = value;
          }
        });

        self.set(fetchedAttributes, true);
      });

      cb(self);
    } else {
      // No model was found.
      cb();
    }

    if (restore) {
      // Restore the cache.
      self._saveToCache();
    }
  });
};

Model.prototype.destroy = function(req, cb) {
  var self = this;
  var pk = this._requirePk();

  // Keep the access request optional.
  if (cb === null) {
    cb = req;
    req = null;
  }

  // Run `beforeDelete` callback.
  this.beforeCallback(req, function(err) {
    if (err) {return cb(err);}

    // Destroy all backrefs through head recursion.
    _.each(relationNames, function(relationName) {
      var ref = self.modelConstructor._backrefs[relationName];

      // target can be collection or model
      var target = self.get(relationName);
      target.setRelationNull(ref.relationName, self);
      // sets HasOne to null, removes from HasMany collection.
      var relationType = target.relations[ref.relationName].type;
      if (relationType === relations.HasOne) {
        target.set(ref.relationName, null);
      } else if (relationType === relations.HasMany) {
        target.get(ref.relationName).remove(self);
        // TODO: the above should decrement any counters.
      }
      target.save();
    });

    // Destroy the model.
    self.modelConstructor.destroyFromDatastores(function(datastore, cb) {
      datastore.destroy(self.modelConstructor.name, pk, cb);
    }, cb);
  });
};

Model.prototype._serialize = function(data) {
  var marshaller = this.modelConstructor.marshaller;
  return marsahllers.serialize(marshaller, data, this.options);
};

Model.prototype._unserialize = function(data) {
  var marshaller = this.modelConstructor.marshaller;
  return marsahllers.unserialize(marshaller, data, this.options);
};

Model.prototype._getScope = function(scope) {
  if (!scope) {
    // If the scope is undefined, use all attributes.
    return
  } else if (_.isArray(scope)) {
    return scope;
  } else if (!(scope in this.options.scopes)) {
    throw new Error('undefined scope `' + scope + '`');
  } else {
    return this.options.scopes[scope];
  }
};

Model.prototype._saveToCache = function() {
  /* saves everything to cache and ignore changedAttributes. Does not traverse into relations.*/
};

Model.prototype._filterAttributes = function(func) {
  var options = this.modelConstructor.options;
  return _.filter(_.union(
    _.keys(options.attributes), _.keys(options.relations)
  ), func);
};

Model.prototype._requirePk = function() {
  var pk = this.getPk();
  if (pk) {
    return pk;
  } else {
    throw new Error('model must have a defined primary key');
  }
}

function ModelConstructor(name, orm, options) {
  var modelOptions = this._parseOptions(options);
  this.name = name;
  this.orm = orm;
  this.options = options;

  // Model marshaller should default to orm's `options.modelMarshaller`.
  this.marshaller = options.marshaller || orm.modelMarshaller;

  // Load model options as properties.
  this.pkAttribute = modelOptions.pkAttribute;
  this.indexes = modelOptions.indexes;

  // Clone the Model base class.
  this.model = _.extend({}, Model);

  // Set static methods.
  _.extend(this, this.options.staticMethods);

  // Set instance methods.
  _.extend(this.model.prototype, this.options.methods);

  // Apply mixins.
  var mixins = {
    set: [];
  };

  _.each(this.options.mixins, function(mixin) {
    if (mixin.beforeFetch) {
      self.beforeFetch = next; // TODO: waterfall
    }
    if (mixin.set) {
      mixins.push(mixin.set);
    }
  });

  this.mixins = mixins;
  this._backrefs = {};
}

ModelConstructor.prototype._parseOptions = function(options) {
  // First, apply the mixins.
  options.mixins

  // Check that property and relation names do not collide.
  var attribueNames = _.keys(options.attributes);
  var relationNames = _.keys(options.relations);
  var diff = _.difference(attributeNames, relationNames);
  if (diff.length > 0) {
    throw new Error('attributes' + diff + 'are defined as both properties ' +
      'and relations');
  }

  // Check that the scopes include valid attributes.
  var attributeNames = _.union(attributeNames, relationNames);
  _.each(options.scopes, function(scope, name) {
    var scopeDiff = _.difference(scope, attributeNames)
    if (scopeDiff.length > 0) {
      throw new Error('scope `' + name +'` defines undefined attributes ',
        scopeDiff);
    }
  });

  // Solve relational dependencies.
  // This should only be called after all model definitions.
  _.each(options.relations, function(relation, name) {
    // Add back-references to child models.
    this.orm.models[relation.relatedModel]._addBackref(name, this.model);
  });


  var pkAttribute = null;
  var indexes = [];

  // Check for required options.
  utils.requireAttributes(options, ['table', 'schema']);

  // Check for a primary key attribute.
  for (name in options.schema) {
    var attribute = options.schema[name];
    if (attribute.primary) {
      if (pkAttribute) {
        throw new Error('only one primary key attribute can be defined per ' +
          'model');
      } else {
        pkAttribute = name;
      }
    } else if (attribute.index) {
      indexes.push(name);
    }
  }

  if (!pkAttribute) {
    throw new Error('a primary key attribute is required');
  }

  return {
    pkAttribute: pkAttribute,
    indexes: indexes
  };
};

ModelConstructor.prototype.create = function(attributes, raw) {
  this.orm.constructRelations();
  if (!this.optionsParsed) {
    this.optionsParsed = true;
    this.options = this.parseOptions(this.options);
  }

  var model = new this.model(this);
  return model.set(attributes || {}, raw);
};

ModelConstructor.prototype.get = function(pk, raw) {
  var attributes = _.object([[this.pkAttribute, pk]]);
  if (raw !== false) {
    attributes = this.transform(attributes, 'input');
  }
  return this.create(attributes);
};

/**
 * Resolves index values to a model id.
 */
ModelConstructor.prototype.find = function(query, cb, transform) {
  // Use only one query attribute for now.
  var attribute = _.first(_.keys(query));

  // Check if the attributes in the query are indexed.
  if (!_.contains(this.indexes, attribute)) {
    throw new Error('attribute `' + attribute + '` is not indexed');
  }

  if (transform !== false) {
    query = this.transform(query, 'input');
  }

  this.fetchFromDatastores(function(datastore, cb) {
    datastore.find(query, cb);
  }, function(err, pk, restore) {
    if (err) {return cb(err);}
    cb(null, this.get(pk));
  });
};

ModelConstructor.prototype._fetchFromDatastores = function(onDatastore, cb) {
  onDatastore(this.redis, function(err, result) {
    var noCacheResult = !result;
    if (err || noCacheResult) {
      onDatastore(this.cassandra, function(err, result) {
        // Set restore flag.
        cb(err, result, result && noCacheResult);
      });
    } else {
      cb(null, result);
    }
  });
};

ModelConstructor.prototype._addBackrefsToRelated = function(models) {
  var self = this;
  var modelName = this.name;
  _.each(this.options.relations, function(relation, name) {
    if (relation.deleteReferences !== false) {
      var relationName = relation.reverseRelationName || modelName;
      var relatedModel = models[relation.relatedModel];
      if relatedModel.relations.hasOwnProperty(relationName) {
        throw new Error('Relation `x` already exists on `y`. Try using reverseRelationName.');
      }
      relatedModel.relations[relationName] = {
        type: Relations.HasOne,
        cache: relation.cache,
        relatedModel: modelName
      }
      // Only add backrefs if the relation is set to `deleteReferences`.
      models[relation.relatedModel]._addBackref(this, name);
      relatedModel.backrefs[relationName] = {
        x: self,
        name: name
      }
    }
  });
};

ModelConstructor.prototype._addBackref = function(model, relationName) {
  if (!model.name in this._backrefs) {
    this._backrefs[model.name] = [];
  }
  this._backrefs.push({relationName: relationName, model: model});
};

module.exports = {
  ModelConstructor: ModelConstructor,
  Model: Model
};
