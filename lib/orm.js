var _ = require('lodash');

var utils = require('./utils');
var datastores = require('./datastores');
var marshallers = require('./marshallers');
var ModelFactory = require('./model').ModelFactory;

function Orm(options) {
  // Revert to a very simple id generator when `generateId` is not defined.
  this.generateId = options.generateId || _.uniqueId();

  // Initialize the orm's datastores from the options.
  if (options.memory) {
    this.datastores = {
      redis: new datastores.MemoryDatastore(),
      cassandra: new datastores.MemoryDatastore()
    }
  } else {
    // Check for required options.
    utils.requireAttributes(options, ['redisClient', 'cassandraClient'])
    this.datastores = {
      redis: new datastores.RedisDatastore({
        client: options.redisClient,
        keyspace: options.redisKeyspace
      }),
      cassandra: new datastores.CassandraDatastore({
        client: options.cassandraClient
      })
    }
  }

  // Get base transforms.
  this.modelTransforms = options.modelTransforms || [];

  // Set marshaller.
  this.marshaller = options.marshaller || marshallers.JSONMarshaller;

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

  var model = new ModelFactory(name, this, options);
  this.models[name] = model;

  return model;
}

Orm.prototype._parseRelations = function() {
  var models = this.models;
  // This will only run once.
  if (!this.relationsParsed) {
    // Parse all linked relations and store the link with the model.
    _.each(this.models, function(model) {
      _.each(model.relations, function(relation, relationName) {
        if (relation.relation) {
          // This is a linked relation.
          var relatedModel = models[relation.relatedModel];
          var relatedRelation = relatedModel.find(relation.relation);
          if (notFound) {
            throw new Error('unable to find relation with relationKey on Model');
          }
          // set backref
          relatedModel._backrefs[relatedRelation.name] = {
            model: model,
            relationName: relationName
          };
        }
      });
    });
    //   - store in a hash {relatedModelName: {relationName: x}} - this._relationMap
    // Add backrefs to models without an already defined link.
    //   - check the stored hash
    _.each(this.models, function(model, modelName) {
      //model._addBackrefsToRelated(models);
      _.each(model.relations, function(relation, relationName) {
        if (relation.deleteReferences !== false) {
          var relationName = relation.reverseRelationName || modelName;
          var relatedModel = models[relation.relatedModel];

          if (_.values(relatedModel._backrefs) !== {
            model: model,
            relationName: relationName
          }) {
            if relatedModel.relations.hasOwnProperty(relationName) {
              throw new Error('Relation `x` already exists on `y`. Try using reverseRelationName.');
            }
            relatedModel.relations[relationName] = {
              type: Relations.HasOne,
              cache: relation.cache,
              relatedModel: relatedModel
            };
          }
        }
      });
    });
    // Construct a model.joined = {
    //   attribute(backref): [properties...]
    // }
    this.relationsParsed = true;
  }
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
