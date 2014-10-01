var _ = require('lodash');

var datastored = require('..');

var baseOptions = {
  table: 'models',
  properties: {
    id: {type: 'string', primary: true},
    foo: {type: 'string'},
    bar: {type: 'string'}
  },
  scopes: {
    foo: ['foo']
  }
};

function createTestOrm() {
  return datastored.createOrm({memory: true});
}

function createModel(orm, baseOptions) {
  return function(options, name, isNew) {
    if (!isNew) {options = _.merge({}, baseOptions, options);}
    return orm.createModel(name || _.uniqueId(), options);
  }
}

function appendValue(data, appendedValue) {
  return _.object(_.map(data, function(value, key) {
    return [key, value + ',' + appendedValue]
  }));
}

function setupOrm() {
  // Create test orm.
  this.orm = createTestOrm();
  this.createModel = createModel(this.orm, baseOptions);
  this.createNewModel = createModel(this.orm);
}

function setupTestModels() {
  // Define test models.
  this.BasicModel = this.createModel();

  this.MethodModel = this.createModel({
    staticMethods: {foo: function() {return this;}},
    methods: {foo: function() {return this;}}
  });

  this.ErrorModel = this.createModel({
    properties: {foo: {type: 'string'}},
    callbacks: {
      beforeInput: function(values, cb) {cb({foo: 'message'});}
    }
  });

  this.CallbackModel = this.createModel({mixins: [{callbacks: {
    beforeInput: function(values, cb) {
      cb(null, testUtils.appendValue(values, 'beforeInput'));
    },
    afterInput: function(values, cb) {
      cb(null, testUtils.appendValue(values, 'afterInput'));
    },
    beforeOutput: function(values) {
      return testUtils.appendValue(values, 'beforeOutput');
    },
    afterOutput: function(values) {
      return testUtils.appendValue(values, 'afterOutput');
    }}}],
    callbacks: callbacks});
}

function reloadInstance(instance, scope, cb) {
  var model = instance.model.get(instance.getId());
  model.fetch(scope, function(err) {
    if (err) {return cb(err);}
    cb(null, model);
  });
}

module.exports = {
  createTestOrm: createTestOrm,
  createModel: createModel,
  baseOptions: baseOptions,
  appendValue: appendValue,
  setupOrm: setupOrm,
  setupTestModels: setupTestModels,
  reloadInstance: reloadInstance
};
