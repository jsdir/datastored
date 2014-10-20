var _ = require('lodash');
var async = require('async');

var utils = require('./utils');

function Instance(model) {
  this.model = model;
  this.values = {};
  this.isNew = true;
  this._resetValueState();
}

Instance.prototype.set = function(name, value, raw) {
  // Sync validation rules only? (no async).
  // - guarded attributes (include otherAttributes in analysis and traceback to the owning attribute)

  var self = this;
  var changedValues;

  if (_.isString(name)) {
    // Set a single attribute.
    var values = {};
    values[name] = value;
  } else {
    // Set multiple attributes.
    var values = name;
    raw = value;
  }

  // TODO: remove attributes where hasValue is false
  // TODO: id should be guarded

  // Only set defined values.
  values = _.pick(values, _.keys(this.model.attributes));

  if (raw) {
    // Overwrite existing values if they exist.
    changedValues = values;
  } else {
    // Remove guarded values.

    // Run attributes through input callbacks.
    this._runInputCallbacks(values, function(err, values) {
      if (err) {
        // Overwrite existing error messages if they exist.
        _.extend(self.errors, err);
      } else {
        // Set changed attributes.
        changedValues = values;
      }
    });
  }

  // Update changed attributes.
  if (changedValues) {
    _.extend(this.values, changedValues);
    this.changed = _.union(this.changed, _.keys(changedValues));
  }

  // Chain methods.
  return this;
};

Instance.prototype.get = function(attributes, raw) {
  // Accept a single attribute string or an array of multiple attributes.
  var single = false;

  if (_.isString(attributes)) {
    attributes = [attributes];
    single = true;
  }

  var values = _.pick(this.values, attributes);
  if (!raw) {
    // run through transforms.
  }

  // Return the result based on the attributes that were given.
  if (single) {
    return values[attributes];
  } else {
    return values;
  }
};

Instance.prototype.fetch = function(options, scope, cb) {
  var self = this;
  this._requireSaved();

  // `options` is optional.
  if (_.isFunction(scope)) {
    cb = scope;
    scope = options;
    options = {};
  }

  // Get scope attributes for `hashStore`.
  var attributes = this._getScopeAttributes(scope);

  this._fetch(attributes, options, function(err, data) {
    if (err) {return cb(err);}

    // Set the fetched values.
    _.extend(self.values, data);

    // Call back with a boolean indicating whether new data was fetched or not.
    cb(null, !_.isEmpty(data));
  });

  // Chain methods.
  return this;
};

Instance.prototype.save = function(options, cb) {
  // Iterate through attributes:
  //   if required: ensure that the main attribute is defined (not null) and (all, some) or the other (need better name) attributes are also set...
  // TODO: handle space-saving defaults

  var self = this;

  // `options` is optional.
  if (_.isFunction(options)) {
    cb = options;
    options = {};
  }

  // Fail if instance errors exist. Since `this.errors` are only set when using
  // `this.set`, `save` is the only logical place where they should be handled.
  if (!_.isEmpty(this.errors)) {return cb(this.errors);}

  // Return if no attributes were changed.
  if (!this.isChanged()) {return cb();}

  // Wait for id if it is being generated.
  this._onId(function(err) {
    // TODO: if new, save indexes first to ensure uniqueness.
    // Run attributes through save callbacks.
    this._save(_.pick(self.values, self.changed), options, cb);
  });

  // Chain methods.
  return this;
};

Instance.prototype.toObject = function(scope, raw) {
  var data = this.get(this._getScopeAttributes(scope), raw);
  // Add id property to the output data.
  data[this.model.pkProperty] = this.getId(raw);
  return data;
};

Instance.prototype.getId = function(raw) {
  return this.get('id', raw);
};

Instance.prototype.isChanged = function() {
  return (this.changed.length > 0);
};

Instance.prototype._getScopeAttributes = function(scope) {
  // Return scope attributes if `scope` is a scope name.
  if (_.isString(scope)) {
    return this.model.options.scopes[scope];
  }
  // Otherwise, `scope` is an array of attributes. Return it as is.
  return scope;
};

Instance.prototype._changeIncrements = function(name, amount) {
  if (!_.contains(_.keys(this.increments), name)) {
    this.increments[name] = 0;
  }
  this.increments[name] += amount;
  this.changed = _.union(this.changed, [name]);
};

Instance.prototype._resetValueState = function() {
  // Reset value-related state. This will not reset reset the values.
  this.errors = {};
  this.changed = [];
  this.increments = {};
};

Instance.prototype._generateId = function() {
  var self = this;
  // Generate id asynchronously.
  this._idPromise = utils.Deferred();
  this.model.orm.generateId(this.model.type, function(err, id) {
    if (err) {return self._idPromise.resolve(err);}
    // Set the instance id.
    self.set(self.model.pkProperty, id, true);
    // Resolve the promise.
    self._idPromise.resolve(null, id)
  });
};

Instance.prototype._onId = function(cb) {
  if (this.getId(true) !== null) {
    // id exists or was manually input.
    cb();
  } else {
    // id is generated.
    this._idPromise.then(cb);
  }
};

Instance.prototype._requireSaved = function() {
  if (this.isNew) {
    throw new Error('the instance must be saved');
  }
};

module.exports = Instance;
