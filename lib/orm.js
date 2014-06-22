var _ = require('lodash');

var utils = require('./utils');
var datastores = require('./datastores');
var ModelConstructor = require('./model').ModelConstructor;

function Orm(options) {
  // Check for required options.
  utils.requireOptions(options, ['redisClient', 'cassandraClient'])

  // Revert to a very simple id generator when `generateId` is not defined.
  this.generateId = options.generateId
  if (!this.generateId) {
    var i = 0;
    this.generateId = function() {
      i++;
      return i;
    }
  }

  // Initialize the orm's datastores from the options.
  this.datastores = {
    redis: new datastores.RedisDatastore({
      client: options.redisClient,
      keyspace: options.redisKeyspace
    }),
    cassandra: new datastores.CassandraDatastore({
      client: options.cassandraClient
    })
  }

  // Get base transforms.
  this.modelTransforms = options.modelTransforms || [];

  // Initialize a container for the orm's registered models.
  this.models = {};
}

/**
 * Creates a model, registers it with the orm, and returns it.
 * @param  {string} name - the model's name
 * @param  {object} options - the model's options
 * @return {Model} - the created model
 */
Orm.prototype.createModel = function(name, options) {
  // Check that the model's name is not already registered.
  if (name in this.models) {
    throw new Error('model `' + name + '` is already defined');
  }

  var model = new ModelConstructor(name, this, options);
  this.models[name] = model;

  return model;
}

/**
 * Creates an orm instance and returns it.
 * @param  {objects} options - the orm's options
 * @return {Orm} - the created orm
 */
function createOrm(options) {
  var orm = new Orm(options);
  return orm;
}

module.exports = createOrm;
