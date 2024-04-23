const fs = require('fs');

const mutatePolicy = (policyName) => {
    return {
        apiVersion: "kyverno.io/v1",
        kind: "ClusterPolicy",
        metadata: {
            name: policyName,
            labels: {
                "app.kubernetes.io/name": "kyverno-policies"
            }
        },
        spec: {
            rules: [
                {
                    match: {
                        any: [{
                            resources: {
                                kinds: ["Pod"]
                            }
                        }]
                    },
                    mutate: {
                        patchStrategicMerge: {
                            metadata: {
                                labels: {
                                    ["+(test" + policyName + ")"]: "bravo"
                                }
                            }
                        }
                    },
                    name: "policy-" + policyName
                }
            ]
        }
    }
};

for (let i = 0; i < 10; i++) {
    const policyName = "policy-" + i;
    const policyData = mutatePolicy(policyName);

    fs.appendFile('/tmp/policies.json', JSON.stringify(policyData, null, 2) + '\n', (err) => {
        if (err) {
            console.error(err);
            return;
        }
    });
}

console.log('Policies data has been written to /tmp/policies.json file');
