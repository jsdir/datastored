CREATE KEYSPACE test WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};

USE test;

CREATE TABLE family (primary_key text PRIMARY KEY, string text, integer int, "booleanTrue" boolean, "booleanFalse" boolean, datetime timestamp, date int);
CREATE TABLE integration1 (primary_key text PRIMARY KEY, foo text, bar text);
