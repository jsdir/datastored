ORM
===

The orm is a single unit that manages configuration and model definitions. It is best practice to export an orm instance from a module so that it behaves like a singleton and can be easily required when creating models.

```js
// orm.js

var datastored = require('datastored');
module.exports = datastored.createOrm();
```

## Methods

### `datastored.createOrm(options)`

Creates an orm.

- `options` (object, optional)

  - `generateId` (function, optional)

    A function that calls an errback with a unique id on invocation. `generateId` defaults an async wrapper over lodash's `uniqueId`. Datastored requires this function to callback with a unique id with respect to the database. If the orm will be running on multiple nodes, use a distributed id system or a package like [flake-idgen](https://github.com/T-PWK/flake-idgen) to generate unique, cluster-wide ids.
