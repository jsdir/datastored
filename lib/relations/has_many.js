var Collection = require('./collection');

var HasMany = {
  initializeRelation: function() {
    // TODO: Throw error until uncached relations are implemented.
    if (!this.relation.cached) {
      throw new Error('all HasMany relations must be cached for now');
    }
  },
  getDefaultValue: function() {
    return new Collection(this);
  },
  onInput: function() {
    // Prevent the attribute from being directly mutated.
    throw new Error('cannot directly set a HasMany relation');
  }
};

function HasMany(options) {
  return {
    default: new Collection(),
    hasValue: false // unjoinable, unsettable
  };
}

module.exports = HasMany;
