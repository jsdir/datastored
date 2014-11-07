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

`Model.find(attribute_name, attribute_value, cb)`

Transforms input if in user mode.

```js
var instance = Model.find('attribute_name', 'attribute_value');
// User mode.
var instance = Model.userMode().find('serialized_id_value');
```

If an error occurs when finding the instance, the error will be propagated through the chain and `cb` will not be called. If no error happened, `cb` will be called with the instance if it was found, or `null` if no instance was found.

Returns deferred `Instance`. Throws chain error on find error.

### withId

`Model.withId(id)`

Transforms input if in user mode.

```js
var instance = Model.withId('id_value');
// User mode.
var instance = Model.userMode().withId('serialized_id_value');
```

Returns `Model.build({id: value})` with `isNew` set to `false`.

### build

`Model.build(data)`

Builds a new instance with `data` as attribute values. Transforms input if in user mode.

```js
var instance = Model.build({foo: 'bar'});
// User mode.
var instance = Model.userMode().build({foo: 'bar'});
```

Returns `Instance`.

### create

`Model.create(data)`

Builds a new instance with `data` as attribute values and saves the instance. Transforms input if in user mode.

```js
var instance = Model.create({foo: 'bar'});
// User mode.
var instance = Model.userMode().create({foo: 'bar'});
```

Returns `Instance`. Errors are propagated through the chain.

## Helpers

### end

`instance.end(cb)`

`cb` is called with the instance when operations are finished.

### require

`instance.require()`

Throws an error if the instance is `null`. This can be used after `find`.

## Transforms

These functions return the instance with new state.

### fetch

`instance.fetch(attributes)`

`attributes` can either be a string, an array, or an object of attribute names. If `attributes` is a string, the orm with fetch one attribute as that name. If `attributes` is an object, the keys are the attribute names and the values are the attribute fetch options. If the attribute object has an attribute without options, the options can be set to `true`.

```js
// Fetch attributes.
instance.fetch(['foo', 'bar']);
// Fetch attributes with options.
instance.fetch({foo: {option: 'value'}, bar: true});
```

Returns `Instance`. Errors are propagated through the chain.

### userMode

`instance.userMode()`

Sets the instance to user mode. Disable user mode with `instance.userMode(false)`. Returns `Instance`.

### save

`instance.save()` or `instance.save({attribute_name: options})`

Sets `isNew` to `false`. Validates attribute `rules` and `required`. Attribute save options can also be passed.

Returns `Instance`. Errors are propagated through the chain.

## Value

These functions return a value.

### get

`get('attribute_name', cb)`, `get(['attribute1_name', 'attribute2_name'], cb)`, or `get({attribute_name: null, attribute2_name: { options }}, cb)`
Transforms output if in user mode. Calls back with result.

### getId

`instance.getId()`

Returns the instance id. Transforms output if in user mode. If the instance is not saved, `null` is returned.

## Asynchronicity

Asynchonous mode is triggered on `save`, `fetch`, and `find` methods and their derivatives.
