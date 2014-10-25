var Collection = require('./collection');

function HasMany(options) {
  return {
    staticValue: new Collection(),
    //hasMutableValue: false // unjoinable, unsettable
  };
}

module.exports = HasMany;
