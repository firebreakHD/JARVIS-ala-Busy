import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseSseFrame, normalizeToolEvent } from '../public/tool-events.mjs';

test('Real JARVIS HTTP proxy streams observed tools and text for Runs and legacy chat', async (t) => {
  let runs = true, created = 0;
  const upstream = http.createServer(async (req, res) => {
    assert.equal(req.headers.authorization, 'Bearer test-key');
    if (req.url === '/v1/capabilities') { res.end(JSON.stringify({ features: runs ? { run_submission: true, run_events_sse: true, run_stop: true } : {} })); return; }
    if (req.url === '/v1/runs') { created++; res.end('{"run_id":"test-run"}'); return; }
    res.setHeader('Content-Type', 'text/event-stream');
    if (req.url === '/v1/runs/test-run/events') {
      res.write('event: tool.started\r\ndata: {"tool":"browser_navigate","preview":"secret-value"}\r\n\r\n');
      res.write('event: tool.completed\ndata: {"tool":"browser_navigate","error":false}\n\n');
      res.write('event: message.delta\ndata: {"delta":"Hallo Buddy"}\n\n');
      res.end('event: run.completed\ndata: {"output":"Hallo Buddy"}');
    } else if (req.url === '/v1/chat/completions') {
      res.write('event: hermes.tool.progress\ndata: {"tool":"web_search"}\n\n');
      res.end('data: {"choices":[{"delta":{"content":"Hallo Buddy"}}]}\n\ndata: [DONE]\n\n');
    } else { res.writeHead(404); res.end(); }
  });
  upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
  t.after(() => { upstream.closeAllConnections(); upstream.close(); });
  const dataRoot = fileURLToPath(new URL('../data/', import.meta.url));
  await mkdir(dataRoot, { recursive: true });
  const dataDir = await mkdtemp(path.join(dataRoot, 'stream-test-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  for (const runMode of [true, false]) {
    runs = runMode;
    const child = spawn(process.execPath, ['server.mjs'], {
      cwd: new URL('..', import.meta.url), windowsHide: true,
      env: { ...process.env, JARVIS_ADDON: 'false', HOST: '127.0.0.1', PORT: '0', DATA_DIR: dataDir, JARVIS_ACCESS_PASSWORD: '', HERMES_API_KEY: 'test-key', HERMES_BASE_URL: `http://127.0.0.1:${upstream.address().port}` },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    try {
      const base = await new Promise((resolve, reject) => {
        let logs = '';
        const timer = setTimeout(() => reject(new Error('Startup timeout')), 5000);
        child.stdout.on('data', (chunk) => { logs += chunk; const match = logs.match(/listening on (127\.0\.0\.1:\d+)/); if (match) { clearTimeout(timer); resolve(`http://${match[1]}`); } });
        child.once('error', (error) => { clearTimeout(timer); reject(error); });
        child.once('exit', () => { clearTimeout(timer); reject(new Error('Unexpected exit')); });
      });
      const response = await fetch(`${base}/api/chat`, { method: 'POST', body: JSON.stringify({ sessionId: 'test-session', messages: [{ role: 'user', content: 'Test' }] }) });
      assert.equal(response.status, 200);
      const text = await response.text();
      const frames = text.trim().split(/\r?\n\r?\n/).map(parseSseFrame);
      const events = frames.filter((frame) => frame.data && frame.data !== '[DONE]').map((frame) => ({ frame, payload: JSON.parse(frame.data) }));
      const tools = events.map(({ frame, payload }) => normalizeToolEvent(frame.name, payload)).filter(Boolean);
      assert.equal(tools[0].name, runMode ? 'browser_navigate' : 'web_search');
      assert.equal(tools[0].status, 'running');
      if (runMode) { assert.equal(tools[1].status, 'done'); assert.equal(text.includes('secret-value'), false); }
      assert.equal(events.map(({ payload }) => payload.choices?.[0]?.delta?.content || '').join(''), 'Hallo Buddy');
    } finally { if (child.exitCode === null) { child.kill(); await once(child, 'exit'); } }
  }
  assert.equal(created, 1, 'One submitted run, never replay tool actions to display them');
});
