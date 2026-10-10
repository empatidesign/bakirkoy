#!/usr/bin/env bash
set -euo pipefail

API_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT=5207
LOG="${API_LOG:-/private/tmp/api.log}"

if [ -x /opt/homebrew/bin/dotnet ]; then
  export PATH="/opt/homebrew/bin:$PATH"
fi

pids="$(lsof -ti tcp:$PORT -sTCP:LISTEN 2>/dev/null || true)"
pids="$pids $(pgrep -f 'Nexora.Api' 2>/dev/null || true)"
for pid in $pids; do kill "$pid" 2>/dev/null || true; done
for _ in $(seq 1 20); do
  lsof -ti tcp:$PORT -sTCP:LISTEN >/dev/null 2>&1 || break
  sleep 0.5
done

cd "$API_DIR"
dotnet build src/Nexora.Api --no-incremental -nologo -v q

nohup dotnet run --no-build --project src/Nexora.Api >"$LOG" 2>&1 &
echo "API başlatıldı (pid $!), log: $LOG"

for _ in $(seq 1 60); do
  if curl -fs "http://localhost:$PORT/health" >/dev/null 2>&1; then
    echo "API hazır: http://0.0.0.0:$PORT"
    exit 0
  fi
  sleep 1
done
echo "API 60 sn içinde ayağa kalkmadı, log:" >&2
tail -40 "$LOG" >&2
exit 1
