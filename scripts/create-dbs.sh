#!/bin/sh

# Postgres
psql -c 'create database test;' -U postgres
psql -c 'create table instances (id int primary key, body bytea);' -U postgres -d test
