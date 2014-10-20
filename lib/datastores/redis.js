function RedisHashStore(redis) {
  this.redis = redis;
}

RedisHashStore.prototype.save = function(key, values, cb) {
  this.redis.hsetall
};

RedisHashStore.prototype.fetch = function(key, attributes, cb) {

};

function RedisIndexStore(redis) {
  this.redis = redis;
}

RedisIndexStore.prototype.get = function(key, cb) {
  this.redis.get(key, cb);
};

RedisIndexStore.prototype.set = function(key, value, cb) {
  this.redis.set(key, marshaller.serialize(value), cb);
};

RedisIndexStore.prototype.del = function(key, cb) {
  this.redis.del(key, cb);
};

module.exports = {
  RedisHashStore: RedisHashStore,
  RedisIndexStore: RedisIndexStore
};
