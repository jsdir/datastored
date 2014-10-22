var _ = require('lodash');

var datastored = require('..');

function noop() {}

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
  keyspace: 'keyspace',
  id: datastored.Integer,
  attributes: {
    foo: datastored.String({
      datastores: [1, 2]
    })
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
    mixins: [TransformMixin],
    attributes: {
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
    staticMethods: {func: function() {return this;}},
    methods: {func: function() {return this;}},
    scopes: {
      foo: ['foo']
    }
  });

  var options = _.extend({}, createTransformMixin(0), {
    mixins: [createTransformMixin(1), createTransformMixin(2)]
  });
  this.TransformModel = this.createModel(options);
}

function saveAndReloadInstance(instance, scope, cb) {
  instance.save(function(err) {
    if (err) {return cb(err);}
    var newInstance = instance.model.get(instance.getId());
    newInstance.fetch(scope, function(err) {
      if (err) {return cb(err);}
      cb(null, newInstance);
    });
  });
}

module.exports = {
  noop: noop,
  createModel: createModel,
  baseOptions: baseOptions,
  setupOrm: setupOrm,
  setupTestModels: setupTestModels,
  saveAndReloadInstance: saveAndReloadInstance
};
