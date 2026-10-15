// Supervisor ingress has a dedicated listener; never trust forwarded IP headers.
export function isSupervisor(req) {
  return ['172.30.32.2', '::ffff:172.30.32.2'].includes(req.socket.remoteAddress);
}

export function renderIndex(html, req) {
  const prefix = req.jarvisIngress ? req.headers['x-ingress-path'] : '';
  const base = typeof prefix === 'string' && /^\/(?!\/)[a-zA-Z0-9_/-]+$/.test(prefix)
    ? `${prefix.replace(/\/+$/, '')}/` : '/';
  return html.replace('<base href="./">', `<base href="${base}">`);
}
