import http from "k6/http";
import { check } from "k6";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.2/index.js";

import {
  buildKubernetesBaseUrl,
  generatePod,
  mutatePolicy,
  getParamsWithAuth,
  getTestNamespace,
  randomString,
} from "./util.js";

const baseUrl = buildKubernetesBaseUrl();
const namespace = getTestNamespace();

const params = getParamsWithAuth();
params.headers["Content-Type"] = "application/json";

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
