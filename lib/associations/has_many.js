var Collection = require('./collection');

function HasMany(options) {
  return function(orm, model, attributeName) {
    return {
      virtual: true,
      defaultValue: function() {
        return new Collection(model, attributeName);
      },
      outputAsync: function(value, options, userMode, cb) {
        // Collection.get
        value.get(options, cb);
      }
    };
  }
}

module.exports = HasMany;
