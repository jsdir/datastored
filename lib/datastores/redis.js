var util = require('util');

var _ = require('lodash');

var datastoreUtils = require('./datastore_utils.js');

function RedisStore(redis) {
  this.redis = redis;
}

RedisStore.prototype.reset = function(cb) {
  this.redis.flushall(cb);
};

/**
 * RedisHashStore
 */

function RedisHashStore() {
  RedisHashStore.super_.apply(this, arguments);
}

util.inherits(RedisHashStore, RedisStore);

RedisHashStore.prototype.save = function(options, cb) {
  var key = datastoreUtils.getHashKey(options);
};

RedisHashStore.prototype.fetch = function(options, cb) {
  var key = datastoreUtils.getHashKey(options);
  this.redis.hgetall(key, options.attributes, cb);
};

exports.RedisHashStore = RedisHashStore;

/**
 * RedisIndexStore
 */

// Defines command mappings for instance substition.

var commands = {
  list: {
    lindex: true,
    linsert: {input: {position: 1, repeat: true}},
    llen: true,
    lpop: {output: {position: 0}},
    lpush: {input: {position: 0, repeat: true}},
    lrange: {output: {position: 0, repeat: true}},
    lrem: {input: {position: 1}},
    lset: {input: {position: 1}},
    ltrim: true,
    rpop: {output: {position: 0}},
    rpush: {input: {position: 0, repeat: true}}
  },
  set: {
    sadd: {input: {position: 0, repeat: true}},
    scard: true,
    sismember: {input: {position: 0}},
    smembers: {output: {position: 0, repeat: true}},
    spop: {output: {position: 0}},
    srandmember: {output: {position: 0}},
    srem: {input: {position: 0, repeat: true}}
  }
};

function RedisIndexStore() {
  RedisIndexStore.super_.apply(this, arguments);
}

util.inherits(RedisIndexStore, RedisStore);

_.each(['get', 'set', 'del'], function(method) {
  RedisIndexStore.prototype[method] = function(options, cb) {
    var key = datastoreUtils.getIndexKey(options);
    this.redis[method](key, cb);
  };
});

exports.RedisIndexStore = RedisIndexStore;

/**
 * RedisAssociationStore
 */

function RedisAssociationStore() {
  RedisAssociationStore.super_.apply(this, arguments);
}

util.inherits(RedisAssociationStore, RedisStore);

RedisAssociationStore.prototype.execute = function(method, group, args) {
  if (!_.contains(allowedMethods[group], method)) {
    throw new Error(method + ' is an invalid method');
  }

  var func = this.redis[method];
  func.apply(func, args);
};

exports.RedisAssociationStore = RedisAssociationStore;
