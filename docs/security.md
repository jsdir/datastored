# Security

## User Transforms

To enhance security, prevent exploits, and provide convenience, all of datastored's interfaces with user input provide the `user` options to apply user transforms. Active user transforms affect all input and output methods in the following ways:

For methods that may accept user input:
  - Guarded attribute values will be removed from input.
  - Values will be deserialized from JSON based on their type.

For methods that may output to the user:
  - Hidden attribute values will be removed from output.
  - Values will be serialized to JSON based on their type.

Set `options.user` to `true` to enable user transforms for the method.
