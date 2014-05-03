var chai = require('chai');

var transforms = require('../lib/transforms');

var expect = chai.expect;

describe('validate transform', function() {

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
