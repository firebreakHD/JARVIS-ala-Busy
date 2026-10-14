import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
const storeFile = path.join(dataDir, 'sessions.json');
const port = Number(process.env.PORT || 8787);
let addonOptions = {};
try { addonOptions = JSON.parse(await fs.readFile(path.join(dataDir, 'options.json'), 'utf8')); } catch { /* Outside Home Assistant, configure with environment variables. */ }
const hermesBase = (process.env.HERMES_BASE_URL || addonOptions.hermes_base_url || '').replace(/\/+$/, '');
const hermesApiKey = process.env.HERMES_API_KEY || addonOptions.hermes_api_key || '';
const accessPassword = process.env.JARVIS_ACCESS_PASSWORD || addonOptions.access_password || '';
const cookieSecret = randomBytes(32);
const host = process.env.HOST || addonOptions.host || (accessPassword ? '0.0.0.0' : '127.0.0.1');
if (host !== '127.0.0.1' && host !== '::1' && !accessPassword) throw new Error('Für Netzwerkzugriff muss JARVIS_ACCESS_PASSWORD gesetzt sein.');
const whisperPath = process.env.WHISPER_CPP_PATH || addonOptions.whisper_cpp_path || '';
const whisperModel = process.env.WHISPER_MODEL_PATH || addonOptions.whisper_model_path || '';
const ffmpegPath = process.env.FFMPEG_PATH || addonOptions.ffmpeg_path || 'ffmpeg';
let store = { sessions: [] };
let hermesFeatures = null;
let featuresCheckedAt = 0;
let writeQueue = Promise.resolve();

