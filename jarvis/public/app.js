import { apiUrl } from './api-url.mjs';
import { parseSseFrame, normalizeToolEvent } from './tool-events.mjs';
import { createToolActivity } from './tool-activity.mjs';

const activity = createToolActivity();

const $ = (selector) => document.querySelector(selector);
const ui = {
  sessions: $('#session-list'), messages: $('#messages'), welcome: $('#welcome'), scroll: $('#chat-scroll'),
  input: $('#message-input'), form: $('#composer'), send: $('#send-button'), stopGeneration: $('#stop-generation'),
  stopAudio: $('#stop-audio'), ttsEnabled: $('#tts-enabled'), ttsVolume: $('#tts-volume'), volumeValue: $('#volume-value'),
  voiceSelect: $('#tts-voice'), toast: $('#toast'), connectionDot: $('#connection-dot'), connectionLabel: $('#connection-label'),
  voiceSetup: $('#voice-setup'), voiceBanner: $('#voice-banner'), voiceStatus: $('#voice-status'),
};
let currentSession = null;
let activeRequest = null;
let generation = 0;
let toastTimer;
let voiceMode = false;
let micMuted = false;
let mediaStream = null;
let audioContext = null;
let recorder = null;
let recordedChunks = [];
let hasVoice = false;
let lastLoudAt = 0;
let voiceStartedAt = 0;
let speechBuffer = '';
let speechActive = false;
let ttsUnavailableNotified = false;
let vadLoop = 0;
let cfg = {};
let sessionSaveQueue = Promise.resolve();

const prefs = {
  get(key, fallback) { try { const value = localStorage.getItem(`jarvis.${key}`); return value === null ? fallback : value; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(`jarvis.${key}`, value); } catch { /* Private browsing can disable storage. */ } },
};

