#!/usr/bin/env bash

set -euo pipefail

NAMESPACE="load-tests"

if [[ $# -lt 3 ]]; then
	echo "Usage: $0 <script> <vus> <iterations>" 1>&2
	echo "Example: $0 tests/my-test.js 10 100" 1>&2
	exit 1
fi

SCRIPT="$1"
VUS="$2"
ITERATIONS="$3"

if [[ $ITERATIONS -lt $VUS ]]; then
	echo "iterations must be greater or equal to vus" 1>&2
	exit 1
fi

echo "Running $SCRIPT..."
if [[ $SCRIPT == *"kyverno-pss.js" ]]; then
	echo "installing PSS policies" 1>&2
	helm repo add kyverno https://kyverno.github.io/kyverno/
	helm install kyverno-policies --namespace kyverno-policies kyverno/kyverno-policies --create-namespace -f pss-values.yml
	kubectl wait --for=condition=Ready --timeout=120s cpol -l app.kubernetes.io/name=kyverno-policies
fi

if [[ $SCRIPT == *"kyverno-mutate.js" ]]; then
	echo "installing 10 mutate policies" 1>&2
	node tests/utils/create-mutate-policies.js
	kubectl create -f /tmp/policies.json
	kubectl wait --for=condition=Ready --timeout=120s cpol -l app.kubernetes.io/name=kyverno-policies
fi

echo "Deploying namespace..."
kubectl create ns "$NAMESPACE"

echo "Deploying RBAC..."
kubectl apply -n "$NAMESPACE" -f rbac.yaml

# copy the script to a temp file under a common name
# so that we can reference always to the same name in the pod
SCRIPT_DIR=$(mktemp -d)
NEW_SCRIPT_PATH="${SCRIPT_DIR}/script.js"

cp "$SCRIPT" "$NEW_SCRIPT_PATH"

echo "Creating configmap..."
kubectl create configmap -n "$NAMESPACE" load-test --from-file="tests/util.js" --from-file="$NEW_SCRIPT_PATH" --from-literal="vus=$VUS" --from-literal="iterations=$ITERATIONS"

rm -rf "$SCRIPT_DIR"

echo "Deploying k6 job..."
kubectl apply -n "$NAMESPACE" -f job.yaml

echo "Waiting for the job to finish..."
kubectl wait -n $NAMESPACE --for=condition=complete --timeout=600s jobs/load-test &
COMPLETE_PID=$!
kubectl wait -n $NAMESPACE --for=condition=failed --timeout=600s jobs/load-test &
FAILED_PID=$!
wait -n $COMPLETE_PID $FAILED_PID
kill $COMPLETE_PID $FAILED_PID 2> /dev/null || true

echo "Getting job exit code..."
POD_NAME=$(kubectl get pods -n "$NAMESPACE" -l job-name=load-test -o jsonpath='{.items[0].metadata.name}')
EXIT_CODE=$(kubectl get pods -n "$NAMESPACE" "$POD_NAME" -o jsonpath='{.status.containerStatuses[0].state.terminated.exitCode}')
echo "Job exit code: $EXIT_CODE"

echo "Extracting logs and summary..."
kubectl logs -n "$NAMESPACE" jobs/load-test > "$(basename "$SCRIPT")-${VUS}vu-${ITERATIONS}it-logs.txt"

echo "Clean up job and configmap..."
kubectl delete -n "$NAMESPACE" jobs load-test
kubectl delete -n "$NAMESPACE" configmap load-test
kubectl delete clusterrolebinding load-test

echo "Clean up..."
kubectl delete ns "$NAMESPACE"

if [[ $SCRIPT == *"kyverno-pss.js" ]]; then
	echo "deleting PSS policies" 1>&2
	helm uninstall kyverno-policies -n kyverno-policies
fi

if [[ $SCRIPT == *"kyverno-mutate.js" ]]; then
	echo "cleaning up 10 mutate policies" 1>&2
	kubectl delete -f /tmp/policies.json
	rm /tmp/policies.json
fi

exit $EXIT_CODE
