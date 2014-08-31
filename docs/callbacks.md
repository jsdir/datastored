# Callbacks

Defines actions to perform at different times in the model's lifecycle.

- initialize
- create

- beforeOutput
- afterOutput

- beforeInput
- afterInput

- beforeFetch
- afterFetch

- beforeSave
- afterSave

- beforeDestroy
- afterDestroy

Model callbacks are defined in model options as the `callbacks` option. Datastored binds each callback to the model instance.

### initialize: func(options) -> options

Return modified `options`.

### defaults: func(data) -> data

Returns initial data for an `Instance`.

### beforeOutput: func(data) -> data

Methods to perform before internal mutations like unserialization and hidden value filtering. During extension, functions from different option partials are composed in reverse compared to `beforeInput` to preserve the mixin layering.

### afterOutput: func(data) -> data

Methods to perform after internal mutations like unserialization and hidden value filtering. During extension, functions from different option partials are composed in reverse compared to `afterInput` to preserve the mixin layering.

### beforeInput: func(data, cb)

Methods to perform before internal mutations like serialization and immutability filtering. Must call `cb(err, data)` synchronously.

### afterInput: func(data, cb)

Methods to perform after internal mutations like serialization and immutability filtering. Must call `cb(err, data)` synchronously.

### beforeFetch: func(options, attributes, cb)

Calls `cb(err, options, attributes)`.

### afterFetch: func(options, data, cb)

Calls `cb(err, options, data)`.

### beforeSave: func(options, data, cb)

Calls `cb(err, options, data)`.

### afterSave: func(options, data, cb)

Calls `cb(err, options, data)`.

### beforeDestroy: func(options, cb)

Calls `cb(err, options)`.

### afterDestroy: func(options, cb)

Calls `cb(err, options)`.
