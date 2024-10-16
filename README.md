# Kyverno Load Testing

This repository contains scripts and tools for load testing Kyverno.

## Structure

- `k6/tests` - contains the k6 tests
- `k6/rbac` - contains the necessary RBAC resources to run tests
- `k6/run.sh` - contains a scaffold for running the tests

## Running the tests

You can use `make` to run the tests through the `run` target. You can basically pass it any arguments you would pass to `k6 run`.

```bash
make run -- k6/tests/kyverno-pss.js -e SCENARIO=breakpoint
```

Or,

```bash
make run --  k6/tests/kyverno-pss.js --vus 100 --iterations 1000
```

This will install `k6` and run the test `k6/tests/kyverno-pods.js` with 100 virtual users and 1000 iterations.

## What do the tests do?

The tests are designed to simulate a real-world scenario where a user is creating, updating, and deleting resources in a Kubernetes cluster. The tests are designed to be run against a Kyverno policy that enforces its rules on the resources.
