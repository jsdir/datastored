function requireAttributes(attributes, required) {
  for (var i in required) {
    if (!(required[i] in attributes)) {
      throw new Error('attribute "' + required[i] + '"' + ' is not defined');
    }
  }
}

module.exports = {
  requireAttributes: requireAttributes
}
