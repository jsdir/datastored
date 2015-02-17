var _ = require('lodash');
var _s = require('underscore.string');
var async = require('async');
var bignum = require('bignum');

var dateFactor = 16 * 32;

/**
 * Converts a `Date` to a three-byte integer.
 * @param  {Date} value The `Date` to convert.
 * @return {Integer}    The converted date.
 */
exports.serializeIntegerDate = function(value) {
  // Convert Date to a three-byte integer
  // packed as YYYY×16×32 + MM×32 + DD.
  return value.getUTCFullYear() * dateFactor +
    value.getUTCMonth() * 32 + value.getUTCDate();
};

/**
 * Converts a packed three-byte integer date into a `Date`.
 * @param  {Integer} value The packed date to convert.
 * @return {Date}          The converted `Date`.
 */
exports.unserializeIntegerDate = function(value) {
  value = parseInt(value);

  // Unpack three-byte integer as a Date.
  var day = value % 32;
  value -= day;
  var month = (value % dateFactor) / 32;
  value -= month;
  var year = Math.floor(value / dateFactor);

  return new Date(Date.UTC(year, month, day));
};

exports.requireAttribute = function(data, name) {
  if (!_.has(data, name)) {
    throw new Error('"' + name + '" is not defined');
  }
};

exports.requireAttributes = function(data, names) {
  _.each(names, function(name) {
    exports.requireAttribute(data, name);
  });
};

exports.groupByHashStore = function(attributes, groups) {
  // Check if any groups contain all of the requested attributes. If such a
  // group exists, use it,
  var matchingGroup;

  _.any(groups, function(group) {
    if (_.isEmpty(_.difference(attributes, group.attributes))) {
      // The hashStore matches.
      matchingGroup = group;
      return true;
    }
  });

  if (matchingGroup) {
    return [matchingGroup];
  }

  // If no matching hashStore was found, revert to layering.
  var result = {};
  return _.reduce(groups, function(result, group) {
    var matchedAttributes = _.intersection(attributes, group.attributes);
    if (matchedAttributes.length > 0) {
      result.push({
        hashStore: group.hashStore,
        attributes: matchedAttributes
      });
      attributes = _.without(attributes, matchedAttributes);
    }
    return result;
  }, []);
};

exports.mapValues = function(obj, func, cb) {
  var tasks = _.mapValues(obj, function(value, key) {
    return function(cb) {func(value, key, cb);};
  });
  async.parallel(tasks, cb);
};

exports.mapObjectValue = function(array, value) {
  return _.object(_.map(array, function(key) {
    return [key, value];
  }));
};

exports.getIncrAmount = function(value) {
  var amount = 0;
  if (value) {
    if (value.incr) {
      amount += value.incr;
    }
    if (value.decr) {
      amount -= value.decr;
    }
  }
  return amount;
};

exports.getIdMethods = function(options, models) {
  var type = options.type;
  return {
    toId: function(instance) {
      var id = exports.serializeId(instance.id);
      // The id only needs to be embedded in the id when using multiple types.
      return type ? id : instance.model.type + ';' + id;
    },
    fromId: function(id) {
      var model;
      if (type) {
        model = models[type];
      } else {
        var parts = id.split(/;(.+)?/);
        model = models[parts[0]];
        id = parts[1];
      }

      // Cast string to bignum.
      if (model._attributeTypes.id === 'integer' && _.isString(id)) {
        id = bignum(id);
      }

      return model.withId(id);
    }
  };
};

// String Functions

exports.toTokenSentence = function(array, lastSeparator) {
  var strings = _.map(array, function(v) {
    return _s.quote(v);
  });
  return _s.toSentenceSerial(strings, ', ', lastSeparator);
};

// Datastore utils

exports.getIndexKey = function(options) {
  return [
    options.keyspace,
    options.attributeName,
    options.attributeValue
  ].join(':');
};

exports.getHashKey = function(options) {
  return options.keyspace + ':' + exports.serializeId(options.id);
};

exports.serializeId = function(id) {
  // Handle bignums.
  // Cast to string if id is a bignum.
  if (_.isObject(id)) {
    id = id.toString();
  }
  return id;
};

exports.updateHash = function(source, data) {
  var merged = _.extend({}, source, data);
  // Remove `null` values.
  return {
    data: _.omit(merged, _.isNull),
    nullValues: _.keys(_.pick(merged, _.isNull))
  };
};
