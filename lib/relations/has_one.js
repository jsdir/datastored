var _ = require('lodash');

var utils = require('../utils');

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

  // TODO: validate hashStores with shared method.

  return function(orm) {
    var relatedModelIdType;

    // Check that `relatedModels` have the save id type.
    if (_.isArray(relatedModel)) {
      _.each(relatedModel, function(modelType) {
        var type = orm.models[modelType].options.idType;
        if (relatedModelIdType && type !== relatedModelIdType) {
          throw new Error('related models must have the same id type');
        }
        relatedModelIdType = type;
      });
      var relatedModels = relatedModel;
    } else {
      relatedModelIdType = orm.models[relatedModel].options.idType;
      var relatedModels = [relatedModel];
    }

    return {
      type: relatedModelIdType,
      hashStores: options.hashStores,
      required: options.required,
      input: function(value, raw) { // TODO: all input
        /*
        TODO: allow raw

        if (!raw) {
          // Guard the attribute.
          return undefined;
        }*/

        // Allow setting value to `null`.
        if (_.isNull(value)) {return value;}

        if (!value || !value.model || !value.model.type) {
          throw new Error('invalid instance object')
        }

        if (!_.contains(relatedModels, value.model.type)) {
          relatedModelNames = utils.toTokenSentence(relatedModels, ' or ');
          throw new Error('expected instance with type ' + relatedModelNames);
        }

        return value;
      },
      output: function(value, repr, raw) {
        if (options.hidden) {
          return undefined;
        }

        if (raw) {return value;}
        // Return id or joined attributes.
        if (_.isString(repr)) {
          return value.getId();
        } else {
          // repr is {name: "attribute_title", joinedAttributes: []}
          var data = {id: value.getId()};
          _.extend(data, value.get(repr.joinedAttributes));
          return data;
        }
      },
      save: function(value) {
        return value.getId(true);
      },
      fetch: function(attributes) {
        if (relatedModel.length > 1) {
          // Deconstruct id.
          var instance = attributes.main// deconstruct id.
        } else {
          var instance = getInstanceFromType(relatedModel);
        }
        // Load joined properties.
        instance.set(attributes.joinedAttributes);
        instance.isNew = false;
        instance._resetAttributeState();
      },
      scopeToDatastore: function(attributeName, param) {
        return _.map(param.joinedAttributes, function(name) {
          return attributeName + '_' + name;
        });
      }
    };
  }
}

module.exports = HasOne;
