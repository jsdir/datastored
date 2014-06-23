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
  { // Hide hidden attributes.
    output: function(attributes, options) {
      return _.omit(attributes, _.filter(_.keys(options.schema), function(n) {
        return options.schema[n].hidden;
      }));
    }
  }/*,
  { // Enforce attribute immutability.
    input: function(attribute, options) {
      options.schema
    }
  }*/
];

function parseOptions(options) {
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
}

function transformSync(options, attributes, chain) {
  return _.reduce(chain, function(existing, transform) {
    return transform(existing, options);
  }, attributes);
}

function transformAsync(options, attributes, chain, cb) {
  async.reduce(chain, attributes, function(existing, transform, cb) {
    transform(existing, options, cb);
  }, cb);
}

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
  this.name = modelConstructor.name;
  this.options = modelConstructor.options;

  this.attributes = {};
  this.attributeNames = _.keys(this.options.schema);
}

Model.prototype.getPk = function() {
  return this.attributes[this.modelConstructor.pkAttribute];
}

Model.prototype.set = function(attr, value, transform) {
  // Set multiple attributes at first.
  var data = attr;

  if (!_.isObject(attr)) {
    // Set a single attribute.
    var data = _.object([[attr, value]]);
  } else {
    // Shift the `transform` argument.
    transform = value;
  }

  // Only set attributes that are defined.
  data = _.pick(data, this.attributeNames);

  // Transform the data by default.
  if (transform !== false) {
    data = this.transform(data, 'input');
  }

  // changedAttributes
  _.extend(this.attributes, data);

  // Return the model for chaining.
  return this;
}

Model.prototype.get = function(attributes) {
  var single = false;
  if (_.isString(attributes)) {
    attributes = [attributes];
    single = true;
  }

  // Fail if requesting attributes that do not exist in the schema.
  var difference = _.difference(attributes, this.attributeNames);
  if (difference.length > 0) {
    throw new Error('invalid attribute `' + difference[0] + '`');
  }

  var data = _.pick(this.attributes, attributes);

  if (single) {
    return data[attributes];
  } else {
    return data;
  }
}

Model.prototype.save = function(cb) {
  this.modelConstructor.saveToDatastores(function(datastore) {
    datastore.save(this.attributes);
  }, cb);
}

Model.prototype.fetch = function(scope, cb) {
  var self = this;
  var attributes = this.options.scopes[scopes]
  this.modelConstructor.fetchFromDatastores(function(datastore, cb) {
    datastore.fetch(attributes, cb);
  }, function(err, data, restore) {
    if (err) {return cb(err);}
    var model = self.set(self.transform(data, 'fetch'), false)
    cb(null, model);
    if (restore) {
      model.saveToCache();
    }
  });
}

Model.prototype.destroy = function(cb) {
  var pk = this.getPk();
  var context = this.getDatastoreContext();
  var options = this.options;
  this.modelConstructor.destroyFromDatastores(function(datastore, cb) {
    datastore.destroy(context, cb);
  }, cb);
}

function ModelConstructor(name, orm, options) {
  this.name = name;
  this.orm = orm;
  this.options = options;

  var modelOptions = parseOptions(options);

  // Load model options as properties.
  this.pkAttribute = modelOptions.pkAttribute;
  this.indexes = modelOptions.indexes;

  this.transformsByChain = parseTransforms(this.orm.modelTransforms.concat(
    modelTransforms, options.transforms || []
  ));

  // Set static methods.
  if (this.options.staticMethods) {
    for (var name in this.options.staticMethods) {
      this[name] = this.options.staticMethods[name];
    }
  }
}

ModelConstructor.prototype.create = function(attributes, transform) {
  var model = new Model(this);

  // Set instance methods.
  if (this.options.methods) {
    for (var name in this.options.methods) {
      model[name] = this.options.methods[name];
    }
  }

  model.set(attributes || {}, transform);
  return model;
}

ModelConstructor.prototype.get = function(pk, transform) {
  var attributes = _.object([[this.pkAttribute, pk]]);
  if (transform !== false) {
    attributes = this.transform(attributes, 'input');
  }
  return this.create(attributes);
}

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
}

ModelConstructor.prototype.fetchFromDatastores = function(onDatastore, cb) {
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
}

ModelConstructor.prototype.transform = function(attributes, chain, cb) {
  var transforms = this.transformsByChain[chain] || [];

  if (chain === 'save') {
    transformAsync(this.options, attributes, transforms, cb);
  } else {
    return transformSync(this.options, attributes, transforms);
  }
}

module.exports = {
  ModelConstructor: ModelConstructor,
  Model: Model
};
