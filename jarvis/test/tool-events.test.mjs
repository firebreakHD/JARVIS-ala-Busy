import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSseFrame, normalizeToolEvent, updateActivities } from '../public/tool-events.mjs';

test('SSE parsing retains event names, CRLF, multiline JSON, and ignores keepalives', () => {
  const frame = parseSseFrame(': keepalive\r\nevent: tool.started\r\nid: 1\r\ndata: {"tool":\r\ndata: "browser_navigate"}');
  assert.equal(frame.name, 'tool.started');
  assert.equal(JSON.parse(frame.data).tool, 'browser_navigate');
  assert.equal(parseSseFrame(': keepalive').data, '');
});

test('Only observed tool lifecycle becomes activity; arguments and results never enter cards', () => {
  const started = normalizeToolEvent('tool.started', { tool: 'browser_navigate', preview: 'password=secret', args: { token: 'secret' } });
  assert.deepEqual(started, { name: 'browser_navigate', status: 'running' });
  assert.deepEqual(normalizeToolEvent('hermes.tool.progress', { tool: 'web_search' }), { name: 'web_search', status: 'running' });
  assert.equal(normalizeToolEvent('message.delta', { text: 'Using a browser' }), null);
  assert.equal(normalizeToolEvent('hermes.tool.progress', { tool: '_thinking' }), null);
  assert.equal(normalizeToolEvent('tool.started', { tool: { invalid: true } }), null);
  assert.equal(normalizeToolEvent('jarvis.tool', { name: 'terminal', status: 'invented' }), null);
  assert.equal(normalizeToolEvent('tool.completed', { tool: 'terminal', error: true }).status, 'failed');
});

test('Concurrent calls of the same tool close individually; replayed call ids do not duplicate', () => {
  let items = [];
  for (const id of ['1', '2', '2']) items = updateActivities(items, { name: 'browser_click', id, status: 'running' });
  assert.equal(items.length, 2);
  items = updateActivities(items, { name: 'browser_click', id: '2', status: 'done' });
  items = updateActivities(items, { name: 'browser_click', id: '2', status: 'done' });
  assert.equal(items.length, 2);
  assert.equal(items[0].status, 'running');
  assert.equal(items[1].status, 'done');
  items = updateActivities(items, { name: 'browser_click', status: 'failed' });
  assert.equal(items[0].status, 'failed');
  for (let index = 0; index < 20; index++) items = updateActivities(items, { name: `finished_${index}`, status: 'done' });
  assert.equal(items.length, 12);
});
