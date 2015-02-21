var util = require('util');

var _ = require('lodash');
var RSVP = require('rsvp');

var attributes = require('./attributes');
var Instance = require('./instance');
var utils = require('./utils');
var mixins = require('./mixins');

function mergeProps(mixins) {
  return _.merge.apply(_.merge, _.map(mixins, function(mixin) {
    return _.omit(mixin, 'attributes');
  }));
}

function mergeAttrs(mixins, orm) {
  var attrs = _.merge.apply(_.merge, _.map(mixins, function(mixin) {
    return _.mapValues(mixin.attributes, function(value, name) {
      return _.isFunction(value) ? value(orm, name) : value;
    });
  }));

  if (_.isEmpty(attrs)) {
    throw new Error('no attributes have been defined');
  }

  return attrs;
}

function syncNoop(data, options) {
  return data;
}

function asyncNoop(data, options, cb) {
  cb(null, data);
}

function syncCompose(func1, func2) {
  return function(data, options) {
    return func2.call(this, func1.call(this, data, options), options);
  };
}

function asyncCompose(func1, func2) {
  return function(data, options, cb) {
    var self = this;
    func1.call(self, data, options, function(err, changedData) {
      if (err) {return cb(err);}
      func2.call(self, changedData, options, cb);
    });
  };
}

/**
 * Merges model transforms in their correct order.
 */

function mergeTransforms(mixins) {
  return _.reduce(mixins, function(result, mixin) {

    function compose(name, func, reverse) {
      if (mixin[name]) {
        result[name] = reverse ?
          func(mixin[name], result[name])
          : func(result[name], mixin[name]);
      }
    }

    compose('input', syncCompose, true);
    compose('output', syncCompose, false);
    compose('fetch', asyncCompose, true);
    compose('save', asyncCompose, false);

    return result;
  }, {
    input: syncNoop,
    output: syncNoop,
    save: asyncNoop,
    fetch: asyncNoop
  });
}

function extractMixins(mixins) {
  var mixinList = [];
  _.each(mixins || [], function(mixin) {
    mixinList.push(mixin);
    mixinList = mixinList.concat(extractMixins(mixin.mixins));
  });
  return mixinList;
}

function Model(type, orm, options) {
  // Set up model class properties.
  this.type = type;
  this.orm = orm;

  // Get options as list of mixins.
  this._mixins = [
    {},
    mixins.Core,
    mixins.Serialize,
    options
  ].concat(extractMixins(options.mixins))
    .concat(mixins.AttributeTransforms);
  this._props = mergeProps(this._mixins);
  utils.requireAttributes(this._props, ['keyspace', 'id']);

  // Set static properties.
  _.extend(this, this._props.statics);

  // Set instance methods.
  function ModelInstance() {
    return Instance.apply(this, arguments);
  }

  ModelInstance.prototype = _.extend({},
    Instance.prototype,
    this._props.methods,
    {constructor: ModelInstance}
  );

  this._constructor = ModelInstance;
}

Model.prototype.create = function(data, options) {
  return new this._constructor(this)
    .save(data, _.extend({}, options, {insert: true}));
};

Model.prototype.withId = function(id, options) {
  return new this._constructor(this, {id: id}, options);
};

Model.prototype.find = function(name, value, options) {
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
  var instance = new this._constructor(this, {data: data}, options);

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

Model.prototype._getCounters = function() {
  var attributes = this._attributes;
  return _.filter(this._attributeNames, function(name) {
    return attributes[name].counter;
  });
};

Model.prototype._getHashStoreGroups = function() {
  return _.reduce(this._attributes, function(result, attribute, name) {
    _.each(attribute.hashStores || [], function(hashStore) {
      // Try to find an existing hashStore index.
      var group = _.find(result, function(group) {
        return (group.hashStore === hashStore);
      });

      if (group) {
        group.attributes.push(name);
      } else {
        result.push({hashStore: hashStore, attributes: [name]});
      }
    });
    return result;
  }, []);
};

Model.prototype._initAttributes = function() {
  var self = this;
  _.each(this._attributes, function(attribute) {
    attribute.initialize && attribute.initialize.call(self);
  });
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
  this._counters = this._getCounters();
  this._initAttributes();
};

module.exports = Model;
