#!/bin/sh

if [ $TRAVIS ]; then
  CQLSH="/usr/local/cassandra/bin/cqlsh"
else
  CQLSH="cqlsh"
fi

${CQLSH} 127.0.0.1 9160 < ./scripts/test.cql &

wait %1

exit_code=$?

sleep 0.5

echo "Done"
exit $exit_code
