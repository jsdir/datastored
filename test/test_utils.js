var domain = require('domain');

var _ = require('lodash');
var sinon = require('sinon');
var RSVP = require('rsvp');

var datastored = require('..');

function getAsyncError(func, cb) {
  var errDomain = domain.create();
  errDomain.on('error', cb);
  errDomain.run(func);
}

/*
var hashStore = new datastored.MemoryHashStore();

function wrapValues(data, wrapValue) {
  return _.mapValues(data, function(value) {
    return wrapValue + '(' + value + ')';
  });
}

var modelOptions = {
  BasicUnitModel: {
    keyspace: 'BasicUnitModel',
    id: datastored.Id({type: 'string'}),
    attributes: {
      text: datastored.String({hashStores: [hashStore]}),
      text2: datastored.String({hashStores: [hashStore]}),
      default1: datastored.String({
        hashStores: [hashStore],
        defaultValue: 'default1'
      }),
      default2: datastored.String({
        hashStores: [hashStore],
        defaultValue: 'default2'
      }),
      defaultFunc: datastored.String({
        hashStores: [hashStore],
        defaultValue: function() {
          return 'defaultFunc';
        }
      }),
      guarded: datastored.String({hashStores: [hashStore], guarded: true}),
      hidden: datastored.String({hashStores: [hashStore], hidden: true})
    },
    statics: {
      staticFunc: function() {return this;},
      property: 'text'
    },
    methods: {
      methodFunc: function() {return this;}
    }
  },
  TypeModel: {
    keyspace: 'TypeModel',
    id: datastored.Id({type: 'string'}),
    attributes: {
      string: datastored.String({hashStores: [hashStore]}),
      integer: datastored.Integer({hashStores: [hashStore]}),
      boolean: datastored.Boolean({hashStores: [hashStore]}),
      date: datastored.Date({hashStores: [hashStore]}),
      datetime: datastored.Datetime({hashStores: [hashStore]})
    }
  }
  RequiredModel: {
    keyspace: 'RequiredModel',
    id: datastored.Id({type: 'string'}),
    attributes: {
      text: datastored.String({hashStores: [hashStore]}),
      required: datastored.String({required: true, hashStores: [hashStore]})
    }
  }
};
*/

exports.createTestEnv = function() {
  var orm = datastored.createOrm({createModelsAtRuntime: true});
  var env = {
    orm: orm,
    BasicModel: function(hashStore) {
      return orm.createModel('BasicModel', {
        keyspace: 'BasicModel',
        id: datastored.Id({type: 'string'}),
        attributes: {
          text: datastored.String({hashStores: [hashStore]}),
          text2: datastored.String({hashStores: [hashStore]}),
          default1: datastored.String({
            hashStores: [hashStore],
            defaultValue: 'default1'
          }),
          default2: datastored.String({
            hashStores: [hashStore],
            defaultValue: 'default2'
          }),
          defaultFunc: datastored.String({
            hashStores: [hashStore],
            defaultValue: function() {
              return 'defaultFunc';
            }
          }),
          guarded: datastored.String({hashStores: [hashStore], guarded: true}),
          hidden: datastored.String({hashStores: [hashStore], hidden: true})
        },
        statics: {
          staticFunc: function() {return this;},
          property: 'text'
        },
        methods: {
          methodFunc: function() {return this;}
        }
      });
    }
  };

  env.assertCreateFails = function(options, message, cb) {
    if (cb) {
      getAsyncError(function() {
        env.orm.createModel(_.uniqueId(), options);
      }, function(err) {
        err.message.should.eq(message);
        cb();
      });
    } else {
      (function() {
        env.orm.createModel(_.uniqueId(), options);
      }).should.throw(message);
    }
  };

  env.createWithAttributes = function(name, attributes) {
    // `name` is optional
    if (!attributes) {
      attributes = name;
      // If `name` is not defined, set it to a random id.
      name = _.uniqueId();
    }
    return env.orm.createModel(name, {
      keyspace: name,
      id: datastored.Id({type: 'integer'}),
      attributes: attributes
    });
  };

  return env;
};

exports.shouldReject = function() {
  throw new Error('promise should have been rejected');
};

exports.reloadInstance = function(attributes) {
  return function(instance) {
    var newInstance = instance.model.withId(instance.id);
    // Override the input transform.
    newInstance.id = instance.id;
    return newInstance.fetch(attributes).then(function(exists) {
      exists.should.be.true;
      return newInstance;
    });
  }
};
