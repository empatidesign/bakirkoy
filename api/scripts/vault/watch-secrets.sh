#!/bin/sh
# Docker daemon restarts do not rerun completed Compose init services.
# Restore the local dev Vault after it loses its in-memory data.
set -eu

ready() {
  for category in database main external; do
    vault kv get "secret/nexora/api/production/production/$category" >/dev/null 2>&1 || return 1
  done
}

if [ "${1:-}" = "--check" ]; then
  ready
  exit $?
fi

trap 'exit 0' TERM INT
while :; do
  if vault status >/dev/null 2>&1 && ! ready; then
    sh /seed/seed-secrets.sh || echo '[vault-seed] Restore failed; retrying.' >&2
  fi
  sleep 5 &
  wait $!
done
