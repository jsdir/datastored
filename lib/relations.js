var async = require('async');

/**
 * Collections can be order-aware.
 * @param {[type]} context [description]
 * - sorting by child attribute: (specify function that maps model to score || string)
 *   - each sorting attribute adds a zset
 */
function Collection(context) {
  this.models = [];
  this.context = context;
  /*
  Order
  Limit
  Offset
   */
}

Collection.prototype.add = function(model) {
  this.models.push(model);
  this.deletedModels = _.without(this.deletedModels, model);
  this.addedModels.push(model);
};

Collection.prototype.delete = function(model) {
  this.models = _.without(this.models, model);
  this.addedModels = _.without(this.addedModels, model);
  this.deletedModels.push(model);
};

Collection.prototype.fetch = function(options, scope) {
  // options about sort order and attribute
  // this.context
  this.context.model.modelConstructor.fetchFromDatastores(function(datastore) {
    var pks = datastore.fetchCollection(this.context.model, this.context.relation.name);
    this.models = datastore.fetchByPks(pks, constructor.getAttributes(scope.attributes));
  });
};

Collection.prototype.save = function(cb, context) {
  context.relationName
  context.relation
  context.model
  relation.name
  // collection also needs parent model and relationName
  // should this data be provided with the save method?
  var self = this;

  async.series([
    function(cb) {
      // Save all models in the collection.
      async.each(self.models, function(model, cb) {
        model.save(cb);
      }, cb);
    },
    function(cb) {
      // Save model primary keys to datastore.
      // Add ids as a batch.
      var ids = getIds(self.addedModels);
      context.model.modelConstructor.saveToDatastores(function(datastore) {
        datastore.addToCollection(context.model, relation.name, ids);
        self.addedModels = [];
        // then
        datadata.removeFromCollection
        self.deletedModels = [];
      }, context.relation.cache, cb);
    }
  ], cb);
};

function TreeCollection() {
  function move
}

function createCollection() {
  return new Collection();
}

function validate(options, name, value) {
  model.type === options.type;
}

function HasOne(name, options) {
  this.name = name;
}

/**
 * options
 *   - dependent
 *   - 
 */

var HasOne = {
  validateOptions: function(options, value) {
    if (options.required && !value) {
      throw new Error('relational attribute `' +  + '` is required');
    }
  }
};

var HasMany = {
  getInitialValue: createCollection,
  validateOptions: function(options) {
    /*
    - value agrees with the defined type
    - options:
      - list, set, zset
      - score
     */
  }
};

var Tree = {
  /*
  options:
    - relatedModel
   */
  validateOptions: function(options) {
    options.
  }
};

module.exports = {
  HasOne: function(options) {
    return function(options) {
      return new HasOne(options);
    }
  }
  HasOne: HasOne,
  HasMany: HasMany,
  BelongsTo: BelongsTo,
  HasAndBelongsTo: HasAndBelongsTo
};

/*
- relation required defined in the options
  - save transform validates regular attributes, what about relations
- setting a relation target should validate model type if it's an option
- `save` iterates through defined relations, starts at leaves and starts saving
  each. `isNew` should work and prevent unchanged models from being saved again.
  `changed` flag would be better used
  collections and higher-level constructs might also need an `isNew`. idk

saving a model will for:

  - save called recursively, can save the items at breadth-first level. the order of `save` and `save children` can affect the traversal direction
  - recursive saves make things easy! not all saves have to be inside a batch. hooray!
  - HasOne: throw error if required and no set relationship, then will save the target before the parent
  - HasMany: no required, it is just an empty array at starting point.
    - save the contained models if they were added, removed, moved, or changed. The collection needs to record mutations.
    - start saving the leaves (what about tree), then save the parent.
  - BelongsTo: throw error if required and no set relationship, save target first (prevent loop with isNew?) then save the model.
  - HasAndBelongsToMany:
    - friends:
      - HasAndBelongsToMany(User)
    - followers:
    - likes:

// Fetches
fetching a model will for:

  - HasOne: only Model.get(id), the back-reference `BelongsTo` will also be set up?
    - if this relation is joined, then no real subsequent fetch will be necessary.
    - lock down the type unless needed otherwise or an interface with the datastored to store model types.
  - HasMany: lock down to one model type for simplicity sake
    - if joined (ids or full objects), initiate collection, otherwise,
      leave the collection present but uninitialized.
  - (HasOne and HasMany can have a reverse option that indicates the name of the field on the target that references back to it to make relation assignment easier.)
  - BelongsTo:
    - Image > belongsTo > Collection > belongsTo > User
    - just like hasOne. fetch and initialize with the id.
  - HasAndBelongsToMany:
    - friends
    - followers (reverse: following)
    - likes (media) (how to filter these?)
  - Tree?
    - Collection -> Images
    - Collection HasMany Images <- this relation should have an option to define a tree.
    - Tree could use HasMany, BelongsTo

Fetching also:
  - reconstructs joins.

Collections can be fetched (collection.fetch()?)
  - all at once
  - paged

Ideas
-----
- All relations have a dependent option.
- hasMany needs a counterCache
- use a join model (Friendship, Like)
*/
