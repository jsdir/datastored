var util = require('util');

var _ = require('lodash');
var async = require('async');

var attributes = require('./attributes');
var Instance = require('./instance');
var utils = require('./utils');

var CoreMixin = require('./mixins/core_mixin');

function mergeProps(mixins) {
  return _.merge.apply(_.merge, _.map(mixins, function(mixin) {
    return _.omit(mixin, ['transforms', 'attributes']);
  }));
}

function mergeAttrs(mixins, orm) {
  return _.merge.apply(_.merge, _.map(mixins, function(mixin) {
    return _.mapValues(mixin.attributes || {}, function(value, name) {
      return [name, _.isFunction(value) ? value(orm) : value];
    });
  }));
}

/**
 * Merges model transforms in their correct order.
 *
 * `id` attribute can be included.
 *
 * # Outgoing data flow
 *
 * input: core.input -> core.attr.input -> m1.input -> m1.attr.input
 *   model: (data, applyUserTransforms)
 *   attribute: (value, applyUserTransforms)
 *
 * fetch: core.fetch -> core.attr.fetch -> m1.fetch -> m1.attr.fetch
 *   model: (data, cb)
 *   attribute: (value, cb)
 *
 * # Incoming data flow
 *
 * output: core.output <- core.attr.output <- m1.output <- m1.attr.output
 *   model: (data, options, applyUserTransforms)
 *   attribute: (value, options, applyUserTransforms)
 *
 * outputAsync: core.outputAsync <- core.attr.outputAsync <- m1.outputAsync <- m1.attr.outputAsync
 *   model: (data, options, applyUserTransforms, cb)
 *   attribute: (value, options, applyUserTransforms, cb)
 *
 * save: core.save <- core.attr.save <- m1.save <- m1.attr.save
 *   model: (data, cb)
 *   attribute: (value, cb)
 */
function mergeTransforms(mixins) {
  return _.reduce(mixins, function(result, mixin) {

    function compose(name, func, reverse) {
      if (mixin[name]) {
        result[name] = reverse
          ? func(mixin[name], result[name])
          : func(result[name], mixin[name]);
      }
    }

    compose('input', function(func1, func2) {
      return function(data, applyUserTransforms) {
        func2(func1(data, applyUserTransforms), applyUserTransforms);
      }
    });

    compose('output', function(func1, func2) {
      return function(data, options, applyUserTransforms) {
        func2(func1(data, options, applyUserTransforms), options, applyUserTransforms);
      }
    });

    //compose('output', _.compose, true);
    compose('outputAsync', async.compose, true);
    compose('fetch', async.compose);
    compose('save', async.compose, true);

    return result;
  }, {
    input: function(data, applyUserTransforms) {
      return data;
    },
    fetch: function(data, cb) {
      cb(null, data);
    },
    output: function(data, options, applyUserTransforms) {
      return data;
    },
    outputAsync: function(data, options, applyUserTransforms, cb) {
      cb(null, data);
    },
    save: function(data, cb) {
      cb(null, data);
    }
  });
}

function Model(type, orm, options) {
  // Set up model class properties.
  this.type = type;
  this.orm = orm;

  // Get options as list of mixins.
  this._mixins = [{}, options].concat(options.mixins || []);
  this._props = mergeProps(this._mixins);
  utils.requireAttributes(this._props, ['keyspace', 'id']);

  // Set static properties.
  _.extend(this, this._props.statics);

  // Set instance methods.
  this._constructor = _.clone(Instance);
  _.extend(this._constructor.prototype, this._props.methods);
}

Model.prototype.build = function(data, applyUserTransforms) {
  return this._newInstance({data: data}, applyUserTransforms);
};

Model.prototype.create = function(data, applyUserTransforms) {
  return this.build(data, applyUserTransforms).save();
};

Model.prototype.withId = function(id, applyUserTransforms) {
  return this._newInstance({id: id}, applyUserTransforms);
};

Model.prototype.find = function(name, value, applyUserTransforms) {
  // Check that the attribute is an index.
  utils.requireAttributes(this._attributes, [name]);
  var attribute = this._attributes[name];
  if (!attribute.indexStore) {
    throw new Error(util.format('attribute "%s" is not an index', name));
  }

  // Build the instance.
  var data = {};
  data[name] = value;
  var instance = this.build(data, applyUserTransforms);

  // Find using attribute's indexStore.
  var deferred = RSVP.defer();
  attribute.indexStore.get({
    keyspace: this.options.keyspace,
    attributeName: name,
    attributeValue: instance.data[name],
    types: this._attributeTypes
  }, function(err, id) {
    if (err) {return deferred.reject(err);}
    if (_.isNull(id)) {return deferred.resolve(null);}
    instance.id = id;
    return deferred.resolve(instance);
  });

  return deferred.promise;
};

Model.prototype._getDefaults = function() {
  return _.reduce(this._attributes, function(result, attribute, name) {
    var value = attribute.defaultValue;
    if (!_.isUndefined(value)) {
      result[name] = _.isFunction(value) ? value() : value;
    }
    return result;
  }, {});
};

Model.prototype._getAttributeTypes = function() {
  return _.extend(_.mapValues(this.options.attributes, 'type'), {
    id: this.options.id.type
  });
};

Model.prototype._newInstance = function(data, applyUserTransforms) {
  return new this._constructor(this, data, applyUserTransforms);
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

/**
 * Called once all models are defined in the orm.
 */
Model.prototype._load = function() {
  this._attributes = mergeAttrs(this.mixins, this.orm);

  // Check attribute names.
  if (this._attributes.id) {
    throw new Error('attribute name cannot be "id"');
  }

  // Generate static data now that all of the models are defined.
  this._attributeTypes = this._getAttributeTypes();
  this._hashStoreGroups = this._getHashStoreGroups();
  this._transforms = mergeTransforms(this.mixins);
};

module.exports = Model;
