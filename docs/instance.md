Asynchronous Chaining
---------------------

Instance methods are called through asynchronous chaining. This makes it easier to call more functions while handling errors in one place.

```js
Model
  .userMode()
  .find('name', 'foo')
  .fetch(['bar'])
  .incr({bar: 3})
  .save(['bar']);
```

## User mode

User mode changes input and output methods.

For data input methods:
  - removes guarded attribute values
  - deserializes from JSON

For data output methods:
  - removes hidden attribute values
  - serializes to JSON

## Initializers

These functions return an initialized model.

### find

`Model.find(attribute_name, attribute_value)`

Transforms input if in user mode.

```js
var instance = Model.find('attribute_name', 'attribute_value');
// User mode.
var instance = Model.userMode().withId('serialized_id_value');
```

### withId

`Model.withId(id)`

Transforms input if in user mode.

```js
var instance = Model.withId('id_value');
// User mode.
var instance = Model.userMode().withId('serialized_id_value');
```

### create

`Model.create(data)`

Creates a new instance with `data` as attribute values. Transforms input if in user mode.

```js
var instance = Model.create({foo: 'bar'});
// User mode.
var instance = Model.userMode().create({foo: 'bar'});
```

## Transforms

These functions return the instance with new state.

### fetch

`instance.fetch(attributes)`

`attributes` can either be an array or object of attribute names. If `attributes` is an object, the keys are the attribute names and the values are the attribute fetch options. If the attribute object has an attribute without options, the options can be set to `true`.

```js
// Fetch attributes.
instance.fetch(['foo', 'bar']);
// Fetch attributes with options.
instance.fetch({foo: {option: 'value'}, bar: true});
```

### userMode

`instance.userMode()`

Sets the instance to user mode. Disable user mode with `instance.userMode(false)`.

### save

`instance.save()` or `instance.save({attribute_name: options})`

Sets `isNew` to `false`. Validates attribute `rules` and `required`. Attribute save options can also be passed.

## Value

These functions return a value.

### get

`get('attribute_name')`, `get(['attribute1_name', 'attribute2_name'])`, or `get({attribute_name: null, attribute2_name: { options }})`
Transforms output if in user mode.

### getId

`instance.getId()`

Returns the instance id. Transforms output if in user mode. If the instance is not saved, `null` is returned.
