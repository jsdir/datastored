var domain = require('domain');

var _ = require('lodash');
var sinon = require('sinon');
var RSVP = require('rsvp');

var datastored = require('..');

var hashStore = new datastored.MemoryHashStore();

function wrapValues(data, wrapValue) {
  return _.mapValues(data, function(value) {
    return wrapValue + '(' + value + ')';
  });
}

function getAsyncError(func, cb) {
  var errDomain = domain.create();
  errDomain.on('error', cb);
  errDomain.run(func);
}

var modelOptions = {
  BasicUnitModel: {
    keyspace: 'BasicUnitModel',
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
  },
  TypeModel: {
    keyspace: 'TypeModel',
    id: datastored.Id({type: 'string'}),
    attributes: {
      string: datastored.String({hashStores: [hashStore]}),
      integer: datastored.Integer({hashStores: [hashStore]}),
      boolean: datastored.Boolean({hashStores: [hashStore]}),
      date: datastored.Date({hashStores: [hashStore]}),
      datetime: datastored.Datetime({hashStores: [hashStore]})
    }
  },
  MixinModel: {
    keyspace: 'MixinModel',
    mixins: [{
      input: function(data) {
        return wrapValues(data, 'mixin.1');
      },
      output: function(data) {
        return wrapValues(data, 'mixin.1');
      },
      save: function(data, cb) {
        cb(null, wrapValues(data, 'mixin.1'));
      },
      fetch: function(data, options, cb) {
        cb(null, wrapValues(data, 'mixin.1'));
      }
    }, {
      input: function(data) {
        return wrapValues(data, 'mixin.2');
      },
      output: function(data) {
        return wrapValues(data, 'mixin.2');
      },
      save: function(data, cb) {
        cb(null, wrapValues(data, 'mixin.2'));
      },
      fetch: function(data, options, cb) {
        cb(null, wrapValues(data, 'mixin.2'));
      }
    }],
    id: datastored.Id({type: 'string'}),
    attributes: {
      text: datastored.String({
        hashStores: [hashStore],
        input: function(name, value) {
          return 'attribute.1(' + value + ')';
        },
        output: function(name, value) {
          return 'attribute.1(' + value + ')';
        },
        save: function(name, value, cb) {
          cb(null, 'attribute.1(' + value + ')');
        },
        fetch: function(name, value, options, cb) {
          cb(null, 'attribute.1(' + value + ')');
        }
      })
    },
  },
  RequiredModel: {
    keyspace: 'RequiredModel',
    id: datastored.Id({type: 'string'}),
    attributes: {
      text: datastored.String({hashStores: [hashStore]}),
      required: datastored.String({required: true, hashStores: [hashStore]})
    }
  }
};

function createTestModels(orm) {
  return {
    BasicUnitModel: orm.createModel(
      'BasicUnitModel', modelOptions.BasicUnitModel
    ),
    TypeModel: orm.createModel(
      'TypeModel', modelOptions.TypeModel
    ),
    MixinModel: orm.createModel(
      'MixinModel', modelOptions.MixinModel
    ),
    RequiredModel: orm.createModel(
      'RequiredModel', modelOptions.RequiredModel
    )
  }
}

function createTestEnv(ctx) {
  ctx.orm = datastored.createOrm({createModelsAtRuntime: true});
  ctx.options = modelOptions;
  ctx.models = createTestModels(ctx.orm);

  ctx.assertCreateFails = function(options, message, cb) {
    if (cb) {
      getAsyncError(function() {
        ctx.orm.createModel(_.uniqueId(), options);
      }, function(err) {
        err.message.should.eq(message);
        cb();
      });
    } else {
      (function() {
        ctx.orm.createModel(_.uniqueId(), options);
      }).should.throw(message);
    }
  }

  ctx.createWithAttributes = function(name, attributes) {
    // `name` is optional
    if (_.isNull(attributes)) {
      attributes = name;
      // If `name` is not defined, set it to a random id.
      name = _.uniqueId();
    }

    return ctx.orm.createModel(name, {
      keyspace: name,
      id: datastored.Id({type: 'integer'}),
      attributes: attributes
    });
  }
}

function stubTransforms(model) {
  var transforms = _.clone(model._transforms);
  var stubs = {
    input: sinon.spy(function(data) {return wrapValues(data, 'input');}),
    output: sinon.spy(function(data) {return wrapValues(data, 'output');}),
    save: sinon.spy(function(data, cb) {cb(null, wrapValues(data, 'save'));}),
    fetch: sinon.spy(function(data, options, cb) {cb(null, wrapValues(data, 'fetch'));})
  }
  var stubTransforms = model._transforms;
  _.extend(stubTransforms, stubs);

  function restore() {
    model._transforms = transforms;
  }

  return _.extend({
    restore: restore,
    disabled: function(func) {
      // Temporarily disable stubs.
      restore();
      var value = func();
      // Enable stubs.
      model._transforms = stubTransforms;
      return value;
    }
  }, stubs);
}

function shouldReject() {
  throw new Error('promise should have been rejected');
}

function reloadInstance(attributes) {
  return function(instance) {
    var newInstance = instance.model.withId(instance.id);
    // Override the input transform.
    newInstance.id = instance.id;
    return newInstance.fetch(attributes).then(function(exists) {
      exists.should.be.true;
      return newInstance;
    });
  }
}

module.exports = {
  createTestEnv: createTestEnv,
  wrapValues: wrapValues,
  stubTransforms: stubTransforms,
  shouldReject: shouldReject,
  reloadInstance: reloadInstance
};
