function requireOptions(options, required) {
  for (var i in required) {
    if (!(required[i] in options)) {
      throw new Error('attribute `' + required[i] + '`' + ' is not defined');
    }
  }
}

module.exports = {
  requireOptions: requireOptions
}
