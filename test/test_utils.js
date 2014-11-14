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
      guarded: datastored.String({hashStores: [true], guarded: true})
    },
    statics: {
      func: function() {return this;},
      property: 'text'
    },
    methods: {func: function() {return this;}}
  }
};

function createTestModels(orm) {
  return {
    BasicUnitModel: orm.createModel(
      'BasicUnitModel', modelOptions.BasicUnitModel
    )
  }
}

function createTestEnv(ctx) {
  ctx.orm = datastored.createOrm();
  ctx.options = modelOptions;
  ctx.models = createTestModels(ctx.orm);

  ctx.assertCreateFails = function(options, message) {
    (function() {
      ctx.orm.createModel(_.uniqueId(), options);
    }).should.throw(message);
  }
}

module.exports = {
  createTestEnv: createTestEnv
};
