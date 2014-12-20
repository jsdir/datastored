Attribute API
=============

In datastored, models are defined with attributes. Every valid attribute exposes an API that defines its interaction with the parent instance.

```js
var Model = orm.createModel('Model', {
  attributes: {
    foo: Attribute({bar: 'baz'})
  }
})
```

Attribute Options
-----------------

### Values

#### `required`

Boolean value. Default `false`. Set to `true` if the attribute must be defined before saving a new instance.

#### `hashStores`

An array of `HashStores` to save the attribute to.

#### `indexStore`

An `IndexStore` to index the instance.

#### `replaceIndex`

Boolean value. Default `false`. Set to `true` to overwrite old indexes when the value changes.

#### `guarded`

Boolean value. Default `false`. Set to `true` to prevent the user from setting this attribute.

#### `hidden`

Boolean value. Default `false`. Set to `true` to prevent the user from viewing this attribute.

#### `defaultValue`

The default value to set when the instance is created. This can be the value or a function that returns the value.

#### `virtual`

Boolean value. Default `false`. Set to `true` to prevent the user from setting this attribute, to prevent the attribute from being joined in a `HasOne` association, and to prevent the attribute from being saved to a HashStore.

#### `type`

The valids-compatible type for use in the datastore marshallers.

#### `rules`

valids-compatible rules for attribute validation.

### Functions

#### `input`

`input(value, userMode)` or `array` for auto-composition
Called per-attribute on `instance.get()`. This function can be sync/async.

#### `output`

`output(value, userMode)` or `array` for auto-composition

#### `outputAsync`

`outputAsync(value, userMode, cb)` or `array` for auto-composition

#### `save`

`save(value, cb)` or `array` for auto-composition

Called instead of saving the attribute to a `HashStore`.

#### `fetch`

`fetch(value)` or `array` for auto-composition

### Waiting for the loaded ORM

If the orm needs to be accessed when all of its models are loaded to performs things like cross-model link checking and other validations, the attribute can instead be a function that accepts the orm as its first parameter and returns the attribute object:

```js
function Attribute(options) {
  // This function will be called by the orm when all of the models are loaded.
  return function(orm, model) {
    // Use `orm` to check `options`.
    return {
      type: 'string'
    };
  }
}
```

Built-in Attributes
-------------------

- `datastored.String`
- `datastored.Boolean`
- `datastored.Integer`
- `datastored.Float`
- `datastored.Date`
- `datastored.Datetime`
- `datastored.Enum`
- `datastored.Id`
