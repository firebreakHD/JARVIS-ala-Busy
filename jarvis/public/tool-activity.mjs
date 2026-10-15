import { updateActivities } from './tool-events.mjs';

export function createToolActivity() {
  const panel = document.querySelector('#tool-activity');
  const list = document.querySelector('#tool-activity-list');
  const status = document.querySelector('#tool-activity-status');
  const toggle = document.querySelector('#activity-toggle');
  let items = [], timer;
  const labels = { running: 'Läuft', done: 'Abgeschlossen', failed: 'Fehlgeschlagen', stopped: 'Unterbrochen', ended: 'Ausgabe beendet · Ergebnis nicht gemeldet' };
  function clearTimer() { clearTimeout(timer); }
  function hideLater() { clearTimer(); timer = setTimeout(() => { panel.hidden = true; render(); }, 8000); }
  function render() {
    list.replaceChildren();
    for (const item of items) {
      const card = document.createElement('article'); card.className = `tool-card ${item.status}`;
      const icon = document.createElement('span'); icon.className = 'tool-icon'; icon.setAttribute('aria-hidden', 'true');
      icon.textContent = item.status === 'running' ? '◌' : item.status === 'done' ? '✓' : item.status === 'failed' ? '!' : '■';
      const body = document.createElement('div');
      const name = document.createElement('strong'); name.textContent = item.name;
      const state = document.createElement('span'); state.textContent = labels[item.status];
      body.append(name, state); card.append(icon, body); list.append(card);
    }
    const running = items.filter((item) => item.status === 'running').length;
    status.textContent = running ? `${running} aktiv` : 'Letzte Aktivitäten';
    toggle.hidden = items.length === 0;
    toggle.textContent = running ? `Tools · ${running}` : 'Aktivität';
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
    list.scrollTop = list.scrollHeight;
  }
  toggle.addEventListener('click', () => { clearTimer(); panel.hidden = !panel.hidden; render(); });
  document.querySelector('#activity-close').addEventListener('click', () => { panel.hidden = true; render(); });
  panel.addEventListener('mouseenter', clearTimer);
  panel.addEventListener('focusin', clearTimer);
  panel.addEventListener('focusout', () => { if (!panel.contains(document.activeElement) && !items.some((item) => item.status === 'running')) hideLater(); });
  panel.addEventListener('mouseleave', () => { if (!items.some((item) => item.status === 'running')) hideLater(); });
  return {
    reset() { clearTimer(); items = []; panel.hidden = true; render(); },
    event(event) {
      clearTimer(); items = updateActivities(items, event); panel.hidden = false; render();
      if (!items.some((item) => item.status === 'running')) hideLater();
    },
    finish(interrupted = false) {
      items = items.map((item) => item.status === 'running' ? { ...item, status: interrupted ? 'stopped' : 'ended' } : item);
      render(); if (items.length) hideLater();
    },
  };
}
