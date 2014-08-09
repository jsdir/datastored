CREATE KEYSPACE datastored_test WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1} AND durable_writes = 'false';

USE datastored_test;

CREATE TABLE column (
  id varchar PRIMARY KEY,
  bar int,
  baz varchar
);
