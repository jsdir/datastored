CREATE KEYSPACE datastored_test WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1} AND durable_writes = 'false';

USE datastored_test;

CREATE TABLE test_table (
  id text PRIMARY KEY,
  bar int,
  baz text,
  "booleanTrue" boolean,
  "booleanFalse" boolean,
  datetime timestamp,
  date int
);

CREATE TABLE test_table_int (
  id int PRIMARY KEY,
  bar int,
  baz text,
  "booleanTrue" boolean,
  "booleanFalse" boolean,
  datetime timestamp,
  date int
);

CREATE TABLE count (
  id text PRIMARY KEY,
  i1 counter,
  i2 counter,
  i3 counter
);
