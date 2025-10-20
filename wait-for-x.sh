#!/usr/bin/env bash
set -euo pipefail

# Attend que le DISPLAY soit prêt (Xvnc :1) avant de lancer le script donné
TRIES=60
SLEEP=0.5
i=0
export DISPLAY="${DISPLAY:-:1}"
export XAUTHORITY="${XAUTHORITY:-/home/kasm-user/.Xauthority}"

while ! xset -q >/dev/null 2>&1; do
  i=$((i+1))
  if [ "$i" -ge "$TRIES" ]; then
    echo "[wait-for-x] X not ready after $((TRIES*SLEEP))s" >&2
    break
  fi
  sleep "$SLEEP"
done

exec "$@"
