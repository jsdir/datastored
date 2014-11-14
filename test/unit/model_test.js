var _ = require('lodash');
var chai = require('chai');

var datastored = require('../..')
var testUtils = require('../test_utils');

chai.should();
var expect = chai.expect;

describe('Model', function() {

  before(function() {
    testUtils.createTestEnv(this);
    this.Model = this.models.BasicUnitModel;
    this.modelOptions = this.options.BasicUnitModel;
  });

  describe('options', function() {

    it('should require attributes', function() {
      var options = _.omit(this.modelOptions, 'attributes');
      this.assertCreateFails(options, '"attributes" is not defined');
    });

    it('should require an id attribute', function() {
      var options = _.omit(this.modelOptions, 'id');
      this.assertCreateFails(options, '"id" is not defined');
    });

    it('should require a keyspace', function() {
      var options = _.omit(this.modelOptions, 'keyspace');
      this.assertCreateFails(options, '"keyspace" is not defined');
    });

    it('should assign "statics"', function() {
      this.Model.property.should.eq('text');
      this.Model.func().should.deep.eq(this.Model);
    });
  });

  describe.only('#build()', function() {

    it('should build an instance', function() {
      var instance = this.Model.build({guarded: 'a', text: 'b'});
      instance.isNew().should.be.true;
      instance.get('guarded').should.eq('a');
      instance.get('text').should.eq('b');
    });

    it('should transform data if in user mode', function() {
      var instance = this.Model.userMode().build({
        guarded: 'a', text: 'b'
      }).userMode(false);
      expect(instance.get('guarded')).to.be.undefined
      instance.get('text').should.eq('unser(input(b))');
    });
  });

  describe('#withId()', function() {

    it('should return a model with the given id', function() {
      this.Model.withId('a').getId().should.eq('a');
    });

    it('should transform the id value if in user mode', function() {
      var instance = this.Model.userMode().withId('a');
      instance.userMode(false).getId().should.eq('unser(input(a))');
    });

    it('should correctly set instance status', function() {
      this.Model.withId('a').isNew().should.be.false;
    });
  });

  describe('#find()', function() {

    it('should ensure that the query attribute is indexed', function() {
      var Model = this.Model;

      // Test undefined attribute.
      (function() {
        Model.find('undefined', 'a');
      }).should.throw('"undefined" is not defined');

      // Test attribute that is not an index.
      (function() {
        Model.find('text', 'a');
      }).should.throw('attribute "text" is not an index');
    });
  });
});
