var _ = require('lodash');

var datastored = require('..');
var memoryDatastores = require('../lib/datastores/memory');

var hashStore = new memoryDatastores.MemoryHashStore();

function wrapValues(data, wrapValue) {
  return _.mapValues(data, function(value) {
    return wrapValue + '(' + value + ')';
  });
}

var modelOptions = {
  BasicUnitModel: {
    keyspace: 'BasicUnitModel',
    id: datastored.Id({type: 'string'}),
    attributes: {
      text: datastored.String({hashStores: [hashStore]}),
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
      guarded: datastored.String({hashStores: [hashStore], guarded: true})
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
      input: function(data, applyUserTransforms) {
        return wrapValues(data, 'mixin.1');
      }
    }, {
      input: function(data, applyUserTransforms) {
        return wrapValues(data, 'mixin.2');
      }
    }],
    id: datastored.Id({type: 'string'}),
    attributes: {
      text: datastored.String({
        hashStores: [hashStore],
        input: function(value, applyUserTransforms) {
          return 'attribute.1(' + value + ')';
        }
      })
    },
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
    )
  }
}

function createTestEnv(ctx) {
  ctx.orm = datastored.createOrm();
  ctx.options = modelOptions;
  ctx.models = createTestModels(ctx.orm);

  ctx.assertCreateFails = function(options, message, cb) {
    if (cb) {
      listeners = process.listeners('uncaughtException');
      process.removeAllListeners('uncaughtException');

      process.once('uncaughtException', function(err) {
        err.message.should.eq(message);
        _.each(listeners, function(listener) {
          process.on('uncaughtException', listener);
        });
        cb();
      });
      ctx.orm.createModel(_.uniqueId(), options);
    } else {
      (function() {
        ctx.orm.createModel(_.uniqueId(), options);
      }).should.throw(message);
    }
  }
}

module.exports = {
  createTestEnv: createTestEnv,
  wrapValues: wrapValues
};
