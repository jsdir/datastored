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

        attributeInput.should.have.been.calledWithExactly('a', true);
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

        attributeOutput.should.have.been.calledWithExactly('a', {
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

  it('should validate data', function() {
    return this.ValidationModel.create({bar: 'abc', baz: 'abc'})
      .catch(function(err) {
        err.should.deep.eq({
          bar: 'attribute "bar" must have a maximum of 2 characters',
          baz: 'attribute "baz" must have a minimum of 4 characters'
        });
      });
  });

  xit('should fail with serialization errors', function(done) {
    var TypeModel = this.models.TypeModel;
    TypeModel.create().then(function(instance) {
      TypeModel._transforms.save.call(instance, {
        date: 'invalid'
      }, function(err) {
        console.log(arguments)
        err.should.deep.eq(345);
        done();
      });
    }, done);
  });
});

xdescribe('fetch transform', function() {

  xit('should apply mixin transforms in the correct order', function() {
    var MixinModel = this.models.MixinModel;
    return MixinModel.create().then(function(instance) {
      MixinModel._transforms.save.call(instance, {text: 'a'})
        .should.deep.eq({text: 'attribute.1(mixin.2(mixin.1(a)))'})
    });
  });
});
