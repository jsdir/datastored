var _ = require('lodash');

var Instance = require('./instance');
var utils = require('./utils');

function combineMixins(options) {
  // Nested mixins.
  var mixins = (options.mixins || []).reverse();
  var mixinOptions = _.map(mixins, combineMixins);
  return _.extend.apply(_.extend, [{}].concat(mixinOptions).concat(options));
}

function checkAttributeIndex(attribute) {
  // Check that all datastores are compatible with indexing.
  var incompatible = _.filter(attribute.datastores, function(datastore) {
    return !datastore.indexStore;
  });

  if (incompatible.length > 0) {
    throw new Error(util.format('datastores %s cannot be used to index',
      incompatible));
  }

  if (attribute.hasValue === false) {
    throw new Error('attribute must have a value in order to index');
  }

  if(!_.contains(['string', 'integer'], attribute.type)) {
    throw new Error('only strings and integers can be indexed');
  }
}

function checkAttribute(attribute) {
  // Check that at least one datastore is defined.
  if (_.isEmpty(attribute.datastores)) {
    throw new Error('no datastores have been defined for the attribute');
  }

  checkAttributeIndex(attributes);
}

function checkOptions(options) {
  utils.requireAttributes(options, ['table', 'attributes']);

  if (_.isEmpty(options.attributes)) {
    throw new Error('no attribute defined');
  }

  _.each(options.attributes, checkAttribute);
}

function Model(type, orm, options) {
  // Set up model class properties.
  this.type = type;
  this.orm = orm;

  this.options = combineMixins(options);
  checkOptions(this.options);

  // Set static methods.
  if (this.options.staticMethods) {
    _.extend(this, this.options.staticMethods);
  }

  // Set instance methods.
  this.instance = _.clone(Instance);
  _.extend(this.instance.prototype, this.options.methods);
}

Model.prototype.create = function(attributes, raw) {
  var instance = new this.instance(this);

  // Generate instance id.
  instance._generateId.call(instance);

  if (attributes) {
    instance.set(attributes, raw);
  }

  return instance;
};

Model.prototype.get = function(value, raw) {
  var instance = new this.instance(this);

  // Set the id.
  instance.set('id', value, raw);
  instance.isNew = false;
  // No need to `instance._resetValueState()` since id is never counted as a
  // changed attribute.

  return instance;
};

Model.prototype.find = function(name, value, raw, cb) {
  var self = this;

  // `raw` is optional.
  if (_.isFunction(raw)) {
    cb = raw;
    raw = false;
  }

  // Check that the attribute is an index.
  var attribute = this.options.attributes[name];
  if (!attribute) {
    throw new Error(util.format('attribute "%s" does not exist', name));
  }

  if (!attribute.index) {
    throw new Error(util.format('attribute "%s" is not an index', name));
  }

  // Use the first datastore.
  var datastore = attribute.datastores[0];
  var key = [this.options.table, name, value];
  datastore.indexStore.get(key, function(err, id) {
    if (err) {return cb(err);}
    if (_.isNull(id)) {
      // No instance was found. Call back with `null`.
      cb();
    } else {
      // An instance was found. Call back with the instance.
      cb(null, self.instance.get(id, true).set(name, value));
    }
  });
};

module.exports = Model;
