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
  return function(options, isNew) {
    if (!isNew) {options = _.merge({}, baseOptions, options);}
    return orm.createModel(_.uniqueId(), options);
  }
}

function appendValue(data, appendedValue) {
  return _.object(_.map(data, function(value, key) {
    return [key, value + ',' + appendedValue]
  }));
}

module.exports = {
  createTestOrm: createTestOrm,
  createModel: createModel,
  baseOptions: baseOptions,
  appendValue: appendValue
};
