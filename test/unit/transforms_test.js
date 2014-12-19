var sinon = require('sinon');

var datastored = require('../..');
var memoryDatastores = require('../../lib/datastores/memory');
var testUtils = require('../test_utils');

describe('input transform', function() {

  before(function() {
    testUtils.createTestEnv(this);
  });

  it('should unserialize data', function() {
    var TypeModel = this.models.TypeModel;
    return TypeModel.create().then(function(instance) {
      var data = TypeModel._transforms.input.call(instance, {
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
    return Model.create().then(function(instance) {
      Model._transforms.input.call(instance, {
        guarded: 'guarded', text: 'a'
      }).should.deep.eq({guarded: 'guarded', text: 'a'});
    });
  });

  it('should remove guarded values when using user transforms', function() {
    var Model = this.models.BasicUnitModel;
    return Model.create().then(function(instance) {
      Model._transforms.input.call(instance, {
        guarded: 'guarded', text: 'a'
      }, true).should.deep.eq({text: 'a'});
    });
  });

  it('should apply mixin transforms in the correct order', function() {
    var MixinModel = this.models.MixinModel;
    return MixinModel.create().then(function(instance) {
      MixinModel._transforms.input.call(instance, {text: 'a'})
        .should.deep.eq({text: 'attribute.1(mixin.2(mixin.1(a)))'})
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
      Model.create().then(function(instance) {
        attributeInput.reset();
        optionsInput.reset();
        Model._transforms.input.call(instance, {text: 'a'}, true);
        attributeInput.should.have.been.calledWithExactly('a', true);
        attributeInput.lastCall.thisValue.should.eq(instance);
        optionsInput.should.have.been.calledWithExactly({text: 'a'}, true);
        optionsInput.lastCall.thisValue.should.eq(instance);
      }).then(done, done);
    });
  });
});

describe('output transform', function() {

  before(function() {
    testUtils.createTestEnv(this);
  });

  it('should serialize data', function() {
    var TypeModel = this.models.TypeModel;
    return TypeModel.create().then(function(instance) {
      TypeModel._transforms.output.call(instance, {
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
    return Model.create().then(function(instance) {
      Model._transforms.output.call(instance, {
        hidden: 'hidden', text: 'a'
      }, {}).should.deep.eq({hidden: 'hidden', text: 'a'});
    });
  });

  it('should remove hidden values when using user transforms', function() {
    var Model = this.models.BasicUnitModel;
    return Model.create().then(function(instance) {
      Model._transforms.output.call(instance, {
        hidden: 'hidden', text: 'a'
      }, {}, true).should.deep.eq({text: 'a'});
    });
  });

  it('should apply mixin transforms in the correct order', function() {
    var MixinModel = this.models.MixinModel;
    return MixinModel.create().then(function(instance) {
      MixinModel._transforms.output.call(instance, {text: 'a'})
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
      Model.create().then(function(instance) {
        attributeOutput.reset();
        optionsOutput.reset();
        Model._transforms.output.call(instance, {
          text: 'a'
        }, {option: 'value'}, true);

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
});

describe('save transform', function() {

  before(function() {
    testUtils.createTestEnv(this);
  });

  before(function() {
    this.ValidationModel = this.orm.createModel('ValidationModel', {
      keyspace: 'ValidationModel',
      id: datastored.Id({type: 'string'}),
      attributes: {
        bar: datastored.String({hashStores: [true], rules: {max: 2}}),
        baz: datastored.String({hashStores: [true], rules: {min: 4}})
      }
    });
  });

  xit('should apply mixin transforms in the correct order', function() {
    var MixinModel = this.models.MixinModel;
    return MixinModel.create().then(function(instance) {
      MixinModel._transforms.save.call(instance, {text: 'a'})
        .should.deep.eq({text: 'attribute.1(mixin.2(mixin.1(a)))'})
    });
  });

  it('should validate data', function() {
    return this.ValidationModel.create({bar: 'abc', baz: 'abc'})
      .should.be.rejectedWith({
        bar: 'attribute "bar" must have a maximum of 2 characters',
        baz: 'attribute "baz" must have a minimum of 4 characters'
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

describe('fetch transform', function() {

  xit('should apply mixin transforms in the correct order', function() {
    var MixinModel = this.models.MixinModel;
    return MixinModel.create().then(function(instance) {
      MixinModel._transforms.save.call(instance, {text: 'a'})
        .should.deep.eq({text: 'attribute.1(mixin.2(mixin.1(a)))'})
    });
  });
});
