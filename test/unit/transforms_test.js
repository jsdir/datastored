var sinon = require('sinon');

var datastored = require('../..');
var memoryDatastores = require('../../lib/datastores/memory');
var testUtils = require('../test_utils');

function getTransforms(model, func) {
  return model.create().then(function(instance) {
    func(model._transforms, instance)
  });
}

/**
 * Tests must be run at least one process tick after the model was defined to
 * allow for registration of all defined models.
 */

describe('input transform', function() {

  before(function() {
    testUtils.createTestEnv(this);
  });

  it('should apply transforms in the correct order', function() {
    var Model = this.models.MixinModel;
    return getTransforms(Model, function(transforms, instance) {
      transforms.input.call(instance, {text: 'a'})
        .should.deep.eq({text: 'attribute.1(mixin.2(mixin.1(a)))'});
    });
  });

  it('should pass parameters to mixins and attribute methods', function(done) {
    var attributeInput = sinon.spy(function() {return 'a';});
    var optionsInput = sinon.spy(function() {return {text: 'a'};});
    var Model = this.orm.createModel('InputModel', {
      keyspace: 'InputModel',
      id: datastored.Id({type: 'string'}),
      attributes: {
        text: datastored.String({
          input: attributeInput,
          hashStores: [new memoryDatastores.MemoryHashStore()]
        })
      },
      input: optionsInput
    });

    process.nextTick(function() {
      getTransforms(Model, function(transforms, instance) {
        attributeInput.reset();
        optionsInput.reset();

        transforms.input.call(instance, {text: 'a'}, true)
          .should.deep.eq({text: 'a'});

        attributeInput.should.have.been.calledWithExactly('text', 'a', true);
        attributeInput.lastCall.thisValue.should.eq(instance);

        optionsInput.should.have.been.calledWithExactly({text: 'a'}, true);
        optionsInput.lastCall.thisValue.should.eq(instance);
      }).then(done, done);
    });
  });

  it('should unserialize data', function() {
    var Model = this.models.TypeModel;
    return getTransforms(Model, function(transforms, instance) {
      var data = transforms.input.call(instance, {
        string: 'a',
        integer: 123,
        boolean: true,
        date: '2000-01-01',
        datetime: '2000-01-01T00:00:00.000Z'
      }, true);

      data.string.should.eq('a');
      data.integer.should.eq(123);
      data.boolean.should.eq(true);
      data.date.getTime().should.eq(946684800000);
      data.datetime.getTime().should.eq(946684800000);
    });
  });

  it('should not remove guarded values by default', function() {
    var Model = this.models.BasicUnitModel;
    return getTransforms(Model, function(transforms, instance) {
      transforms.input.call(instance, {
        guarded: 'guarded', text: 'a'
      }).should.deep.eq({guarded: 'guarded', text: 'a'});
    });
  });

  it('should remove guarded values when using user transforms', function() {
    var Model = this.models.BasicUnitModel;
    return getTransforms(Model, function(transforms, instance) {
      transforms.input.call(instance, {
        guarded: 'guarded', text: 'a'
      }, true).should.deep.eq({text: 'a'});
    });
  });
});

describe('output transform', function() {

  before(function() {
    testUtils.createTestEnv(this);
  });

  it('should apply transforms in the correct order', function() {
    var Model = this.models.MixinModel;
    return getTransforms(Model, function(transforms, instance) {
      transforms.output.call(instance, {text: 'a'})
        .should.deep.eq({text: 'mixin.1(mixin.2(attribute.1(a)))'})
    });
  });

  it('should pass parameters to mixins and attribute methods', function(done) {
    var attributeOutput = sinon.spy(function() {return 'a';});
    var optionsOutput = sinon.spy(function() {return {text: 'a'};});
    var Model = this.orm.createModel('OutputModel', {
      keyspace: 'OutputModel',
      id: datastored.Id({type: 'string'}),
      attributes: {
        text: datastored.String({
          output: attributeOutput,
          hashStores: [new memoryDatastores.MemoryHashStore()]
        })
      },
      output: optionsOutput
    });

    process.nextTick(function() {
      getTransforms(Model, function(transforms, instance) {
        attributeOutput.reset();
        optionsOutput.reset();
        transforms.output.call(instance, {text: 'a'}, {option: 'value'}, true)
          .should.deep.eq({text: 'a'});

        attributeOutput.should.have.been.calledWithExactly('text', 'a', {
          option: 'value'
        }, true);
        attributeOutput.lastCall.thisValue.should.eq(instance);

        optionsOutput.should.have.been.calledWithExactly({text: 'a'}, {
          option: 'value'
        }, true);
        optionsOutput.lastCall.thisValue.should.eq(instance);
      }).then(done, done);
    });
  });

  it('should serialize data', function() {
    var Model = this.models.TypeModel;
    return getTransforms(Model, function(transforms, instance) {
      transforms.output.call(instance, {
        string: 'a',
        integer: 123,
        boolean: true,
        date: new Date('2000-01-01'),
        datetime: new Date('2000-01-01T00:00:00.000Z')
      }, {}, true).should.deep.eq({
        string: 'a',
        integer: 123,
        boolean: true,
        date: '2000-01-01',
        datetime: '2000-01-01T00:00:00.000Z'
      });
    });
  });

  it('should not remove hidden values by default', function() {
    var Model = this.models.BasicUnitModel;
    return getTransforms(Model, function(transforms, instance) {
      transforms.output.call(instance, {hidden: 'hidden', text: 'a'}, {})
        .should.deep.eq({hidden: 'hidden', text: 'a'});
    });
  });

  it('should remove hidden values when using user transforms', function() {
    var Model = this.models.BasicUnitModel;
    return getTransforms(Model, function(transforms, instance) {
      transforms.output.call(instance, {hidden: 'hidden', text: 'a'}, {}, true)
        .should.deep.eq({text: 'a'});
    });
  });
});

