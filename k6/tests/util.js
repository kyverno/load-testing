export const generatePod = (name = "test", image = "registry.k8s.io/pause") => {
  return {
    kind: "Pod",
    apiVersion: "v1",
    metadata: {
      name: name,
    },
    spec: {
      containers: [
        {
          name: "test",
          image,
          securityContext: {
            allowPrivilegeEscalation: false,
            runAsNonRoot: true,
            seccompProfile: {
              type: "RuntimeDefault",
            },
            capabilities: {
              drop: ["ALL"],
            },
          },
        },
      ],
      terminationGracePeriodSeconds: 0,
    },
  };
};

export const generateConfigmap = (name = "test") => {
  return {
    kind: "ConfigMap",
    apiVersion: "v1",
    metadata: {
      name: name,
    },
  };
};

export const generateSecret = (name = "test") => {
  return {
    kind: "Secret",
    apiVersion: "v1",
    metadata: {
      name: name,
    },
  };
};

export const buildKubernetesBaseUrl = () => {
  return `http://${__ENV.KUBERNETES_HOST}:${__ENV.KUBERNETES_PORT}`;
};

export const getTestNamespace = () => {
  return __ENV.TEST_NAMESPACE;
};

export const getParamsWithAuth = () => {
  return {
    headers: {
      Authorization: `Bearer ${__ENV.KUBERNETES_TOKEN}`,
    },
  };
};

export const randomString = (length) => {
  const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let result = "";
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
};
