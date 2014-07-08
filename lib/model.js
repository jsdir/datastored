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

/**
 * Constructs a new `Instance` from the given data.
 * @param  {object}   data
 * @param  {boolean}  raw
 * @return {Instance}
 */
Model.prototype.create = function(attributes, raw) {
  var instance = new this.instance(this);
  instance.set(attributes, raw);
  return instance;
};

function Instance(model) {
  this.model = model;
  this.values = {};
}

Instance.prototype.get = function(attributes, raw) {
  var single = false;
  if (_.isString(attributes)) {
    attributes = [attributes];
    single = true;
  }

  var values = _.pick(this.values, attributes);

  if (single) {
    return values[attributes];
  } else {
    return values;
  }
};

Instance.prototype.set = function(name, value, raw) {
  if (arguments.length > 2) {
    // Set a single attribute.
    var values = _.object([[name, value]]);
  } else {
    // Set multiple attributes.
    var values = name;
    raw = value;
  }

  // Overwrite existing values if they exist.
  _.extend(this.values, values);

  // Enable chaining.
  return this;
};

module.exports = {
  Model: Model,
  Instance: Instance
};
