import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { normalizeHermesBase, probeHermes } from '../hermes-connection.mjs';

test('Normalize pasted API addresses without duplicating /v1', () => {
  assert.equal(normalizeHermesBase(' http://hermes:8642/v1/ '), 'http://hermes:8642');
  assert.equal(normalizeHermesBase('http://hermes:8642/'), 'http://hermes:8642');
});

test('Authenticated model check rejects web UI responses and wrong keys', async (t) => {
  let mode = 'models';
  const server = http.createServer((req, res) => {
    assert.equal(req.url, '/v1/models');
    if (req.headers.authorization !== 'Bearer test-secret') { res.writeHead(401); res.end('{}'); return; }
    if (mode === 'html') { res.end('<html>Web UI</html>'); return; }
    if (mode === 'health') { res.end('{"status":"ok"}'); return; }
    if (mode === '404') { res.writeHead(404); res.end('{}'); return; }
    if (mode === 'slow') return;
    res.setHeader('Content-Type', 'application/json'); res.end('{"data":[{"id":"hermes-agent"}]}');
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await probeHermes(base, 'test-secret')).ok, true);
  const rejected = await probeHermes(base, 'wrong-secret');
  assert.equal(rejected.code, 'auth_failed');
  assert.equal(JSON.stringify(rejected).includes('wrong-secret'), false);
  for (const next of ['html', 'health', '404']) {
    mode = next;
    assert.equal((await probeHermes(base, 'test-secret')).code, next === '404' ? 'wrong_endpoint' : 'invalid_response');
  }
  mode = 'slow';
  assert.equal((await probeHermes(base, 'test-secret', { timeoutMs: 50 })).code, 'timeout');
});

test('Missing configuration, invalid URLs, DNS and closed ports give useful diagnostics', async () => {
  assert.equal((await probeHermes('', '')).code, 'missing_url');
  assert.equal((await probeHermes('http://hermes:8642', '')).code, 'missing_key');
  assert.equal((await probeHermes('not a url', 'key')).code, 'invalid_url');
  for (const [cause, expected] of [['ENOTFOUND', 'dns_failed'], ['ECONNREFUSED', 'connection_refused'], ['CERT_HAS_EXPIRED', 'network_error']]) {
    const result = await probeHermes('http://hermes:8642', 'key', { fetchImpl: async () => { throw Object.assign(new Error('secret in raw error'), { cause: { code: cause } }); } });
    assert.equal(result.code, expected);
    assert.equal(JSON.stringify(result).includes('secret in raw error'), false);
  }
});
