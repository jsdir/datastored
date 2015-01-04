/*
function testAssociation(Association) {

  before(function() {
    this.ParentModel = orm.createModel({
      children: Association()
    });
  });

  beforeEach(function() {
    var self = this;
    return this.ParentModel.create(function(instance) {
      self.parent = instance;
    });
  });

  it('should fetch empty lists', function() {
    return RSVP.all(
      this.parent.get('children').then(function(instances) {
        instances.should.be.empty;
      }),
      this.parent.get('children', true).then(function(instances) {
        instances.should.be.empty;
      })
    );
  });

  describe('adding children', function() {

    it('should check that the child is valid', function() {
      var parent = this.parent;
      (function() {parent.save({child: true});})
        .should.throw('HasOne associations can only be saved with an ' +
          'instance object or "null"');
    });

    it('should check that the child has the correct type', function() {
      var self = this;
      (function() {self.parent.save({child: self.basicInstance});})
        .should.throw('expected instance with type "ChildModel"');
    });

    it('should check that the child has the correct id type', function() {
      var self = this;
      (function() {self.parent.save({anyChild: self.basicInstance});})
        .should.throw('expected instance id type to be "string"');
    });
  });

  it('should update parent/child link', function() {
    // links are not required
    // parent.add child (association has link)
    // child.get(parent) should be parent
    // parent.remove(child)
    // child.get(parent) should be null
  });

  it('should allow multiple types to be added', function() {
    this.parent.save({
      children: {
        add: [this.basicModel, this.basicModel]
      }
    });
  });
}

describe('RedisList', function() {

  before(function() {
    testUtils.createTestEnv(this);
  });

  testAssociation(datastored.RedisList);

  it('should add children', function() {
    // test single add, and multiple add
    // check that all have been added
    // test by getting last item
  });

  it('should fetch ranges', function() {
    var attributes = {
      foo: true,
      children: {
        range: [10, 20]
      }
    };

    return RSVP.all(
      this.parent.get(attributes).then(function(results) {
        results.should.deep.eq({})
      }),
      this.parent.get(attributes, true).then(function(results) {
        results.should.deep.eq({
          foo: 'bar',
          children: [{

          }, {

          }]
        })
      })
    );
  });
});
*/

describe('RedisList', function() {

});