function notify(message) {
  ui.toast.textContent = message; ui.toast.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 3600);
}
function setConnection(online, label) {
  ui.connectionDot.className = `status-dot ${online ? 'online' : 'offline'}`;
  ui.connectionLabel.textContent = label;
}
function stopAudio() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  speechBuffer = ''; speechActive = false;
  ui.stopAudio.classList.remove('is-active');
}
function interruptGeneration() {
  activity.finish(true);
  generation++;
  if (activeRequest) { activeRequest.abort(); activeRequest = null; }
  ui.stopGeneration.hidden = true;
  const pending = currentSession?.messages?.findLast?.((message) => message.role === 'assistant' && message.pending);
  if (pending) {
    pending.pending = false; pending.interrupted = true;
    const pendingIndex = currentSession.messages.indexOf(pending);
    const interruptedUser = currentSession.messages.slice(0, pendingIndex).findLast?.((message) => message.role === 'user');
    if (interruptedUser) interruptedUser.interrupted = true;
    if (!pending.content) currentSession.messages.splice(currentSession.messages.indexOf(pending), 1);
    renderMessages(); saveSession();
  }
}
function stopEverything() { stopAudio(); interruptGeneration(); }
function appendMessage(role, content = '', extras = {}) {
  const message = { role, content, ...extras };
  currentSession.messages.push(message); renderMessages(); return message;
}
function renderMessages() {
  const messages = currentSession?.messages || [];
  ui.welcome.hidden = messages.length > 0;
  ui.messages.replaceChildren();
  for (const message of messages) {
    const item = document.createElement('article'); item.className = `message ${message.role}${message.pending ? ' pending' : ''}${message.error ? ' error' : ''}`;
    const avatar = document.createElement('div'); avatar.className = 'message-avatar'; avatar.textContent = message.role === 'user' ? 'DU' : 'J';
    const body = document.createElement('div'); body.className = 'message-content';
    const label = document.createElement('span'); label.className = 'message-label'; label.textContent = message.role === 'user' ? 'DU' : 'J.A.R.V.I.S.';
    const text = document.createElement('div'); text.textContent = message.content || (message.pending ? 'Denke nach…' : '');
    body.append(label, text);
    if (message.interrupted) { const interrupted = document.createElement('span'); interrupted.className = 'message-label'; interrupted.textContent = 'AUSGABE UNTERBROCHEN'; interrupted.style.marginTop = '8px'; body.append(interrupted); }
    if (message.role === 'assistant' && message.content && !message.pending) {
      const actions = document.createElement('div'); actions.className = 'message-actions';
      const copy = document.createElement('button'); copy.textContent = 'Antwort kopieren'; copy.addEventListener('click', () => navigator.clipboard?.writeText(message.content).then(() => notify('Antwort kopiert.')).catch(() => notify('Kopieren ist in diesem Browser nicht verfügbar.')));
      const speak = document.createElement('button'); speak.textContent = 'Vorlesen'; speak.addEventListener('click', () => speakWhole(message.content)); actions.append(copy, speak); body.append(actions);
    }
    item.append(avatar, body); ui.messages.append(item);
  }
  requestAnimationFrame(() => { ui.scroll.scrollTop = ui.scroll.scrollHeight; });
}
async function api(url, options = {}) {
  const response = await fetch(apiUrl(url), { ...options, headers: { ...(options.body instanceof Blob ? {} : { 'Content-Type': 'application/json' }), ...options.headers } });
  if (!response.ok) { let data = {}; try { data = await response.json(); } catch {} throw new Error(data.error || `Serverfehler (${response.status}).`); }
  return response.status === 204 ? null : response.json();
}
async function saveSession() {
  if (!currentSession) return;
  const snapshot = { id: currentSession.id, title: currentSession.title, messages: structuredClone(currentSession.messages) };
  prefs.set('session', snapshot.id);
  sessionSaveQueue = sessionSaveQueue.catch(() => {}).then(() => api(`/api/sessions/${snapshot.id}`, { method: 'PATCH', body: JSON.stringify({ title: snapshot.title, messages: snapshot.messages }) }));
  try { await sessionSaveQueue; }
  catch (error) { console.warn('Session konnte nicht gespeichert werden:', error); }
  refreshSessions();
}
async function refreshSessions() {
  try {
    const sessions = await api('/api/sessions'); ui.sessions.replaceChildren();
    for (const session of sessions) {
      const button = document.createElement('button'); button.className = `session-item${currentSession?.id === session.id ? ' active' : ''}`; button.textContent = session.title || 'Neuer Chat'; button.title = session.title;
      button.addEventListener('click', () => openSession(session.id)); ui.sessions.append(button);
    }
  } catch { /* The status check provides the user-facing connection state. */ }
}
async function createSession() {
  stopEverything();
  activity.reset();
  currentSession = await api('/api/sessions', { method: 'POST', body: '{}' });
  renderMessages(); await refreshSessions(); ui.input.focus();
}
async function openSession(id) {
  try {
    stopEverything(); activity.reset(); currentSession = await api(`/api/sessions/${id}`); prefs.set('session', currentSession.id); renderMessages(); await refreshSessions();
    $('#sidebar').classList.remove('open');
  } catch (error) { notify(error.message); }
}
async function checkStatus() {
  const detail = $('#connection-error');
  detail.hidden = true;
  const showError = (text) => { detail.textContent = text; detail.hidden = false; };
  try {
    cfg = await api('/api/config');
    if (!cfg.hermesConfigured) {
      setConnection(false, 'Hermes konfigurieren');
      showError(!cfg.hermesBaseConfigured ? 'Bitte hermes_base_url in der JARVIS-Add-on-Konfiguration setzen: Adresse des Hermes-API-Servers (interner Port 8642).' : 'Bitte hermes_api_key in der JARVIS-Add-on-Konfiguration setzen: denselben Wert wie api_server_key bei Hermes.');
    }
    else {
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(apiUrl('/api/hermes-health'), { signal: controller.signal });
        const result = await response.json();
        setConnection(response.ok, response.ok ? 'Hermes verbunden' : 'Hermes nicht erreichbar');
        if (!response.ok) showError(result.error || 'Hermes-Prüfung fehlgeschlagen.');
      } catch { setConnection(false, 'Hermes-Prüfung fehlgeschlagen'); showError('Die Verbindungsprüfung wurde unterbrochen. Mit ↻ erneut prüfen; bei erneutem Fehler das JARVIS-Protokoll prüfen.'); }
      finally { clearTimeout(timeout); }
    }
    ui.voiceSetup.hidden = true;
    if (voiceMode && !cfg.localSttConfigured) endVoiceMode(false);
    if (!cfg.localSttConfigured) $('#start-voice').title = cfg.localSttReason;
  } catch { setConnection(false, 'J.A.R.V.I.S. nicht erreichbar'); }
}

