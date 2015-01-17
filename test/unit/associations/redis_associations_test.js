var RSVP = require('rsvp');
var redis = require('redis');

var datastored = require('../../..');
var redisDatastores = require('../../../lib/datastores/redis');
var testUtils = require('../../test_utils');

function assertCommandReturns(command, args, assertedResult, cb) {

}

describe('Redis associaitons >', function() {

  before(function() {
    this.env = testUtils.createTestEnv();
    this.client = redis.createClient();
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
  });

  xit('should fail on redis failure', function() {});
});
