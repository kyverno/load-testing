import http from "k6/http";
import exec from "k6/execution";
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
  const disallowHostNamespacesClusterPolicy = {
    apiVersion: "kyverno.io/v2beta1",
    kind: "ClusterPolicy",
    metadata: {
      name: "disallow-host-namespaces",
    },
    spec: {
      background: false,
      rules: [
        {
          match: { any: [{ resources: { kinds: ["Pod"] } }] },
          name: "host-namespaces",
          validate: {
            message:
              "Sharing the host namespaces is disallowed. The fields spec.hostNetwork, spec.hostIPC, and spec.hostPID must be unset or set to `false`.",
            pattern: {
              spec: {
                "=(hostIPC)": "false",
                "=(hostNetwork)": "false",
                "=(hostPID)": "false",
              },
            },
          },
        },
      ],
      validationFailureAction: "Enforce",
    },
  };
  const clusterPolicyCreationResult = http.post(
    `${baseUrl}/apis/kyverno.io/v2beta1/clusterpolicies`,
    JSON.stringify(disallowHostNamespacesClusterPolicy),
    params
  );
  check(clusterPolicyCreationResult, {
    "verify response code of POST is 201": (r) => r.status === 201,
  });

  const numPolex = exec.test.options.scenarios.default.iterations;
  for (let i = 0; i < numPolex; i++) {
    const polex = {
      apiVersion: "kyverno.io/v2beta1",
      kind: "PolicyException",
      metadata: {
        name: `delta-${i}-exception`,
        namespace: namespace,
      },
      spec: {
        exceptions: [
          {
            policyName: "disallow-host-namespaces",
            ruleNames: ["host-namespaces", "autogen-host-namespaces"],
          },
        ],
        match: {
          any: [
            {
              resources: {
                kinds: ["Pod", "Deployment"],
                names: [`important-${i}-tool*`],
                namespaces: [namespace],
              },
            },
          ],
        },
      },
    };
    const polexCreationResult = http.post(
      `${baseUrl}/apis/kyverno.io/v2beta1/namespaces/${namespace}/policyexceptions`,
      JSON.stringify(polex),
      params
    );
    check(polexCreationResult, {
      "verify response code of POST is 201": (r) => r.status === 201,
    });
  }
}

export default function () {
  const deployment = {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      labels: { app: "busybox" },
      name: `important-${exec.scenario.iterationInTest}-tool`,
      namespace: namespace,
    },
    spec: {
      replicas: 1,
      selector: { matchLabels: { app: "busybox" } },
      template: {
        metadata: { labels: { app: "busybox" } },
        spec: {
          containers: [
            {
              command: ["sleep", "1d"],
              image: "busybox:1.35",
              name: "busybox",
            },
          ],
          hostIPC: true,
        },
      },
    },
  };

  const createResult = http.post(
    `${baseUrl}/apis/apps/v1/namespaces/${namespace}/deployments`,
    JSON.stringify(deployment),
    params
  );

  check(createResult, {
    "verify response code of POST is 201": (r) => r.status === 201,
  });
}

export function teardown() {
  const deleteResult = http.del(
    `${baseUrl}/apis/kyverno.io/v2beta1/clusterpolicies/disallow-host-namespaces`,
    null,
    params
  );

  check(deleteResult, {
    "verify response code of DELETE is 200": (r) => r.status === 200,
  });
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: " ", enableColors: false }),
    "summary.json": JSON.stringify(data),
  };
}
