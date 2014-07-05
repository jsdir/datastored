# Mutators

Datstored uses several base attribute mutations for features such as hidden attributes and validation. These mutators cannot be changed. User-defined mutators are added to the function chain immediately after the immutable ones added by datastored.

A diagram of the mutators in the datastored pipeline:

```
+------------+  fetch  +-------+  output  +------+
|            |-------->|       |--------->|      |
| Datastores |  save   | Model |  input   | User |
|            |<--------|       |<---------|      |
+------------+         +-------+          +------+
```

### input

Input mutators are synchronous and can return errors.

- Unserializes data from JSON.

### output

Output mutators are synchronous and cannot return errors.

- Hides attributes marked as hidden.
- Serializes data to JSON.

### save

Save mutators are asynchronous and can call back with errors.

- Validates data.

### fetch

Fetch mutators are synchronous and cannot return errors.

## Mutator utils

- validate
- marshal
- hide
- lowercase
- alias
