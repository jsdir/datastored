var _ = require('lodash');

var datastored = require('..');

function createTransformMixin(text) {
  return {
    transform: {
      input: function(data) {
        return wrapValues(data, 'input' + text);
      },
      output: function(data) {
        return wrapValues(data, 'output' + text);
      }
    }
  };
}

var TransformMixin = createTransformMixin('');

var baseOptions = {
  mixins: [TransformMixin],
  keyspace: 'keyspace',
  id: datastored.Integer,
  attributes: {
    foo: datastored.String({
      datastores: [1, 2]
    }),
    bar: datastored.String({
      datastores: [1, 2]
    }),
    guarded: datastored.String({
      datastores: [1, 2],
      guarded: true
    }),
    hidden: datastored.String({
      datastores: [1, 2],
      hidden: true
    }),
    indexed: datastored.String({
      datastores: [{indexStore: true}, {indexStore: true}],
      indexed: true
    })
  },
  scopes: {
    foo: ['foo']
  }
};

function wrapValues(data, value) {
  return _.object(_.map(data, function(dataValue, key) {
    return [key, value + '(' + dataValue + ')'];
  }));
}

function createModel(orm, baseOptions) {
  return function(name, options) {
    // `name` is optional
    if (_.isObject(name)) {
      options = name;
      // Name defaults to a unique id.
      name = _.uniqueId();
    }

    if (baseOptions) {
      options = _.merge({}, baseOptions, options);
    }

    return orm.createModel(name, options);
  }
}

function setupOrm() {
  // Create test orm.
  this.orm = datastored.createOrm();
  this.createModel = createModel(this.orm, baseOptions);
  this.createNewModel = createModel(this.orm);
}

function setupTestModels() {
  this.BasicModel = this.createModel({
    staticMethods: {func: function() {return this;}},
    methods: {func: function() {return this;}}
  });

  var options = _.extend({}, createTransformMixin(0), {
    mixins: [createTransformMixin(1), createTransformMixin(2)]
  });
  this.TransformModel = this.createModel(options);
}

function reloadInstance(instance, scope, cb) {
  var model = instance.model.get(instance.getId());
  model.fetch(scope, function(err) {
    if (err) {return cb(err);}
    cb(null, model);
  });
}

module.exports = {
  createModel: createModel,
  baseOptions: baseOptions,
  setupOrm: setupOrm,
  setupTestModels: setupTestModels,
  reloadInstance: reloadInstance
};
