var util = require('util');
var EventEmitter = require('events').EventEmitter;

var _ = require('lodash');

var marshallers = require('./marshallers');
var Model = require('./model');

function createIdGenerator() {
  // Use this simple incrementing id generator when no id generator is defined.
  var i = 0;

  return function generateId(type, cb) {
    i++;
    cb(null, i + ';' + type);
  };
}

function Orm(options) {
  // Initialize orm from options.
  options = options || {};
  this.generateId = options.generateId || createIdGenerator();

  // Set a default marshaller for user input/output.
  this.marshaller = options.marshaller || marshallers.JSONMarshaller;

  // Create a registry for the orm's registered models.
  this.models = {};
}

util.inherits(Orm, EventEmitter);

/**
 * Creates a model, registers it with the orm, and returns it.
 * @param  {string} type - the model's type
 * @param  {object} options - the model's options
 * @return {Model} - the created model
 */
Orm.prototype.createModel = function(type, options) {
  // Check that the model's type is not already registered.
  if (this._modelExists(type)) {
    throw new Error('model "' + type + '" is already defined');
  }

  var model = new Model(type, this, options);
  this.models[type] = model;
  this.emit('model', model);

  return model;
};

Orm.prototype._onModel = function(type, cb) {
  if (this._modelExists(type)) {
    cb(this.models[type]);
  } else {
    this.on('model', function(model) {
      if (model.type === type) {
        cb(model);
      }
    });
  }
};

Orm.prototype._modelExists = function(type) {
  return (type in this.models);
};

/**
 * Creates an orm instance and returns it.
 * @param  {objects} options - the orm's options
 * @return {Orm} - the created orm
 */
function createOrm(options) {
  return new Orm(options);
}

module.exports = createOrm;
