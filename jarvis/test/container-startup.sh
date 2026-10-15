#!/usr/bin/env bash
set -euo pipefail

# Exercise the real image entrypoint: starting Node directly misses s6's env reset.
image=jarvis-startup-test
container=jarvis-startup-test
cleanup() {
  docker logs "$container" || true
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker build -t "$image" jarvis
docker run -d --name "$container" \
  -p 127.0.0.1:18787:8787 -p 127.0.0.1:18099:8099 "$image"

ready=false
for attempt in {1..30}; do
  if curl --fail --silent http://127.0.0.1:18787/api/auth/status > /dev/null; then
    ready=true
    break
  fi
  sleep 1
done
if [ "$ready" != true ]; then
  echo 'The direct listener did not become reachable.' >&2
  exit 1
fi

curl --fail --silent http://127.0.0.1:18787/ | python3 -c \
  'import sys; assert "<base href=\"/\">" in sys.stdin.read()'
curl --fail --silent http://127.0.0.1:18787/api/auth/status | python3 -c \
  'import json,sys; s=json.load(sys.stdin); assert s["setupRequired"] and not s["authenticated"]'
test "$(curl --silent -o /dev/null -w '%{http_code}' http://127.0.0.1:18787/api/sessions)" = 401
# Published test traffic is deliberately not Supervisor ingress: expect a live,
# protected listener (403), rather than an absent listener or an auth bypass.
test "$(curl --silent -o /dev/null -w '%{http_code}' http://127.0.0.1:18099/)" = 403
docker logs "$container" 2>&1 | python3 -c \
  'import sys; s=sys.stdin.read(); assert "0.0.0.0:8787; data: /data" in s and "ingress listening on 8099" in s'
echo 'Container startup, persistent data path, and both listeners verified.'
