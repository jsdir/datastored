# Security

## `applyUserTransforms`

To enhance security, prevent exploits, and provide convenience, all of datastored's interfaces with user input present an option to `applyUserTransforms`. Setting `applyUserTransforms` to `true` will affect all input and output methods in the following ways:

For methods that may accept user input:
  - Guarded attribute values are removed from input.
  - Values are deserialized from JSON based on their type.

For methods that may output to the user:
  - Hidden attribute values are removed from output.
  - Values are serialized to JSON based on their type.
