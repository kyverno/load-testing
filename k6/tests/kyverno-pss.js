import http from "k6/http";
import { check } from "k6";

import {
  buildKubernetesBaseUrl,
  generatePod,
  getParamsWithAuth,
  getTestNamespace,
  randomString,
} from "./util.js";

let scenarios = {
  smoke: {
    executor: "constant-vus",
    vus: 2,
    duration: "20s",
    tags: { type: "smoke" },
  },
  average: {
    executor: "ramping-vus",
    stages: [
      { duration: "30s", target: 5 }, // traffic ramp-up from 1 to 5 users over 30 seconds.
      { duration: "3m", target: 5 }, // stay at 5 users for 3 minutes
      { duration: "30s", target: 0 }, // ramp-down to 0 users
    ],
    tags: { type: "average" },
  },
  stress: {
    executor: "ramping-vus",
    stages: [
      { duration: "1m", target: 10 }, // traffic ramp-up from 1 to a higher 10 users over 1 minutes.
      { duration: "3m", target: 10 }, // stay at higher 10 users for 3 minutes
      { duration: "30s", target: 0 }, // ramp-down to 0 users
    ],
    tags: { type: "stress" },
  },
  soak: {
    executor: "ramping-vus",
    stages: [
      { duration: "30s", target: 5 }, // traffic ramp-up from 1 to 5 users over 30 seconds.
      { duration: "30m", target: 5 }, // stay at 5 users for 30 minutes!!!
      { duration: "30s", target: 0 }, // ramp-down to 0 users
    ],
    tags: { type: "soak" },
  },
  spike: {
    executor: "ramping-vus",
    stages: [
      { duration: "1m", target: 100 }, // fast ramp-up to a high point
      // No plateau
      { duration: "30s", target: 0 }, // quick ramp-down to 0 users
    ],
    tags: { type: "spike" },
  },
  breakpoint: {
    executor: "ramping-arrival-rate", //Assure load increase if the system slows
    stages: [
      { duration: "10m", target: 300 }, // just slowly ramp-up to a HUGE load
    ],
    preAllocatedVUs: 20,
    maxVUs: 200,
    tags: { type: "breakpoint" },
  },
};

export let options = {
  scenarios: {},
  thresholds: {
    "checks{type:smoke}": [{ threshold: "rate>0.99", abortOnFail: true }], // checks should pass for 99% of requests
    "http_req_duration{type:smoke}": [
      { threshold: "p(95)<600", abortOnFail: true },
    ], // 95% of requests should be below 600ms
    "checks{type:average}": [{ threshold: "rate>0.99", abortOnFail: true }],
    "http_req_duration{type:average}": [
      { threshold: "p(95)<1000", abortOnFail: true },
    ],
    "checks{type:stress}": [{ threshold: "rate>0.99", abortOnFail: true }],
    "http_req_duration{type:stress}": [
      { threshold: "p(95)<1600", abortOnFail: true },
    ],
    "checks{type:soak}": [{ threshold: "rate>0.99", abortOnFail: true }],
    "http_req_duration{type:soak}": [
      { threshold: "p(95)<800", abortOnFail: true },
    ],
    "checks{type:spike}": [{ threshold: "rate>0.99", abortOnFail: true }],
    "http_req_duration{type:spike}": [
      { threshold: "p(95)<3200", abortOnFail: true },
    ],
    "checks{type:breakpoint}": [{ threshold: "rate>0.99", abortOnFail: true }],
  },
  teardownTimeout: "10m",
};

if (__ENV.SCENARIO) {
  // Use just a single scenario if `--env scenario=foo` is used.
  options.scenarios[__ENV.SCENARIO] = scenarios[__ENV.SCENARIO];
} else {
  // Use all scenrios.
  options.scenarios = scenarios;
}

const baseUrl = buildKubernetesBaseUrl();
const namespace = getTestNamespace();

export default function () {
  const podName = `test-${randomString(8)}`;
  const pod = generatePod(podName);
  pod.metadata.labels = {
    app: "k6-test",
  };

  const params = getParamsWithAuth();
  params.headers["Content-Type"] = "application/json";

  const createRes = http.post(
    `${baseUrl}/api/v1/namespaces/${namespace}/pods`,
    JSON.stringify(pod),
    params
  );

  check(createRes, {
    "verify Pod is created": (r) => r.status === 201,
  });
}

export function teardown() {
  const params = getParamsWithAuth();
  http.del(
    `${baseUrl}/api/v1/namespaces/${namespace}/pods?labelSelector=app=k6-test`,
    null,
    params
  );
}