await fs.mkdir(dataDir, { recursive: true });
try { store = JSON.parse(await fs.readFile(storeFile, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') console.error('Could not read session store:', error.message); }

const persist = () => {
  writeQueue = writeQueue.then(async () => {
    const tmp = `${storeFile}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(store, null, 2), 'utf8');
    await fs.rename(tmp, storeFile);
  });
  return writeQueue;
};
const json = (res, status, value) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
};
const readBody = async (req, limit = 2_000_000) => {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('Anfrage ist zu groß.'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};
const getSession = (id) => store.sessions.find((item) => item.id === id);
const cookieName = 'jarvis_session';
function sessionCookie(req, res) {
  const token = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (!token) return false;
  const [expires, signature] = token.split('.');
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  const expected = createHmac('sha256', cookieSecret).update(expires).digest();
  let actual; try { actual = Buffer.from(signature, 'base64url'); } catch { return false; }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function setSessionCookie(req, res, expires) {
  const value = expires ? `${expires}.${createHmac('sha256', cookieSecret).update(String(expires)).digest('base64url')}` : '';
  const secure = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https' || process.env.JARVIS_COOKIE_SECURE === 'true';
  res.setHeader('Set-Cookie', `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${expires ? 43200 : 0}${secure ? '; Secure' : ''}`);
}
function passwordsMatch(candidate) {
  const expected = createHash('sha256').update(accessPassword).digest();
  const received = createHash('sha256').update(String(candidate || '')).digest();
  return timingSafeEqual(expected, received);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/auth/status') {
      const authenticated = !accessPassword || sessionCookie(req, res);
      return json(res, 200, { passwordRequired: Boolean(accessPassword), authenticated });
    }
    if (req.method === 'POST' && url.pathname === '/api/login') {
      const body = JSON.parse((await readBody(req)).toString('utf8'));
      if (!accessPassword || !passwordsMatch(body.password)) return json(res, 401, { error: 'Passwort ist nicht korrekt.' });
      setSessionCookie(req, res, Date.now() + 12 * 60 * 60 * 1000);
      return json(res, 200, { authenticated: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/logout') {
      setSessionCookie(req, res, 0); return json(res, 200, { authenticated: false });
    }
    if (accessPassword && url.pathname.startsWith('/api/') && !['/api/auth/status', '/api/login'].includes(url.pathname) && !sessionCookie(req, res)) {
      return json(res, 401, { error: 'Bitte zuerst anmelden.' });
    }
    if (req.method === 'GET' && url.pathname === '/api/config') {
      return json(res, 200, { hermesConfigured: Boolean(hermesBase && hermesApiKey), hermesBaseConfigured: Boolean(hermesBase), hermesAuthConfigured: Boolean(hermesApiKey), localSttConfigured: Boolean(whisperPath && whisperModel), localSttReason: whisperPath && whisperModel ? '' : 'Whisper.cpp und ein lokales Modell müssen am Server konfiguriert sein.', defaultMode: 'chat' });
    }
    if (req.method === 'GET' && url.pathname === '/api/hermes-health') {
      if (!hermesBase) return json(res, 503, { error: 'Hermes nicht konfiguriert.' });
      if (!hermesApiKey) return json(res, 503, { error: 'HERMES_API_KEY fehlt. Der Hermes API Server muss mit einem Bearer-Key geschützt sein.' });
      const headers = hermesHeaders();
      try {
        let health = await fetch(`${hermesBase}/health`, { headers, signal: AbortSignal.timeout(3000) });
        if (health.status === 404 || health.status === 405) health = await fetch(`${hermesBase}/v1/models`, { headers, signal: AbortSignal.timeout(3000) });
        if (!health.ok) return json(res, 502, { error: 'Hermes ist nicht erreichbar.' });
        try {
          const capabilities = await fetch(`${hermesBase}/v1/capabilities`, { headers, signal: AbortSignal.timeout(3000) });
          if (capabilities.ok) {
            const payload = await capabilities.json();
            hermesFeatures = payload.features || {};
            featuresCheckedAt = Date.now();
          }
        } catch { /* Keep OpenAI-compatible chat available if this Hermes version has no capabilities route. */ }
        return json(res, 200, { status: 'ok', features: hermesFeatures });
      } catch { return json(res, 502, { error: 'Hermes ist nicht erreichbar.' }); }
    }
    if (req.method === 'GET' && url.pathname === '/api/sessions') return json(res, 200, store.sessions.map(({ id, title, updatedAt }) => ({ id, title, updatedAt })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    if (req.method === 'POST' && url.pathname === '/api/sessions') {
      const now = new Date().toISOString();
      const session = { id: crypto.randomUUID(), title: 'Neuer Chat', createdAt: now, updatedAt: now, messages: [] };
      store.sessions.push(session); await persist(); return json(res, 201, session);
    }
    const sessionMatch = url.pathname.match(/^\/api\/sessions\/([\w-]+)$/);
    if (sessionMatch && req.method === 'GET') {
      const session = getSession(sessionMatch[1]);
      return session ? json(res, 200, session) : json(res, 404, { error: 'Sitzung nicht gefunden.' });
    }
    if (sessionMatch && req.method === 'DELETE') {
      store.sessions = store.sessions.filter((session) => session.id !== sessionMatch[1]);
      await persist(); return json(res, 204, {});
    }
    if (sessionMatch && req.method === 'PATCH') {
      const session = getSession(sessionMatch[1]); if (!session) return json(res, 404, { error: 'Sitzung nicht gefunden.' });
      const patch = JSON.parse((await readBody(req)).toString('utf8'));
      if (Array.isArray(patch.messages)) session.messages = patch.messages.slice(-500);
      if (typeof patch.title === 'string') session.title = patch.title.slice(0, 120);
      session.updatedAt = new Date().toISOString(); await persist(); return json(res, 200, session);
    }
    if (req.method === 'POST' && url.pathname === '/api/chat') {
      if (!hermesBase || !hermesApiKey) return json(res, 503, { error: 'Hermes ist noch nicht vollständig konfiguriert. Setze HERMES_BASE_URL und HERMES_API_KEY am Server.' });
      const input = JSON.parse((await readBody(req)).toString('utf8'));
      if (!input.sessionId || !Array.isArray(input.messages)) return json(res, 400, { error: 'sessionId und messages sind erforderlich.' });
      const controller = new AbortController();
      const cancel = () => controller.abort();
      req.on('aborted', cancel); res.on('close', () => { if (!res.writableEnded) cancel(); });
      let useRunStop = false;
      if (!hermesFeatures || Date.now() - featuresCheckedAt > 60_000) {
        try {
          const response = await fetch(`${hermesBase}/v1/capabilities`, { headers: hermesHeaders(), signal: AbortSignal.timeout(2500) });
          if (response.ok) { const payload = await response.json(); hermesFeatures = payload.features || {}; featuresCheckedAt = Date.now(); }
          else hermesFeatures = {};
        } catch { hermesFeatures = {}; }
      }
      useRunStop = hermesFeatures?.run_submission === true && hermesFeatures?.run_events_sse === true && hermesFeatures?.run_stop === true;
      if (useRunStop) {
        let runId = '';
        let cancellationRequested = controller.signal.aborted;
        const stopRun = async () => {
          if (!runId || !cancellationRequested) return;
          try { await fetch(`${hermesBase}/v1/runs/${encodeURIComponent(runId)}/stop`, { method: 'POST', headers: hermesHeaders(), body: '{}', signal: AbortSignal.timeout(5000) }); }
          catch { /* Hermes may have finished just before the stop request arrived. */ }
        };
        controller.signal.addEventListener('abort', () => { cancellationRequested = true; void stopRun(); }, { once: true });
        const messages = input.messages;
        const lastUserIndex = messages.findLastIndex((message) => message.role === 'user');
        if (lastUserIndex < 0) return json(res, 400, { error: 'Mindestens eine Nutzernachricht ist erforderlich.' });
        const lastUser = messages[lastUserIndex];
        const idempotencyKey = String(input.requestId || crypto.randomUUID()).replace(/[^\x21-\x7e]/g, '').slice(0, 255) || crypto.randomUUID();
        const create = await fetch(`${hermesBase}/v1/runs`, {
          method: 'POST', headers: { ...hermesHeaders(), 'Content-Type': 'application/json', 'Idempotency-Key': `jarvis-${idempotencyKey}` },
          body: JSON.stringify({ input: lastUser.content, session_id: input.sessionId }),
        });
        if (!create.ok) {
          const detail = await create.text(); return json(res, create.status, { error: `Hermes konnte den Lauf nicht starten (HTTP ${create.status}).`, detail: detail.slice(0, 1500) });
        }
        const created = await create.json(); runId = created.run_id;
        if (!runId) return json(res, 502, { error: 'Hermes hat beim Laufstart keine run_id zurückgegeben.' });
        if (cancellationRequested) { await stopRun(); return; }
        const events = await fetch(`${hermesBase}/v1/runs/${encodeURIComponent(runId)}/events`, { headers: { ...hermesHeaders(), Accept: 'text/event-stream' }, signal: controller.signal });
        if (!events.ok || !events.body) { const detail = await events.text(); return json(res, events.status || 502, { error: 'Hermes-Liveereignisse konnten nicht gelesen werden.', detail: detail.slice(0, 1000) }); }
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        const reader = events.body.getReader(); const decoder = new TextDecoder(); let buffer = ''; let sentText = false; let terminal = false;
        try {
          while (!terminal) {
            const { value, done } = await reader.read(); buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
            const frames = buffer.split(/\r?\n\r?\n/); buffer = frames.pop() || '';
            for (const frame of frames) {
              const eventName = frame.match(/^event:\s*(.+)$/m)?.[1]?.trim() || '';
              const payloadLine = frame.split(/\r?\n/).find((line) => line.startsWith('data:'));
              if (!payloadLine) continue;
              const raw = payloadLine.slice(5).trim(); if (!raw || raw === '[DONE]') continue;
              let payload; try { payload = JSON.parse(raw); } catch { continue; }
              const kind = eventName || payload.event || payload.type || '';
              const delta = kind === 'message.delta' ? (payload.text ?? payload.delta ?? payload.content ?? '') : '';
              if (typeof delta === 'string' && delta && !controller.signal.aborted && !res.destroyed) {
                sentText = true;
                res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: delta } }] })}\n\n`);
              }
              if (kind === 'run.completed') {
                const output = payload.output;
                if (!sentText && typeof output === 'string' && output) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: output } }] })}\n\n`);
                terminal = true;
              }
              if (kind === 'run.failed' || kind === 'run.interrupted') {
                res.write(`data: ${JSON.stringify({ error: payload.error || 'Hermes-Lauf wurde nicht abgeschlossen.' })}\n\n`); terminal = true;
              }
              if (kind === 'run.cancelled') terminal = true;
            }
            if (done) break;
          }
        } catch (error) { if (!controller.signal.aborted) throw error; }
        finally {
          reader.releaseLock();
          if (controller.signal.aborted) { cancellationRequested = true; await stopRun(); }
          if (!controller.signal.aborted && !res.destroyed) res.write('data: [DONE]\n\n');
          if (!res.writableEnded && !res.destroyed) res.end();
        }
        return;
      }
      const headers = { ...hermesHeaders(), 'Content-Type': 'application/json', Accept: 'text/event-stream', 'X-Hermes-Session-Id': input.sessionId };
      const upstream = await fetch(`${hermesBase}/v1/chat/completions`, {
        method: 'POST', headers, signal: controller.signal,
        body: JSON.stringify({ model: process.env.HERMES_MODEL || 'hermes-agent', messages: input.messages, stream: true }),
      });
      if (!upstream.ok) {
        const detail = await upstream.text();
        return json(res, upstream.status, { error: `Hermes antwortet mit HTTP ${upstream.status}.`, detail: detail.slice(0, 2000) });
      }
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      if (!upstream.body) { res.end(); return; }
      const reader = upstream.body.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read(); if (done) break;
          if (res.destroyed || controller.signal.aborted) break;
          if (!res.write(Buffer.from(value))) await new Promise((resolve) => res.once('drain', resolve));
        }
      } catch (error) { if (!controller.signal.aborted) throw error; }
      finally { reader.releaseLock(); if (!res.writableEnded && !res.destroyed) res.end(); }
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/voice/transcribe') {
      if (!(whisperPath && whisperModel)) return json(res, 503, { error: 'Lokale Spracherkennung ist nicht eingerichtet.' });
      const audio = await readBody(req, 24 * 1024 * 1024);
      if (!audio.length) return json(res, 400, { error: 'Keine Audiodaten empfangen.' });
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jarvis-audio-'));
      const inputPath = path.join(tempDir, 'turn.webm'); const wavPath = path.join(tempDir, 'turn.wav');
      try {
        await fs.writeFile(inputPath, audio);
        const convert = await run(ffmpegPath, ['-y', '-i', inputPath, '-ar', '16000', '-ac', '1', wavPath]);
        if (convert.code !== 0) return json(res, 422, { error: 'Audio konnte nicht konvertiert werden. Prüfe ffmpeg und den Browser-Audio-Codec.', detail: convert.stderr.slice(-1000) });
        const result = await run(whisperPath, ['-m', whisperModel, '-f', wavPath, '-l', 'de', '-nt', '--no-gpu']);
        if (result.code !== 0) return json(res, 502, { error: 'Whisper.cpp konnte die Aufnahme nicht transkribieren.', detail: result.stderr.slice(-1000) });
        return json(res, 200, { text: result.stdout.trim() });
      } finally { await fs.rm(tempDir, { recursive: true, force: true }); }
    }
    if (req.method === 'GET' && url.pathname === '/') {
      const html = await fs.readFile(path.join(publicDir, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(html);
    }
    if (req.method === 'GET' && url.pathname.startsWith('/assets/')) {
      const name = path.basename(url.pathname.slice('/assets/'.length));
      const file = path.join(publicDir, name);
      try { const content = await fs.readFile(file); const types = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' }; res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); return res.end(content); }
      catch { return json(res, 404, { error: 'Datei nicht gefunden.' }); }
    }
    return json(res, 404, { error: 'Endpunkt nicht gefunden.' });
  } catch (error) {
    if (error.name === 'AbortError') return;
    if (res.headersSent) { if (!res.destroyed) res.end(); return; }
    console.error('Request failed:', error.message);
    return json(res, error.status || 500, { error: error.status ? error.message : 'Interner Serverfehler.' });
  }
});

function hermesHeaders() {
  const headers = { 'X-Hermes-Session-Key': process.env.HERMES_SESSION_KEY || 'jarvis:main' };
  if (hermesApiKey) headers.Authorization = `Bearer ${hermesApiKey}`;
  return headers;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true }); let stdout = ''; let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout = (stdout + chunk).slice(-20000); });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr = (stderr + chunk).slice(-4000); });
    child.on('error', reject); child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

server.listen(port, host, () => console.log(`J.A.R.V.I.S. listening on ${host}:${port}; data: ${dataDir}`));
