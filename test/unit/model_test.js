var chai = require('chai');

var datastored = require('../..');

chai.should();

describe('Model', function() {

  beforeEach(function() {
    // Stub the datastores.
    this.orm = datastored.createOrm({
      redisClient: true,
      cassandraClient: true
    });
  });

  it('should set `methods` and `staticMethods`', function() {
    var Model = this.orm.createModel('Model', {
      methods: {
        getInstanceThis: function() {
          return this;
        }
      },
      staticMethods: {
        getStaticThis: function() {
          return this;
        }
      }
    });

    // Test static methods.
    Model.getStaticThis().should.deep.equal(Model);

    // Test instance methods.
    var model = Model.create({});
    model.getInstanceThis().should.deep.equal(model);
  });
});
