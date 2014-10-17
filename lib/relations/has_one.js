function getInstance(options, id) {
  return options.orm.models[options.relation.relatedModel].get(id, true);
}

function createInstaceFromType(orm, relation, relationName, data) {
  var type = data.type || relation.relatedModel;
  if (_.isArray(type)) {
    throw new Error('Cannot assign typeless data to multitype relation "' +
      relationName + '". Try including a valid "type" attribute ' +
      'with the data.');
  }

  return orm.models[type].create(_.omit(data, 'type'));
}

function getJoinedProperties(relationName, attributes) {
  var joinedProperties = [];
  var exp = new RegExp('^' + relationName + '.(.*)$');
  _.each(attributes, function(name) {
    var match = name.match(exp);
    if (match) {
      joinedProperties.push(match[1]);
    }
  });

  return joinedProperties;
}



// Static Methods

function modelTypeMatches(name, relatedModel) {
  if (_.isString(relatedModel)) {
    return name === relatedModel;
  } else {
    return _.contains(relatedModel, name);
  }
}

var HasOne = {
  initializeRelation: function() {
    var self = this;
    // If a relation link exists, store the link in the orm.
    if (this.relation.joinedProperties) {
      // Require a link to use joined properties.
      if (!this.relation.link) {
        throw new Error('relation "' + this.relationName + '" must have a ' +
          '"link" in order to use "joinedProperties"');
      }

      // Set the property links when the related model exists.
      this.orm._onModel(this.relation.relatedModel, function(model) {
        // Set default property links.
        model.propertyLinks = model.propertyLinks || {};
        model.propertyLinks[self.relationName] =
          self.relation.joinedProperties;
      });
    }
  },
  beforeInput: function(instance) {
    if (!instance) {
      return null;
    }

    // Create an instance if a plain object was given as input.
    if (_.isPlainObject(instance)) {
      instance = createInstaceFromType(this.orm, this.relation,
        this.relationName, instance);
    }

    // Fail if the instance type does not match `relatedModel`.
    if (!modelTypeMatches(instance.model.type, this.relation.relatedModel)) {
      // Format the error message.
      var relatedModels = this.relation.relatedModel;
      if (_.isString(relatedModels)) {
        relatedModels = [relatedModels];
      }
      var modelNames = utils.toTokenSentence(relatedModels, ' or ');

      throw new Error('relation "' + this.relationName + '" must be set ' +
        'with "null" or an instance of type ' + modelNames);
    }

    if (this.relation.link) {
      // Unset child link relation.
      var lastValue = this.instance.get(this.relationName);
      if (lastValue) {
        lastValue.set(this.relation.link, null);
      }

      // Set child link relation to parent.
      instance.set(this.relation.link, this.instance);
    }

    return instance;
  },
  beforeOutput: function(instance, attributes) {
    // Convert instances into their ids. Leave null values alone.
    if (instance) {
      var props = getJoinedProperties(this.relationName, this.attributes);
      if (props.length > 0) {
        // Use `attributes` to determine what object properties to return.
        return instance.toObject(props);
      } else {
        return instance.getId();
      }
    }

    return instance;
  },
  beforeSave: function(instance, options, cb) {
    // Convert instances into raw ids for saving. If the child has changed
    // attributes or is not saved, the child will be saved before the parent.
    if (instance && instance.isChanged() && !_.contains(options._savedInstances, instance)) {
      // Keep track of instances that have already been saved. This will
      // prevent an infinite loop.
      options._savedInstances = options._savedInstances || [];
      options._savedInstances.push(instance);
      instance.save(options, function(err) {
        if (err) {return cb(err);}
        // Callback with the raw id.
        cb(null, instance.getId(true));
      });
    } else {
      cb();
    }
  },
  afterSave: function() {
    // TODO: Update joined properties on related models based on the newly changed
    // attributes.
  },
  getFetchKeys: function(keys) {
    // TODO: Include joined properties as extra properties to fetch.
    //
    // Scopes:
    //   "relation": id only
    //   "relation.property_name": single joined property
    var joinedProperties = this.relation.joinedProperties;

    if (joinedProperties) {
      // Fetch joined properties if they are used.
      props = [];
      _.each(attributes, function(name) {
        var match = name.match(/^(.*)\.\*$/);
        if (match) {
          var prefix = match[1];
          props = props.concat(_.map(joinedProperties, function(prop) {
            return prefix + '.' + prop;
          }));
        } else {
          props.push(name);
        }
      });
    }

    return keys;
  },
  onFetch: function(id, data) {
    console.log('onFetch');
    var self = this;
    var instance = getInstance(this, id);

    // Set fetched joined properties on the related model.
    _.each(data, function(value, name) {
      var exp = new RegExp('^' + self.relationName + '.(.*)$');
      var match = name.match(exp);
      if (match) {
        // TODO: a better interface to set data without changed attributes?
        instance.get(this.relationName).values[match[1]] = value;
      }
    });

    return instance;
  }
};

module.exports = HasOne;
