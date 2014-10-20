var util = require('util');

var _ = require('lodash');

var attributes = require('./attributes');
var Instance = require('./instance');
var utils = require('./utils');

function mergeMixins(options) {
  // Nested mixins.
  var mixins = (options.mixins || []).reverse();
  var mixinOptions = _.map(mixins, mergeMixins);
  return _.extend.apply(_.extend, [{}].concat(mixinOptions).concat(options));
}

function checkOptions(options) {
  utils.requireAttributes(options, ['keyspace', 'attributes', 'id']);

  // Check id type.
  var validIdAttributes = [attributes.Integer, attributes.String];
  if (!_.contains(validIdAttributes, options.id)) {
    throw new Error('id can only be string or integer');
  }
}

function Model(type, orm, options) {
  // Set up model class properties.
  this.type = type;
  this.orm = orm;

  this.options = mergeMixins(options);
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
  instance._generateId();

  if (attributes) {
    instance.set(attributes, raw);
  }

  return instance;
};

Model.prototype.get = function(value, raw) {
  var instance = new this.instance(this);

  // Set the id.
  instance.set({id: value}, raw);
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

  // Check that the attribute exists.
  utils.requireAttributes(this.options.attributes, [name]);

  // Check that the attribute is an index.
  var attribute = this.options.attributes[name];
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
