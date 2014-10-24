var datastored = require('../..');
var chai = require('chai');
var sinon = require('sinon');
var expect = chai.expect;

var testUtils = require('../test_utils');

describe('Instance', function() {

  before(function() {
    testUtils.setupOrm.call(this);
    testUtils.setupTestModels.call(this);
  });

  it('should have "methods" from model options', function() {
    var instance = this.BasicModel.create();
    instance.func().should.deep.eq(instance);
  });

  describe('#get()', function() {

    it('should transform data by default', function() {
      var instance = this.BasicModel.create({foo: 'bar'}, true);
      instance.get('foo').should.eq('output(bar)');
    });

    it('should not transform data if requested', function() {
      var instance = this.BasicModel.create({foo: 'bar'}, true);
      instance.get('foo', true).should.eq('bar');
    });

    it('should extend transforms correctly', function() {
      var instance = this.TransformModel.create({foo: 'bar'}, true);
      instance.get('foo').should.eq('output0(output1(output2(bar)))');
    });

    it('should support getting multiple attributes', function() {
      var instance = this.BasicModel.create({foo: 'bar', bar: 'baz'}, true);
      var result = instance.get(['foo', 'bar'], true);
      result.should.deep.eq({foo: 'bar', bar: 'baz'});
    });

    it('should not return hidden attributes by default', function() {
      var instance = this.BasicModel.create({hidden: 'hidden'}, true);
      expect(instance.get('hidden')).to.be.undefined;
    });

    it('should return hidden attributes if requested', function() {
      var instance = this.BasicModel.create({hidden: 'hidden'}, true);
      instance.get('hidden', true).should.eq('hidden');
    });
  });

  describe('#set()', function() {

    it('should transform data by default', function() {
      var instance = this.BasicModel.create({foo: 'bar'});
      instance.get('foo', true).should.eq('input(bar)');
    });

    it('should not transform data if requested', function() {
      var instance = this.BasicModel.create({foo: 'bar'}, true);
      instance.get('foo', true).should.eq('bar');
    });

    it('should extend transforms correctly', function() {
      var instance = this.TransformModel.create({foo: 'bar'});
      instance.get('foo', true).should.eq('input0(input1(input2(bar)))');
    });

    it('should set a single attribute', function() {
      var instance = this.BasicModel.create();
      instance.set('foo', 'bar', true);
      instance.get('foo', true).should.eq('bar');
    });

    it('should only set defined attributes', function() {
      var instance = this.BasicModel.create();
      instance.set({foo: 'bar', foobar: 123}, true);
      expect(instance.get('foo', true)).to.eq('bar');
      expect(instance.get('foobar')).to.be.undefined;
    });

    it('should not change the id', function() {
      var instance = this.BasicModel.get('idValue', true);
      instance.set({id: 'foo'});
      instance.getId(true).should.eq('idValue');
    });

    it('should not change guarded attributes', function() {
      var instance = this.BasicModel.create({guarded: 'foo'}, true);
      instance.set({guarded: 'bar'});
      instance.get('guarded', true).should.eq('foo');
    });

    it('should change guarded attributes if requested', function() {
      var instance = this.BasicModel.create({guarded: 'foo'}, true);
      instance.set({guarded: 'bar'}, true);
      instance.get('guarded', true).should.eq('bar');
    });
  });

  describe('#save()', function() {

    before(function() {
      this.RequiredModel = this.createModel({
        attributes: {
          required: datastored.String({
            required: true, hashStores: [true]
          })
        }
      });

      this.ValidationModel = this.createModel({
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

      this.ErrorModel = this.createModel({
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

    it('should validate required attributes', function(done) {
      var instance = this.RequiredModel.create({foo: 'bar'});
      instance.save(function(err) {
        err.should.deep.eq({required: 'attribute "required" is not defined'});
        done();
      });
    });

    it('should callback immediately if no attributes were changed', function() {
      var spy = sinon.spy();
      var instance = this.BasicModel.get('foo');
      instance.save(function(err) {
        if (err) {throw err;}
        spy();
      });
      spy.should.have.been.called;
    });
  });

  describe('#toObject()', function() {

    it('should return data in the correct scope', function() {
      var instance = this.BasicModel.get('foo', true);
      instance.set({foo: 'foo', bar: 'bar'}, true);

      instance.toObject('foo').should.deep.eq({foo: 'output(foo)'});
      instance.toObject(['bar']).should.deep.eq({bar: 'output(bar)'});
    });
  });

  describe('#getId()', function() {

    it('should transform the result by default', function() {
      var instance = this.BasicModel.get('foo', true);
      instance.getId().should.eq('output(foo)');
    });

    it('should not transform the result if requested', function() {
      var instance = this.BasicModel.get('foo', true);
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
