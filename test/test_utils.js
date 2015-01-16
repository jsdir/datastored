var domain = require('domain');

var _ = require('lodash');
var sinon = require('sinon');
var RSVP = require('rsvp');

var datastored = require('..');
var memoryStores = require('../lib/datastores/memory');

function getAsyncError(func, cb) {
  var errDomain = domain.create();
  errDomain.on('error', cb);
  errDomain.run(func);
}

exports.createTestEnv = function() {
  var hashStore = new memoryStores.MemoryHashStore();
  var orm = datastored.createOrm({createModelsAtRuntime: true});
  var basicModelOptions = {};

  var env = {
    orm: orm,
    hashStore: hashStore
  };

  // Utility models

  env.basicModelOptions = {
    id: datastored.Id({type: 'string'}),
    attributes: {
      text: datastored.String({hashStores: [hashStore]}),
      text2: datastored.String({hashStores: [hashStore]}),
      default1: datastored.String({
        hashStores: [hashStore],
        defaultValue: 'default1'
      }),
      default2: datastored.String({
        hashStores: [hashStore],
        defaultValue: 'default2'
      }),
      defaultFunc: datastored.String({
        hashStores: [hashStore],
        defaultValue: function() {
          return 'defaultFunc';
        }
      }),
      guarded: datastored.String({hashStores: [hashStore], guarded: true}),
      hidden: datastored.String({hashStores: [hashStore], hidden: true})
    },
    statics: {
      staticFunc: function() {return this;},
      property: 'text'
    },
    methods: {
      methodFunc: function() {return this;}
    }
  };

  env.BasicModel = orm.createModel('BasicModel', _.extend(
    {}, env.basicModelOptions, {keyspace: 'BasicModel'}
  ));

  env.basicModelLogMixin = exports.wrapMixin('m');
  env.BasicModelLog = orm.createModel('BasicModelLog', _.extend(
    {}, env.basicModelOptions, {
      keyspace: 'BasicModelLog',
      mixins: [env.basicModelLogMixin]
    }
  ));

  // Utility methods

  env.assertCreateFails = function(options, message, cb) {
    if (cb) {
      getAsyncError(function() {
        env.orm.createModel(_.uniqueId(), options);
      }, function(err) {
        err.message.should.eq(message);
        cb();
      });
    } else {
      (function() {
        env.orm.createModel(_.uniqueId(), options);
      }).should.throw(message);
    }
  };

  env.createWithAttributes = function(name, attributes) {
    // `name` is optional
    if (!attributes) {
      attributes = name;
      // If `name` is not defined, set it to a random id.
      name = _.uniqueId();
    }
    return env.orm.createModel(name, {
      keyspace: name,
      id: datastored.Id({type: 'string'}),
      attributes: attributes
    });
  };

  return env;
};

exports.shouldReject = function() {
  throw new Error('promise should have been rejected');
};

exports.wrap = function(value, wrapValue) {
  return wrapValue + '(' + value + ')';
};

exports.wrapValues = function(data, wrapValue) {
  return _.mapValues(data, function(value) {
    return exports.wrap(value, wrapValue);
  });
};

exports.wrapMixin = function(wrapValue) {
  return {
    input: sinon.spy(function(data, options) {
      return exports.wrapValues(data, wrapValue + '.input');
    }),
    output: sinon.spy(function(data, options) {
      return exports.wrapValues(data, wrapValue + '.output');
    }),
    fetch: sinon.spy(function(data, options, cb) {
      cb(null, exports.wrapValues(data, wrapValue + '.fetch'));
    }),
    save: sinon.spy(function(data, options, cb) {
      cb(null, exports.wrapValues(data, wrapValue + '.save'));
    })
  };
};

exports.resetTransforms = function(obj) {
  obj.input.reset();
  obj.output.reset();
  obj.fetch.reset();
  obj.save.reset();
};

exports.nextTick = function(func) {
  return new RSVP.Promise(function(resolve) {
    // Tests must be run at least one process tick after the model was
    // defined to allow for registration of all defined models.
    process.nextTick(resolve);
  }).then(func);
};

exports.cloneInstance = function(instance) {
  var model = instance.model;
  var clone = new model._constructor(model, {}, {});
  clone.id = instance.id;
  clone.saved = instance.saved;
  return clone;
};
