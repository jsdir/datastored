var RSVP = require('rsvp');
var redis = require('redis');

var datastored = require('../../..');
var redisDatastores = require('../../../lib/datastores/redis');
var testUtils = require('../../test_utils');

describe('Redis associaitons >', function() {

  before(function() {
    this.env = testUtils.createTestEnv();
    this.client = redis.createClient();
    this.hashStore = new redisDatastores.RedisHashStore(this.client);
    this.store = new redisDatastores.RedisAssociationStore(this.client);

    this.ParentModel = this.env.createWithAttributes('ParentModel', {
      children: datastored.RedisList({store: this.store})
    });
  });

  beforeEach(function(done) {
    this.store.reset(done);
  });

  beforeEach(function() {
    var self = this;
    return testUtils.nextTick(function() {
      return RSVP.all([
        self.ParentModel.create().then(function(instance) {
          self.parent = instance;
        }),
        self.env.BasicModel.create().then(function(instance) {
          self.child1 = instance;
        }),
        self.env.BasicModel.create().then(function(instance) {
          self.child2 = instance;
        }),
      ]);
    }).then(function() {
      return self.parent.fetch({children: ['lpush', [
        self.child1, self.child2
      ]]});
    });
  });

  describe('RedisList', function() {

    it('should use lpush correctly', function() {
      return this.parent.fetch({
        children: ['lpush', [this.parent, this.parent]]
      }).then(function(data) {
        data.should.eq(4);
      });
    });

    it('should use lrange correctly', function() {
      var self = this;
      var parent = this.parent;
      return this.parent.fetch({children: ['lrange', [0, 4]]})
        .then(function(data) {
          testUtils.assertEqualInstances(data[0], self.child2);
          testUtils.assertEqualInstances(data[1], self.child1);
        });
    });

    it('should save correctly', function() {
      return this.parent.save({
        children: ['lpush', [this.parent, this.parent]]
      });
    });

    describe('trees', function() {

      before(function() {
        this.ChildModel = this.env.createWithAttributes('ChildModel', {
          children: datastored.RedisList({
            store: this.store,
            type: 'ChildModel'
          }),
          foo: datastored.Integer({hashStores: [this.hashStore]}),
          bar: datastored.Integer({hashStores: [this.hashStore]}),
          baz: datastored.Integer({hashStores: [this.hashStore]})
        });

        this.ParentModel = this.env.createWithAttributes('AncestorModel', {
          descendants: datastored.RedisList({
            store: this.store,
            type: 'ChildModel',
            tree: {
              childrenAttribute: 'children'
            }
          }),
          foo: datastored.Integer({hashStores: [this.hashStore]})
        });
      });

      beforeEach(function() {
        // Save a test structure.
        var self = this;
        var child1, child2;
        return this.ChildModel.create({foo: 1, bar: 2, baz: 3}).then(function(child) {
	  child1 = child;
          return self.ChildModel.create({foo: 4, bar: 5, baz: 6});
        }).then(function(child) {
          child2 = child;
          return self.ChildModel.create({foo: 4, children: ['rpush', [child1, child2]]});
        }).then(function(child) {
          return self.ParentModel.create({foo: 5, descendants: ['rpush', [child]]});
        }).then(function(parent) {
          self.parent = parent;
        });
      });

      it('should be fetched correctly with user transforms', function() {
        return this.parent.fetch({descendants: {tree: true, attributes: {
          foo: true, bar: true
        }, user: true}}).then(function(descendants) {
          testUtils.assertEqualResults(descendants, [{
            children: [{
              id: true,
              foo: 1,
              bar: 2,
              children: []
            }, {
              id: true,
              foo: 4,
              bar: 5,
              children: []
            }]
          }]);
        });
      });

      it('should be fetched correctly without user transforms', function() {
        return this.parent.fetch({descendants: {tree: true, attributes: {
          foo: true, bar: true
        }}}).then(function(descendants) {
          var attributes = {foo: true, bar: true, baz: true};
          descendants[0].instance.get('foo').should.eq(4);
          descendants[0].children[0].instance.get(attributes, {ids: false})
            .should.deep.eq({foo: 1, bar: 2});
          descendants[0].children[1].instance.get(attributes, {ids: false})
            .should.deep.eq({foo: 4, bar: 5});
        });
      });
    });
  });
});
