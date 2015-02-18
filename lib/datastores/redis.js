var util = require('util');
var fs = require('fs');
var path = require('path');

var _ = require('lodash');
var async = require('async');
var RSVP = require('rsvp');

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
  var optionsData = _.clone(options.data);

  // Initialize counters to 0 if inserting.
  if (options.insert) {
    _.each(options.counters, function(counter) {
      optionsData[counter] = 0;
    });
  }
  var hashData = utils.updateHash({}, optionsData);
  var serializedData = marshallers.serializeData(
    marshallers.JSONMarshaller,
    options.types,
    hashData.data
  );

  async.parallel([
    function(cb) {
      // Set hash values.
      if (_.isEmpty(serializedData)) {return cb();}
      self.client.hmset(key, serializedData, cb);
    },
    function(cb) {
      // Increment counters.
      async.each(_.keys(options.incr), function(name, cb) {
        self.client.hincrby(key, name, options.incr[name], cb);
      }, cb);
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
  this.client.get(key, function(err, id) {
    if (err) {return cb(err);}
    // TODO: merge with getIdMethods
    if (options.types.id === 'integer' && _.isString(id)) {
      id = require('bignum')(id);
    }
    cb(null, id);
  });
};

RedisIndexStore.prototype.set = function(options, cb) {
  var key = utils.getIndexKey(options);
  this.client.setnx(key, utils.serializeId(options.id), function(err, result) {
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
    linsert: {input: {action: 'add', position: 1, repeat: true}},
    llen: false,
    lpop: {output: {action: 'remove', position: 0}},
    lpush: {input: {action: 'add', position: 0, repeat: true}},
    lrange: {output: {position: 0, repeat: true}},
    lrem: {input: {action: 'remove', position: 1}},
    // TODO: UNSUPPORTED: lset: {input: {type: 'replace', position: 1}},
    // TODO: UNSUPPORTED: ltrim: false,
    rpop: {output: {action: 'remove', position: 0}},
    rpush: {input: {action: 'add', position: 0, repeat: true}}
  },
  set: {
    sadd: {input: {action: 'add', position: 0, repeat: true}},
    scard: false,
    sismember: {input: {position: 0}},
    smembers: {output: {position: 0, repeat: true}},
    spop: {output: {action: 'remove', position: 0}},
    srandmember: {output: {position: 0}},
    srem: {input: {action: 'remove', position: 0, repeat: true}}
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
  var client = this.client;
  this.scriptSha = new RSVP.Promise(function(resolve, reject) {
    var filename = path.join(__dirname, 'scripts/redis.lua');
    fs.readFile(filename, function(err, data) {
      if (err) {return reject(err);}
      return resolve(data);
    });
  })
  .then(function(data) {
    return new RSVP.Promise(function(resolve, reject) {
      client.script('load', data, function(err, sha) {
        if (err) {return reject(err);}
        return resolve(sha);
      });
    });
  });
}

util.inherits(RedisAssociationStore, RedisStore);

RedisAssociationStore.prototype.execute = function(group, idMethods, db, cb) {
  var command = db.query[0];
  var mask = commands[group][command];

  // Check that the command is supported.
  if (!mask) {
    throw new Error(command + ' is an invalid method for redis ' + group);
  }

  // Get the action type.
  var action;
  var params = mask.input || mask.output;
  if (params) {
    action = params.action;
  }

  // Intercept instances.
  var instances = [];
  function getInstance(instance) {
    instances.push(instance);
    return idMethods.toId(instance);
  }

  // Format redis args.
  var args = applyMask(mask.input, db.query[1], getInstance);
  this.client[command].apply(this.client, [db.key]
    .concat(args)
    .concat(function(err, data) {
      if (err) {return cb(data);}
      if (mask.output) {
        data = applyMask(mask.output, data, idMethods.fromId);
      }
      cb(null, {data: data, action: action, instances: instances});
    }));
};

RedisAssociationStore.prototype.fetchTree = function(params, cb) {
  var client = this.client;
  this.scriptSha.then(function(sha) {
    client.evalsha(sha, 4,
      params.rootKey,
      params.childKeyspace,
      params.childrenAttribute,
      params.type,
    function(err, data) {
      if (err) {return cb(err);}
      cb(null, JSON.parse(data));
    });
  }).catch(cb);
};

exports.RedisAssociationStore = RedisAssociationStore;
