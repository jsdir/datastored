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
    this.transforms = testUtils.stubTransforms(this.models.BasicUnitModel);
  });

  afterEach(function() {
    this.transforms.restore();
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
      return this.Model.create({text: 'a'})
        .then(function(instance) {
          instance.get('text').should.eq('output(input(a))');
          output.lastCall.thisValue.should.eq(instance);
          output.should.have.been.calledWithExactly({
            text: 'input(a)'
          }, {text: null}, sinon.match.falsy);
        });
    });

    it('should get multiple attributes', function() {
      var output = this.transforms.output;
      return this.Model.create({text: 'a', text2: 'b'})
        .then(function(instance) {
          instance.get(['text', 'text2']).should.deep.eq({
            text: 'output(input(a))', text2: 'output(input(b))'
          });
          output.lastCall.thisValue.should.eq(instance);
          output.should.have.been.calledWithExactly({
            text: 'input(a)', text2: 'input(b)'
          }, {text: undefined, text2: undefined}, sinon.match.falsy);
        });
    });

    it('should get multiple attributes with options', function() {
      var output = this.transforms.output;
      return this.Model.create({text: 'a', text2: 'b'})
        .then(function(instance) {
          instance.get({text: 1, text2: 2}).should.deep.eq({
            text: 'output(input(a))', text2: 'output(input(b))'
          });
          output.lastCall.thisValue.should.eq(instance);
          output.should.have.been.calledWithExactly({
            text: 'input(a)', text2: 'input(b)'
          }, {text: 1, text2: 2}, sinon.match.falsy);
        });
    });

    it('should apply user transforms if requested', function() {
      var output = this.transforms.output;
      return this.Model.create({text: 'a'})
        .then(function(instance) {
          instance.get('text', true).should.eq('output(input(a))');
          output.lastCall.thisValue.should.eq(instance);
          output.should.have.been.calledWithExactly({
            text: 'input(a)'
          }, {text: null}, true);
        });
    });
  });

  describe('#getId()', function() {

    beforeEach(function() {
      this.instance = this.Model.withId('value');
    });

    it('should return the instance id', function() {
      this.instance.getId().should.eq('output(input(value))');
      this.transforms.output.lastCall.thisValue.should.eq(this.instance);
      this.transforms.output.should.have.been.calledWithExactly({
        id: 'input(value)'
      }, null, sinon.match.falsy);
    });

    it('should apply user transforms if requested', function() {
      this.instance.getId(true).should.eq('output(input(value))');
      this.transforms.output.lastCall.thisValue.should.eq(this.instance);
      this.transforms.output.should.have.been.calledWithExactly({
        id: 'input(value)'
      }, null, true);
    });
  });

  describe('#fetch()', function() {

    it('should only fetch requested attributes', function() {
      var Model = this.Model;
      var transforms = this.transforms;
      return Model.create({text: 'a', text2: 'b'}).then(function(instance) {
        var newInstance = transforms.disabled(function() {
          return Model.withId(instance.id);
        });
        return newInstance.fetch(['text']);
      }).then(function(instance) {
        instance.get('text').should.eq('output(fetch(save(input(a))))');
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

  describe('#save()', function() {

    it('should save values', function() {
      var attributes = ['text', 'required'];
      return this.models.RequiredModel.create({
        text: 'a', required: 'b'
      })
        // Make sure required errors are not thrown when `required` is not
        // saved.
        .then(function(instance) {return instance.save({text: 'c'});})
        // Test that the saved attributes were persisted.
        .then(testUtils.reloadInstance(attributes))
        .then(function(instance) {
          instance.get(attributes).should.deep.eq({text: 'c', required: 'b'});
        });
    });
  });
});
