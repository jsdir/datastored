CREATE KEYSPACE datastored_test WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1} AND durable_writes = 'false';

USE datastored_test;

CREATE TABLE column (
  id text PRIMARY KEY,
  bar int,
  baz text,
  "booleanTrue" boolean,
  "booleanFalse" boolean,
  datetime timestamp,
  date int
);

CREATE TABLE column_int (
  id int PRIMARY KEY,
  bar int,
  baz text,
  "booleanTrue" boolean,
  "booleanFalse" boolean,
  datetime timestamp,
  date int
);
