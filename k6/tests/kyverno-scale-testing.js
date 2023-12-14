import http from "k6/http";
import { check } from "k6";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.2/index.js";

import {
  buildKubernetesBaseUrl,
  generatePod,
  getParamsWithAuth,
  getTestNamespace,
  randomString,
} from "./util.js";

export const options = {
  discardResponseBodies: true,
  scenarios: {
    scale: {
      executor: "constant-arrival-rate",

      // How long the test lasts
      duration: "120s",

      // How many iterations per timeUnit
      rate: 30,

      // Start `rate` iterations per second
      timeUnit: "1s",

      // Pre-allocate VUs
      preAllocatedVUs: 50,
    },
  },
};

const baseUrl = buildKubernetesBaseUrl();
const namespace = getTestNamespace();

const params = getParamsWithAuth();
params.headers["Content-Type"] = "application/json";

export function setup() {
  const validatePolicy = {
    apiVersion: "kyverno.io/v1",
    kind: "ClusterPolicy",
    metadata: {
      annotations: {
        "kubectl.kubernetes.io/last-applied-configuration":
          '{"apiVersion":"kyverno.io/v1","kind":"ClusterPolicy","metadata":{"annotations":{},"name":"require-labels"},"spec":{"background":true,"rules":[{"match":{"any":[{"resources":{"kinds":["Pod"]}}]},"name":"check-team","validate":{"message":"label \'team\' is required","pattern":{"metadata":{"labels":{"team":"?*"}}}}}],"validationFailureAction":"Audit"}}\n',
      },
      name: "require-labels",
    },
    spec: {
      background: true,
      rules: [
        {
          match: { any: [{ resources: { kinds: ["Pod"] } }] },
          name: "check-team",
          validate: {
            message: "label 'team' is required",
            pattern: { metadata: { labels: { team: "?*" } } },
          },
        },
      ],
      validationFailureAction: "Audit",
    },
  };

  const createRes = http.post(
    `${baseUrl}/apis/kyverno.io/v1/clusterpolicies`,
    JSON.stringify(validatePolicy),
    params
  );

  check(createRes, {
    "verify response code of POST is 201": (r) => r.status === 201,
  });
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

  check(createRes, {
    "verify response code of POST is 201": (r) => r.status === 201,
  });
}

export function teardown() {
  const deleteRes = http.del(
    `${baseUrl}/apis/kyverno.io/v1/clusterpolicies/require-labels`,
    null,
    params
  );

  check(deleteRes, {
    "verify response code of DELETE is 200": (r) => r.status === 200,
  });
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: " ", enableColors: false }),
    "summary.json": JSON.stringify(data),
  };
}
