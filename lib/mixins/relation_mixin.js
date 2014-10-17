var _ = require('lodash');
var async = require('async');

/**
 * Helper method for easily saving multi-level instance hierarchies.
 */
function saveWithChildren(attributes, raw) {

}

var callbacks = {
  beforeInitialize: function(options) {
    var orm = this.orm;

    _.each(options.relations, function(relation, name) {
      // Validate relation options.
      if (!relation.relatedModel) {
        throw new Error('relation "' + name + '" requires a "relatedModel" ' +
          'option');
      }

      // Initialize the relations.
      if (relation.type.initializeRelation) {
        relation.type.initializeRelation.call({
          relationName: name, relation: relation, orm: orm
        });
      }
    });

    return options;
  },
  beforeInput: function(data, cb) {
    var self = this;
    // Run `onInput` callback on relations.
    _.each(this.model.options.relations, function(relation, name) {
      if (relation.type.beforeInput && (name in data)) {
        data[name] = relation.type.beforeInput.call({
          relationName: name,
          relation: relation,
          instance: self,
          orm: self.model.orm
        }, data[name]);
      }
    });

    cb(null, data);
  },
  beforeOutput: function(data) {
    var self = this;
    // Run `onOutput` callback on relations.
    _.each(this.instance.model.options.relations, function(relation, name) {
      if (relation.type.beforeOutput && (name in data)) {
        data[name] = relation.type.beforeOutput.call({
          relationName: name,
          attributes: self.attributes
        }, data[name]);
      }
    });

    return data;
  },
  beforeSave: function(options, data, cb) {
    var self = this;
    var relationNames = _.keys(this.model.options.relations);
    async.each(relationNames, function(name, cb) {
      var relation = self.model.options.relations[name];

      if (relation.type.beforeSave && (name in data)) {
        relation.type.beforeSave.call({}, data[name], options, function(err, value) {
          if (err) {return cb(err);}
          data[name] = value;
          cb();
        });
      } else {
        cb();
      }
    }, function(err) {
      if (err) {return cb(err);}
      cb(null, options, data);
    });
  },
  /*
  beforeSave: function(options, data, cb) {
    // Only run callback if data[value] exists
    var keys = _.keys(data);
    async.each(keys, function(key, cb) {

    }, function(err) {
      // if (err)
    });

    var self = this;
    return cb(null, options, _.object(_.map(data, function(value, key) {
      // Iterate through relations being saved.
      if (key in self.model.options.relations) {
        var relation = self.model.options.relations[key];
        if (relation.type.onSave) {
          relation.type.onSave.call({

          }, self, cb);
        }
      }
      return [key, value];
    })));

    var self = this;
    var names = _.keys(this.model.options.relations);

    // Iterate through parent relations and save children.
    async.each(names, function(name, cb) {
      var relation = self.model.options.relations[name];
      var beforeSave = relation.type.beforeSave;
      if (beforeSave) {
        beforeSave.call({
          relationName: name, relationOptions: relation, value: data[name]
        }, options, data, cb);
      } else {
        cb();
      }
    }, function(err) {
      if (err) {return cb(err);}
      cb(null, options, data);
    });
  },*/
  beforeFetch: function(options, attributes, cb) {
    // Run `getFetchKeys` on relations to combine the keys that should be
    // requested from the datastore.

    /*
      TODO: cleanup
     _.each(this.model.options.relations, function(relation, name) {
      if (relation.type.getFetchKeys) {
        attributes = relation.type.getFetchKeys.call({
          relationName: name, relation: relation
        }, attributes);
      }
    });*/
    console.log('attributes', attributes);
    cb(null, options, attributes);
  },
  afterFetch: function(options, data, cb) {
    console.log("afterFetch", data);
    var orm = this.model.orm;
    _.each(this.model.options.relations, function(relation, name) {
      var afterFetch = relation.type.afterFetch;
      if (afterFetch) {
        afterFetch.call({
          relationName: name, relationOptions: relation, orm: orm
        }, data[value], data);
      }
    });

    cb(null, options, data);
  },
  defaults: function(defaults) {
    var instance = this;
    // Run `getDefaultValue` on relations to combine the default attributes.
    _.each(this.model.options.relations, function(relation, name) {
      if (relation.type.getDefault) {
        defaults[name] = relation.type.getDefaultValue.call({
          relationName: name,
          relation: relation,
          instance: instance,
          orm: instance.model.orm
        });
      }
    });

    return defaults;
  }
};

var RelationMixin = {
  callbacks: callbacks,
  staticMethods: {
    saveWithChildren: saveWithChildren
  }
};
