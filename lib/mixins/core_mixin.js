var CoreMixin = {
  statics: {
    create: function(data) {
      return this.build(data).save();
    }
  },
  methods: {
    required: function(message) {
      this.end(function(err, instance) {
        if (err) {return cb(err);}
        if (instance.isNew()) {cb(message);}
      });
    },
    exists: function(cb) {
      this.end(function(err, instance) {
        if (err) {return cb(err);}
        cb(null, !_.isNull(instance));
      });
    }
  },
  input: function(data, userMode) {
    return _.object(_.map(data, function(value, name) {
      var attribute = this._getAttribute(name);
      return [name, attribute.guarded ? undefined : value];
    }));
  },
  output: function(data, userMode) {
    return _.object(_.map(data, function(value, name) {
      var attribute = this._getAttribute(name);
      return [name, attribute.hidden ? undefined : value];
    }));
  }
};

module.exports = CoreMixin;