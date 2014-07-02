var _ = require('lodash');
var async = require('async');

var transforms = require('./transforms');
var utils = require('./utils');

function Model(factory) {
  this.factory = factory;
  this.options = factory.options;
  this.attributes = this._getInitialAttributes();
  this.changedAttributes = [];
  this.isValid = true;
}

/**
 * Populates properties with their default values and populates relational
 * attributes with their initial values.
 * @return {object} Initial attributes
 */
Model.prototype._getInitialAttributes = function() {
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

/**
 * @return {*} The value of the instance's primary key.
 */
Model.prototype.getPk = function() {
  return this.attributes[this.factory.pkAttribute];
};

Model.prototype.set = function(name, value, raw) {
  var self = this;

  if (raw === null) {
    // Set attributes.
    var attributes = name;
    raw = value;
  } else {
    // Use a single attribute.
    var attributes = _.object([[name, value]]);
  }

  this._beforeInput(attributes, function(err, attributes) {
    if (err) {
      self.setError(err);
    } else {
      // Unserialize the attributes if requested.
      if (raw !== false) { // `raw` should default to `true`.
        attributes = this._unserialize(attributes, self.setError);
      }

      if (self.isValid) {
        // Only set registered attributes.
        var data = _.pick(attributes, self.factory.attributeNames);

        // Set changed attributes.
        self.changedAttributes = _.union(self.changedAttributes, _.filter(data,
          function(value, name) {
            return value !== self.get(name, true);
          }
        );
      }
    }
  });

  // Return the model for chaining.
  return this;
};

Model.prototype._beforeFetch = function(attributes) {
  var func = (this.options.callbacks || {}).beforeFetch;
  if (func) {
    return func(attributes);
  } else {
    return attributes;
  }
};

Model.prototype._afterFetch = function(req, data, cb) {
  var func = (this.options.callbacks || {}).afterFetch;
  if (func) {
    func(req, data, cb);
  } else {
    cb(null, data);
  }
};

Model.prototype._beforeInput = function(attributes, cb) {
  var func = (this.options.callbacks || {}).beforeInput;
  if (func) {
    func(attributes, cb);
  } else {
    cb(attributes);
  }
};

Model.prototype._beforeOutput = function(attributes, cb) {
  var func = (this.options.callbacks || {}).beforeOutput;
  if (func) {
    func(attributes, cb);
  } else {
    cb(attributes);
  }
};

Model.prototype.get = function(attributes, raw) {
  var single = false;
  if (_.isString(attributes)) {
    attributes = [attributes];
    single = true;
  }

  // TODO: also include the id of HasOne relations as result.

  // Only get existing properties.
  attributes = _.intersection(attributes, _.keys(this.options.properties));

  var data = _.pick(this.attributes, attributes);

  if (!raw) {
    data = this._serialize(this.transform(data, 'output'));
    // Serialize after callback.
  }

  if (single) {
    return data[attributes];
  } else {
    return data;
  }
};

Model.prototype.toObject = function(scope, raw) {
  if (scope) {
    var attributeNames = this._getScope(scope);
  } else {
    var attributeNames = this.factory.attributeNames;
  }
  return this.get(attributeNames, raw);
};

Model.prototype.save = function(req, scope, cb) {
  if (!this.isValid) {return cb(this.err);}
  var self = this;

  if (this.changedAttributes.length > 0) {
    // Only save changed attributes (includes properties and relations).
    this.beforeSave(req, this.attributes, function(err, attributes) {
      if (err) {return cb(err);}
      self.factory._saveToDatastores(function(datastore, cb) {
        datastore.save(attributes, cb);
      }, cb);
      self.changedAttributes = []; // at the end
    });
  }

  // Recursively save dependents with head recursion.
  async.each(this.relations, function(relation, cb) {

  });

  // Get referencing models and their linking relations.
  var changedProperties = this.getChangedProperties();
  // get all attributes that changedProperties includes, just iterate through backrefs like destroy does.
  // foreach attribute fetch (like destroy):
  //   target.set(properties).save()
  this.factory._joined

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
        self.factory._saveToDatastores(function(datastore) {
          datastore.save(attributes);
        }, cb);
        self.
      });
    }
  }
};

