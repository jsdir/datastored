var _ = require('lodash');

function Model(name, orm, options) {
  this.name = name;
  this.orm = orm;
  this.options = options;

  // Clone the Model base class.
  this.instance = _.clone(Instance);

  // Set static methods.
  _.extend(this, options.staticMethods);

  // Set instance methods.
  _.extend(this.instance.prototype, options.methods);
}

Model.prototype.create = function(data) {
  var instance = new this.instance(this);
  return instance;
};

function Instance(model) {
  this.model = model;
}

module.exports = {
  Model: Model,
  Instance: Instance
};
