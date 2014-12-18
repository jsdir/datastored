var chai = require('chai');
var sinon = require('sinon');
var chaiAsPromised = require('chai-as-promised');

var datastored = require('../..');
var testUtils = require('../test_utils');

var expect = chai.expect;
chai.use(chaiAsPromised);

describe('Instance', function() {

  before(function() {
    testUtils.createTestEnv(this);
    this.Model = this.models.BasicUnitModel;
    this.modelOptions = this.options.BasicUnitModel;
  });

  beforeEach(function() {
    sinon.stub(this.Model._transforms, 'output', function(data) {
      return testUtils.wrapValues(data, 'output');
    });
    this.transforms = this.Model._transforms;
  });

  afterEach(function() {
    this.transforms.output.restore();
  });

  describe('model options', function() {

    it('should assign "methods"', function() {
      return this.Model.create().then(function(instance) {
        instance.methodFunc().should.deep.eq(instance);
      });
    });
  });

  describe('#get()', function() {

    it('should get a single attribute', function() {
      var output = this.transforms.output;
      return this.Model.create({text: 'a'}).then(function(instance) {
        instance.get('text').should.eq('output(a)');
        output.lastCall.thisValue.should.eq(instance);
        output.should.have.been.calledWithExactly({
          text: 'a'
        }, {text: null}, undefined);
      });
    });

    it('should get multiple attributes', function() {
      var output = this.transforms.output;
      return this.Model.create({text: 'a', text2: 'b'}).then(function(instance) {
        instance.get(['text', 'text2']).should.deep.eq({
          text: 'output(a)', text2: 'output(b)'
        });
        output.lastCall.thisValue.should.eq(instance);
        output.should.have.been.calledWithExactly({
          text: 'a', text2: 'b'
        }, {text: undefined, text2: undefined}, undefined);
      });
    });

    it('should get multiple attributes with options', function() {
      var output = this.transforms.output;
      return this.Model.create({text: 'a', text2: 'b'}).then(function(instance) {
        instance.get({text: 1, text2: 2}).should.deep.eq({
          text: 'output(a)', text2: 'output(b)'
        });
        output.lastCall.thisValue.should.eq(instance);
        output.should.have.been.calledWithExactly({
          text: 'a', text2: 'b'
        }, {text: 1, text2: 2}, undefined);
      });
    });

    it('should apply user transforms if requested', function() {
      var output = this.transforms.output;
      return this.Model.create({text: 'a'}).then(function(instance) {
        instance.get('text', true).should.eq('output(a)');
        output.lastCall.thisValue.should.eq(instance);
        output.should.have.been.calledWithExactly({
          text: 'a'
        }, {text: null}, true);
      });
    });
  });

  describe('#getId()', function() {

    beforeEach(function() {
      this.instance = this.Model.withId('value');
    });

    it('should return the instance id', function() {
      this.instance.getId().should.eq('output(value)');
      this.transforms.output.lastCall.thisValue.should.eq(this.instance);
      this.transforms.output.should.have.been.calledWithExactly({
        id: 'value'
      }, null, undefined);
    });

    it('should apply user transforms if requested', function() {
      this.instance.getId(true).should.eq('output(value)');
      this.transforms.output.lastCall.thisValue.should.eq(this.instance);
      this.transforms.output.should.have.been.calledWithExactly({
        id: 'value'
      }, null, true);
    });
  });

  describe('#fetch()', function() {

    it('should only fetch requested attributes', function() {
      var Model = this.Model;
      return Model.create({text: 'a', text2: 'b'}).then(function(instance) {
        var newInstance = Model.withId(instance.id);
        return newInstance.fetch(['text']);
      }).then(function(instance) {
        instance.get('text').should.eq('output(a)');
        expect(instance.get('text2')).to.be.undefined;
      });
    });

    it('should resolve indicating if the instance was found', function() {
      var instance = this.Model.withId('undefined');
      return instance.fetch('text').then(function(instance) {
        expect(instance).to.be.null;
      });
    });
  });

  xdescribe('#save()', function() {

    before(function() {
      this.ValidationModel = this.orm.createModel('ValidationModel', {
        keyspace: 'ValidationModel',
        id: datastored.Id({type: 'string'}),
        attributes: {
          bar: datastored.String({
            hashStores: [true],
            rules: {max: 2}
          }),
          baz: datastored.String({
            hashStores: [true],
            rules: {min: 4}
          })
        }
      });

      this.ErrorModel = this.orm.createModel('ErrorModel', {
        keyspace: 'ErrorModel',
        id: datastored.Id({type: 'string'}),
        attributes: {text: datastored.String({hashStores: [true]})},
        asyncTransform: {
          save: function(options, data, cb) {
            cb('message');
          }
        }
      });
    });

    it('should fail if instance errors exist', function(done) {
      var instance = this.ErrorModel.create({foo: 'bar'});
      instance.save(function(err) {
        err.should.eq('message');
        done();
      });
    });

    it('should validate attributes', function(done) {
      var instance = this.ValidationModel.create({bar: 'abc', baz: 'abc'});
      instance.save(function(err) {
        err.should.deep.eq({
          bar: 'attribute "bar" must have a maximum of 2 characters',
          baz: 'attribute "baz" must have a minimum of 4 characters'
        });
        done();
      });
    });

    it('should callback immediately if no attributes were changed', function() {
      _save.should.not.have.beenCalled;
    });

    it('should fail with serialization errors if they exist', function() {
      return instance.save();
    });
  });
});
