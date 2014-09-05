var _ = require('lodash');

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

function requireAttributes(attributes, required) {
  for (var i in required) {
    if (!(required[i] in attributes)) {
      throw new Error('"' + required[i] + '"' + ' is not defined');
    }
  }
}

function updatePath(obj, fun, ks, defaultValue) {
  var deepness = _.isArray(ks);
  var keys     = deepness ? ks : [ks];
  var ret      = _.clone(obj);
  var lastKey  = _.last(keys);
  var target   = ret;

  _.each(_.initial(keys), function(key) {
    if (defaultValue && !_.has(target, key)) {
      target[key] = _.clone(defaultValue);
    }
    target = target[key];
  });

  target[lastKey] = fun(target[lastKey]);
  return ret;
}

function Deferred() {
  var args, callbacks = [];

  return {
    resolve: function() {
      args = _.values(arguments);
      _.each(callbacks, function(cb) {cb.apply(cb, args);});
    },
    then: function(cb) {
      if (args) {
        cb.apply(cb, args);
      } else {
        callbacks.push(cb);
      }
    }
  }
}

module.exports = {
  serializeIntegerDate: serializeIntegerDate,
  unserializeIntegerDate: unserializeIntegerDate,
  requireAttributes: requireAttributes,
  updatePath: updatePath,
  Deferred: Deferred
};
