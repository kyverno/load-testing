#!/usr/bin/env bash

set -euo pipefail

NAMESPACE="load-tests"

cleanup() {
    echo "Performing cleanup..."
    kubectl delete -n "$NAMESPACE" -f k6/rbac.yaml || true
    if [[ "$@" =~ "--no-teardown" ]]; then
        echo "No teardown requested"
    else
        kubectl delete ns "$NAMESPACE" || true
	    helm uninstall kyverno-policies -n kyverno-policies || true
    fi
    pkill -f "kubectl proxy" || true
}

# Set trap to call cleanup function on script exit
trap 'cleanup $@' EXIT

TEST="$1"

if [[ $TEST == *"kyverno-pss.js" ]] || [[ $TEST == *"kyverno-polex.js" ]]; then
    echo "Installing PSS policies..." 1>&2
    helm repo add kyverno https://kyverno.github.io/kyverno/
    helm install kyverno-policies --namespace kyverno-policies kyverno/kyverno-policies --create-namespace -f k6/pss-values.yml
    kubectl wait --for=condition=Ready --timeout=120s cpol -l app.kubernetes.io/name=kyverno-policies
fi

echo "Deploying namespace..."
kubectl create ns "$NAMESPACE"

echo "Deploying RBAC..."
kubectl apply -n "$NAMESPACE" -f k6/rbac.yaml

echo "Running test..."
export KUBERNETES_HOST=localhost
export KUBERNETES_PORT=8001
export KUBERNETES_TOKEN=$(kubectl -n "$NAMESPACE" get secret load-test-token -o jsonpath='{.data.token}' | base64 -d)
export TEST_NAMESPACE="$NAMESPACE"

kubectl proxy &
sleep 1
k6 run $* | tee test-output.log
