export function parseSseFrame(frame) {
  const lines = frame.split(/\r?\n/);
  return {
    name: lines.find((line) => line.startsWith('event:'))?.slice(6).trim() || '',
    data: lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).replace(/^ /, '')).join('\n'),
  };
}

// Only forward tool identity and lifecycle. Raw arguments/results can contain secrets.
export function normalizeToolEvent(kind, payload = {}) {
  if (!payload || typeof payload !== 'object') return null;
  let status;
  if (['tool.started', 'tool.start'].includes(kind)) status = 'running';
  else if (['tool.completed', 'tool.complete'].includes(kind)) status = payload.error || payload.is_error ? 'failed' : 'done';
  else if (kind === 'tool.failed') status = 'failed';
  else if (kind === 'jarvis.tool') status = payload.status;
  else if (kind === 'hermes.tool.progress') status = 'running';
  else return null;
  if (!['running', 'done', 'failed'].includes(status)) return null;
  const name = payload.tool || payload.tool_name || payload.name;
  if (typeof name !== 'string' || !name.trim() || name === '_thinking') return null;
  const id = payload.tool_id || payload.call_id;
  return { name: name.trim().slice(0, 100), status, ...(typeof id === 'string' ? { id: id.slice(0, 150) } : {}) };
}

export function updateActivities(items, event) {
  const next = items.map((item) => ({ ...item }));
  const known = event.id ? next.findIndex((item) => item.id === event.id) : -1;
  if (known >= 0) {
    if (event.status !== 'running') next[known] = { ...next[known], ...event };
    return next;
  }
  if (event.status === 'running') {
    next.push({ ...event });
  } else {
    const index = next.findIndex((item) => item.status === 'running' && (event.id ? item.id === event.id : item.name === event.name));
    if (index < 0) next.push({ ...event });
    else next[index] = { ...next[index], ...event };
  }
  // Retain all active calls; only prune older completed entries.
  while (next.length > 12) {
    const index = next.findIndex((item) => item.status !== 'running');
    if (index < 0) break;
    next.splice(index, 1);
  }
  return next;
}
