var marshallers = require('../../lib/marshallers.js');

describe('BasicMarshaller', function() {

  it('should serialize geotags', function() {
    marshallers.BasicMarshaller.serializers.geolocation({
      lat: 21.5, lon: 50.2, foo: 'bar'
    }).should.deep.equal([null, '{"lat":21.5,"lon":50.2}']);
  });

  it('should unserialize geotags', function() {
    marshallers.BasicMarshaller.unserializers.geolocation(
      '{"lat": 21.5, "lon": 50.2}'
    ).should.deep.equal([null, {lat: 21.5, lon: 50.2}]);
  });

  it('should validate when serializing geotags', function() {
    marshallers.BasicMarshaller.serializers.geolocation({
      lat: 21.5
    }).should.deep.equal(['invalid geolocation']);

    marshallers.BasicMarshaller.serializers.geolocation({
      lat: 21.5, lon: -50.2
    }).should.deep.equal(['invalid geolocation']);

    marshallers.BasicMarshaller.serializers.geolocation({
      lat: 21.5, lon: 100.2
    }).should.deep.equal(['invalid geolocation']);
  });
});
