var chai = require('chai');

var transforms = require('../lib/transforms');

var expect = chai.expect;
chai.should();

describe('transforms', function() {

  describe('validate', function() {
    var model = {options: {attributes: {
      foo: {rules: {required: true}},
      bar: {rules: {min: 3}}
    }}};

    it('should validate attributes', function(done) {
      transforms.validate.save({
        foo: 'baz',
        bar: 'abcd'
      }, model, function(err) {
        expect(err).to.be.undefined;
        done();
      });
    });

    it('should fail with messages', function(done) {
      transforms.validate.save({
        foo: null,
        bar: 'ab'
      }, model, function(err) {
        err.should.have.property('foo').that.is.a('string');
        err.should.have.property('bar').that.is.a('string');
        done();
      });
    });
  });

  /*describe('marshal', function() {
    it('should marshal input with the given marshaller', function() {

    });

    it('should marshal output with the given marshaller', function() {

    });
  });*/

  describe('hide', function() {
    it('should hide the given attributes', function() {
      transforms.hide(['hide1', 'hide2'])
        .output({hide1: 'foo', show: 'bar'})
        .should.deep.equal({show: 'bar'});
    });
  });

  describe('lowercase', function() {
    it('should make the given attributes lowercase', function() {
      transforms.lowercase('lower')
        .input({lower: 'TEXT', upper: 'TEXT'})
        .should.deep.equal({lower: 'text', upper: 'TEXT'});
    });
  });

  describe('alias', function() {
    it('should change attribute values according to the aliases', function() {
      transforms.alias('attr', {'foo': 'foo1', 'bar': 'bar1'})
        .input({'attr': 'bar'}).should.deep.equal({'attr': 'bar1'});
    });
  });
});
