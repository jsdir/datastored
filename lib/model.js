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

  // Load groups for instance methods.
  this._hashStoreGroups = this._getHashStoreGroups();
  this._attributeTypes = this._getAttributeTypes();

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
  if (!attribute.indexDatastore) {
    throw new Error(util.format('attribute "%s" is not an index', name));
  }

  // Use the first datastore.
  attributesByDatastore.indexStore.get({
    keyspace: this.options.keyspace,
    attributeName: name,
    value: value,
    types: this._attributeTypes
  }, function(err, id) {
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

Model.prototype._getHashStoreGroups = function() {
  return _.reduce(this.options.attributes, function(result, attribute, name) {
    _.each(attribute.hashStores || [], function(hashStore) {
      // Try to find an existing hashStore index.
      var group = _.find(result, function(group) {
        return (group.hashStore === hashStore);
      });

      if (group) {
        group.attributes.push(name)
      } else {
        result.push({hashStore: hashStore, attributes: [name]});
      }
    });
    return result;
  }, []);
};

Model.prototype._getAttributeTypes = function() {
  var options = this.options;
  var types = _.object(_.map(options.attributes, function(attribute, name) {
    return [name, attribute.type];
  }));
  // Include `id` for datastore convenience.
  return _.extend({id: options.idType}, types);
};

module.exports = Model;