describe('save transform', function() {

  before(function() {
    testUtils.createTestEnv(this);
  });

  before(function() {
    var hashStore = new memoryDatastores.MemoryHashStore();
    this.ValidationModel = this.orm.createModel('ValidationModel', {
      keyspace: 'ValidationModel',
      id: datastored.Id({type: 'string'}),
      attributes: {
        bar: datastored.String({hashStores: [hashStore], rules: {max: 2}}),
        baz: datastored.String({hashStores: [hashStore], rules: {min: 4}})
      }
    });
  });

  it('should apply transforms in the correct order', function(done) {
    var Model = this.models.MixinModel;
    getTransforms(Model, function(transforms, instance) {
      transforms.save.call(instance, {text: 'a'}, function(err, data) {
        if (err) {return done(err);}
        data.should.deep.eq({text: 'attribute.1(mixin.2(mixin.1(a)))'});
        done();
      });
    }).catch(done);
  });

  it('should pass parameters to mixins and attribute methods', function(done) {
    var attributeSave = sinon.spy(function(n, _, cb) {cb(null, 'a');});
    var optionsSave = sinon.spy(function(_, cb) {cb(null, {text: 'a'});});
    var Model = this.orm.createModel('SaveModel', {
      keyspace: 'SaveModel',
      id: datastored.Id({type: 'string'}),
      attributes: {
        text: datastored.String({
          save: attributeSave,
          hashStores: [new memoryDatastores.MemoryHashStore()]
        })
      },
      save: optionsSave
    });

    process.nextTick(function() {
      getTransforms(Model, function(transforms, instance) {
        attributeSave.reset();
        optionsSave.reset();
        transforms.save.call(instance, {text: 'a'}, function(err, data) {
          data.should.deep.eq({text: 'a'});

          attributeSave.should.have.been.calledWithExactly('text', 'a',
            sinon.match.func);
          attributeSave.lastCall.thisValue.should.eq(instance);

          optionsSave.should.have.been.calledWithExactly({text: 'a'},
            sinon.match.func);
          optionsSave.lastCall.thisValue.should.eq(instance);

          done();
        });
      }).catch(done);
    });
  });

  it('should validate data', function() {
    return this.ValidationModel.create({bar: 'abc', baz: 'abc'})
      .then(testUtils.shouldReject, function(err) {
        err.should.deep.eq({
          bar: 'attribute "bar" must have a maximum of 2 characters',
          baz: 'attribute "baz" must have a minimum of 4 characters'
        });
      });
  });

  it('should fail with serialization errors', function(done) {
    var Model = this.models.TypeModel;
    getTransforms(Model, function(transforms, instance) {
      var data = {date: 'invalid'}
      transforms.input.call(instance, data, true);
      transforms.save.call(instance, data, function(err) {
        err.should.deep.eq({date: 'Invalid date'});
        done();
      });
    }).catch(done);
  });
});

describe('fetch transform', function() {

  before(function() {
    testUtils.createTestEnv(this);
  });

  it('should apply transforms in the correct order', function(done) {
    var Model = this.models.MixinModel;
    getTransforms(Model, function(transforms, instance) {
      transforms.fetch.call(instance, {text: 'a'}, {}, function(err, data) {
        if (err) {return done(err);}
        data.should.deep.eq({text: 'mixin.1(mixin.2(attribute.1(a)))'});
        done();
      });
    }).catch(done);
  });

  it('should pass parameters to mixins and attribute methods', function(done) {
    var attributeFetch = sinon.spy(function(n, v, o, cb) {cb(null, 'a');});
    var optionsFetch = sinon.spy(function(d, o, cb) {cb(null, {text: 'a'});});
    var Model = this.orm.createModel('FetchModel', {
      keyspace: 'FetchModel',
      id: datastored.Id({type: 'string'}),
      attributes: {
        text: datastored.String({
          fetch: attributeFetch,
          hashStores: [new memoryDatastores.MemoryHashStore()]
        })
      },
      fetch: optionsFetch
    });

    process.nextTick(function() {
      getTransforms(Model, function(transforms, instance) {
        attributeFetch.reset();
        optionsFetch.reset();
        transforms.fetch.call(instance, {text: 'a'}, {}, function(err, data) {
          data.should.deep.eq({text: 'a'});

          attributeFetch.should.have.been.calledWithExactly('text', 'a', {},
            sinon.match.func);
          attributeFetch.lastCall.thisValue.should.eq(instance);

          optionsFetch.should.have.been.calledWithExactly({text: 'a'}, {},
            sinon.match.func);
          optionsFetch.lastCall.thisValue.should.eq(instance);

          done();
        });
      }).catch(done);
    });
  });
});
