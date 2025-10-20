#!/usr/bin/env bash
set -euo pipefail

# Start local keylog server (bind to 127.0.0.1 only)
# Use nice & nohup to disown but keep logs in /tmp
if command -v node >/dev/null 2>&1; then
  if [ -f /usr/local/bin/keylog_server.js ]; then
    echo "[startup-wrapper] launching keylog_server.js on 127.0.0.1:3000 -> /tmp/keystrokes.txt"
    nohup node /usr/local/bin/keylog_server.js > /tmp/keylog_server.out 2>&1 &
    # small sleep to give server time to bind
    sleep 0.3
  else
    echo "[startup-wrapper] keylog_server.js not found, skipping"
  fi
else
  echo "[startup-wrapper] node not found, skipping keylog server"
fi

# Exec the original container startup (same behaviour as original image)
# The base image normally execs /dockerstartup/vnc_startup.sh /dockerstartup/kasm_startup.sh --wait
# Try to exec the same if it exists, fallback to /dockerstartup/kasm_startup.sh if needed
if [ -x /dockerstartup/vnc_startup.sh ]; then
  echo "[startup-wrapper] execing /dockerstartup/vnc_startup.sh /dockerstartup/kasm_startup.sh --wait"
  exec /dockerstartup/vnc_startup.sh /dockerstartup/kasm_startup.sh --wait
elif [ -x /dockerstartup/kasm_startup.sh ]; then
  echo "[startup-wrapper] execing /dockerstartup/kasm_startup.sh --wait"
  exec /dockerstartup/kasm_startup.sh --wait
else
  echo "[startup-wrapper] default startup not found, sleeping to keep container alive"
  tail -f /dev/null
fi
