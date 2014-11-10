var Collection = require('./collection');

function HasMany(options) {
  return function(orm, model, attributeName) {
    var collection = new Collection(model, attributeName);
    return {
      staticValue: collection,
      virtual: true,
      get: collection.get
    };
  }
}

module.exports = HasMany;
