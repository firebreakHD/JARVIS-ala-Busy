import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { isSupervisor, renderIndex } from '../web-access.mjs';
import { apiUrl } from '../public/api-url.mjs';

test('Ingress trusts the Supervisor socket, never client forwarding headers', () => {
  for (const remoteAddress of ['172.30.32.2', '::ffff:172.30.32.2']) {
    assert.equal(isSupervisor({ socket: { remoteAddress } }), true);
  }
  assert.equal(isSupervisor({ socket: { remoteAddress: '192.168.1.20' }, headers: { 'x-forwarded-for': '172.30.32.2', 'x-ingress-path': '/api/hassio_ingress/token' } }), false);
});

test('Assets, nested module imports, and all API routes keep the ingress prefix', () => {
  const html = '<head><base href="./"></head>';
  for (const prefix of ['/api/hassio_ingress/test-token', '/api/hassio_ingress/test-token/']) {
    const rendered = renderIndex(html, { jarvisIngress: true, headers: { 'x-ingress-path': prefix } });
    const base = new URL(rendered.match(/href="([^"]+)"/)[1], 'https://ha.local:8123').href;
    assert.equal(new URL('assets/app.css', base).pathname, '/api/hassio_ingress/test-token/assets/app.css');
    const script = new URL('assets/app.js', base);
    assert.equal(new URL('./api-url.mjs', script).pathname, '/api/hassio_ingress/test-token/assets/api-url.mjs');
    for (const route of ['/api/auth/status', '/api/login', '/api/logout', '/api/config', '/api/sessions/123', '/api/chat', '/api/hermes-health', '/api/voice/transcribe']) {
      assert.equal(new URL(apiUrl(route, base)).pathname, `/api/hassio_ingress/test-token${route}`);
      assert.equal(apiUrl(route, 'http://ha.local:8787/'), `http://ha.local:8787${route}`);
    }
  }
  assert.equal(renderIndex(html, { headers: { 'x-ingress-path': '/spoof' } }), '<head><base href="/"></head>');
  for (const prefix of ['//evil.example', '/"><script>', 'https://evil.example']) {
    assert.equal(renderIndex(html, { jarvisIngress: true, headers: { 'x-ingress-path': prefix } }), '<head><base href="/"></head>');
  }
});

async function freePort() {
  const server = http.createServer();
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test('Add-on serves the UI, protects direct API access, and persists sessions after login', async (t) => {
  const testRoot = fileURLToPath(new URL('../data/', import.meta.url));
  await mkdir(testRoot, { recursive: true });
  const dataDir = await mkdtemp(path.join(testRoot, 'access-test-'));
  const port = await freePort(); const ingressPort = await freePort();
  let child;
  t.after(async () => {
    if (child && child.exitCode === null) { child.kill(); await once(child, 'exit'); }
    await rm(dataDir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${port}`;
  async function start(password) {
    child = spawn(process.execPath, ['server.mjs'], {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, DATA_DIR: dataDir, PORT: String(port), INGRESS_PORT: String(ingressPort), JARVIS_ADDON: 'true', HOST: '0.0.0.0', JARVIS_ACCESS_PASSWORD: password, HERMES_BASE_URL: '', HERMES_API_KEY: '' },
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    let logs = ''; child.stdout.on('data', (chunk) => { logs += chunk; }); child.stderr.on('data', (chunk) => { logs += chunk; });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) assert.fail(logs);
      if (logs.includes('ingress listening')) return;
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    assert.fail(`Server startup timeout: ${logs}`);
  }
  await start('');
  assert.equal((await fetch(base)).status, 200);
  assert.equal((await (await fetch(`${base}/api/auth/status`)).json()).setupRequired, true);
  assert.equal((await fetch(`${base}/api/sessions`)).status, 401);
  assert.equal((await fetch(`${base}/api/login`, { method: 'POST', body: JSON.stringify({ password: '' }) })).status, 503);
  assert.equal((await fetch(`http://127.0.0.1:${ingressPort}/`, { headers: { 'x-forwarded-for': '172.30.32.2', 'x-ingress-path': '/api/hassio_ingress/spoof' } })).status, 403);
  child.kill(); await once(child, 'exit');
  await start('test-password');
  const html = await (await fetch(base, { headers: { 'x-ingress-path': '/spoof' } })).text();
  assert.match(html, /<base href="\/">/);
  for (const asset of ['app.css', 'app.js', 'api-url.mjs']) {
    const response = await fetch(`${base}/assets/${asset}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), asset === 'app.css' ? /text\/css/ : /text\/javascript/);
  }
  assert.equal((await fetch(`${base}/api/sessions`, { headers: { 'x-forwarded-for': '172.30.32.2', 'x-ingress-path': '/spoof' } })).status, 401);
  assert.equal((await fetch(`${base}/api/login`, { method: 'POST', body: JSON.stringify({ password: 'wrong' }) })).status, 401);
  const login = await fetch(`${base}/api/login`, { method: 'POST', body: JSON.stringify({ password: 'test-password' }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const headers = { Cookie: cookie };
  const session = await (await fetch(`${base}/api/sessions`, { method: 'POST', body: '{}', headers })).json();
  assert.ok(session.id);
  assert.equal((await (await fetch(`${base}/api/sessions`, { headers })).json())[0].id, session.id);
  await fetch(`${base}/api/logout`, { method: 'POST', headers });
  child.kill(); await once(child, 'exit');
  await start('test-password');
  const relogin = await fetch(`${base}/api/login`, { method: 'POST', body: JSON.stringify({ password: 'test-password' }) });
  const newCookie = relogin.headers.get('set-cookie').split(';')[0];
  assert.equal((await (await fetch(`${base}/api/sessions`, { headers: { Cookie: newCookie } })).json())[0].id, session.id);
});
