var utils = require('../utils');

exports.RedisList = function(options) {

  function executeCommands(name, value, attrOptions, cb) {
    var key = this.model._props.keyspace + ':' + this.id + ':' + name;
    var models = this.model.orm.models;
    options.store.execute('list', utils.getIdMethods(options, models), {
      // fetch: attrOptions.attributes[name], save: value
      key: key, query: value || attrOptions.attributes[name]
    }, cb);
  }

  return {
    virtual: true,
    fetch: executeCommands,
    save: executeCommands
  }
};
