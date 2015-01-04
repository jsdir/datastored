/*
describe('RedisSet', function() {

  before(function() {
    testUtils.createTestEnv(this);
  });

  testAssociation(datastored.RedisSet);

  it('should add children', function() {
    // test single add, and multiple add
    // check that all have been added
    // validate with `has`
  });

  it('should remove children', function() {
    // remove by key
    // validate with `has`
  });

  it('should check membership', function() {
    var parent = this.parent;
    var basicInstance = this.basicInstance;
    return parent
      .get('children', {has: basicInstance})
      .then(function(exists) {
        exists.should.be.false;
        return parent.save({children: {push: basicInstance}});
      })
      .then(function(parent) {
        return parent.get('children', {has: basicInstance});
      })
      .then(function(exists) {
        exists.should.be.true;
      });
  });
});
 */