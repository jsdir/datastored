function assertCommandReturns(command, args, assertedResult, cb) {

}

xdescribe('RedisList', function() {

  // command should be run in save and fetch contexts, value should be asserted only for fetch.
  it('should use lpush correctly', function(done) {
    assertCommandReturns('lpush', [instance, instance], 2, done);
  });

  it('should use lrange correctly', function(done) {
    // lpush multiple instances.
    assertCommandReturns('lrange', [2, 4], [3,4,5], done);
  });

  it('should fail on redis failure', function() {

    // try syntax error with fetch and save
  });
});
