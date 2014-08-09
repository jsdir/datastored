var datastored = require('..');

var baseOptions = {
  table: 'models',
  properties: {
    id: {type: 'string', primary: true}
  }
};

function createTestOrm() {
  return datastored.createOrm({memory: true});
}

module.exports = {
  createTestOrm: createTestOrm,
  baseOptions: baseOptions
};
