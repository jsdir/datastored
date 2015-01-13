Datastores
==========

Datastores are abstractions over the databases that datastored uses. Different attributes require differenct types of datastores.

- HashStores
  
  HashStores save and fetch hashes (objects) from databases.

  - `MemoryHashStore`
  - `RedisHashStore`

- IndexStores

  IndexStores can set and unset key/value pairs.

  - `MemoryIndexStore`
  - `RedisMemoryStore`

- RedisAssociationStores
  
  RedisAssociationStores provide an interface with a Redis connection.

  - `RedisAssociationStore`

## Including Datastores

It is best practice to export a module exporting all of the used datastores so that it behaves like a singleton and can be easily required when creating models and defining attributes.
