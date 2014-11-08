var util = require('util');

var _ = require('lodash');
var async = require('async');

var attributes = require('./attributes');
var Instance = require('./instance');
var utils = require('./utils');

/*
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
}*/

function checkOptions(type, options) {
  utils.requireAttributes(type, options, ['keyspace', 'attributes', 'idType']);

  // Check id type.
  if (!_.contains(['string', 'integer'], options.idType)) {
    throw new Error(type + '.idIype must be "string" or "integer"');
  }
}

function Model(type, orm, options) {
  // Set up model class properties.
  this.type = type;
  this.orm = orm;
  this._resetMode();

  this.options = mergeMixins(options);
  checkOptions(type, this.options);

  // Set static properties.
  _.extend(this, this.options.statics);

  // Set instance methods.
  this.instance = _.clone(Instance);
  _.extend(this.instance.prototype, this.options.methods);
}

Model.prototype.build = function(data) {
  return this._newInstance({data: data, userMode: this._userMode});
};

Model.prototype.withId = function(id) {
  return this._newInstance({id: id, userMode: this._userMode});
};

Model.prototype.create = function(data) {
  return this.build(data).save();
};

Model.prototype.find = function(name, value) {
  // TODO reset state
  var self = this;

  // Check that the attribute is an index.
  var attribute = this._requireAttribute(name);
  if (!attribute.indexStore) {
    throw new Error(util.format('attribute "%s" is not an index', name));
  }

  // Build the instance.
  var data = {};
  data[name] = value;
  var instance = this.build(data);

  // Use the first datastore.
  attribute.indexStore.get({
    keyspace: this.options.keyspace,
    attributeName: name,
    attributeValue: instance.get(name, true),
    types: this._attributeTypes
  }, function(err, id) {
    if (err) {return cb(err);}
    if (!_.isNull(id)) {
      // No instance was found.
      self.cb(); // TODO: callback with null if not default.
    } else {
      // An instance was found. Call back with the instance.
      self.cb(null, self.withId(id, {[name]: value}));
    }
  });

  return instance;
};

Model.prototype.userMode = function(state) {
  this._userMode = (state === null) || state;
  return this;
};

Model.prototype._newInstance = function(options) {
  var instance = new this.instance(this, options);
  this._resetMode();
  return instance;
};

Model.prototype._resetMode = function() {
  this._userMode = false;
};

Model.prototype._requireAttribute = function(name) {
  utils.requireAttributes(this._attributes, [name]);
  return attributes[name];
};

Model.prototype._load = function() {
  // Load all static and deferred attributes.
  var orm = this.orm;
  var attributes = this.options.attributes;
  this._attributes = _.object(_.map(attributes, function(attribute, name) {
    if (_.isFunction(attribute)) {
      // Deferred attribute
      return [name, attribute(orm)]
    } else {
      // Static attribute
      return [name, attribute];
    }
  }));

  // Load groups for instance methods.
  this._hashStoreGroups = this._getHashStoreGroups();
  this._attributeTypes = this._getAttributeTypes();
};

Model.prototype._getHashStoreGroups = function() {
  return _.reduce(this._attributes, function(result, attribute, name) {
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
  var types = _.object(_.map(this._attributes, function(attribute, name) {
    return [name, attribute.type];
  }));
  // Include `id` for datastore convenience.
  return _.extend({id: this.options.idType}, types);
};

module.exports = Model;
