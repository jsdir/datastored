var chai = require('chai');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');

var Orm = require('..');

var expect = chai.expect;
chai.should();
chai.use(sinonChai);

describe('ORM', function() {

  var redis = {
    insert: function() {},
    update: function() {}
  };

  var cassandra = {
    insert: function() {},
    update: function() {}
  };

  var orm = new Orm({
    redis: redis,
    cassandra: cassandra,
    redisKeyspace: 'keyspace',
    generateId: function(cb) {cb(null, 'generated_id');}
  });

  before(function() {
    this.BasicModel = orm.model('BasicModel', {
      attributes: {
        primary_key: {
          primary: true,
          type: 'string'
        },
        foo: {type: 'string'},
        bar: {type: 'string'}
      }
    });
  });

  describe('#model()', function() {

    function modelWithAttributes(attributes, message) {
      expect(function() {
        orm.model('InvalidModel', {attributes: attributes});
      }).to.throw(message);
    }

    it('should fail when a model is defined without a primary key',
      function() {
      modelWithAttributes({
        random: {type: 'string'}
      }, 'a primary key attribute is required');
    });

    it('should fail when a model is defined with a primary key with ' +
        'cache set to false', function() {
      modelWithAttributes({
        id: {
          primary: true,
          cache: false,
          type: 'string'
        }
      }, 'the primary key "id" must be cached');
    });

    it('should fail when a model is defined with more than one primary ' +
        'key', function() {
      modelWithAttributes({
        id: {
          primary: true,
          type: 'string'
        },
        random: {
          primary: true,
          type: 'string'
        }
      }, 'there must only be one primary key attribute');
    });

    it('should fail when a model is defined with an attribute with no type',
      function() {
      modelWithAttributes({
        random: {primary: true}
      }, 'attribute "random" must have a type');
    });
  });

  describe('#use()', function() {

    it('should fail when using a nonexistent model', function() {
      expect(function() {
        orm.use('NonexistentModel');
      }).to.throw('model "NonexistentModel" has not been defined');
    });

    it('should return the correct model', function() {
      orm.use('BasicModel').should.deep.equal(this.BasicModel);
    });
  });

  describe('model', function() {

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
        var model = new this.BasicModel('value', false);
        this.set.should.have.been.calledWith('primary_key', 'value', false);
        model.options.pkAttribute.should.equal('primary_key');
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
        var model = this.model;

        expect(model.get('foo', false)).to.be.undefined;
        expect(model.get('bar', false)).to.be.undefined;

        this.transform.returns({
          foo: 'inputTransformed',
          bar: 'inputTransformed'
        });

        model.set('foo', 1);
        model.set('bar', 2, false);

        // Test for proper invocations of the input transform chain.
        this.transform.should.have.been.calledWith({'foo': 1}, 'input');

        this.transform.returns({
          foo: 'outputTransformed',
          bar: 'outputTransformed'
        });

        model.get('foo').should.equal('outputTransformed');
        model.get('bar').should.equal('outputTransformed');

        model.get('foo', false).should.equal('inputTransformed');
        model.get('bar', false).should.equal(2);

        model.changedAttributes.should.include.members(['foo', 'bar']);
      });

      it('should set multiple attributes', function() {
        var model = this.model;

        // Test input with transforms.
        this.transform.returns({
          foo: 'inputTransformed',
          bar: 'inputTransformed'
        });
        model.set({foo: 'foo', bar: 'bar'})
        model.get(['foo', 'bar'], false).should.deep.equal({
          foo: 'inputTransformed', bar: 'inputTransformed'
        });
        this.transform.returns({
          foo: 'outputTransformed',
          bar: 'outputTransformed'
        });
        model.get(['foo', 'bar']).should.deep.equal({
          foo: 'outputTransformed', bar: 'outputTransformed'
        });

        // Test input without transforms.
        model.set({foo: 'foo2', bar: 'bar2'}, false);
        model.get(['foo', 'bar']).should.deep.equal({
          foo: 'outputTransformed', bar: 'outputTransformed'
        });
        model.get(['foo', 'bar'], false).should.deep.equal({
          foo: 'foo2', bar: 'bar2'
        });

        model.changedAttributes.should.include.members(['foo', 'bar']);
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
        this.model.transform({foo: '0'}, 'save', function(err, attributes) {
          attributes.foo.should.equal('021');
          done();
        });
      });
    });

    describe('#save()', function() {

      before(function() {
        this.stubs = {
          redis: {
            insert: sinon.stub(redis, 'insert', function(data, cb) {cb();}),
            update: sinon.stub(redis, 'update', function(data, cb) {cb();})
          },
          cassandra: {
            insert: sinon.stub(cassandra, 'insert', function(data, cb) {
              cb();
            }),
            update: sinon.stub(cassandra, 'update', function(data, cb) {
              cb();
            })
          }
        };
      });

      beforeEach(function() {
        this.model = new this.BasicModel();
      });

      afterEach(function() {
        this.stubs.redis.insert.reset();
        this.stubs.redis.update.reset();
        this.stubs.cassandra.insert.reset();
        this.stubs.cassandra.update.reset();
      });

      after(function() {
        this.stubs.redis.insert.restore();
        this.stubs.redis.update.restore();
        this.stubs.cassandra.insert.restore();
        this.stubs.cassandra.update.restore();
      });

      it('should not fail when no attributes have changed', function(done) {
        this.model.save(function(err) {
          expect(err).to.be.undefined;
          done();
        });
      });

      it('should reset changed attributes when done', function(done) {
        var model = this.model;
        model.set('foo', 'bar');

        model.save(function(err) {
          expect(err).to.be.undefined;
          model.changedAttributes.should.be.empty;
          done();
        });
      });

      it('should insert into datastores correctly', function(done) {
        var model = this.model;
        var cassandraInsert = this.stubs.cassandra.insert;
        var redisInsert = this.stubs.redis.insert;

        model.set('foo', 'bar');
        model.isNew.should.be.true;

        var transform = sinon.stub(model, 'transform',
          function(attributes, chain, cb) {
            cb(null, {foo: 'transformed_bar'});
          }
        );

        model.save(function(err) {
          transform.should.have.been.calledWith({
            foo: 'bar'
          }, 'save', sinon.match.func);

          cassandraInsert.should.have.been.calledWith({
            foo: 'transformed_bar', primary_key: 'generated_id'
          }, sinon.match.func);
          redisInsert.should.have.been.calledWith({
            foo: 'transformed_bar', primary_key: 'generated_id'
          }, sinon.match.func);

          cassandraInsert.should.have.been.calledBefore(redisInsert);

          expect(err).to.be.undefined;
          model.isNew.should.be.false;
          done();
        });
      });

      it('should update datastores correctly', function(done) {
        var model = new this.BasicModel('id');
        var cassandraUpdate = this.stubs.cassandra.update;
        var redisUpdate = this.stubs.redis.update;

        model.set('foo', 'bar');
        model.isNew.should.be.false;

        var transform = sinon.stub(model, 'transform',
          function(attributes, chain, cb) {
            cb(null, {foo: 'transformed_bar', primary_key: 'id'});
          }
        );

        model.save(function(err) {
          transform.should.have.been.calledWith({
            foo: 'bar', primary_key: 'id'
          }, 'save', sinon.match.func);

          cassandraUpdate.should.have.been.calledWith({
            foo: 'transformed_bar', primary_key: 'id'
          }, sinon.match.func);
          redisUpdate.should.have.been.calledWith({
            foo: 'transformed_bar', primary_key: 'id'
          }, sinon.match.func);

          cassandraUpdate.should.have.been.calledBefore(redisUpdate);

          expect(err).to.be.undefined;
          model.isNew.should.be.false;
          done();
        });
      });

      it('should use the async save transform chain', function() {

      });
    });

    xdescribe('#fetch()', function() {

      before(function() {
        var CachedModel = Orm.model('CachedModel', {
          attributes: {

          }
        });
        // stub transform.fetch to return "fetchTransformed"
      });

      // test failover for fetch and save.

      // Global assertions: all returned attributes should use the fetch transform chain.
      it('should fetch from redis first if all the attributes are cached', function() {

      });

      it('should fetch from cassandra if any of the attributes are not cached', function() {

      });

      it('should fetch from cassandra if fetching from redis fails', function() {
        // if successful, make sure that redis is repopulated *after* the result is returned.
      });

      it('should fail when fetching from cassandra fails', function() {

      });
    });

    xdescribe('#show()', function() {

      before(function() {
        var ScopeModel = orm.model('ScopeModel', {
          scopes: {
            'fooScope': ['foo'],
            'allScope': ['foo', 'bar']
          }
        });
        this.model = new ScopeModel({foo: 'foo', bar: 'bar'});
      });

      it('should use the given scope', function() {
        this.model.show('fooScope').should.deep.equal({foo: 'foo'});
        this.model.show('allScope').should.deep.equal({
          foo: 'foo', bar: 'bar'
        });
      });
    });
  });
});
