var _ = require('lodash');

var marshallers = require('../marshallers');

var marshaller = marshallers.createInstance(marshallers.JSONMarshaller);

function getInstanceAttributes(instance) {
  var options = instance.model.options;
  return _.extend({id: options.idType}, instance.model._attributes);
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
