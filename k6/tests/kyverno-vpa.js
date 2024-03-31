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
let vpaCreated = false;
let vpaName = "";

export default function () {
  if (!vpaCreated) {
    vpaName = `vpa-${randomString(8)}`;
    const vpa = generateVPA(vpaName);
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
    vpaCreated = true;
  }
  const podName = `test-${randomString(8)}`;
  const pod = generatePod(podName);
  pod.metadata.labels = {
    app: "k6-test",
  };

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
