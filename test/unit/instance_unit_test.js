var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');

var datastored = require('../..');
var Instance = require('../../lib/instance');
var testUtils = require('../test_utils');

chai.should();
chai.use(sinonChai);
var expect = chai.expect;

describe('Instance (unit)', function() {

  before(function() {
    testUtils.setupOrm.call(this);
    testUtils.setupTestModels.call(this);
  });

  it('should get "methods" from model options', function() {
    var instance = this.MethodModel.create({});
    instance.foo().should.deep.equal(instance);
  });

  describe('#get()', function() {

    before(function() {
      this.HiddenModel = this.createModel({properties: {
        password: {type: 'string', hidden: true}
      }});
    });

    it('should mutate attributes by default', function() {
      var instance = this.CallbackModel.create({foo: 'bar'}, true);
      var value = 'bar,beforeOutput,beforeOutput,afterOutput,afterOutput';
      instance.get('foo').should.deep.eq(value);
    });

    it('should not mutate attributes if requested', function() {
      var instance = this.CallbackModel.create({foo: 'bar'}, true);
      instance.get('foo', true).should.eq('bar');
    });

    it('should support getting multiple values', function() {
      var instance = this.BasicModel.create({foo: 'foo', bar: 'bar'}, true);
      instance.get(['foo', 'bar']).should.deep.eq({foo: 'foo', bar: 'bar'});
    });

    it('should not return hidden attributes by default', function() {
      var instance = this.HiddenModel.create({password: 'secret'}, true);
      expect(instance.get('password')).to.be.undefined;
    });

    it('should return hidden attributes if requested', function() {
      var instance = this.HiddenModel.create({password: 'secret'}, true);
      instance.get('password', true).should.eq('secret');
    });
  });

  describe('#set()', function() {

    before(function() {
      this.ImmutableModel = this.createModel({
        properties: {foo: {type: 'string', immutable: true}}
      });
    });

    it('should mutate attributes by default', function() {
      var instance = this.CallbackModel.create();
      instance.set({foo: 'bar'});
      var value = 'bar,beforeInput,beforeInput,afterInput,afterInput';
      instance.get('foo', true).should.eq(value);
    });

    it('should not mutate attributes if requested', function() {
      var instance = this.CallbackModel.create();
      instance.set({foo: 'bar'}, true);
      instance.get('foo', true).should.eq('bar');
    });

    it('should set a single attribute', function() {
      var instance = this.CallbackModel.create();
      instance.set('foo', 'bar', true);
      instance.get('foo', true).should.eq('bar');
    });

    it('should only set defined values', function() {
      var instance = this.BasicModel.create();
      instance.set({foo: 'bar', baz: 123}, true);
      expect(instance.get('foo')).to.eq('bar');
      expect(instance.get('baz')).to.be.undefined;
    });

    it('should store errors on callback error', function() {
      var instance = this.ErrorModel.create();
      instance.set({foo: 'bar'});
      instance.errors.should.deep.eq({'foo': 'message'});
    });

    it('should not change immutable attributes by default', function() {
      var instance = this.ImmutableModel.create({foo: 'bar'}, true);
      instance.set({foo: 'baz'});
      instance.get('foo').should.eq('bar');
    });

    it('should change immutable attributes if requested', function() {
      var instance = this.ImmutableModel.create({foo: 'bar'}, true);
      instance.set({foo: 'baz'}, true);
      instance.get('foo').should.eq('baz');
    });

    it('should not set the primary key property', function() {
      var instance = this.BasicModel.create();
      instance.set('id', 'foo', true);
      instance.get('id', true).should.eq('foo');

      var rawInstance = this.BasicModel.get('foo', true);
      rawInstance.set('id', 'bar', true);
      rawInstance.get('id', true).should.eq('foo');
    });
  });

  describe('#save()', function() {

    it('should fail if instance errors exist', function(done) {
      var instance = this.ErrorModel.create({foo: 'foo'});
      instance.save(function(err) {
        err.should.deep.eq({foo: 'message'});
        done();
      });
    });

    it('should call back if no attributes were changed', function() {
      var spy = sinon.spy();
      var instance = this.BasicModel.get('foo');
      instance.save(function(err) {
        if (err) {throw err;}
        spy();
      });
      spy.should.have.been.called;
    });
  });

  describe('#incr()', function() {

    it('should only increment counter properties', function() {
      var instance = this.BasicModel.create();
      (function() {instance.incr('foo', 1);})
        .should.throw('only counters can be incremented');
    });
  });

  describe('#decr()', function() {

    it('should only decrement counter properties', function() {
      var instance = this.BasicModel.create();
      (function() {instance.decr('foo', 1);})
        .should.throw('only counters can be decremented');
    });
  });

  describe('#toObject()', function() {

    it('should return data in the correct scope', function() {
      var instance = this.CallbackModel.get('foo', true);
      instance.set({foo: 'foo', bar: 'bar'}, true);

      instance.toObject('foo').should.deep.eq({
        id: 'foo,beforeOutput,beforeOutput,afterOutput,afterOutput',
        foo: 'foo,beforeOutput,beforeOutput,afterOutput,afterOutput'
      });

      instance.toObject(['bar']).should.deep.eq({
        id: 'foo,beforeOutput,beforeOutput,afterOutput,afterOutput',
        bar: 'bar,beforeOutput,beforeOutput,afterOutput,afterOutput'
      });

      instance.toObject('foo', true).should.deep.eq({
        id: 'foo', foo: 'foo'
      });

      instance.toObject(['bar'], true).should.deep.eq({
        id: 'foo', bar: 'bar'
      });
    });
  });

  describe('#getId()', function() {

    it('should mutate the result by default', function() {
      var instance = this.CallbackModel.get('foo', true);
      var value = 'foo,beforeOutput,beforeOutput,afterOutput,afterOutput';
      instance.getId().should.eq(value);
    });

    it('should not mutate the result if requested', function() {
      var instance = this.CallbackModel.get('foo', true);
      instance.getId(true).should.eq('foo');
    });
  });

  describe('#isChanged()', function() {

    it('should return changed attributes', function() {
      var instance = this.BasicModel.create();
      instance.isChanged().should.be.false;
      instance.set('foo', 'bar');
      instance.isChanged().should.be.true;
    });
  });
});
