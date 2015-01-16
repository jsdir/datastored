exports.RedisList = function(options) {
  options.store
  options.link
  return {
    default: options.virtual,
    input: function() {

    }
  }
};

exports.RedisSet = function(options) {
  if (!options.store) {
    throw new Error('store required');
  }
  // options.link
  return {
    virtual: true,
    fetch: function(name, value, options, cb) {
      var query = options.attributes[name];

      // Run query
      options.store.execute({
        onInstance: function(id) {
          return convert
        }
      },

      query[0], 'set', query[1], function(err, res) {
        if (err) {return cb(err);}
        // Convert ids to instances.
        res
      });
    },
    save: function(name, value, options, cb) {
      var query = options.attributes[name];

    }
  };
};
