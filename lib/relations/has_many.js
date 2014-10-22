var Collection = require('./collection');

function HasMany(options) {
  return {
    default: new Collection(),
    hasMutableValue: false // unjoinable, unsettable
  };
}

module.exports = HasMany;
