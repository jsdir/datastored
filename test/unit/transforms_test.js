var _ = require('lodash');
var sinon = require('sinon');
var RSVP = require('rsvp');

var datastored = require('../..');
var memoryDatastores = require('../../lib/datastores/memory');
var testUtils = require('../test_utils');

/**
 * Tests must be run at least one process tick after the model was defined to
 * allow for registration of all defined models.
 */

function wrap(value, wrapValue) {
  return wrapValue + '(' + value + ')';
}

function wrapValues(data, wrapValue) {
  return _.mapValues(data, function(value) {
    return wrap(value, wrapValue);
  });
}

function wrapMixin(wrapValue) {
  return {
    input: sinon.spy(function(data, options) {
      return wrapValues(data, wrapValue + '.input');
    }),
    output: sinon.spy(function(data, options) {
      return wrapValues(data, wrapValue + '.output');
    }),
    fetch: sinon.spy(function(data, options, cb) {
      cb(null, wrapValues(data, wrapValue + '.fetch'));
    }),
    save: sinon.spy(function(data, options, cb) {
      cb(null, wrapValues(data, wrapValue + '.save'));
    })
  };
}

describe('Transform sets >', function() {

  before(function() {
    this.env = testUtils.createTestEnv();
    this.hashStore = new memoryDatastores.MemoryHashStore();
    this.mixin = wrapMixin('mixin.1');
    this.models = {
      mixin: {}, type: {}, basic: {}
    };

    this.attribute = {
      input: sinon.spy(function(name, value, options) {
        return wrap(value, 'attribute.input');
      }),
      output: sinon.spy(function(name, value, options) {
        return wrap(value, 'attribute.output');
      }),
      fetch: sinon.spy(function(name, value, options, cb) {
        cb(null, wrap(value, 'attribute.fetch'));
      }),
      save: sinon.spy(function(name, value, options, cb) {
        cb(null, wrap(value, 'attribute.save'));
      })
    };
    this.attribute.hashStores = [this.hashStore];

    // Define models

    this.MixinModel = this.env.orm.createModel('MixinModel', {
      keyspace: 'MixinModel',
      id: datastored.Id({type: 'string'}),
      mixins: [this.mixin, wrapMixin('mixin.2')],
      attributes: {
        text: datastored.String(this.attribute)
      }
    });

    this.TypeModel = this.env.createWithAttributes({
      string: datastored.String({hashStores: [this.hashStore]}),
      integer: datastored.Integer({hashStores: [this.hashStore]}),
      float: datastored.Float({hashStores: [this.hashStore]}),
      boolean: datastored.Boolean({hashStores: [this.hashStore]}),
      date: datastored.Date({hashStores: [this.hashStore]}),
      datetime: datastored.Datetime({hashStores: [this.hashStore]})
    });

    this.BasicModel = this.env.BasicModel(this.hashStore);
  });

  before(function() {
    var self = this;
    return new RSVP.Promise(function(resolve) {
      process.nextTick(resolve);
    }).then(function() {
      return RSVP.all([
        self.MixinModel.create()
          .then(function(instance) {
            self.models.mixin.instance = instance;
            self.models.mixin.transforms = instance.model._transforms;
          })
      , self.TypeModel.create()
          .then(function(instance) {
            self.models.type.instance = instance;
            self.models.type.transforms = instance.model._transforms;
          })
      , self.BasicModel.create()
          .then(function(instance) {
            self.models.basic.instance = instance;
            self.models.basic.transforms = instance.model._transforms;
          })
      ]);
    });
  });

  beforeEach(function(done) {
    this.mixin.input.reset();
    this.mixin.output.reset();
    this.mixin.fetch.reset();
    this.mixin.save.reset();

    this.attribute.input.reset();
    this.attribute.output.reset();
    this.attribute.fetch.reset();
    this.attribute.save.reset();

    this.hashStore.reset(done);
  });

  describe('input', function() {

    var testData = {
      string: 'a',
      integer: 123,
      float: 1.2,
      boolean: true,
      date: '2000-01-01',
      datetime: '2000-01-01T00:00:00.000Z'
    };

    it('should call transforms correctly', function() {
      var options = {option: 'value'};
      var model = this.models.mixin;

      model.transforms.input
        .call(model.instance, {text: 'a'}, options)
        .should.deep.eq({text: 'attribute.input(mixin.2.input(mixin.1.input(a)))'});

      // Test model-level transforms.
      this.mixin.input.lastCall.thisValue.should.eq(model.instance);
      this.mixin.input.should.have.been
        .calledWithExactly({text: 'a'}, options);

      // Test attribute-level transforms.
      this.attribute.input.lastCall.thisValue.should.eq(model.instance);
      this.attribute.input.should.have.been
        .calledWithExactly('text', 'mixin.2.input(mixin.1.input(a))', options);
    });

    it('should not unserialize data by default', function() {
      var model = this.models.type;
      model.transforms.input.call(model.instance, testData, {})
        .should.deep.eq(testData);
    });

    it('should unserialize data when using user transforms', function() {
      var model = this.models.type;
      var data = model.transforms.input
        .call(model.instance, testData, {user: true});

      data.string.should.eq('a');
      data.integer.should.eq(123);
      data.float.should.eq(1.2);
      data.boolean.should.eq(true);
      data.date.getTime().should.eq(946684800000);
      data.datetime.getTime().should.eq(946684800000);
    });

    it('should not remove guarded values by default', function() {
      var model = this.models.basic;
      model.transforms.input.call(model.instance, {
        guarded: 'guarded', text: 'a'
      }, {}).should.deep.eq({guarded: 'guarded', text: 'a'});
    });

    it('should remove guarded values when using user transforms', function() {
      var model = this.models.basic;
      model.transforms.input.call(model.instance, {
        guarded: 'guarded', text: 'a'
      }, {user: true}).should.deep.eq({text: 'a'});
    });
  });

  describe('output', function() {

    var testData = {
      string: 'a',
      integer: 123,
      float: 1.2,
      boolean: true,
      date: new Date('2000-01-01'),
      datetime: new Date('2000-01-01T00:00:00.000Z')
    };

    it('should call transforms correctly', function() {
      var options = {option: 'value'};
      var model = this.models.mixin;

      model.transforms.output
        .call(model.instance, {text: 'a'}, options)
        .should.deep.eq({text: 'mixin.1.output(mixin.2.output(attribute.output(a)))'});

      // Test attribute-level transforms.
      this.mixin.output.lastCall.thisValue.should.eq(model.instance);
      this.mixin.output.should.have.been
        .calledWithExactly({text: 'mixin.2.output(attribute.output(a))'}, options);

      // Test model-level transforms.
      this.attribute.output.lastCall.thisValue.should.eq(model.instance);
      this.attribute.output.should.have.been
        .calledWithExactly('text', 'a', options);
    });

    it('should not serialize data by default', function() {
      var model = this.models.type;
      model.transforms.output.call(model.instance, testData, {})
        .should.deep.eq(testData);
    });

    it('should serialize data when using user transforms', function() {
      var model = this.models.type;
      model.transforms.output.call(model.instance, testData, {user: true})
        .should.deep.eq({
          string: 'a',
          integer: 123,
          float: 1.2,
          boolean: true,
          date: '2000-01-01',
          datetime: '2000-01-01T00:00:00.000Z'
        });
    });

    it('should not remove hidden values by default', function() {
      var model = this.models.basic;
      model.transforms.output.call(model.instance, {
        hidden: 'hidden', text: 'a'
      }, {}).should.deep.eq({hidden: 'hidden', text: 'a'});
    });

    it('should remove hidden values when using user transforms', function() {
      var model = this.models.basic;
      model.transforms.output.call(model.instance, {
        hidden: 'hidden', text: 'a'
      }, {user: true}).should.deep.eq({text: 'a'});
    });
  });

  describe('save', function() {

    it('should call transforms correctly', function(done) {
      var self = this;
      var options = {option: 'value'};
      var model = this.models.mixin;

      model.transforms.save
        .call(model.instance, {text: 'a'}, options, function(err, data) {
          data.should.deep.eq({text: 'attribute.save(mixin.2.save(mixin.1.save(a)))'});

          // Test attribute-level transforms.
          self.mixin.save.lastCall.thisValue.should.eq(model.instance);
          self.mixin.save.should.have.been
            .calledWithExactly({text: 'a'}, options, sinon.match.func);

          // Test model-level transforms.
          self.attribute.save.lastCall.thisValue.should.eq(model.instance);
          self.attribute.save.should.have.been
            .calledWithExactly('text', 'mixin.2.save(mixin.1.save(a))', options, sinon.match.func);

          done();
        });
    });

    it('should fail with serialization errors', function(done) {
      var model = this.models.type;
      var data = {date: 'invalid'};
      model.transforms.input.call(model.instance, data, {user: true});
      model.transforms.save.call(model.instance, data, {}, function(err) {
        err.should.deep.eq({date: 'Invalid date'});
        done();
      });
    });
  });

  describe('fetch', function() {

    it('should call transforms correctly', function(done) {
      var self = this;
      var options = {option: 'value'};
      var model = this.models.mixin;

      model.transforms.fetch
        .call(model.instance, {text: 'a'}, options, function(err, data) {
          data.should.deep.eq({text: 'mixin.1.fetch(mixin.2.fetch(attribute.fetch(a)))'});

          // Test attribute-level transforms.
          self.mixin.fetch.lastCall.thisValue.should.eq(model.instance);
          self.mixin.fetch.should.have.been
            .calledWithExactly({text: 'mixin.2.fetch(attribute.fetch(a))'}, options, sinon.match.func);

          // Test model-level transforms.
          self.attribute.fetch.lastCall.thisValue.should.eq(model.instance);
          self.attribute.fetch.should.have.been
            .calledWithExactly('text', 'a', options, sinon.match.func);

          done();
        });
    });
  });
});