function availableLocalVoices() {
  if (!('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices().filter((voice) => voice.localService && /^de(?:-|$)/i.test(voice.lang));
}
function loadVoices() {
  const voices = availableLocalVoices(); const wanted = prefs.get('voice', '');
  ui.voiceSelect.replaceChildren();
  const first = document.createElement('option'); first.value = ''; first.textContent = voices.length ? 'Automatisch (Deutsch)' : 'Keine lokale deutsche Stimme'; ui.voiceSelect.append(first);
  for (const voice of voices) { const option = document.createElement('option'); option.value = voice.name; option.textContent = `${voice.name} · ${voice.lang}`; ui.voiceSelect.append(option); }
  if (voices.some((voice) => voice.name === wanted)) ui.voiceSelect.value = wanted;
}
function selectedVoice() { return availableLocalVoices().find((voice) => voice.name === ui.voiceSelect.value) || availableLocalVoices()[0] || null; }
function queueSpeech(text) {
  if (!ui.ttsEnabled.checked || !text.trim() || !('speechSynthesis' in window)) return;
  speechBuffer += text;
  const boundary = /[.!?…](?:[”»"')\]]*)\s+/g;
  let match; let end = 0;
  while ((match = boundary.exec(speechBuffer))) {
    const part = speechBuffer.slice(end, match.index + match[0].length).trim();
    if (part) enqueueUtterance(part);
    end = match.index + match[0].length;
  }
  if (end) speechBuffer = speechBuffer.slice(end);
}
function enqueueUtterance(text) {
  const voice = selectedVoice();
  if (!voice) {
    if (!ttsUnavailableNotified) { notify('Für TTS ist eine lokale deutsche Stimme auf diesem Gerät nötig.'); ttsUnavailableNotified = true; }
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice; utterance.lang = voice.lang;
  utterance.volume = Number(ui.ttsVolume.value); utterance.rate = 1.0; utterance.pitch = 1.0;
  utterance.onstart = () => { speechActive = true; ui.stopAudio.classList.add('is-active'); if (voiceMode) ui.voiceStatus.textContent = 'J.A.R.V.I.S. spricht · sag einfach etwas zum Unterbrechen'; };
  utterance.onend = () => { if (!window.speechSynthesis.speaking && !speechBuffer) { speechActive = false; ui.stopAudio.classList.remove('is-active'); if (voiceMode) ui.voiceStatus.textContent = 'Ich höre zu'; } };
  window.speechSynthesis.speak(utterance);
}
function speakWhole(text) { stopAudio(); enqueueUtterance(text); }

async function sendMessage(text) {
  const prompt = text.trim(); if (!prompt) return;
  if (!currentSession) await createSession();
  stopAudio(); interruptGeneration();
  activity.reset();
  ui.voiceSetup.hidden = true;
  appendMessage('user', prompt);
  if (currentSession.messages.filter((message) => message.role === 'user').length === 1) {
    currentSession.title = prompt.length > 42 ? `${prompt.slice(0, 42).trim()}…` : prompt;
  }
  const assistant = appendMessage('assistant', '', { pending: true });
  const thisGeneration = generation; const controller = new AbortController(); activeRequest = controller; ui.stopGeneration.hidden = false;
  await saveSession();
  if (thisGeneration !== generation) return;
  const conversation = currentSession.messages.filter((message) => ['user', 'assistant'].includes(message.role) && !message.error && !message.interrupted).slice(0, -1).map(({ role, content }) => ({ role, content }));
  try {
    const requestId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const response = await fetch(apiUrl('/api/chat'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: currentSession.id, requestId, messages: conversation }), signal: controller.signal });
    if (!response.ok) { let detail = {}; try { detail = await response.json(); } catch {} throw new Error(detail.error || `Hermes-Anfrage fehlgeschlagen (${response.status}).`); }
    if (!response.body) throw new Error('Der Browser unterstützt den Antwortstream nicht.');
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''; let finished = false;
    while (!finished) {
      const { value, done } = await reader.read(); buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const parts = buffer.split(/\r?\n\r?\n/); buffer = parts.pop() || '';
      if (done && buffer.trim()) { parts.push(buffer); buffer = ''; }
      for (const part of parts) {
          if (thisGeneration !== generation) return;
          const frame = parseSseFrame(part);
          const data = frame.data.trim(); if (!data || data === '[DONE]') { finished ||= data === '[DONE]'; continue; }
          let event;
          try { event = JSON.parse(data); } catch { continue; }
          const tool = normalizeToolEvent(frame.name || event.event || event.type, event);
          if (tool) { activity.event(tool); continue; }
          if (event.error) throw new Error(event.error);
          const delta = event.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta) { if (thisGeneration !== generation) return; assistant.content += delta; queueSpeech(delta); renderMessages(); }
      }
      if (done) break;
    }
    if (thisGeneration !== generation) return;
    activity.finish();
    if (speechBuffer.trim()) { enqueueUtterance(speechBuffer.trim()); speechBuffer = ''; }
    assistant.pending = false; activeRequest = null; ui.stopGeneration.hidden = true; renderMessages(); await saveSession();
    if (!assistant.content) notify('Hermes hat eine leere Antwort gesendet.');
  } catch (error) {
    if (error.name === 'AbortError' || thisGeneration !== generation) return;
    activity.finish(true);
    assistant.pending = false; assistant.error = true; assistant.content = error.message; activeRequest = null; ui.stopGeneration.hidden = true;
    if (voiceMode) ui.voiceStatus.textContent = 'Verbindung unterbrochen · ich höre weiter zu';
    renderMessages(); await saveSession();
  }
}

async function startVoiceMode() {
  if (!cfg.localSttConfigured) { notify('Whisper.cpp und das lokale Sprachmodell sind noch nicht konfiguriert.'); return; }
  if (!window.isSecureContext && location.hostname !== 'localhost') { notify('Mikrofonzugriff benötigt HTTPS oder localhost.'); return; }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { notify('Dieser Browser unterstützt keine lokale Mikrofonaufnahme.'); return; }
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    audioContext = new AudioContext(); const source = audioContext.createMediaStreamSource(mediaStream); const analyser = audioContext.createAnalyser(); analyser.fftSize = 1024; source.connect(analyser);
    voiceMode = true; micMuted = false; ui.voiceSetup.hidden = true; ui.voiceBanner.hidden = false; ui.voiceStatus.textContent = 'Ich höre zu'; $('#mute-mic').textContent = 'Mikrofon stummschalten';
    ui.ttsEnabled.checked = true; prefs.set('tts-enabled', '1'); stopAudio();
    vadLoop = window.setInterval(() => detectVoice(analyser), 75);
  } catch (error) { notify(`Mikrofon konnte nicht gestartet werden: ${error.message}`); }
}
function detectVoice(analyser) {
  if (!voiceMode || micMuted) return;
  const data = new Uint8Array(analyser.fftSize); analyser.getByteTimeDomainData(data);
  let sum = 0; for (const sample of data) { const value = (sample - 128) / 128; sum += value * value; }
  const rms = Math.sqrt(sum / data.length); const now = Date.now();
  if (rms > 0.035) {
    lastLoudAt = now;
    if (speechActive) { stopAudio(); interruptGeneration(); ui.voiceStatus.textContent = 'Unterbrochen · ich höre zu'; }
    if (!recorder || recorder.state === 'inactive') beginRecording();
    if (!voiceStartedAt) voiceStartedAt = now;
  }
  if (recorder?.state === 'recording' && ((now - lastLoudAt > 950 && now - voiceStartedAt > 450) || now - voiceStartedAt > 18000)) finishRecording();
}
function beginRecording() {
  if (speechActive || !mediaStream || recorder?.state === 'recording') return;
  try {
    const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? { mimeType: 'audio/webm;codecs=opus' } : {};
    recorder = new MediaRecorder(mediaStream, options); recordedChunks = []; voiceStartedAt = Date.now(); lastLoudAt = Date.now();
    recorder.ondataavailable = (event) => { if (event.data.size) recordedChunks.push(event.data); };
    recorder.onstop = () => { const blob = new Blob(recordedChunks, { type: recorder.mimeType || 'audio/webm' }); if (blob.size > 1200) transcribe(blob); else ui.voiceStatus.textContent = 'Ich höre zu'; };
    recorder.start(250); ui.voiceStatus.textContent = 'Ich höre zu · Aufnahme läuft';
  } catch (error) { notify(`Aufnahme fehlgeschlagen: ${error.message}`); }
}
function finishRecording() {
  if (recorder?.state === 'recording') { recorder.stop(); recorder = null; }
  voiceStartedAt = 0; ui.voiceStatus.textContent = 'Sprache wird lokal erkannt…';
}
async function transcribe(blob) {
  try {
    const response = await fetch(apiUrl('/api/voice/transcribe'), { method: 'POST', headers: { 'Content-Type': blob.type || 'audio/webm' }, body: blob });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Spracherkennung fehlgeschlagen.');
    if (data.text?.trim()) { ui.input.value = data.text.trim(); ui.input.dispatchEvent(new Event('input')); ui.voiceStatus.textContent = 'Sende deine Nachricht…'; await sendMessage(data.text); }
    else ui.voiceStatus.textContent = 'Ich habe nichts verstanden · versuch es noch einmal';
  } catch (error) { ui.voiceStatus.textContent = 'Spracherkennung nicht verfügbar'; notify(error.message); }
}
function endVoiceMode(showSetup = true) {
  voiceMode = false; window.clearInterval(vadLoop); stopAudio();
  if (recorder?.state === 'recording') recorder.stop(); recorder = null;
  mediaStream?.getTracks().forEach((track) => track.stop()); mediaStream = null;
  audioContext?.close(); audioContext = null; ui.voiceBanner.hidden = true; ui.voiceSetup.hidden = !showSetup || !cfg.localSttConfigured;
}

ui.form.addEventListener('submit', (event) => { event.preventDefault(); const text = ui.input.value; ui.input.value = ''; ui.input.style.height = 'auto'; sendMessage(text); });
ui.input.addEventListener('input', () => { ui.input.style.height = 'auto'; ui.input.style.height = `${Math.min(ui.input.scrollHeight, 180)}px`; });
ui.input.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); ui.form.requestSubmit(); } });
$('#new-chat').addEventListener('click', createSession);
$('#stop-generation').addEventListener('click', () => { interruptGeneration(); notify('Laufende Hermes-Anfrage gestoppt.'); });
$('#stop-audio').addEventListener('click', stopAudio);
$('#settings-toggle').addEventListener('click', () => { const panel = $('#settings-panel'); panel.hidden = !panel.hidden; if (!panel.hidden) loadVoices(); });
ui.ttsEnabled.checked = prefs.get('tts-enabled', '1') === '1';
ui.ttsEnabled.addEventListener('change', () => { prefs.set('tts-enabled', ui.ttsEnabled.checked ? '1' : '0'); if (!ui.ttsEnabled.checked) stopAudio(); else if (!availableLocalVoices().length) notify('Auf diesem Gerät wurde keine lokale deutsche Stimme gefunden.'); });
ui.ttsVolume.value = prefs.get('volume', '0.85'); ui.volumeValue.value = `${Math.round(Number(ui.ttsVolume.value) * 100)} %`;
ui.ttsVolume.addEventListener('input', () => { ui.volumeValue.value = `${Math.round(Number(ui.ttsVolume.value) * 100)} %`; prefs.set('volume', ui.ttsVolume.value); });
ui.voiceSelect.addEventListener('change', () => prefs.set('voice', ui.voiceSelect.value));
if ('speechSynthesis' in window) { window.speechSynthesis.addEventListener('voiceschanged', loadVoices); loadVoices(); }
$('#chat-mode').addEventListener('click', () => { if (voiceMode) endVoiceMode(false); $('#chat-mode').classList.add('active'); $('#chat-mode').setAttribute('aria-selected', 'true'); $('#voice-mode').classList.remove('active'); $('#voice-mode').setAttribute('aria-selected', 'false'); });
$('#voice-mode').addEventListener('click', () => { $('#voice-mode').classList.add('active'); $('#voice-mode').setAttribute('aria-selected', 'true'); $('#chat-mode').classList.remove('active'); $('#chat-mode').setAttribute('aria-selected', 'false'); ui.voiceSetup.hidden = false; });
$('#start-voice').addEventListener('click', startVoiceMode);
$('#end-voice').addEventListener('click', () => { endVoiceMode(false); $('#chat-mode').click(); });
$('#mute-mic').addEventListener('click', () => { micMuted = !micMuted; $('#mute-mic').textContent = micMuted ? 'Mikrofon aktivieren' : 'Mikrofon stummschalten'; ui.voiceStatus.textContent = micMuted ? 'Mikrofon stumm' : 'Ich höre zu'; if (micMuted && recorder?.state === 'recording') finishRecording(); });
$('#menu-button').addEventListener('click', () => $('#sidebar').classList.add('open'));
$('#sidebar-close').addEventListener('click', () => $('#sidebar').classList.remove('open'));
$('#refresh-status').addEventListener('click', checkStatus);
document.querySelectorAll('.suggestions button').forEach((button) => button.addEventListener('click', () => { ui.input.value = button.dataset.prompt; ui.form.requestSubmit(); }));
document.addEventListener('keydown', (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); createSession(); } if (event.key === 'Escape') { $('#settings-panel').hidden = true; $('#sidebar').classList.remove('open'); } });