Model.prototype.fetch = function(req, scope, cb) {
  if (!this.isValid) {return cb(this.err);}
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

  // Add additional attributes.
  var attributes = this.beforeFetch(attributes);

  this.factory._fetchFromDatastores(function(datastore, cb) {
    datastore.fetch(self.factory.name, pk, attributes, cb);
  }, function(err, data, restore) {
    if (err) {
      return cb(err);
    } else if (data) {
      // The model was found.
      // No fetch pipeline for now.
      // TODO: unserialize with datastore transform
      self._afterFetch(req, self._unserialize(data), function(err, data) {
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
  if (!this.isValid) {return cb(this.err);}
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
      var ref = self.factory._backrefs[relationName];

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
    self.factory.destroyFromDatastores(function(datastore, cb) {
      datastore.destroy(self.factory.name, pk, cb);
    }, cb);
  });
};

Model.prototype._serialize = function(data, cb) {
  marshaller.serialize({
    marshaller: this.factory.orm.marshaller,
    data: data,
    types: this.options.properties
  }, cb);
};

Model.prototype._unserialize = function(data, cb) {
  marshaller.unserialize({
    marshaller: this.factory.orm.marshaller,
    data: data,
    types: this.options.properties
  }, cb);
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
  var options = this.factory.options;
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

Model.prototype._onInput = function(attributes, raw) {
  if (!raw) {
    // Unserialize the attributes.
    attributes = this._unserialize(attributes);
  }

  // Ignore values provided for immutable properties.
  var immutableProperties = _.filter(_.keys(properties), function(n) {
    return options.properties[n].immutable;
  });

  var properties = this.options.properties;
  attributes = _.omit(attributes, immutableProperties);

  this.mixins.callbacks(onInput);

  // All models will have the following base transforms.
  var modelTransforms = [
    { // Validates all input against the attributes rules in the properties.
      save: function(attributes, options, cb) {
        var messages = {};
        var valid = true;

        // Iterate through the model's attributes and rules.
        for (var name in options.properties) {
          var attribute = options.properties[name];

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
        return _.omit(attributes, _.filter(_.keys(options.properties), function(n) {
          return options.properties[n].hidden;
        }));
      }
    },
    { // Enforce attribute immutability.
      input: function(attributes, options) {
        return _.omit(attributes, _.filter(_.keys(options.properties), function(n) {
          return options.properties[n].immutable;
        }));
      }
    }
  ];
};

Model.prototype._onOutput = function(attributes, raw) {
  if (!raw) {
    // Serialize the attributes.
    attributes = this._serialize(attributes);
  }
};

Model.prototype._onSave = function(attributes, cb) {
  // user defined save functions
  // Generate an id if the model is new.
  // Validate the properties.
  // Validate the relations.
};

Model.prototype._setError = function(err) {
  this.isValid = false;
  this.err = err;
};

Model.prototype._runCallback = function(name) {
  if (name in (this.options.callbacks || {})) {
    this.options.callbacks[name].apply(this, _.rest(_.values(arguments)));
  }
};

function mergeFunctions(dest, src) {
  var syncCallbacks = ['afterInitialize', 'beforeFetch', 'beforeOutput'];
  for (var name in src) {
    var func = src[name];
    if (name in dest) {
      if _.contains(syncCallbacks, name) {
        // Sync callback.
        dest[name] = _.compose(dest[name], func);
      } else {
        // Async callback.
        dest[name] = async.waterfall(dest[name], func);
      }
    } else {
      dest[name] = func;
    }
  }
  return dest;
}

function ModelFactory(name, orm, options) {
  var self = this;
  this.name = name;
  this.orm = orm;

  var optionsList = [options].concat(options.mixins || []);
  this.options = _.reduce(optionsList, function(memo, options) {
    // Merge everything except callbacks. Callbacks are composed.
    var merged = _.merge({}, memo, _.omit(options, 'callbacks'));
    merged.callbacks = mergeFunctions(memo.callbacks, options.callbacks);
    return merged;
  }, {});

  // Load model options as properties.
  var modelOptions = this._parseOptions(this.options);
  this.pkAttribute = modelOptions.pkAttribute;
  this.indexes = modelOptions.indexes;

  // Clone the Model base class.
  this.model = _.clone(Model);

  // Set static methods.
  _.extend(this, this.options.staticMethods);

  // Set instance methods.
  _.extend(this.model.prototype, this.options.methods);

  // Run `afterInitialize` exclusively with the factory as the receiver.
  if (this.options.callbacks || this.options.callbacks.afterInitialize) {
    this.options.callbacks.afterInitialize.call(this)
  }

  // After mixins have potential modified the attributes, get the names.
  this.attributeNames = _.union(
    _.keys(this.options.properties), _.keys(this.options.relations)
  );

  this._backrefs = {};
}

ModelFactory.prototype.create = function(attributes, raw, cb) {
  this.orm.constructRelations();
  this.options = this.parseOptions(this.options);
  var model = new this.model(this);
  return model.set(attributes || {}, raw, cb);
};

ModelFactory.prototype.get = function(pk, raw) {
  var attributes = _.object([[this.pkAttribute, pk]]);
  if (raw !== false) {
    attributes = this.transform(attributes, 'input');
  }
  return this.create(attributes);
};

/**
 * Resolves index values to a model id.
 */
ModelFactory.prototype.find = function(query, cb, transform) {
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

ModelFactory.prototype._parseOptions = function(options) {
  // First, apply the mixins.
  options.mixins;
  mixin.callbacks;

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
        scopeDiff + '`');
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
  utils.requireAttributes(options, ['table', 'properties']);

  // Check for a primary key attribute.
  for (name in options.properties) {
    var attribute = options.properties[name];
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

ModelFactory.prototype._fetchFromDatastores = function(cached, onDatastore, cb) {
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

ModelFactory.prototype._saveToDatastores = function(cached, onDatastore, cb) {
  // Save to cassandra first.
  onDatastore(this.cassandra, function(err) {
    if (err) {
      cb(err);
    } else if (cached) {
      // Also save to redis if requested.
      onDatastore(this.redis, cb);
    }
  });
};

ModelFactory.prototype._addBackrefsToRelated = function(models) {
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

ModelFactory.prototype._addBackref = function(model, relationName) {
  if (!model.name in this._backrefs) {
    this._backrefs[model.name] = [];
  }
  this._backrefs.push({relationName: relationName, model: model});
};

module.exports = {
  ModelFactory: ModelFactory,
  Model: Model
};
