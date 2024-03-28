import http from "k6/http";
import { check } from "k6";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.2/index.js";

import {
  buildKubernetesBaseUrl,
  generatePod,
  generateVPA,
  getParamsWithAuth,
  getTestNamespace,
  randomString,
} from "./util.js";



const baseUrl = buildKubernetesBaseUrl();
const namespace = getTestNamespace();

export default function () {
  const podName = `test-${randomString(8)}`;
  const vpa = generateVPA(podName);
    vpa.metadata.labels = {
        app: "k6-test",
    };
    const params = getParamsWithAuth();
    params.headers["Content-Type"] = "application/json";

  const createVpaRes = http.post(
    `${baseUrl}/apis/autoscaling.k8s.io/v1/namespaces/${namespace}/verticalpodautoscalers`,
    JSON.stringify(vpa),
    params
  );
  check(createVpaRes, {
    "verify response code of POST VPA is 201": (r) => r.status === 201,
  });
}
export function teardown() {}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: " ", enableColors: false }),
    "summary.json": JSON.stringify(data),
  };
}
