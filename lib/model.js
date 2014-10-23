var util = require('util');

var _ = require('lodash');
var async = require('async');

var attributes = require('./attributes');
var Instance = require('./instance');
var utils = require('./utils');

var SerializationMixin = require('./mixins/serialization_mixin');
var ValidationMixin = require('./mixins/validation_mixin');

function mergeMixins(options) {
  var modelMixins = [SerializationMixin, ValidationMixin];
  var mixins = modelMixins.concat(options.mixins || []);

  return _.reduce([options].concat(mixins), function(memo, mixin) {
    _.each(mixin, function(value, key) {
      if (key === 'transform') {
        memo[key] = _.extend({}, memo[key], value, function(a, b) {
          return _.isUndefined(a) ? b : _.compose(a, b);
        });
      } else if (key === 'asyncTransform') {
        memo[key] = _.extend({}, memo[key], value, function(a, b) {
          return _.isUndefined(a) ? b : async.compose(a, b);
        });
      } else if (_.isPlainObject(value)) {
        memo[key] = _.merge({}, memo[key], value);
      } else {
        memo[key] = value;
      }
    });

    return memo;
  }, {});
}

function checkOptions(options) {
  utils.requireAttributes(options, ['keyspace', 'attributes', 'idType']);

  // Check id type.
  if (!_.contains(['string', 'integer'], options.idType)) {
    throw new Error('id type can only be "string" or "integer"');
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
  if (!attribute.indexed) {
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
