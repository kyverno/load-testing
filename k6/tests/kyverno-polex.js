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
  const numPolex = 8000;
  console.log(numPolex);
  for (let i = 0; i < numPolex; i++) {
    const polex = {
      apiVersion: "kyverno.io/v2beta1",
      kind: "PolicyException",
      metadata: {
        name: `pscp-exception-tfap-lnp-dev-${i}`,
        namespace: namespace,
      },
      spec: {
        exceptions: [
          {
            policyName: "disallow-capabilities-strict",
            ruleNames: [
              "require-drop-cap_net_bind_service",
              "require-drop-cap-net_raw",
              "require-drop-cap-sys_admin",
            ],
          },
          {
            policyName: "disallow-privilege-escalation",
            ruleNames: [
              "disallow-privilege-escalation",
              "autogen-disallow-privilege-escalation",
            ],
          },
          {
            policyName: "require-run-as-non-root-fs-group-id",
            ruleNames: ["run-as-non-root-fs-group-id"],
          },
          {
            policyName: "disallow-privileged-containers",
            ruleNames: ["disallow-privileged-containers"],
          },
          {
            policyName: "disallow-host-network-namespaces",
            ruleNames: ["disallow-host-network-namespaces"],
          },
          {
            policyName: "disallow-host-ipc-namespaces",
            ruleNames: ["disallow-host-ipc-namespaces"],
          },
          {
            policyName: "disallow-host-ports",
            ruleNames: ["disallow-host-ports"],
          },
          {
            policyName: "disallow-host-ports-range",
            ruleNames: ["disallow-host-ports-range"],
          },
          {
            policyName: "require-run-as-nonroot",
            ruleNames: ["run-as-non-root", "autogen-run-as-non-root"],
          },
          {
            policyName: "require-run-as-non-root-user-id",
            ruleNames: ["run-as-non-root-user-id"],
          },
          {
            policyName: "require-run-as-non-root-supplemental-group-id",
            ruleNames: ["run-as-non-root-supplemental-group-id"],
          },
          {
            policyName: "restrict-volume-types",
            ruleNames: ["restricted-volumes"],
          },
          {
            policyName: "require-ro-rootfs",
            ruleNames: [
              "validate-readonly-root-filesystem",
              "autogen-validate-readonly-root-filesystem",
            ],
          },
        ],
        match: {
          any: [
            {
              resources: {
                annotations: {
                  "application.tess.io/name": `tfaplnp-${i}`,
                  "environment.tess.io/name": `dev-${i}`,
                },
                kinds: ["Pod", "Job"],
                operations: ["CREATE", "UPDATE"],
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
    console.log("POLEX Creation " + polexCreationResult.status + " " + polexCreationResult.status_text)

    check(polexCreationResult, {
      "verify response code of POLEX Creation is 201": (r) => r.status == 201,
    });
  }
}

export default function () {
  const podName = `test-${randomString(8)}`;
  const pod = generatePod(podName);
  pod.metadata.labels = {
    app: "k6-test",
  };

  pod.metadata.labels["environment.tess.io/name"] = "feature";

  const createResult = http.post(
    `${baseUrl}/api/v1/namespaces/${namespace}/pods`,
    JSON.stringify(pod),
    params
  );
  console.log("POD Creation " + createResult.status + " " + createResult.status_text)

  check(createResult, {
    "verify response code of POD Creation is 400": (r) => r.status === 400,
  });
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: " ", enableColors: false }),
    "summary.json": JSON.stringify(data),
  };
}
