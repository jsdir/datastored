var _ = require('lodash');

var createOrm = require('./lib/orm');
var associations = require('./lib/associations');
var attributes = require('./lib/attributes');
var datastores = require('./lib/datastores');
var utils = require('./lib/utils')

module.exports = _.extend({
  createOrm: createOrm,
  mapAttributes: utils.mapAttributes
}, associations, attributes, datastores);
