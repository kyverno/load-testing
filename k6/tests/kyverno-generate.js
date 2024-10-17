import http from "k6/http";
import { check } from "k6";
import { Trend } from "k6/metrics";

import {
  buildKubernetesBaseUrl,
  generatePod,
  getParamsWithAuth,
  getTestNamespace,
  randomString,
} from "./util.js";

const e2eDurationTrend = new Trend("e2e_duration");

const baseUrl = buildKubernetesBaseUrl();
const namespace = getTestNamespace();

const params = getParamsWithAuth();
params.headers["Content-Type"] = "application/json";

export let options = {
  thresholds: {
    checks: [{ threshold: "rate>0.99", abortOnFail: true }],
    // e2e_duration: [{ threshold: "p(95)<300", abortOnFail: true }],
  },
  teardownTimeout: "10m",
};

export function setup() {
  const clusterRole = {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "ClusterRole",
    metadata: {
      labels: {
        "app.kubernetes.io/component": "background-controller",
        "app.kubernetes.io/instance": "kyverno",
        "app.kubernetes.io/part-of": "kyverno",
      },
      name: "kyverno:create-pods",
    },
    rules: [{ apiGroups: [""], resources: ["pods"], verbs: ["create"] }],
  };

  http.post(
    `${baseUrl}/apis/rbac.authorization.k8s.io/v1/clusterroles`,
    JSON.stringify(clusterRole),
    params
  );

  const generatePolicy = {
    apiVersion: "kyverno.io/v1",
    kind: "ClusterPolicy",
    metadata: { name: "zk-kafka-address" },
    spec: {
      rules: [
        {
          generate: {
            apiVersion: "v1",
            data: {
              data: {
                KAFKA_ADDRESS:
                  "192.168.10.13:9092,192.168.10.14:9092,192.168.10.15:9092",
                ZK_ADDRESS:
                  "192.168.10.10:2181,192.168.10.11:2181,192.168.10.12:2181",
              },
              kind: "ConfigMap",
              metadata: { labels: { app: "k6-test" } },
            },
            kind: "ConfigMap",
            name: "{{request.object.metadata.name}}",
            namespace: namespace,
            synchronize: true,
          },
          match: { any: [{ resources: { kinds: ["Pod"] } }] },
          name: "k-kafka-address",
        },
      ],
    },
  };

  http.post(
    `${baseUrl}/apis/kyverno.io/v1/clusterpolicies`,
    JSON.stringify(generatePolicy),
    params
  );
}

export default function () {
  const podName = `test-${randomString(8)}`;
  const pod = generatePod(podName);
  pod.metadata.labels = {
    app: "k6-test",
  };

  const createRes = http.post(
    `${baseUrl}/api/v1/namespaces/${namespace}/pods`,
    JSON.stringify(pod),
    params
  );
  const startTime = new Date().getTime();
  check(createRes, {
    "verify Pod is created": (r) => r.status === 201,
  });

  let getRes;
  do {
    getRes = http.get(
      `${baseUrl}/api/v1/namespaces/${namespace}/configmaps/${podName}`,
      params
    );
  } while (getRes.status !== 200);
  const endTime = new Date().getTime();
  check(getRes, {
    "verify ConfigMap is created": (r) => r.status === 200,
  });

  e2eDurationTrend.add(endTime - startTime);
}

export function teardown() {
  http.del(
    `${baseUrl}/apis/kyverno.io/v1/clusterpolicies/zk-kafka-address`,
    null,
    params
  );

  http.del(
    `${baseUrl}/apis/rbac.authorization.k8s.io/v1/clusterroles/kyverno:create-pods`,
    null,
    params
  );

  http.del(
    `${baseUrl}/api/v1/namespaces/${namespace}/pods?labelSelector=app=k6-test`,
    null,
    params
  );

  http.del(
    `${baseUrl}/api/v1/namespaces/${namespace}/configmaps?labelSelector=app=k6-test`,
    null,
    params
  );
}
