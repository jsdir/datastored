var async = require('async');

var HasOne = 'HasOne';
var HasMany = 'HasMany';

var RelationMixin = {
  initialize: function(options) {
    var model = this;
    var models = model.orm.models;

    _.each(options.relations, function(relation, name) {
      if (relation.backrefs !== false) {
        // Require "relatedModel" and "relatedName"
        if (!relation.relatedModel) {
          throw new Error('relation "' + name + '" requires an option ' +
            '"relatedModel"');
        }
        if (!relation.relatedName) {
          throw new Error('relation "' + name + '" requires an option ' +
            '"relatedName"');
        }

        // Handle if "relatedModels" is defined as an array.
        var relatedModels = relatedModel;
        if (_.isString(relatedModels)) {
          relatedModels = [relatedModels];
        }

        _.each(relatedModels, function(modelName) {
          // Set initial backrefs map.
          var relatedModel = models[modelName];
          relatedModel._backrefs = relatedModel._backrefs || {};

          // Save the backref.
          relatedModel._backrefs[relation.relatedName] = {
            model: model, relation: name
          };
        });
      }

      // TODO: check options for HasMany
    });

    return options;
  },
  create: function(values) {
    // Set stub collection objects.
    // this._getHasManyRelationNames
    // values[] = 0;
    return values;
  },
  afterInput: function(values, cb) {
    // Ensure correct model types are set.
    _.each(this.options.relations, function(relation, name) {
      var value = values[name];
      var relatedModels = getRelatedModels(relation.relatedModels);

      if (relation.type === HasOne) {
        if (value || _.contains(relatedModels, value.model.name)) {
          cb(values);
        } else {
          throw new Error('relation "' + name + '" was set with a model of an' +
            'invalid type');
        }
      } else if (relation.type === HasMany) {
        if (value) {
          throw new Error('cannot set a HasMany relation');
        }
      }
    });
  },
  afterOutput: function(values) {
    var _this = this;

    _.each(this._hasOneRelationNames, function(name) {
      var model = _.this.get(name);
      if (model) {
        var relation = _this.model.attributes[name];
        var id = model.getPkValue(true);

        if (relation.joinedProperties) {
          // Convert HasOne relations with joined attributes into hashes.
          values[name] = {id: id};
          // TODO: get joined properties from "model"
          _.extend(values[name], model.getJoinedProperties());
        } else {
          // Convert HasOne relational targets into ids.
          values[name] = id;
        }
      }
    });

    // Omit HasMany relations.
    values = _.omit(values, this._hasManyRelationNames);

    return values;
  },
  beforeFetch: function(options, attributes, cb) {
    // add joined attributes to the fetch attributes list
  },
  afterFetch: function(options, values, cb) {
    var _this = this;

    _.each(this._hasOneRelationNames, function(name) {
      var value = values[name];
      if (_.isObject(value)) {

      } else if (value) {

      }
    });
    // since fetch outputs values directly into values, each attributes is
    // an individual flow
    // receive null, id, or hash with attributes:
    //   this.attributes[name] == options
    //   convert into normal model representations
    //   Set hashes directly as the model values, no mutation.
  },
  // get beforeSave and afterSave to function as a transaction?
  beforeSave: function(options, values, cb) {
    // save the HasOne descendants
    async.each(this.options.relations, function(relation, name) {
      var value = _this.values[name];
      if (value) {
        value.save(cb, self, name); // send the parent and the referencing link
      }
    }, function() {

    });
  },
  afterSave: function(options, values, cb) {
    // V update joinedProperties if this is a child model.
    // iterate through backrefs > relation > options
    //   if intersection options.joinedAttributes, this.changedProperties
    //     instantiate the parent through the backref
    //     set the changed/joined attributes directly and save the parent
    //       how to send the new attributes to the datastore without loading
    //       the child model stub. call the datastore directly without going through callbacks?
  },
  beforeDestroy: function(options, cb) {
    // have commands executed atomically
    var _this = this;

    // Destroy backrefs.
    var backrefs = this.model._backrefs;
    var backrefNames = _.keys(backrefs);

    this.fetch(backrefNames, function(err) {
      if (err) {return cb(err);}

      // Destroy each backref.
      async.each(backrefNames, function(name, cb) {
        var backref = backrefs[name];
        var parent = _this.get(name);

        parent.set(backref.relation, null).save(cb);
      }, function(err) {
        if (err) {return cb(err);}

        // Destroy dependent relations.
        var relationNames = _.keys(_this.options.relations);
        async.each(relationNames, function(relationName, cb) {
          var relation = relationNames[relationName];
          if (relation.dependent) {
            // ?
            // TODO: uswe a loaded hash to keep track of hasone relations that are legitimately null.
            var child = _this.get(name);
            if (child) {
              child.destroy(cb);
            }
          }
        }, cb);
      });
    });
  }
};

/**
 * Collections can be order-aware.
 * @param {[type]} context [description]
 * - sorting by child attribute: (specify function that maps model to score || string)
 *   - each sorting attribute adds a zset
 */
function Collection(options) {
  this.models = [];
  this.options = options;
  /*
  Order
  Limit
  Offset
   */
}

// Collection can also be used for collection properties. Can be used to store
// models or values. Values must go through a type or validator. What about maps?

function Set(options) {

}

Set.prototype.has = function(value) {

};

function SortedSet(options) {

}

SortedSet.prototype.sort = function() {

};

function List(options) {

}

Collection.prototype.getParentPk = function() {
  return this.options.model.getPk();
};

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
  this.context.model.factory.fetchFromDatastores(function(datastore) {
    var pks = datastore.fetchCollection(this.context.model, this.context.relation.name);
    this.models = datastore.fetchByPks(pks, factory.getAttributes(scope.attributes));
  });
};

Collection.prototype.contains = function(models, cb) {
  if (!_.isArray(models)) {
    model.append
  }
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
      context.model.factory.saveToDatastores(function(datastore) {
        datastore.addToCollection(context.model, relation.name, ids);
        self.addedModels = [];
        // then
        datadata.removeFromCollection
        self.deletedModels = [];
      }, context.relation.cache, cb);
    }
  ], cb);
};

module.exports = {
  HasOne: HasOne,
  HasMany: HasMany,
  RelationMixin: RelationMixin
};
