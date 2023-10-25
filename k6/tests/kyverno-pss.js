/**
 * Test policy latency based on blocked requests.
 * 
 *    ./start.sh tests/kyverno-pss.js 500 2000
 * 
 * The start script will create Pod Security Standard policies using the Helm chart:  
 * 
 *    https://artifacthub.io/packages/helm/kyverno/kyverno-policies
 * 
 * It then attempts to create insecure pods and measures the response times.
 * 
 */
import http from 'k6/http';
import { check } from 'k6';
import { buildKubernetesBaseUrl, generatePod, getParamsWithAuth, getTestNamespace, randomString } from './util.js';

const baseUrl = buildKubernetesBaseUrl();
const namespace = getTestNamespace();

export const options = {
  thresholds: {
    http_req_failed: ['rate<0.01'], // http errors should be less than 1%
    http_req_duration: ['p(95)<200'], // 95% of requests should be below 200ms
    abortOnFail: true,
  },
};

export default function() {
  const podName = `test-${randomString(8)}`;
  const pod = generatePod(podName);
  pod.metadata.labels = {
    app: 'k6-test'
  }

  // clear the security context for insecure pods
  pod.spec.containers[0].securityContext = {}

  const params = getParamsWithAuth();
  params.headers['Content-Type'] = 'application/json';

  const createRes = http.post(`${baseUrl}/api/v1/namespaces/${namespace}/pods`, JSON.stringify(pod), params);
  check(createRes, {
    'verify response code of POST is 400': r => r.status === 400
  });
}

export function teardown() {
}
