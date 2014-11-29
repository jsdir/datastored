var _ = require('lodash');

var datastored = require('..');

function wrapValues(data, value) {
  return _.object(_.map(data, function(dataValue, key) {
    return [key, value + '(' + dataValue + ')'];
  }));
}

var modelOptions = {
  BasicUnitModel: {
    keyspace: 'BasicUnitModel',
    id: datastored.Id({type: 'string'}),
    attributes: {
      text: datastored.String({hashStores: [true]}),
      default1: datastored.String({
        hashStores: [true],
        defaultValue: 'default1'
      }),
      default2: datastored.String({
        hashStores: [true],
        defaultValue: 'default2'
      }),
      defaultFunc: datastored.String({
        hashStores: [true],
        defaultValue: function() {
          return 'defaultFunc';
        }
      }),
      guarded: datastored.String({hashStores: [true], guarded: true})
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
      string: datastored.String({hashStores: [true]}),
      integer: datastored.Integer({hashStores: [true]}),
      boolean: datastored.Boolean({hashStores: [true]}),
      date: datastored.Date({hashStores: [true]}),
      datetime: datastored.Datetime({hashStores: [true]})
    }
  },
  MixinModel: {
    keyspace: 'MixinModel',
    id: datastored.Id({type: 'string'}),
    attributes: {
      text: datastored.String({hashStores: [true]}),
      input: function(value, applyUserTransforms) {
        return 'attribute.input:' + value;
      }
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
  createTestEnv: createTestEnv
};
