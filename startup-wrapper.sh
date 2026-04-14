#!/usr/bin/env bash
set -euo pipefail

echo "[startup] starting takeover service"
# Run takeover in background so startup can continue.
node /usr/local/bin/takeover.js &
# Keep takeover PID available for potential future supervision.
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

# Poll until the X display used by Kasm is reachable.
until xdpyinfo -display :1 >/dev/null 2>&1; do
  sleep 0.5
done

echo "[startup-wrapper] X server ready"

# ===============================
# KEEP PROCESS ALIVE
# ===============================

# Block on Kasm so container exits if the main session ends.
wait $KASM_PID
