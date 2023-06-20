import http from 'k6/http';
import { check } from 'k6';
import { buildKubernetesBaseUrl, generateConfigmap, getParamsWithAuth, getTestNamespace } from './util.js';

const baseUrl = buildKubernetesBaseUrl();
const namespace = getTestNamespace();

export default function () {
  const cm = generateConfigmap();

  const params = getParamsWithAuth();
  params.headers['Content-Type'] = 'application/json';

  const res = http.post(`${baseUrl}/api/v1/namespaces/${namespace}/configmaps?dryRun=All`, JSON.stringify(cm), params);
  check(res, {
    'verify response code is 201': r => r.status === 201
  })
}
