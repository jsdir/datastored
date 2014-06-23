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
  utils.requireOptions(options, ['table', 'schema']);

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
  // TODO: decide if the io transforms should affect all attributes.
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
  this.modelConstructor.useDatastore(function(datastore) {
    datastore.save(this.id);
  }, cb);
}

Model.prototype.fetch = function(scope, cb) {

}

Model.prototype.destroy = function(cb) {
  var pk = this.getPk();
  var options = this.options;
  this.useDatastore({failOnError: true}, function(datastore, cb) {
    datastore.destroy(pk, options, cb);
  }, cb);
}

Model.prototype.transform = function(attributes, chain, cb) {
  var transformsByChain = this.modelConstructor.transformsByChain;
  var transforms = transformsByChain[chain] || [];

  if (chain === 'save') {
    transformAsync(this.options, attributes, transforms, cb);
  } else {
    return transformSync(this.options, attributes, transforms);
  }
}

Model.prototype.useDatastore = function(options, onDatastore, cb) {
  var datastores = this.modelConstructor.orm.datastores;

  async.series([
    function(datastoreCb) {
      onDatastore(datastores.redis, function(err, result) {
        if (err && options.failOnError) {
          cb(err);
        } else {
          datastoreCb(err, result);
        }
      });
    },
    function(datastoreCb) {
      onDatastore(datastores.cassandra, datastoreCb);
    }
  ], cb);
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

  model.set(attributes || {});
  return model;
}

ModelConstructor.prototype.get = function(pk) {
  return this.create(_.object([[this.pkAttribute, pk]]));
}

/**
 * Resolves index values to a model id.
 */
ModelConstructor.prototype.find = function(query, transform, cb) {
  if (!cb) {
    cb = transform;
    transform = false;
  }

  this.useDatastore(function(datastore, cb) {
    datastore.find(query, cb);
  }, function(err, pk) {
    if (err) {return cb(err);}
    return this.get(pk);
  });
}

module.exports = {
  ModelConstructor: ModelConstructor,
  Model: Model
};
