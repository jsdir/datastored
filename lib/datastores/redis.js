var util = require('util');

var _ = require('lodash');
var async = require('async');

var utils = require('../utils');
var marshallers = require('../marshallers');

function RedisStore(client) {
  this.client = client;
}

RedisStore.prototype.reset = function(cb) {
  this.client.flushall(cb);
};

/**
 * RedisHashStore
 */

function RedisHashStore() {
  RedisHashStore.super_.apply(this, arguments);
}

util.inherits(RedisHashStore, RedisStore);

RedisHashStore.prototype.save = function(options, cb) {
  var self = this;
  var key = utils.getHashKey(options);
  var hashData = utils.updateHash({}, options.data);
  var serializedData = marshallers.serializeData(
    marshallers.JSONMarshaller,
    options.types,
    hashData.data
  );

  async.series([
    function(cb) {
      // Set hash values.
      self.client.hmset(key, serializedData, cb);
    },
    function(cb) {
      // Remove null values if there are any.
      if (hashData.nullValues.length > 0) {
        return self.client.hdel.apply(self.client, [key]
          .concat(hashData.nullValues)
          .concat(cb)
        );
      }
      cb();
    }
  ], cb);
};

RedisHashStore.prototype.fetch = function(options, cb) {
  var key = utils.getHashKey(options);
  this.client.hgetall(key, function(err, serializedData) {
    if (err) {return cb(err);}
    if (serializedData) {
      var data = marshallers.unserializeData(
        marshallers.JSONMarshaller,
        options.types,
        _.pick(serializedData, options.attributes)
      ).data;
      return cb(null, data);
    }
    cb(null, null);
  });
};

exports.RedisHashStore = RedisHashStore;

/**
 * RedisIndexStore
 */

function RedisIndexStore() {
  RedisIndexStore.super_.apply(this, arguments);
}

util.inherits(RedisIndexStore, RedisStore);

RedisIndexStore.prototype.get = function(options, cb) {
  var key = utils.getIndexKey(options);
  this.client.get(key, cb);
};

RedisIndexStore.prototype.set = function(options, cb) {
  var key = utils.getIndexKey(options);
  this.client.setnx(key, options.id, function(err, result) {
    if (err) {return cb(err);}
    cb(null, !result);
  });
};

RedisIndexStore.prototype.del = function(options, cb) {
  var key = utils.getIndexKey(options);
  this.client.del(key, cb);
};

exports.RedisIndexStore = RedisIndexStore;

/**
 * RedisAssociationStore
 */

// Define command mappings for instance substition.

var commands = {
  list: {
    lindex: false,
    linsert: {input: {position: 1, repeat: true}},
    llen: false,
    lpop: {output: {position: 0}},
    lpush: {input: {position: 0, repeat: true}},
    lrange: {output: {position: 0, repeat: true}},
    lrem: {input: {position: 1}},
    lset: {input: {position: 1}},
    ltrim: false,
    rpop: {output: {position: 0}},
    rpush: {input: {position: 0, repeat: true}}
  },
  set: {
    sadd: {input: {position: 0, repeat: true}},
    scard: false,
    sismember: {input: {position: 0}},
    smembers: {output: {position: 0, repeat: true}},
    spop: {output: {position: 0}},
    srandmember: {output: {position: 0}},
    srem: {input: {position: 0, repeat: true}}
  }
};

function applyMask(mask, args, func) {
  // A false mask is a noop.
  if (!mask) {return args;}

  return _.map(args, function(arg, n) {
    if (n === mask.position || (mask.repeat && n > mask.position)) {
      return func(arg);
    }
    return arg;
  });
}

function RedisAssociationStore() {
  RedisAssociationStore.super_.apply(this, arguments);
}

util.inherits(RedisAssociationStore, RedisStore);

RedisAssociationStore.prototype.execute = function(group, idMethods, db, cb) {
  var command = db.query[0];
  var mask = commands[group][command];

  // Check that the command is supported.
  if (!mask) {
    throw new Error(command + ' is an invalid method for redis ' + group);
  }

  // Format redis args.
  var args = applyMask(mask.input, db.query[1], idMethods.toId);
  this.client[command].apply(this.client, [db.key]
    .concat(args)
    .concat(function(err, data) {
      if (err) {return cb(data);}
      if (mask.output) {
        data = applyMask(mask.output, data, idMethods.fromId);
      }
      cb(null, data);
    }));
};

exports.RedisAssociationStore = RedisAssociationStore;
