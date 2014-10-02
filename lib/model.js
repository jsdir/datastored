var _ = require('lodash');
var async = require('async');

var ModelMixin = require('./mixins/model_mixin')
var Instance = require('./instance');
var utils = require('./utils');
var relations = require('./relations');

function mergeCallbacks(dest, src) {
  for (var name in src) {
    if (name in dest) {
      if (_.contains([
        'beforeInitialize', 'afterInitialize', 'defaults'
      ], name)) {
        // Synchronous function.
        dest[name] = _.compose(dest[name], src[name]);
      } else if (_.contains(['beforeOutput', 'afterOutput'], name)) {
        // Reverse synchronous function.
        dest[name] = _.compose(src[name], dest[name]);
      } else {
        // Asynchronous callback.
        dest[name] = async.compose(dest[name], src[name]);
      }
    } else {
      // Set the initial function.
      dest[name] = src[name];
    }
  }

  return dest;
}

function Model(name, orm, options) {
  this.options = this._applyMixins(options);

  // Run initialization callback. Extra attributes may be added.
  this.options = this._initialize('beforeInitialize', this.options);

  // Set up model class properties.
  this.name = name;
  this.orm = orm;
  this.defaults = {};
  this.attributes = _.extend({}, this.options.properties,
    this.options.relations);
  this.attrNames = _.keys(this.attributes);

  // Check options that relate to the entire model.
  this._checkModelOptions(this.options);

  // Register properties.
  this._initializeAttrGroups();
  this._registerProperties();

  this.options = this._initialize('afterInitialize', this.options);

  // Set static methods.
  if (this.options.staticMethods) {
    _.extend(this, this.options.staticMethods);
  }

  // Set instance methods.
  this.instance = _.clone(Instance);
  _.extend(this.instance.prototype, this.options.methods);
}

/**
 * Constructs a new `Instance` from the given data.
 * @param  {object}   data
 * @param  {boolean}  raw
 * @return {Instance}
 */

Model.prototype.create = function(attributes, raw) {
  var instance = new this.instance(this);

  // Generate instance id.
  instance._generateId.call(instance);

  var defaults = _.clone(this.defaults);
  // Set instance defaults.
  var defaultsCb = this._getCallback('defaults', instance);
  if (defaultsCb) {
    defaults = defaultsCb(_.clone(this.defaults));
  }

  // Set model defaults.
  instance.set(defaults, true);

  if (attributes) {
    instance.set(attributes, raw);
  }

  return instance;
};

Model.prototype.get = function(value, raw) {
  var instance = new this.instance(this);

  // Set the id.
  var data = {};
  data[this.pkProperty] = value;
  instance.set(data, raw);
  instance.isNew = false;
  // No need to `isntance._resetValueState()` since id is never counted as a
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
  if (!_.contains(this.attrGroups.index, name)) {
    throw new Error('attribute "' + name + '" is not an index');
  }

  var instance = new this.instance(this);
  instance.set(name, value, raw);

  var datastores = this._getDatastores();
  datastores.redis.find({
    column: this.options.table,
    index: name,
    value: instance.get(name, true)
  }, function(err, id) {
    if (err) {return cb(err);}
    if (_.isNull(id)) {
      cb(null, null);
    } else {
      instance.set(self.pkProperty, id, true);
      instance.isNew = false;
      // `instance._resetValueState` will set changedAttributes to `[]`.
      instance._resetValueState();
      cb(null, instance);
    }
  });
};

// Initialization methods

Model.prototype._initialize = function(name, options) {
  // Run through `{before,after}Initialize` callback.
  var cb = this._getCallback(name);
  if (cb) {
    return cb(options);
  } else {
    return options;
  }
};

Model.prototype._initializeAttrGroups = function() {
  var self = this;

  // Options are `true` if they can be used by properties and relations.
  // Options are `false` if they can only be used by properties.
  var groupOptions = {
    immutable: true,
    hidden: true,
    cache: true,
    cacheOnly: true,
    required: true,
    primary: false,
    index: false
  };

  this.attrGroups = _.object(_.map(groupOptions, function(all, option) {
    return [option, _.filter(self.attrNames, function(name) {
      if (all || _.has(self.options.properties, name)) {
        return self.attributes[name][option];
      }
    })];
  }));
};

Model.prototype._registerProperties = function() {
  var self = this;
  var properties = this.options.properties || {};

  this.pkProperty = null;
  this.incrProperties = [];
  this.replaceIndexes = [];
  this.propertyTypes = _.mapValues(properties, function(options) {
    return options.type;
  });

  // Set value 0 as initial defaults for integer and float counters.
  _.each(properties, function(options, name) {

    if (!options.type) {
      throw new Error('property "' + name + '" requires a type');
    }

    if (options.counter) {
      // Check counter property type.
      if (options.type !== 'integer' && options.type !== 'float') {
        throw new Error('counter property must be integer or float')
      }

      if (!options.cache && !options.cacheOnly) {
        throw new Error('only cached properties can have type "counter"');
      }

      self.incrProperties.push(name);
    }

    // Check property caching.
    if (options.index && !options.cache && !options.cacheOnly) {
      throw new Error('only cached properties can be indexed');
    }

    // Add to replace indexes by default.
    if (options.replace !== false) {
      self.replaceIndexes.push(name);
    }

    if (options.primary) {
      // Check that a primary key is not already defined.
      if (self.pkProperty) {
        throw new Error('multiple primary keys defined');
      }

      self.pkProperty = name;

      // Check that the primary key property has a valid type.
      var validTypes = ['string', 'integer'];
      if (!_.contains(validTypes, self.attributes[self.pkProperty].type)) {
        throw new Error('primary key property "' + self.pkProperty +
          '" must have string or integer type');
      }

      // Check that the primary key property is not hidden.
      if (_.contains(self.attrGroups.hidden, self.pkProperty)) {
        throw new Error('primary key property "' + self.pkProperty + '" ' +
          'cannot be hidden');
      }
    }

    // Set defaults.
    if (options.default) {
      self.defaults[name] = options.default;
    } else if (options.counter && options.type === 'integer') {
      self.defaults[name] = 0;
    } else if (options.counter && options.type === 'float') {
      self.defaults[name] = 0.0;
    }
  });

  // Require a primary key property.
  if (!this.pkProperty) {
    throw new Error('no primary key property defined');
  }

  // Make the primary key property immutable.
  if (!_.contains(this.attrGroups.immutable, this.pkProperty)) {
    this.attrGroups.immutable.push(this.pkProperty);
  }
};

Model.prototype._applyMixins = function(options) {
  // Construct mixin list.
  var initialMixins = [ModelMixin, relations.RelationMixin];
  var mixins = initialMixins.concat(options.mixins || []);

  // Apply mixins.
  _.each(mixins, function(mixin) {
    _.each(mixin, function(prop, name) {
      var data = options[name];
      if (!data) {
        options[name] = {};
        data = options[name];
      }

      if (name === 'callbacks') {
        mergeCallbacks(data, prop);
      } else if (_.isObject(prop)) {
        _.extend(data, prop);
      } else {
        options[name] = prop;
      }
    });
  });

  return options;
}

Model.prototype._checkModelOptions = function(options) {
  // Require a model table name.
  utils.requireAttributes(options, ['table']);
};

// Utility methods

Model.prototype._getCallback = function(name, object) {
  if (this.options.callbacks) {
    var callback = this.options.callbacks[name];
    if (callback) {
      return _.bind(callback, object || this);
    }
  }
};

Model.prototype._getDatastores = function() {
  return this.orm.datastores;
};

module.exports = Model;
