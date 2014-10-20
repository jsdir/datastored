var _ = require('lodash');

var createOrm = require('./lib/orm');
var relations = require('./lib/relations');
var attributes = require('./lib/attributes');

module.exports = _.extend({
  createOrm: createOrm,
}, relations, attributes);
