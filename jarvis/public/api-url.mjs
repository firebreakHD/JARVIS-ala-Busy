// Keep every request under the document base supplied by the HA ingress proxy.
export function apiUrl(route, base = document.baseURI) {
  return new URL(route.replace(/^\/+/, ''), base).href;
}
