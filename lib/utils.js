function requireOptions(options, required) {
  for (var i in required) {
    if (!(required[i] in options)) {
      throw new Error('`' + required[i] + '`' + ' is not defined');
    }
  }
}

module.exports = {
  requireOptions: requireOptions
}
