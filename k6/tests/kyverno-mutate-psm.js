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

const baseUrl = buildKubernetesBaseUrl();
const namespace = getTestNamespace();

const params = getParamsWithAuth();
params.headers["Content-Type"] = "application/json";

export function setup() {
  for (let i = 0; i < 16; i++) {
    const mutatePolicy = {
      apiVersion: "kyverno.io/v1",
      kind: "ClusterPolicy",
      metadata: {
        name: `add-labels-${i}`,
      },
      spec: {
        rules: [
          {
            match: { any: [{ resources: { kinds: ["Pod"] } }] },
            mutate: {
              patchStrategicMerge: {
                metadata: { labels: { "+(team)": "bravo" } },
              },
            },
            name: "add-team",
          },
        ],
      },
    };

    const createRes = http.post(
      `${baseUrl}/apis/kyverno.io/v1/clusterpolicies`,
      JSON.stringify(mutatePolicy),
      params
    );

    check(createRes, {
      "verify response code of POST is 201": (r) => r.status === 201,
    });
  }
}

export default function () {
  const podName = `test-${randomString(8)}`;
  const pod = generatePod(podName);
  pod.metadata.labels = {
    app: "k6-test",
  };

  const createRes = http.post(
    `${baseUrl}/api/v1/namespaces/${namespace}/pods?dryRun=All`,
    JSON.stringify(pod),
    params
  );

  check(createRes, {
    "verify response code of POST is 201": (r) => r.status === 201,
  });
}

export function teardown() {
  for (let i = 0; i < 16; i++) {
    const deleteRes = http.del(
      `${baseUrl}/apis/kyverno.io/v1/clusterpolicies/add-labels-${i}`,
      null,
      params
    );

    check(deleteRes, {
      "verify response code of DELETE is 200": (r) => r.status === 200,
    });
  }
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: " ", enableColors: false }),
    "summary.json": JSON.stringify(data),
  };
}
