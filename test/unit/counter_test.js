var datastored = require('../..');
var testUtils = require('../test_utils');

describe('Counters', function() {

  before(function() {
    this.env = testUtils.createTestEnv();
    this.CounterModel = this.env.createWithAttributes('CounterModel', {
      counter1: datastored.Counter({hashStores: [this.env.hashStore]}),
      counter2: datastored.Counter({hashStores: [this.env.hashStore]})
    });
  });

  beforeEach(function(done) {
    this.env.hashStore.reset(done);
  });

  beforeEach(function() {
    var self = this;
    return this.CounterModel.create().then(function(instance) {
      self.instance = instance;
    });
  });

  var attributes = ['counter1', 'counter2'];

  it('should be initialized to 0', function() {
    var counterValues = {counter1: 0, counter2: 0};
    this.instance.get(attributes, {ids: false})
      .should.deep.eq(counterValues);
    return testUtils.cloneInstance(this.instance)
      .fetch(attributes, {ids: false})
      .then(function(data) {
        data.should.deep.eq(counterValues);
      });
  });

  it('should increment and decrement', function() {
    return this.instance.save({
      counter1: {incr: 2}, counter2: {decr: 3}
    })
      .then(function(instance) {
        instance.get(attributes, {ids: false}).should.deep.eq({
          counter1: 2, counter2: -3
        });
        return testUtils.cloneInstance(instance)
          .fetch(attributes, {ids: false});
      })
      .then(function(data) {
        data.should.deep.eq({counter1: 2, counter2: -3});
      });
  });
});
