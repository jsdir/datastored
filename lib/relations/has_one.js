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

function HasOne(relatedModel, options) {
  /*return function(orm) { // <- optionally return a wrapper function that will be called with all qualified orm models.
    // This function is evaluated when all models are loaded.
    // Introspection can occur.
    // find relatedModel id type
    // pass the related model id
    // fail if relatedModels idTypes are different

    return { // attributeSpec
      attribute: datastored.fromType(relatedModel.idType)({
         // Single logical attributes may return several explicit attributes.
        // Take note for joinedAttributes. joinedAttributes should copy otherAttributes as well.
        onSet: function(value) {
          // Allow setting value to `null`.
          if (_.isNull(value)) {return value;}
          // In all other conditions, ensure that an instance with the correct
          // type was set.

          // check with options if values is an instance that matches relatedModels
          if (!_.isObject(instance)) {
            throw new Error('invalid instance object')
          }

          if (!_.contains(relatedModel, instance.type)) {
            throw new Error('invalid instance type, only ... types allowed');
          }

          return value;
        },
        // rules are not passed. We can ignore those for hasone relations
      }),
      otherAttributes: otherAttributes,
      required: options.required
    };
  }*/

  return {
    required: options.required
  };
}

module.exports = HasOne;
