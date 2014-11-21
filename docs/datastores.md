Datastores
==========

Datastores are abstractions over the databases that datastored uses.

- `HashStore`
- `IndexStore`
- `RedisCollectionStore`

## `HashStore`

`HashStores` save hashes (objects) to the database and can also fetch them.

## `IndexStore`

`IndexStores` set keys to values and can also unset them.

## `RedisCollectionStore`

`RedisCollectionStore` is an abstraction over the `SET`, `LIST`, and `ZSET` data structures in redis.

