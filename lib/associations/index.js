redisAssociations = require('./redis_associations.js');

exports.HasOne = require('./has_one.js');
exports.RedisList = redisAssociations.RedisList;
exports.RedisSet = redisAssociations.RedisSet;
