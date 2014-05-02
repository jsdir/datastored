var chai = require('chai');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');

var orm = require('../../index');

var expect = chai.expect;
chai.should();
chai.use(sinonChai);

describe('ORM', function() {

  describe('#use()', function() {

    it('should fail when using a nonexistent model', function() {
      expect(function() {
        orm.use('NonexistentModel');
      }).to.throw('model "NonexistentModel" has not been defined');
    });
  });

  describe('model', function() {

    before(function() {
      orm.model('BasicModel', {
        attributes: {
          primary_key: {
            primary: true,
            type: 'string'
          },
          foo: {type: 'string'},
          bar: {type: 'string'}
        }
      });

      this.BasicModel = orm.use('BasicModel');
    });

    describe('constructor', function() {

      before(function() {
        this.set = sinon.spy(this.BasicModel.prototype, 'set');
      });

      afterEach(function() {
        this.set.reset();
      });

      after(function() {
        this.set.restore();
      });

      it('should construct with a primary key', function() {
        new this.BasicModel('value', false);
        this.set.should.have.been.calledWith('primary_key', 'value', false);
        this.set.reset();

        new this.BasicModel('value');
        this.set.should.have.been.calledWith('primary_key', 'value');
      });

      it('should construct with attributes', function() {
        new this.BasicModel({foo: 'bar'}, false);
        this.set.should.have.been.calledWith({foo: 'bar'}, false);
        this.set.reset();

        new this.BasicModel({foo: 'bar'});
        this.set.should.have.been.calledWith({foo: 'bar'});
      });
    });

    // TODO: save should set isNew to false;

    describe('#set()', function() {

      /**
       * Most of the tests for #set() test for the correct application of the
       * input transform chain. Most of these test also test the basic
       * functionality of #get() and its handling of the output transform
       * chain as well.
       */

      before(function() {
        this.transform = sinon.stub(this.BasicModel.prototype, 'transform');
      });

      beforeEach(function() {
        this.model = new this.BasicModel('primary_key');
      });

      afterEach(function() {
        this.transform.reset();
      });

      after(function() {
        this.transform.restore();
      });

      it('should set attributes', function() {
        expect(this.model.get('foo', false)).to.be.undefined;
        expect(this.model.get('bar', false)).to.be.undefined;

        this.transform.returns({
          foo: 'inputTransformed',
          bar: 'inputTransformed'
        });

        this.model.set('foo', 1);
        this.model.set('bar', 2, false);

        // Test for proper invocations of the input transform chain.
        this.transform.should.have.been.calledWith({'foo': 1}, 'input');

        this.transform.returns({
          foo: 'outputTransformed',
          bar: 'outputTransformed'
        });

        this.model.get('foo').should.equal('outputTransformed');
        this.model.get('bar').should.equal('outputTransformed');

        this.model.get('foo', false).should.equal('inputTransformed');
        this.model.get('bar', false).should.equal(2);
      });

      it('should set multiple attributes', function() {
        // Test input with transforms.
        this.transform.returns({
          foo: 'inputTransformed',
          bar: 'inputTransformed'
        });
        this.model.set({foo: 'foo', bar: 'bar'})
        this.model.get(['foo', 'bar'], false).should.deep.equal({
          foo: 'inputTransformed', bar: 'inputTransformed'
        });
        this.transform.returns({
          foo: 'outputTransformed',
          bar: 'outputTransformed'
        });
        this.model.get(['foo', 'bar']).should.deep.equal({
          foo: 'outputTransformed', bar: 'outputTransformed'
        });

        // Test input without transforms.
        this.model.set({foo: 'foo2', bar: 'bar2'}, false);
        this.model.get(['foo', 'bar']).should.deep.equal({
          foo: 'outputTransformed', bar: 'outputTransformed'
        });
        this.model.get(['foo', 'bar'], false).should.deep.equal({
          foo: 'foo2', bar: 'bar2'
        });
      });
    });

    describe('#tranform()', function() {

      before(function() {
        orm.model('TransformModel', {
          transforms: [{
            input: function(attributes, model) {
              attributes.foo += '1';
              return attributes;
            },
            output: function(attributes, model) {
              attributes.foo += '1';
              return attributes;
            },
            fetch: function(attributes, model) {
              attributes.foo += '1';
              return attributes;
            },
            save: function(attributes, model, cb) {
              attributes.foo += '1';
              cb(null, attributes);
            }
          }, {
            input: function(attributes, model) {
              attributes.foo += '2';
              return attributes;
            },
            output: function(attributes, model) {
              attributes.foo += '2';
              return attributes;
            },
            fetch: function(attributes, model) {
              attributes.foo += '2';
              return attributes;
            },
            save: function(attributes, model, cb) {
              attributes.foo += '2';
              cb(null, attributes);
            }
          }]
        });

        this.TransformModel = orm.use('TransformModel');
      });

      beforeEach(function() {
        this.model = new this.TransformModel();
      });

      it('should transform with chains in the right order', function(done) {
        this.model.transform({foo: '0'}, 'input').foo.should.equal('012');
        this.model.transform({foo: '0'}, 'fetch').foo.should.equal('012');
        this.model.transform({foo: '0'}, 'output').foo.should.equal('021');
        this.model.transform({foo: '0'}, 'save', function(attributes) {
          attributes.foo.should.equal('021');
          done();
        });
      });
    });

    describe('#find()', function() {
    });
  });
});
