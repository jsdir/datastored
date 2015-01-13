Testing
=======

Tests for datastored are divided into unit and integration tests.

## Unit Tests: `tests/unit`

If a test does not touch any datastores, it is a unit test.

## Integration Tests: `tests/integration`

If a test uses the datastores either explicitly or implicitly, it is an integration test.
