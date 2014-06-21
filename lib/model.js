var _ = require('lodash');
var async = require('async');

var utils = require('./utils');

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

function Model(name, options) {
  this.name = name;
  this.options = options;

  this.attributes = {};
  this.attributeNames = _.keys(this.options.schema);
}

Model.prototype.transform = function(data, chain) {
  return data;
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

Model.prototype.get = function(attributes, transform) {
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

  // Transform the data by default.
  if (transform !== false) {
    data = this.transform(data, 'output');
  }

  if (single) {
    return data[attributes];
  } else {
    return data;
  }
}

Model.prototype.save = function(cb) {
  this.useDatastore(function(datastore) {
    datastore.save(this.id);
  }, cb);
}

Model.prototype.fetch = function(scope, cb) {

}

Model.prototype.destroy = function(cb) {
  this.useDatastore(function(datastore) {
    datastore.save(this.id);
  }, cb);
}

function ModelConstructor(name, options) {
  this.name = name;
  this.options = options;

  var modelOptions = parseOptions(options);

  // Load model options as properties.
  this.pkAttribute = modelOptions.pkAttribute;
  this.indexes = modelOptions.indexes;

  // Set static methods.
  if (this.options.staticMethods) {
    for (var name in this.options.staticMethods) {
      this[name] = this.options.staticMethods[name];
    }
  }
}

ModelConstructor.prototype.create = function(attributes) {
  var model = new Model(this.name, this.options);

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
ModelConstructor.prototype.find = function(query, cb) {
  this.useDatastore(function(datastore, cb) {
    datastore.find(query, cb);
  }, function(err, pk) {
    if (err) {return cb(err);}
    return this.get(pk);
  });
}

ModelConstructor.prototype.useDatastore = function(onDatastore, cb) {
  async.series([
    function(cb) {
      onDatastore(this.options.orm.datastores.redis, cb);
    },
    function(cb) {
      onDatastore(this.options.orm.datastores.cassandra, cb);
    }
  ], function(err, result) {

  });
}

module.exports = {
  ModelConstructor: ModelConstructor,
  Model: Model
};
