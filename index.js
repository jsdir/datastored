var _ = require('lodash');

var createOrm = require('./lib/orm');
var relations = require('./lib/relations');
var attributes = require('./lib/attributes');
var utils = require('./lib/utils')

module.exports = _.extend({
  createOrm: createOrm,
  mapAttributes: utils.mapAttributes
}, relations, attributes);
