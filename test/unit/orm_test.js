var _ = require('lodash');
var chai = require('chai');

var datastored = require('../..');

chai.should()

var options = {
  redisClient: true,
  cassandraClient: true
};

describe('datastored.createOrm()', function() {

  it('should fail when any required option is not defined', function() {
    (function() {
      datastored.createOrm(_.omit(options, ['redisClient']))
    }).should.throw('"redisClient" is not defined');

    (function() {
      datastored.createOrm(_.omit(options, ['cassandraClient']))
    }).should.throw('"cassandraClient" is not defined');
  });

  it('should use an incrementing id generator if `generateId` is not ' +
    'defined', function() {
    var orm = datastored.createOrm(options);

    orm.generateId().should.equal(1);
    orm.generateId().should.equal(2);
  })
});

describe('orm', function() {

  describe('#createModel()', function() {

    it('should fail if the model name has already been registered',
    function() {
      var orm = datastored.createOrm(options);
      var modelOptions = {
        column: 'models',
        properties: {
          id: {
            type: 'string',
            primary: true
          }
        }
      };
      var model = orm.createModel('Model', modelOptions);
      (function() {
        orm.createModel('Model', modelOptions);
      }).should.throw('model "Model" is already defined');
    });
  });
});
