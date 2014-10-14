var util = require('util');

var _ = require('lodash');
var async = require('async');
var valids = require('valids');

var marshallers = require('../marshallers');

function hideHiddenValues(data) {
  return _.omit(data, this.instance.model.attrGroups.hidden);
}

function unserialize(data, cb) {
  var model = this.model;
  var marshaller = marshallers.createInstance(model.orm.marshaller);
  cb(null, marshaller.unserializeData(data, model.propertyTypes));
}

function serialize(data) {
  var model = this.instance.model;
  var marshaller = marshallers.createInstance(model.orm.marshaller);
  return marshaller.serializeData(data, model.propertyTypes);
}

function validate(options, data, cb) {
  var messages = {};
  var requiredAttributes = this.model.attrGroups.required;
  var names = _.keys(data);

  if (this.isNew) {
    _.each(_.difference(requiredAttributes, names), function(name) {
      messages[name] = util.format('attribute "%s" is required', name);
    });
  }

  valids.validate(data, {
    schema: _.pick(this.model.options.properties, names)
  }, function(validationMessages) {
    if (validationMessages) {_.extend(messages, validationMessages);}
    if (_.isEmpty(messages)) {
      cb(null, options, data);
    } else {
      cb(messages);
    }
  });
}

var ModelMixin = {
  callbacks: {
    afterInput: async.compose(unserialize),
    beforeOutput: _.compose(hideHiddenValues, serialize),
    beforeSave: validate
  }
};

module.exports = ModelMixin;
