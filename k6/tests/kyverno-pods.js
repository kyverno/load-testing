import http from 'k6/http';
import { check } from 'k6';
import { buildKubernetesBaseUrl, generatePod, getParamsWithAuth, getTestNamespace, randomString } from './util.js';

const baseUrl = buildKubernetesBaseUrl();
const namespace = getTestNamespace();

export default function() {
  const podName = `test-${randomString(8)}`;
  const pod = generatePod(podName);
  pod.metadata.labels = {
    app: 'k6-test'
  }

  const params = getParamsWithAuth();
  params.headers['Content-Type'] = 'application/json';

  const createRes = http.post(`${baseUrl}/api/v1/namespaces/${namespace}/pods`, JSON.stringify(pod), params);
  check(createRes, {
    'verify response code of POST is 201': r => r.status === 201
  });
}

export function teardown() {
  const params = getParamsWithAuth();
  const deleteRes = http.del(`${baseUrl}/api/v1/namespaces/${namespace}/pods?labelSelector=app=k6-test`, null, params);
  check(deleteRes, {
    'verify response code of DELETE is 200': r => r.status === 200
  });
}
