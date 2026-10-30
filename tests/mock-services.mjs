import assert from 'node:assert/strict';
import { appendFileSync } from 'node:fs';
import axios from 'axios';

const record = call => appendFileSync(process.env.SERVICE_TEST_LOG, JSON.stringify(call) + '\n');
axios.defaults.adapter = async config => {
  assert.equal(config.baseURL, 'https://pdf.fixture.invalid');
  assert.equal(config.headers.get('X-API-Key'), 'synthetic-pdf-key');
  assert.equal(config.method, 'get');
  assert.match(config.url, /^\/api\/v1\/pdf\/(fixture|second)$/);
  record({ service: 'pdf', path: config.url });
  return { data: { id: config.url.split('/').pop(), fileName: 'fixture.pdf', size: 42, uploadDate: '2026-01-01', company: 'Fixture Company' }, status: 200, statusText: 'OK', headers: {}, config };
};

// Intercept Octokit's fetch before the server module is loaded.
globalThis.fetch = async (input, options) => {
  const url = new URL(input);
  assert.equal(url.origin, 'https://api.github.com');
  assert.equal(new Headers(options.headers).get('authorization'), 'token synthetic-github-token');
  const method = options.method;
  const body = options.body ? JSON.parse(options.body) : undefined;
  record({ service: 'github', method, path: url.pathname, query: url.searchParams.get('q'), body });
  let data;
  if (url.pathname === '/search/issues' && method === 'GET') {
    data = { total_count: 1, items: [{ number: 7 }] };
  } else if (url.pathname === '/repos/fixture-owner/fixture-repo/issues' && method === 'POST') {
    data = { number: 7, html_url: 'https://github.fixture.invalid/issues/7' };
  } else if (url.pathname === '/repos/fixture-owner/fixture-repo/issues/7/comments' && method === 'POST') {
    data = { id: 1 };
  } else if (url.pathname === '/repos/fixture-owner/fixture-repo/issues/7' && ['GET', 'PATCH'].includes(method)) {
    data = { number: 7 };
  } else {
    throw new Error('Unexpected GitHub request');
  }
  return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
};
