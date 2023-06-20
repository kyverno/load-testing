import http from 'k6/http';
import { check } from 'k6';
import { buildKubernetesBaseUrl, generatePod, getParamsWithAuth, getTestNamespace } from './util.js';

const baseUrl = buildKubernetesBaseUrl();
const namespace = getTestNamespace();

export default function () {
  const pod = generatePod();

  const params = getParamsWithAuth();
  params.headers['Content-Type'] = 'application/json';

  const res = http.post(`${baseUrl}/api/v1/namespaces/${namespace}/pods?dryRun=All`, JSON.stringify(pod), params);
  check(res, {
    'verify response code is 201': r => r.status === 201
  })
}
