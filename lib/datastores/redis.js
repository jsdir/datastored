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

var allowedMethods = {
  list: [
    'lindex',
    'linsert',
    'llen',
    'lpop',
    'lpush',
    'lrange',
    'lrem',
    'lset',
    'ltrim',
    'rpop',
    'rpush'
  ],
  set: [
    'sadd',
    'scard',
    'sismember',
    'smembers',
    'spop',
    'srandmember',
    'srem'
  ]
}

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
