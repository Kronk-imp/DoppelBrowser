#!/usr/bin/env bash
set -e

# Source unique de vérité
URL_FILE="/etc/kiosk/url"
if [ -s "$URL_FILE" ]; then
  URL="$(head -n1 "$URL_FILE")"
else
  echo "[kiosk] URL non définie. Crée /etc/kiosk/url avec l'URL."
  exit 1
fi

PROFILE="/home/kasm-user/.chrome-kiosk"
export DISPLAY="${DISPLAY:-:1}"
export XAUTHORITY="${XAUTHORITY:-/home/kasm-user/.Xauthority}"

# 1) Tuer Chrome lancé par Kasm (deux binaires possibles)
pgrep -u kasm-user -fa "/opt/google/chrome/chrome" | awk '{print $1}' | xargs -r kill -9 || true
pgrep -u kasm-user -fa "/opt/google/chrome/google-chrome" | awk '{print $1}' | xargs -r kill -9 || true
sleep 0.5

# 2) Profil propre
mkdir -p "$PROFILE"
rm -f "$PROFILE"/Singleton* 2>/dev/null || true

# 3) Choix binaire
CHROME_BIN="/opt/google/chrome/google-chrome"
[ -x "$CHROME_BIN" ] || CHROME_BIN="/opt/google/chrome/chrome"

# 4) Lancer kiosk
su -s /bin/bash -c "$CHROME_BIN \
  --no-sandbox \
  --kiosk \"$URL\" \
  --new-window \
  --start-fullscreen \
  --incognito \
  --disable-restore-session-state \
  --disable-session-crashed-bubble \
  --disable-features=TranslateUI,ExtensionsToolbarMenu,PasswordManagerOnboarding,RestoreSession,SessionRestore \
  --no-first-run --no-default-browser-check \
  --user-data-dir=\"$PROFILE\" >/dev/null 2>&1 &" kasm-user

# 5) Forcer plein écran/focus
for i in $(seq 1 40); do
  WID=$(xdotool search --onlyvisible --class chrome | tail -n1 || true)
  if [ -n "$WID" ]; then
    xdotool windowactivate "$WID" key F11 || true
    wmctrl -ir "$WID" -b add,fullscreen || true
    break
  fi
  sleep 0.25
done
