var utils = require('../utils');
var Collection = require('./collection');

var Tree = {
  initializeRelation: function() {
    utils.requireAttributes(this.relation, [
      'parentRelation', 'childrenRelation', 'link'
    ]);
  },
  getDefaultValue: function() {
    return new Collection(this, true);
  },
  onInput: function() {
    // Prevent the attribute from being directly mutated.
    throw new Error('cannot directly set a Tree relation');
  }
};

module.exports = Tree;
