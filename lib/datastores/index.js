var _ = require('lodash');

module.exports = _.extend(
  require('./memory'),
  require('./redis'),
  require('./postgres')
);
