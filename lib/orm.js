var util = require('util');
var EventEmitter = require('events').EventEmitter;

var _ = require('lodash');
var async = require('async');

var utils = require('./utils');
var marshallers = require('./marshallers');
var Model = require('./model');

var RedisDatastore = require('./datastores/redis');
var CassandraDatastore = require('./datastores/cassandra');
var MemoryDatastore = require('./datastores/memory');

function createBasicIdGenerator() {
  // Use this simple incrementing id generator when no id generator is defined.
  var i = 0;

  return function(cb) {
    i++;
    cb(null, i);
  }
}

function createDatastores(options) {
  // Initialize the orm's datastores from the options.
  if (options.memory) {
    return {
      redis: new MemoryDatastore(),
      cassandra: new MemoryDatastore()
    };
  } else {
    // Check for required options.
    utils.requireAttributes(options, ['redisClient', 'cassandraClient']);
    return {
      redis: new RedisDatastore({
        client: options.redisClient,
        keyspace: options.redisKeyspace
      }),
      cassandra: new CassandraDatastore({
        client: options.cassandraClient
      })
    };
  }
}

function Orm(options) {
  // Initialize orm from options.
  this.generateId = options.generateId || createBasicIdGenerator();
  this.datastores = createDatastores(options);

  // Set a default marshaller for user input/output.
  this.marshaller = options.marshaller || marshallers.JSONMarshaller;

  // Create a registry for the orm's registered models.
  this.models = {};
}

util.inherits(Orm, EventEmitter);

/**
 * Creates a model, registers it with the orm, and returns it.
 * @param  {string} type - the model's type
 * @param  {object} options - the model's options
 * @return {Model} - the created model
 */
Orm.prototype.createModel = function(type, options) {
  // Check that the model's type is not already registered.
  if (this._modelExists(type)) {
    throw new Error('model "' + type + '" is already defined');
  }

  var model = new Model(type, this, options);
  this.models[type] = model;
  this.emit('model', model);

  return model;
};

Orm.prototype._resetDatastores = function(cb) {
  async.each(_.values(this.datastores), function(datastore, cb) {
    datastore.reset(cb);
  }, cb);
};

Orm.prototype._onModel = function(type, cb) {
  if (this._modelExists(type)) {
    cb(this.models[type]);
  } else {
    this.on('model', function(model) {
      if (model.type === type) {
        cb(model);
      }
    });
  }
};

Orm.prototype._modelExists = function(type) {
  return (type in this.models);
};

/**
 * Creates an orm instance and returns it.
 * @param  {objects} options - the orm's options
 * @return {Orm} - the created orm
 */
function createOrm(options) {
  return new Orm(options);
}

module.exports = createOrm;
