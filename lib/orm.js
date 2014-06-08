var datastores = require('./datastores');
var Model = require('./model');

function Orm(options) {
  // Check for required options.
  if (!options.redisClient) {
    throw new Error('`redisClient` is not defined');
  }
  if (!options.cassandraClient) {
    throw new Error('`cassandraClient` is not defined');
  }

  // Revert to a very simple id generator when `generateId` is not defined.
  if (!options.generateId) {
    var i = 0;
    options.generateId = function() {
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

  this.options = options;

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
  var model = new Model(name, options);
  this.models[name] = model;
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
