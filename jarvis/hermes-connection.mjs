export function normalizeHermesBase(value) {
  return String(value || '').trim().replace(/\/+$/, '').replace(/\/v1$/i, '');
}

export async function probeHermes(base, key, { fetchImpl = fetch, timeoutMs = 5000 } = {}) {
  const fail = (code, error) => ({ ok: false, code, error });
  if (!base) return fail('missing_url', 'Hermes-Adresse fehlt. Bitte hermes_base_url in der JARVIS-Add-on-Konfiguration setzen.');
  if (!key) return fail('missing_key', 'Hermes-Schlüssel fehlt. hermes_api_key muss dem api_server_key von Hermes entsprechen.');
  try {
    const url = new URL(base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
  } catch { return fail('invalid_url', 'Ungültige Hermes-Adresse. Eine http://- oder https://-Basisadresse des API-Servers eintragen.'); }
  try {
    // Verify the authenticated API, not a public web UI health endpoint.
    const response = await fetchImpl(`${base}/v1/models`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs), redirect: 'error',
    });
    if ([401, 403].includes(response.status)) return fail('auth_failed', 'Hermes lehnt den API-Schlüssel ab. hermes_api_key und Hermes api_server_key müssen übereinstimmen.');
    if ([404, 405].includes(response.status)) return fail('wrong_endpoint', 'Hermes-API nicht gefunden. Den API-Port 8642 verwenden, nicht den WebUI-Port oder eine HA-Ingress-Adresse.');
    if (!response.ok) return fail('http_error', `Hermes-API antwortet mit HTTP ${response.status}. Bitte das Hermes-Protokoll prüfen.`);
    let payload;
    try { payload = await response.json(); } catch { return fail('invalid_response', 'Die Adresse liefert keine Hermes-API. Bitte Adresse und API-Port prüfen (intern 8642).'); }
    if (!Array.isArray(payload?.data)) return fail('invalid_response', 'Die Antwort entspricht keiner OpenAI-kompatiblen Modellliste. Bitte die Hermes-API-Adresse prüfen.');
    return { ok: true, status: 'ok' };
  } catch (error) {
    const code = error.cause?.code || error.code;
    if (['TimeoutError', 'AbortError'].includes(error.name) || ['ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT'].includes(code)) return fail('timeout', 'Hermes antwortet nicht rechtzeitig. API-Server, Adresse und Port prüfen.');
    if (['ENOTFOUND', 'EAI_AGAIN'].includes(code)) return fail('dns_failed', 'Hermes-Hostname kann nicht aufgelöst werden. Den tatsächlichen HA-internen Add-on-DNS-Namen oder die HA-IP mit veröffentlichtem API-Port verwenden.');
    if (code === 'ECONNREFUSED') return fail('connection_refused', 'Auf diesem Port nimmt kein Hermes-API-Server die Verbindung an. Adresse und Port prüfen; Hermes muss mit aktivierter API laufen.');
    return fail('network_error', 'Verbindung zur Hermes-API fehlgeschlagen. Adresse, Port und bei HTTPS das Zertifikat prüfen.');
  }
}
