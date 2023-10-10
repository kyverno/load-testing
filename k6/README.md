# Load Test for the Kubernetes API with k6

## Description

This folder contains some Kubernetes resources and a script to start load tests against the Kubernetes API.

## How does it work?

Under the surface we're using [k6](https://k6.io/) as load testing. It's written in Go but the tests are written in JavaScript. You can either check existing tests or read the [documentation](https://k6.io/docs/). Existing tests are in the `tests/` subfolder.

To start the tests you can use the `start.sh` script and provide three parameters:

1. the script you want to execute (e.g. tests/my-test.js)
2. the number of concurrent "users" (in k6 they're called virtual users or vus)
3. the number of overall iterations (they will be distributed across the number of vus)

This will spin up a new namespace (`load-test`) in the target cluster with a service account that has cluster-admin role permissions and will spawn k6 with the script you provided. The test file is mounted to the pod from a ConfigMap. Afterwards it will grab the logs from the pod and clean everything up. The logs will be stored in your current folder.

## Misc

There is already a util.js file you can use with some custom helper functions (like get the current namespace, build the Kubernetes API base URL etc.)
