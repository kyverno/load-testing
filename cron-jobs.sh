#!/bin/bash

kubectl create ns test

for i in {1..500000}; do
  CURRJOBS=$(kubectl get jobs -n test -o name | wc -l)
  NEWJOBS=$((60-CURRJOBS))
  if [ "$NEWJOBS" -ge 1 ]; then
    for (( c=1; c<=$NEWJOBS; c++ )); do
      NAME=$(cat /dev/urandom | tr -cd 'a-f0-9' | head -c 32)

echo "apiVersion: batch/v1
kind: Job
metadata:
  name: $NAME
spec:
  template:
    spec:
      containers:
      - image: busybox:1
        name: $NAME
        command:
        - sleep
        - '40'
      restartPolicy: Never
  ttlSecondsAfterFinished: 0" | kubectl apply -n test -f - &
    done
  fi
  #kubectl delete rcr --all -n kyverno --force
  sleep 5
done
