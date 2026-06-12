#!/usr/bin/env bash
set -euo pipefail
cd /app

log() {
  # shellcheck disable=SC2068
  node var/docker/container-supervisor-log.cjs "$@" || true
}

log supervisor.start info "hootnshoot container supervisor starting"

(
  while sleep 90; do
    log supervisor.memory info "cgroup memory snapshot (periodic)"
  done
) &
WATCH_PID=$!

cleanup() {
  kill "${WATCH_PID}" 2>/dev/null || true
}
trap cleanup EXIT

on_term() {
  log supervisor.signal warn "received SIGTERM or SIGINT — container stopping"
  cleanup || true
  exit 143
}
trap on_term TERM INT

if ! nginx; then
  log supervisor.nginx.error error "nginx failed to start"
  exit 1
fi

set +e
pnpm run pm2
code=$?
set -e

if [ "$code" -eq 0 ]; then
  log supervisor.pm2_finished info "pnpm run pm2 exited" "{\"exit_code\":${code}}"
else
  log supervisor.pm2_finished error "pnpm run pm2 exited" "{\"exit_code\":${code}}"
fi

exit "$code"
