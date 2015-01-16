Attributes
==========

In datastored, models are defined with attributes. Every valid attribute exposes an API that defines its interaction with the parent instance.

```js
var Model = orm.createModel('Model', {
  attributes: {
    foo: Attribute({bar: 'baz'})
  }
})
```

## Attribute Options

- `required` = false (boolean, optional)

  Set to `true` if the attribute must be defined before saving a new instance.

- `hashStores` (array, required)

  An array of `HashStores` to save the attribute to.

- `indexStore` (`IndexStore`, optional)

  An `IndexStore` to index the instance.

- `replaceIndex` = false (boolean, optional)

  Set to `true` to overwrite old indexes when the value changes.

- `guarded` = false (boolean, optional)

  Set to `true` to prevent the user from changing this attribute through `instance.set`.

- `hidden` = false (boolean, optional)

  Set to `true` to prevent the user from viewing this attribute.

- `defaultValue` (*, optional)

  The default value to set when the instance is created. This can be a value or a function that returns a value.

- `virtual` = false (boolean, optional)

  Set to `true` to prevent the user from setting this attribute, to prevent the attribute from being joined in a `HasOne` association, and to prevent the attribute from being saved to a `HashStore`. Virtual attributes are useful for creating attribute abstractions like associations that are defined in model mixins.

- `type` (string, required)

  One of the following attribute value types:

  - `string`
  - `integer`
  - `float`
  - `boolean`
  - `date`
  - `datetime`

- `constraints` (object, optional)

  [validate.js constraints](http://validatejs.org/#constraints) for attribute validation.

`input`, `output`, `save`, and `fetch` methods are provided to change data at the attribute level. More info about data flow can be found [here](data_flow.md).

- `input` (function, optional)

  `function(attrName, attrValue, options)`
  This method is applied to all input values for the attribute.

  - `attrName` (string)
  - `attrValue` (*)
  - `options` (object)
    - `user` = false (boolean)

  - Returns: modified `attrValue`

- `output` (function, optional)

  `function(attrName, attrValue, options)`
  This method is applied to all output values for the attribute.

  - `attrName` (string)
  - `attrValue` (*)
  - `options` (object)
    - `user` = false (boolean)
    - `attributes`

      `attributes` parameter from `fetch` and `get` instance methods

  - Returns: modified `attrValue`

- `save` (function, optional)

  `function(attrName, attrValue, options, cb)`
  This method is applied to all saved values for the attribute.

  - `attrName` (string)
  - `attrValue` (*)
  - `options` (object)
    - `user` = false (boolean)
    - `attributes`

      `attributes` parameter from `fetch` and `get` instance methods

  - `cb` (function)

    Call `cb` as an errback with the modified `attrValue`.

- `fetch` (function, optional)

  `function(attrName, attrValue, options, cb)`
  This method is applied to all fetched values for the attribute.

  - `attrName` (string)
  - `attrValue` (*)
  - `options` (object)
    - `user` = false (boolean)
    - `attributes`

      `attributes` parameter from `fetch` and `get` instance methods

  - `cb` (function)

    Call `cb` as an errback with the modified `attrValue`.

## Waiting for the loaded ORM

If the orm needs to be accessed when all of its models are loaded to performs things like cross-model link checking and other validations, the attribute can instead be a function that accepts the orm as its first parameter and returns the attribute object:

```js
function Attribute(options) {
  // This function will be called by the orm when all of the models are loaded.
  return function(orm, model) {
    // Use `orm` to check `options`.
    return {type: 'string'};
  }
}
```

## Built-in Attributes

- `datastored.String`
- `datastored.Boolean`
- `datastored.Integer`
- `datastored.Float`
- `datastored.Date`
- `datastored.Datetime`
- `datastored.Enum`
