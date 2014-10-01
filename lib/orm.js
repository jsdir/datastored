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

function Orm(options) {
  // Revert to a simple incrementing id generator when `generateId` is not
  // defined.
  var i = 0;
  this.generateId = options.generateId || function(cb) {
    i++;
    cb(null, i);
  };

  // Initialize the orm's datastores from the options.
  if (options.memory) {
    this.datastores = {
      redis: new MemoryDatastore(),
      cassandra: new MemoryDatastore()
    };
  } else {
    // Check for required options.
    utils.requireAttributes(options, ['redisClient', 'cassandraClient']);
    this.datastores = {
      redis: new RedisDatastore({
        client: options.redisClient,
        keyspace: options.redisKeyspace
      }),
      cassandra: new CassandraDatastore({
        client: options.cassandraClient
      })
    };
  }

  // Set marshaller for user io.
  this.marshaller = options.marshaller || marshallers.JSONMarshaller;

  // Initialize a container for the orm's registered models.
  this.models = {};
  this.callbacks = {};
}

util.inherits(Orm, EventEmitter);

/**
 * Creates a model, registers it with the orm, and returns it.
 * @param  {string} name - the model's name
 * @param  {object} options - the model's options
 * @return {Model} - the created model
 */
Orm.prototype.createModel = function(name, options) {
  // Check that the model's name is not already registered.
  if (name in this.models) {
    throw new Error('model "' + name + '" is already defined');
  }

  var model = new Model(name, this, options);
  this.models[name] = model;
  this.emit('model', model);

  return model;
};

Orm.prototype._resetDatastores = function(cb) {
  async.each(_.values(this.datastores), function(datastore, cb) {
    datastore.reset(cb);
  }, cb);
};

Orm.prototype._onModel = function(name, cb) {
  if (this._modelExists(name)) {
    cb(this.models[name]);
  } else {
    this.on('model', function(model) {
      if (model.name === name) {
        cb(model);
      }
    });
  }
};

Orm.prototype._modelExists = function(name) {
  return (name in this.models);
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
