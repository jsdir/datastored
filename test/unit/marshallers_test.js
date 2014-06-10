var marshallers = require('../../lib/marshallers.js');

describe('BasicMarshaller', function() {

  it('should serialize geotags', function() {
    marshallers.BasicMarshaller.serializers.geotag({
      lat: 21.5, lon: 50.2, foo: 'bar'
    }).should.deep.equal([null, '{"lon": 21.5, "lon": 50.2}']);
  });

  it('should unserialize geotags', function() {
    marshallers.BasicMarshaller.unserializers.geotag(
      '{"lat": 21.5, "lon": 50.2, "foo": "bar"}'
    ).should.deep.equal([null, {lat: 21.5, lon: 50.2}]);
  });

  it('should validate when serializing geotags', function() {
    marshallers.BasicMarshaller.serializers.geotag({
      lat: 21.5
    }).should.deep.equal(['invalid geotag', null]);

    marshallers.BasicMarshaller.serializers.geotag({
      lat: 21.5, lon: -50.2
    }).should.deep.equal(['invalid geotag', null]);

    marshallers.BasicMarshaller.serializers.geotag({
      lat: 21.5, lon: 100.2
    }).should.deep.equal(['invalid geotag', null]);
  });
});
