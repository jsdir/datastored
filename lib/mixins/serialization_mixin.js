var _ = require('lodash');

var marshallers = require('../marshallers');

var marshaller = marshallers.createInstance(marshallers.JSONMarshaller);

function getInstanceAttributes(instance) {
  var model = instance.model;
  return _.extend({id: model.idType}, model.options.attributes);
}

var SerializationMixin = {
  transform: {
    input: function(data) {
      return marshaller.serializeData(data, getInstanceAttributes(this));
    },
    output: function(data) {
      return marshaller.serializeData(data, getInstanceAttributes(this));
    }
  }
};

module.exports = SerializationMixin;
