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
  var self = this;

  if (_.isString(name)) {
    // Set a single attribute.
    var data = {};
    data[name] = value;
  } else {
    // Set multiple attributes.
    var data = name;
    raw = value;
  }

  // Filter valid attributes.
  var attributes = this.model.options.attributes;
  var names = _.keys(attributes);
  if (this.isNew) {
    names.push('id');
  }
  data = _.pick(data, names);

  // Remove values if they are not mutable.
  data = _.object(_.map(data, function(value, name) {
    if (attributes[name] && attributes[name].hasMutableValue === false) {
      return [name, undefined];
    }
    return [name, value];
  }));

  if (raw) {
    var changedData = data;
  } else {
    // Transform the attributes if necessary.
    data = _.reduce(data, function(result, value, name) {
      var attribute = attributes[name];
      if (attribute) {
        value = attribute.input(value);
        // Do not set undefined values.
        if (_.isUndefined(value)) {return result;}
      }
      result[name] = value;
      return result;
    }, {});

    var changedData = this._transform('input', data);
  }

  // Update changed attributes.
  if (changedData) {
    _.extend(this.values, changedData);
    // Exclude id from changed attributes.
    var changed = _.without(_.keys(changedData), 'id');
    this.changed = _.union(this.changed, changed);
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

  var data = _.pick(this.values, attributes);
  var self = this;
  if (!raw) {
    // Transform the attribute.
    data = _.reduce(data, function(result, value, name) {
      var attribute = self.model.options.attributes[name];
      if (attribute) {
        value = attribute.output(value);
        // Do not get undefined values.
        if (_.isUndefined(value)) {return result;}
      }
      result[name] = value;
      return result;
    }, {});

    data = this._transform('output', data);
  }

  // Return the result based on the attributes that were given.
  if (single) {
    return data[attributes];
  } else {
    return data;
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

  // Validate required attributes if saving a new instance.
  if (this.isNew) {
    var attributes = this.model.options.attributes;
    var requiredAttributes = _.filter(_.keys(attributes), function(name) {
      return attributes[name].required;
    });
    undefinedAttributes = _.difference(requiredAttributes, _.values(self.values));
    if (undefinedAttributes.length > 0) {
      return cb(_.object(_.map(undefinedAttributes, function(name) {
        return [name, 'attribute "' + name + '" is not defined'];
      })));
    }
  }

  // Wait for id if it is being generated.
  this._onId(function(err) {
    // TODO: if new, save indexes first to ensure uniqueness.
    // Run attributes through save callbacks.
    self._save(_.pick(self.values, self.changed), options, cb);
  });

  // Chain methods.
  return this;
};

Instance.prototype.toObject = function(scope) {
  return this.get(this._getScopeAttributes(scope));
};

Instance.prototype.getId = function(raw) {
  return this.get('id', raw);
};

Instance.prototype.isChanged = function() {
  return (this.changed.length > 0);
};

Instance.prototype._transform = function(transform, data) {
  var transformFuncs = this.model.options.transform || {};
  var func = transformFuncs[transform];
  if (func) {
    return func(data);
  }
  return data;
};

Instance.prototype._save = function() {
  // TODO: Compute datastores to save to (hashStore and indexStore)
  // integration test this with mock ds
};

Instance.prototype._fetch = function() {
  // TODO: Find datastore(s) to fetch from. Also negotiate based on numerical
  // datastore.priority
  // integration test this with mock ds
};

Instance.prototype._getScopeAttributes = function(scope) {
  // Return scope attributes if `scope` is a scope name.
  if (_.isString(scope)) {
    return this.model.options.scopes[scope];
  }
  // Otherwise, `scope` is an array of attributes. Return it as is.
  return scope;
};

/*
Instance.prototype._changeIncrements = function(name, amount) {
  if (!_.contains(_.keys(this.increments), name)) {
    this.increments[name] = 0;
  }
  this.increments[name] += amount;
  this.changed = _.union(this.changed, [name]);
};*/

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
