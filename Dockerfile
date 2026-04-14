FROM kasmweb/chrome:1.17.0

USER root

# Install Node.js 20 cleanly
RUN apt-get update && apt-get install -y curl ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install libnss3-tools for mkcert
RUN apt-get install -y libnss3-tools 
# Copy certificates for the takeover server
COPY certs /usr/local/share/takeover-certs
RUN chmod -R 755 /usr/local/share/takeover-certs

# ===============================
# TRUST mkcert CA (IMPORTANT)
# ===============================

# Add CA to the system trust store
RUN cp /usr/local/share/takeover-certs/rootCA.pem /usr/local/share/ca-certificates/mkcert-rootCA.crt \
    && update-ca-certificates

# Create NSS DB for Chrome
RUN mkdir -p /home/kasm-user/.pki/nssdb \
    && certutil -N --empty-password -d sql:/home/kasm-user/.pki/nssdb

# Import the CA into Chrome
RUN certutil -A -d sql:/home/kasm-user/.pki/nssdb \
    -n "mkcert root CA" \
    -t "C,," \
    -i /usr/local/share/ca-certificates/mkcert-rootCA.crt

# Permissions
RUN chown -R kasm-user:kasm-user /home/kasm-user/.pki


# Takeover server
COPY takeover.js /usr/local/bin/takeover.js
RUN chmod +x /usr/local/bin/takeover.js
WORKDIR /usr/local/bin
RUN npm install chrome-remote-interface express

# Custom noVNC page
COPY index.html /usr/share/kasmvnc/www/index.html

# Bot logic
COPY bot.js /usr/local/bin/bot.js

# Pages for takeover
COPY pages /usr/share/kasmvnc/www/pages

# Startup wrapper script
COPY startup-wrapper.sh /usr/local/bin/startup-wrapper.sh
RUN chmod +x /usr/local/bin/startup-wrapper.sh

# Disable basic auth and add custom certificates
RUN sed -i 's|\bvncserver\b|vncserver -disableBasicAuth -cert /usr/local/share/takeover-certs/cert.pem -key /usr/local/share/takeover-certs/key.pem -sslOnly|g' /dockerstartup/vnc_startup.sh

# Permissions
RUN chown -R kasm-user:kasm-user /usr/share/kasmvnc/www

EXPOSE 6901 4000

USER 1000

ENTRYPOINT ["/usr/local/bin/startup-wrapper.sh"]
