var util = require('util');
var RSVP = require('rsvp');

var _ = require('lodash');

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
  this.options = options || {};
  this.generateId = this.options.generateId || createIdGenerator();

  // Create a registry for the orm's registered models.
  this.models = {};
  this.events = this._createEmitter();
}

/**
 * Creates a model, registers it with the orm, and returns it.
 * @param  {string} type - the model's type
 * @param  {object} options - the model's options
 * @return {Model} - the created model
 */
Orm.prototype.createModel = function(type, options) {
  var self = this;

  // Check that the models are not already loaded.
  if (this._modelsLoaded && !this.options.createModelsAtRuntime) {
    throw new Error('cannot create model "' + type + '" since orm models ' +
      'are already loaded');
  }

  // Check that the model's type is not already registered.
  if (this._modelExists(type)) {
    throw new Error('model "' + type + '" is already defined');
  }

  var model = new Model(type, this, options);
  this.models[type] = model;

  // Defer model loading until all of the models are defined.
  process.nextTick(function() {
    model._load();
    self._modelsLoaded = true;
  });

  return model;
};

Orm.prototype._modelExists = function(type) {
  return (type in this.models);
};

Orm.prototype._createEmitter = function() {
  var eventHandlers = {};
  return {
    on: function(eventName, handler) {
      eventHandlers[eventName] = eventHandlers[eventName] || [];
      eventHandlers[eventName].push(handler);
    },
    emit: function(eventName) {
      var args = [].slice.call(arguments, 1);
      var handlers = eventHandlers[eventName];
      if (!handlers) {
        return RSVP.resolve();
      }
      return RSVP.all(_.map(handlers, function(handler) {
        return handler.apply(null, args);
      }));
    }
  };
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
