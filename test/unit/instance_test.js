var chai = require('chai');
var sinon = require('sinon');
var chaiAsPromised = require('chai-as-promised');

var datastored = require('../..');
var testUtils = require('../test_utils');

var expect = chai.expect;
chai.use(chaiAsPromised);

describe('Instance', function() {

  before(function() {
    this.env = testUtils.createTestEnv();
  });

  beforeEach(function(done) {
    testUtils.resetTransforms(this.env.basicModelLogMixin);
    this.env.hashStore.reset(done);
  });

  describe('model options', function() {

    it('should assign "methods"', function() {
      return this.env.BasicModel.create().then(function(instance) {
        instance.methodFunc().should.deep.eq(instance);
      });
    });
  });

  describe('#get()', function() {

    it('should get a single attribute', function() {
      var transforms = this.env.basicModelLogMixin;
      return this.env.BasicModelLog.create({text: 'a'})
        .then(function(instance) {
          instance.get('text').should.eq('m.output(m.input(a))');
          transforms.output.lastCall.thisValue.should.eq(instance);
          transforms.output.should.have.been.calledWithExactly(
            {text: 'm.input(a)'}, {attributes: {text: true}});
        });
    });

    it('should get multiple attributes', function() {
      var transforms = this.env.basicModelLogMixin;
      return this.env.BasicModelLog.create({text: 'a', text2: 'b'})
        .then(function(instance) {
          instance.get(['text', 'text2'], {ids: false}).should.deep.eq({
            text: 'm.output(m.input(a))', text2: 'm.output(m.input(b))'
          });
          transforms.output.lastCall.thisValue.should.eq(instance);
          transforms.output.should.have.been.calledWithExactly({
            text: 'm.input(a)', text2: 'm.input(b)'
          }, {attributes: {text: true, text2: true}, ids: false});
        });
    });
  });

  describe('#getId()', function() {

    before(function() {
      this.instance = this.env.BasicModelLog.withId('value');
      this.transforms = this.env.basicModelLogMixin;
    });

    it('should return the instance id', function() {
      this.instance.getId().should.eq('m.output(m.input(value))');
      this.transforms.output.lastCall.thisValue.should.eq(this.instance);
      this.transforms.output.should.have.been
        .calledWithExactly({id: 'm.input(value)'}, {});
    });

    it('should apply user transforms if requested', function() {
      this.instance.getId({user: true}).should.eq('m.output(m.input(value))');
      this.transforms.output.lastCall.thisValue.should.eq(this.instance);
      this.transforms.output.should.have.been
        .calledWithExactly({id: 'm.input(value)'}, {user: true});
    });
  });

  describe('#fetch()', function() {

    beforeEach(function() {
      var self = this;
      return this.env.BasicModelLog.create({
        text: 'a', text2: 'a'
      }).then(function(instance) {
        self.loadedInstance = instance;
        self.instance = testUtils.cloneInstance(instance);
      })
    });

    it('should fetch a single attribute', function() {
      return this.instance.fetch('text')
        .then(function(value) {
          value.should.eq('m.output(m.fetch(m.save(m.input(a))))');
        });
    });

    it('should fetch multiple attributes', function() {
      var transforms = this.env.basicModelLogMixin;
      var instance = this.instance;
      return instance.fetch(['text', 'text2'], {ids: false})
        .then(function(data) {
          data.should.deep.eq({
            text: 'm.output(m.fetch(m.save(m.input(a))))',
            text2: 'm.output(m.fetch(m.save(m.input(a))))'
          });

          transforms.fetch.lastCall.thisValue.should.eq(instance);
          transforms.fetch.should.have.been.calledWithExactly({
            text: 'm.save(m.input(a))', text2: 'm.save(m.input(a))'
          }, {
            attributes: {text: true, text2: true},
            output: true, reload: false, ids: false
          }, sinon.match.func);

          transforms.output.lastCall.thisValue.should.eq(instance);
          transforms.output.should.have.been.calledWithExactly({
            text: 'm.fetch(m.save(m.input(a)))',
            text2: 'm.fetch(m.save(m.input(a)))'
          }, {
            attributes: {text: true, text2: true},
            output: true, reload: false, ids: false
          });
        });
    });

    it('should fetch multiple attributes with options', function() {
      var transforms = this.env.basicModelLogMixin;
      var instance = this.instance;
      return instance.fetch({text: 1, text2: 2}, {ids: false})
        .then(function(data) {
          data.should.deep.eq({
            text: 'm.output(m.fetch(m.save(m.input(a))))',
            text2: 'm.output(m.fetch(m.save(m.input(a))))'
          });

          transforms.fetch.lastCall.thisValue.should.eq(instance);
          transforms.fetch.should.have.been.calledWithExactly({
            text: 'm.save(m.input(a))', text2: 'm.save(m.input(a))'
          }, {
            attributes: {text: 1, text2: 2},
            output: true, reload: false, ids: false
          }, sinon.match.func);

          transforms.output.lastCall.thisValue.should.eq(instance);
          transforms.output.should.have.been.calledWithExactly({
            text: 'm.fetch(m.save(m.input(a)))',
            text2: 'm.fetch(m.save(m.input(a)))'
          }, {
            attributes: {text: 1, text2: 2},
            output: true, reload: false, ids: false
          });
        });
    });

    it('should not output attributes if requested', function() {
      var transforms = this.env.basicModelLogMixin;
      var instance = this.instance;
      return instance.fetch('text', {output: false})
        .then(function(data) {
          expect(data).to.be.undefined;
          transforms.output.should.not.have.been.called;
          instance.get('text')
            .should.eq('m.output(m.fetch(m.save(m.input(a))))');
        });
    });

    it('should not reload attributes by default', function() {
      var instance = this.loadedInstance;
      return this.instance
        .save({text: 'b'})
        .then(function() {
          return instance.fetch(['text', 'text2'], {ids: false});
        })
        .then(function(data) {
          data.should.deep.eq({
            text: 'm.output(m.input(a))', text2: 'm.output(m.input(a))'
          });
        });
    });

    it('should reload attributes if requested', function() {
      var instance = this.loadedInstance;
      return this.instance
        .save({text: 'b'})
        .then(function() {
          return instance.fetch(['text', 'text2'], {reload: true, ids: false});
        })
        .then(function(data) {
          data.should.deep.eq({
            text: 'm.output(m.fetch(m.save(m.input(b))))',
            text2: 'm.output(m.fetch(m.save(m.input(a))))'
          });
        });
    });

    it('should indicate if the data did not exist', function() {
      return this.env.BasicModelLog
        .withId('noexist')
        .fetch('text')
        .then(function(value) {
          expect(value).to.be.null;
        });
    });
  });

  describe('#save()', function() {

    beforeEach(function() {
      var self = this;
      return this.env.BasicModelLog.create({
        text: 'a', text2: 'a'
      }).then(function(instance) {
        self.instance = instance;
      })
    });

    it('should persist values', function() {
      var transforms = this.env.basicModelLogMixin;
      var instance = this.instance;
      return instance
        .save({text: '2'})
        .then(function(instance) {
          transforms.save.lastCall.thisValue.should.eq(instance);
          transforms.save.should.have.been.calledWithExactly(
            {text: 'm.input(2)'}, {}, sinon.match.func
          );
          return testUtils.cloneInstance(instance).fetch('text');
        })
        .then(function(value) {
          value.should.eq('m.output(m.fetch(m.save(m.input(2))))');
        });
    });

    it('should save values with options', function() {
      var transforms = this.env.basicModelLogMixin;
      var instance = this.instance;
      return instance
        .save({text: '2'}, {user: true})
        .then(function(instance) {
          transforms.save.lastCall.thisValue.should.eq(instance);
          transforms.save.should.have.been.calledWithExactly(
            {text: 'm.input(2)'}, {user: true}, sinon.match.func
          );
          return testUtils.cloneInstance(instance).fetch('text');
        })
        .then(function(value) {
          value.should.eq('m.output(m.fetch(m.save(m.input(2))))');
        });
    });
  });
});
