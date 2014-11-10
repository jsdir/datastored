var HelperMixin = {
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
  }
};

module.exports = HelperMixin;
