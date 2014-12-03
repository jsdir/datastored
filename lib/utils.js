var _ = require('lodash');
var _s = require('underscore.string');
var async = require('async');

var dateFactor = 16 * 32;

/**
 * Converts a `Date` to a three-byte integer.
 * @param  {Date} value The `Date` to convert.
 * @return {Integer}    The converted date.
 */
function serializeIntegerDate(value) {
  // Convert Date to a three-byte integer
  // packed as YYYY×16×32 + MM×32 + DD.
  return value.getUTCFullYear() * dateFactor
    + value.getUTCMonth() * 32 + value.getUTCDate();
}

/**
 * Converts a packed three-byte integer date into a `Date`.
 * @param  {Integer} value The packed date to convert.
 * @return {Date}          The converted `Date`.
 */
function unserializeIntegerDate(value) {
  value = parseInt(value);

  // Unpack three-byte integer as a Date.
  var day = value % 32;
  value -= day;
  var month = (value % dateFactor) / 32;
  value -= month;
  var year = Math.floor(value / dateFactor);

  return new Date(Date.UTC(year, month, day));
}

function requireAttribute(data, name) {
  if (!_.has(data, name)) {
    throw new Error('"' + name + '" is not defined');
  }
}

function requireAttributes(data, names) {
  _.each(names, function(name) {
    requireAttribute(data, name);
  })
}

function mapAttributes(attributes, func) {
  return function(data) {
    return _.object(_.map(data, function(value, name) {
      if (_.contains(attributes, name)) {
        return [name, func(value)];
      }
      return [name, value];
    }));
  }
}

function groupByHashStore(attributes, groups) {
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
}

// String Functions

function toTokenSentence(array, lastSeparator) {
  var strings = _.map(array, function(v) {
    return _s.quote(v);
  });
  return _s.toSentenceSerial(strings, ', ', lastSeparator);
}

function mapValues(obj, func, cb) {
  var tasks = _.mapValues(obj, function(value, key) {
    return function(cb) {return func(value, key, cb);}
  });
  async.parallel(tasks, cb);
}

module.exports = {
  serializeIntegerDate: serializeIntegerDate,
  unserializeIntegerDate: unserializeIntegerDate,
  requireAttribute: requireAttribute,
  requireAttributes: requireAttributes,
  mapAttributes: mapAttributes,
  toTokenSentence: toTokenSentence,
  groupByHashStore: groupByHashStore,
  mapValues: mapValues
};
