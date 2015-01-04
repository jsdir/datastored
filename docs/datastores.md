Datastores
==========

Datastores are abstractions over the databases that datastored uses. Different attributes require differenct types of datastores.

- HashStores
  
  HashStores save and fetch hashes (objects) from databases.

  + `MemoryHashStore`
  + `RedisHashStore`

- IndexStores

  IndexStores can set and unset key/value pairs.

  + `MemoryIndexStore`
  + `RedisMemoryStore`

- RedisAssociationStores
  
  RedisAssociationStores provide an interface with a Redis connection.

  + `RedisAssociationStore`
