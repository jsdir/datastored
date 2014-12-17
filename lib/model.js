var util = require('util');

var _ = require('lodash');
var async = require('async');
var RSVP = require('rsvp');

var attributes = require('./attributes');
var Instance = require('./instance');
var utils = require('./utils');
var mixins = require('./mixins');

function mergeProps(mixins) {
  return _.merge.apply(_.merge, _.map(mixins, function(mixin) {
    return _.omit(mixin, ['transforms', 'attributes']);
  }));
}

function mergeAttrs(mixins, orm) {
  var attributes = _.merge.apply(_.merge, _.map(mixins, function(mixin) {
    return _.mapValues(mixin.attributes, function(value, name) {
      return _.isFunction(value) ? value(orm) : value;
    });
  }));

  if (_.isEmpty(attributes)) {
    throw new Error('no attributes have been defined');
  }

  return attributes;
}

/**
 * Merges model transforms in their correct order.
 *
 * `id` attribute can be included.
 *
 * # Incoming data flow
 *
 * input: core.input -> core.attr.input -> m1.input -> m1.attr.input
 *   model: (data, applyUserTransforms)
 *   attribute: (value, applyUserTransforms)
 *
 * fetch: core.fetch -> core.attr.fetch -> m1.fetch -> m1.attr.fetch
 *   model: (data, cb)
 *   attribute: (value, cb)
 *
 * # Outgoing data flow
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
        return func2.bind(this)(func1.bind(this)(data, applyUserTransforms), applyUserTransforms);
      }
    });

    compose('output', function(func1, func2) {
      return function(data, options, applyUserTransforms) {
        return func2.bind(this)(func1.bind(this)(data, options, applyUserTransforms), options, applyUserTransforms);
      }
    });

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
  this._mixins = [{}, mixins.Core, mixins.Serialize, options]
    .concat(options.mixins || []).concat(mixins.AttributeTransforms);
  this._props = mergeProps(this._mixins);
  utils.requireAttributes(this._props, ['keyspace', 'id']);

  // Set static properties.
  _.extend(this, this._props.statics);

  // Set instance methods.
  this._constructor = _.clone(Instance);
  _.extend(this._constructor.prototype, this._props.methods);
}

Model.prototype.create = function(data, applyUserTransforms) {
  return this._newInstance({}, false).save(data, applyUserTransforms);
};

Model.prototype.withId = function(id, applyUserTransforms) {
  return this._newInstance({id: id}, applyUserTransforms);
};

Model.prototype.find = function(name, value, applyUserTransforms) {
  var self = this;

  // Check that the attribute is an index.
  utils.requireAttributes(this._attributes, [name]);
  var attribute = this._attributes[name];
  if (!attribute.indexStore) {
    throw new Error(util.format('attribute "%s" is not an index', name));
  }

  // Build the instance.
  var data = {};
  data[name] = value;
  var instance = this._newInstance({data: data}, applyUserTransforms);

  // Find using attribute's indexStore.
  return new RSVP.Promise(function(resolve, reject) {
    attribute.indexStore.get({
      keyspace: self._props.keyspace,
      attributeName: name,
      attributeValue: instance._data[name],
      types: self._attributeTypes
    }, function(err, id) {
      if (err) {return reject(err);}
      if (_.isNull(id)) {return resolve(null);}
      instance.id = id;
      instance.saved = true;
      resolve(instance);
    });
  });
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
  return _.extend(_.mapValues(this._attributes, 'type'), {
    id: this._props.id.type
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
  this._attributes = mergeAttrs(this._mixins, this.orm);

  // Check attribute names.
  if (this._attributes.id) {
    throw new Error('attribute name cannot be "id"');
  }

  // Generate static data now that all of the models are defined.
  this._attributeNames = _.keys(this._attributes);
  this._attributeTypes = this._getAttributeTypes();
  this._hashStoreGroups = this._getHashStoreGroups();
  this._transforms = mergeTransforms(this._mixins);
};

module.exports = Model;
