import { check } from 'k6';
import { Kubernetes } from 'k6/x/kubernetes';
import { generatePod, randomString } from './util.js';

export default function () {
  const kubernetes = new Kubernetes();

  const podName = `test-${randomString(8)}`;
  const pod = generatePod(podName);
  pod.metadata.namespace = "default";
  pod.metadata.labels = {
    app: 'k6-test'
  }

  const podResult = kubernetes.create(pod);

  check(podResult, {
    "Verify Pod has been Submitted": (r) => r.status.phase === "Pending",
  });

  kubernetes.delete("Pod", podName, "default");
}
