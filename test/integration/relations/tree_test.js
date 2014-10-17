var datastored = require('../../..');
var shared = require('./shared');

xdescribe('Tree relation', function() {

  // Since `Tree` is basically shares the same functionality as `HasMany`,
  // test it the same way.
  shared.testHasMany(datastored.relations.Tree);
  shared.testRelatedModelRequired(datastored.relations.Tree);

  // Option Validation

  it('should require a "parentRelation" option', function() {
    assertOptionRequired
  });

  it('should require a "childrenRelation" option', function() {
    assertOptionRequired
  });

  it('should require a "link" option', function() {
    assertOptionRequired
  });

  describe('#fetch()', function() {

    it('should fetch leaves by default', function(done) {
      var children = this.root.get('children');
      this.root.get('children').fetch(['foo'], function(err) {
        if (err) {return done(err);}
      });
    });

    it('should not fetch leaves if requested', function(done) {
      var children = this.root.get('children');
      children.fetch(['foo'], {includeLeaves: false}, function(err, data) {
        if (err) {return done(err);}
      });
    });
  });

  describe('#fetchObjects()', function() {

    it('should fetch leaves by default', function() {

    });

    it('should not fetch leaves if requested', function() {

    });
  });

  it('should fail if adding a descendant at a level greater than the "maxLevels" ' +
    'option', function() {
    this.grandchild.get('children').add(model, function(err) {
      err.should.deep.eq('too many levels');
    });
  });
});
