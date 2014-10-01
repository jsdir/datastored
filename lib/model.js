var util = require('util');

var _ = require('lodash');
var async = require('async');
var valids = require('valids');

var Instance = require('./instance');
var utils = require('./utils');
var relations = require('./relations');
var marshallers = require('./marshallers');

function mergeCallbacks(dest, src) {
  for (var name in src) {
    if (name in dest) {
      if (_.contains(['initialize', 'defaults'], name)) {
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

function hideHiddenValues(data) {
  return _.omit(data, this.model.attrGroups.hidden);
}

function unserialize(data, cb) {
  cb(null, marshallers.unserialize(
    this.model.orm.marshaller, data, this.model.propertyTypes
  ));
}

function serialize(data) {
  return marshallers.serialize(
    this.model.orm.marshaller, data, this.model.propertyTypes
  );
}

function validate(options, data, cb) {
  var messages = {};
  var requiredAttributes = this.model.attrGroups.required;
  var names = _.keys(data);

  if (this.isNew) {
    _.each(_.difference(requiredAttributes, names), function(name) {
      messages[name] = util.format('attribute "%s" is required', name);
    });
  }

  valids.validate(data, {
    schema: _.pick(this.model.options.properties, names)
  }, function(validationMessages) {
    if (validationMessages) {_.extend(messages, validationMessages);}
    if (_.isEmpty(messages)) {
      cb(null, options, data);
    } else {
      cb(messages);
    }
  });
}

var ModelMixin = {
  callbacks: {
    afterInput: async.compose(unserialize),
    beforeOutput: _.compose(hideHiddenValues, serialize),
    beforeSave: validate
  }
};

function Model(name, orm, options) {
  var self = this;
  this.name = name;
  this.orm = orm;

  // Merge mixins.
  this.options = _.clone(options);

  // Validate options.
  // Require a column option.
  utils.requireAttributes(this.options, ['table']);

  // Validate properties.
  if (this.options.properties) {
    _.each(this.options.properties, function(options, name) {
      if (!options.type) {
        throw new Error('property "' + name + '" requires a type');
      }
    });
  }

  // Construct mixin list.
  var initialMixins = [ModelMixin, relations.RelationMixin];
  var mixins = initialMixins.concat(this.options.mixins || []);

  // Apply mixins.
  _.each(mixins, function(mixin) {
    _.each(mixin, function(prop, name) {
      var data = self.options[name];
      if (!data) {
        self.options[name] = {};
        data = self.options[name];
      }

      if (name === 'callbacks') {
        mergeCallbacks(data, prop);
      } else if (_.isObject(prop)) {
        _.extend(data, prop);
      } else {
        self.options[name] = prop;
      }
    });
  });

  // Clone the Model base class.
  this.instance = _.clone(Instance);

  // Set static methods.
  _.extend(this, options.staticMethods);

  // Set instance methods.
  _.extend(this.instance.prototype, options.methods);

  // Set attributes.
  this.attributes = _.extend(
    {}, this.options.properties, this.options.relations
  );

  this.propertyTypes = _.mapValues(this.options.properties, function(options) {
    return options.type;
  });

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
  var attributeNames = _.keys(this.attributes);

  this.attrGroups = _.object(_.map(groupOptions, function(all, option) {
    return [option, _.filter(attributeNames, function(name) {
      if (all || _.has(self.options.properties, name)) {
        return self.attributes[name][option];
      }
    })];
  }));

  // Validate the primary key property.
  var primaries = this.attrGroups.primary;
  if (primaries.length > 1) {
    throw new Error('multiple primary key properties defined: ' + primaries);
  } else if (primaries.length == 1) {
    this.pkProperty = _.first(primaries);
  } else {
    throw new Error('no primary key property defined');
  }

  // Check that the primary key property is actually a property.
  if (!(this.pkProperty in this.options.properties)) {
    throw new Error('primary key attribute "' + this.pkProperty +
      '" is not a property');
  }

  // Check that the primary key property has a valid type.
  var validTypes = ['string', 'integer'];
  if (!_.contains(validTypes, this.attributes[this.pkProperty].type)) {
    throw new Error('primary key property "' + this.pkProperty +
      '" must have string or integer type');
  }

  // Check that the primary key property is not hidden.
  if (_.contains(this.attrGroups.hidden, this.pkProperty)) {
    throw new Error('primary key property "' + this.pkProperty + '" ' +
      'cannot be hidden');
  }

  // Make the primary key property immutable.
  if (!_.contains(this.attrGroups.immutable, this.pkProperty)) {
    this.attrGroups.immutable.push(this.pkProperty);
  }

  // Ensure that only cached properties can be indexed.
  this.replaceIndexes = [];
  _.each(this.attrGroups.index, function(name) {
    var options = self.attributes[name];
    if (!options.cache && !options.cacheOnly) {
      throw new Error('only cached properties can be indexed');
    }
    if (options.replace !== false) {
      self.replaceIndexes.push(name);
    }
  });

  // Ensure that only cached props can have type counter.
  _.each(this.propertyTypes, function(type, name) {
    var options = self.attributes[name];
    if (type === 'counter' && !options.cache && !options.cacheOnly) {
      throw new Error('only cached properties can have type "counter"');
    }
  });

  // Set defaults.
  this.defaults = {};
  this.incrProperties = [];
  _.each(this.options.properties, function(options, name) {
    if (options.default) {
      self.defaults[name] = options.default;
    } else if (options.counter && options.type === 'integer') {
      self.defaults[name] = 0;
    } else if (options.counter && options.type === 'float') {
      self.defaults[name] = 0.0;
    }
  });

  var propNames = _.keys(this.options.properties);
  this.incrProperties = _.filter(propNames, function(name) {
    var options = self.options.properties[name];
    if (options.counter) {
      if (options.type === 'integer') {
        self.defaults[name] = 0;
        return true;
      } else if (options.type === 'float') {
        self.defaults[name] = 0.0;
        return true;
      } else {
        throw new Error('only properties of types "integer" and "float" ' +
          'can be counters');
      }
    }
  });

  // Run through `initialize` callback.
  var initialize = this._getCallback('initialize');
  if (initialize) {
    this.options = initialize(this.options);
  }
}

/**
 * Constructs a new `Instance` from the given data.
 * @param  {object}   data
 * @param  {boolean}  raw
 * @return {Instance}
 */
Model.prototype.create = function(attributes, raw) {
  var instance = new this.instance(this);

  var defaults = _.clone(this.defaults);
  // Set instance defaults.
  var defaultsCb = this._getCallback('defaults', instance);
  if (defaultsCb) {
    defaults = defaultsCb(defaults);
  }

  // Set model defaults.
  instance.set(defaults, true);

  if (attributes) {
    instance.set(attributes, raw);
  }
  return instance;
};

Model.prototype.createWithId = function(attributes, raw, cb) {
  if (_.isFunction(attributes)) {
    cb = attributes;
    attributes = null;
  }

  if (_.isFunction(raw)) {
    cb = raw;
    raw = false;
  }

  var instance = new this.instance(this);
  instance.set(this.defaults, true);

  instance._generateId(function(err) {
    if (err) {return cb(err);}
    if (attributes) {
      instance.set(attributes, raw);
    }
    cb(null, instance);
  });
};

Model.prototype.get = function(pkValue, raw) {
  var instance = this.create(_.object([[this.pkProperty, pkValue]]), raw);
  instance.isNew = false;
  return instance;
};

Model.prototype.find = function(name, value, raw, cb) {
  var self = this;

  if (_.isFunction(raw)) {
    cb = raw;
    raw = false;
  }

  // Check that the attribute is an index.
  if (!_.contains(this.attrGroups.index, name)) {
    throw new Error('attribute "' + name + '" is not an index');
  }

  var instance = this.create();
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
      cb(null, instance);
    }
  });
};

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
