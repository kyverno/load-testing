/**
 * Test policy latency based on blocked requests.
 *
 *    ./start.sh tests/kyverno-pss.js 500 2000
 *
 * The start script will create Pod Security Standard policies using the Helm chart:
 *
 *    https://artifacthub.io/packages/helm/kyverno/kyverno-policies
 *
 * It then attempts to create insecure pods and measures the response times.
 *
 */
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
  thresholds: {
    // 90% of requests should be below 200ms
    http_req_duration: ["p(90)<200"],
  },
};

const baseUrl = buildKubernetesBaseUrl();
const namespace = getTestNamespace();

export default function () {
  const podName = `test-${randomString(8)}`;
  const pod = generatePod(podName);
  pod.metadata.labels = {
    app: "k6-test",
  };

  // clear the security context for insecure pods
  pod.spec.containers[0].securityContext = {};

  const params = getParamsWithAuth();
  params.headers["Content-Type"] = "application/json";

  const createRes = http.post(
    `${baseUrl}/api/v1/namespaces/${namespace}/pods`,
    JSON.stringify(pod),
    params
  );
  check(createRes, {
    "verify response code of POST is 400": (r) => r.status === 400,
  });
}

export function teardown() {}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: " ", enableColors: false }),
    "summary.json": JSON.stringify(data),
  };
}