async function initializeApp() {
  await checkStatus();
  try {
    const sessions = await api('/api/sessions');
    const savedId = prefs.get('session', '');
    const initial = sessions.find((item) => item.id === savedId) || sessions[0];
    if (initial) { currentSession = await api(`/api/sessions/${initial.id}`); prefs.set('session', initial.id); }
    else { currentSession = await api('/api/sessions', { method: 'POST', body: '{}' }); prefs.set('session', currentSession.id); }
    renderMessages(); await refreshSessions();
  } catch (error) { setConnection(false, 'Lokaler Server nicht erreichbar'); notify(error.message); }
}
$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const password = $('#login-password').value; $('#login-error').textContent = '';
  try { await api('/api/login', { method: 'POST', body: JSON.stringify({ password }) }); $('#login-password').value = ''; $('#auth-screen').hidden = true; await initializeApp(); }
  catch (error) { $('#login-error').textContent = error.message; $('#login-password').focus(); }
});
$('#logout').addEventListener('click', async () => {
  stopEverything(); activity.reset(); endVoiceMode(false);
  try { await api('/api/logout', { method: 'POST', body: '{}' }); $('#auth-screen').hidden = false; $('#login-password').focus(); }
  catch (error) { notify(error.message); }
});
try {
  const auth = await api('/api/auth/status'); $('#logout').hidden = !auth.passwordRequired;
  if (auth.authenticated) await initializeApp();
  else {
    $('#auth-screen').hidden = false;
    if (auth.setupRequired) $('#login-error').textContent = 'Bitte zuerst access_password in der Home-Assistant-Add-on-Konfiguration setzen. Der HA-Seitenleistenzugriff funktioniert bereits ohne dieses Passwort.';
  }
} catch (error) { setConnection(false, 'Lokaler Server nicht erreichbar'); notify(error.message); }
