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

// export const options = {
//   thresholds: {
//     // 90% of requests should be below 600ms
//     http_req_duration: ["p(90)<600"],
//   },
// };

const baseUrl = buildKubernetesBaseUrl();
const namespace = getTestNamespace();

const params = getParamsWithAuth();
params.headers["Content-Type"] = "application/json";

export function setup() {
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

  const createRes = http.post(
    `${baseUrl}/apis/kyverno.io/v1/clusterpolicies`,
    JSON.stringify(generatePolicy),
    params
  );

  check(createRes, {
    "verify response code of POST is 201": (r) => r.status === 201,
  });
}

export default function () {
  const podName = `test-${randomString(8)}`;

  const pod = {
    kind: "Pod",
    apiVersion: "v1",
    metadata: {
      name: podName,
      labels: {
        app: "k6-test",
      },
    },
    spec: {
      containers: [
        {
          name: "test",
          image: "nginx",
        },
      ],
    },
  };

  const createRes = http.post(
    `${baseUrl}/api/v1/namespaces/${namespace}/pods`,
    JSON.stringify(pod),
    params
  );

  check(createRes, {
    "verify response code of POST is 201": (r) => r.status === 201,
  });

  let getRes;
  do {
    getRes = http.get(
      `${baseUrl}/api/v1/namespaces/${namespace}/configmaps/${podName}`,
      params
    );
  } while (getRes.status !== 200);

  check(getRes, {
    "verify response code of GET is 200": (r) => r.status === 200,
  });
}

export function teardown() {
  const deleteRes = http.del(
    `${baseUrl}/apis/kyverno.io/v1/clusterpolicies/zk-kafka-address`,
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
