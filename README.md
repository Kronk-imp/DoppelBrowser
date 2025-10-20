# DoppelBrowser — Browser-in-Browser Keylogging PoC (LAB USE ONLY)

## Legal Disclaimer & Intended Use

**This project is strictly intended for research, awareness, and laboratory use.**
- Never use this PoC on any system, organization, or user without their explicit consent.
- Any unauthorized or malicious use is illegal and entirely your responsibility.
- The author accepts no liability for misuse or for any illegal activity based on this code.

---

## About

**DoppelBrowser** is a personal research project demonstrating a modern **browser-in-browser** attack vector against Kasm/noVNC cloud desktop solutions.

This PoC shows that if an attacker can tamper with the infrastructure or Docker image, they can:
- Capture all keyboard input from the user's session (even in kiosk mode)
- Stealthily log keystrokes to `/tmp/keystrokes.txt` on the container, with no visible UI changes
- Achieve this by injecting a small JavaScript keylogger into the `index.html` served by KasmVNC, with events exfiltrated to a local Node.js server

Participations and improvements are welcome. See [Contributing](#contributing) below.

---

## Attack Type

- **Browser-in-browser:** The user is interacting with what appears to be a genuine browser session in a remote desktop (noVNC/Kasm).
- All input is transparently intercepted via code injected into the container’s browser frontend.
- There is no user warning, and the attack can persist across legitimate workflows.

---

## Security Impact & Realistic Risks

- This technique **could be weaponized in highly convincing phishing or credential-harvesting campaigns**, especially if combined with social engineering.
- From the victim’s perspective, **the experience appears entirely normal**: low latency, real content, and interaction with the legitimate target website.
- If deployed carefully, **this approach can be adapted to virtually any web page** and may be almost indistinguishable from a real session.
- For the targeted website, **advanced implementations of this attack are extremely difficult to detect**. From the web service’s point of view, the traffic appears to originate from a normal, legitimate client; traditional anti-phishing mechanisms may not trigger.

**This PoC demonstrates a plausible browser-in-browser attack chain for red teamers, security researchers, and those interested in modern supply-chain risks in virtualized browsing environments.**

---

## Technologies

- KasmVNC / kasmweb/chrome (Docker base)
- Node.js (local keylogging server)
- JavaScript (key event interception and transmission)
- Dockerfile (custom image)
- Self-signed TLS certificates (for HTTPS between client and keylog server)

---

## Quickstart (LAB ONLY)

1. **Clone the repo**
   ```bash
   git clone https://github.com/<your-username>/DoppelBrowser.git
   cd DoppelBrowser

2. **Build the custom Docker image**

   ```bash
   docker build -t doppelbrowser .
   ```

3. **Run the container**

   ```bash
   docker run -d --name doppel-kasm \
     -p 6901:6901 -p 5901:5901 -p 3000:3000 \
     --shm-size=4g \
     -e VNC_RESOLUTION=1920x1080 \
     -e KASM_URL='http://testphp.vulnweb.com/login.php' \
     -e APP_ARGS='--no-sandbox --kiosk --new-window --incognito --start-fullscreen --disable-restore-session-state --disable-session-crashed-bubble --disable-features=TranslateUI,ExtensionsToolbarMenu,PasswordManagerOnboarding' \
     doppelbrowser
   ```

4. **Accept the self-signed certificate (required for the PoC)**

   * Visit [https://127.0.0.1:3000/](https://127.0.0.1:3000/) and accept the certificate in your browser.
   * Then visit [https://127.0.0.1:6901/](https://127.0.0.1:6901/) to start the KasmVNC session.
   * All keyboard input will now be logged.

5. **Retrieve captured keystrokes**

   ```bash
   docker exec -it doppel-kasm bash -lc "tail -n 50 /tmp/keystrokes.txt"
   # or
   docker cp doppel-kasm:/tmp/keystrokes.txt ./keystrokes.txt
   ```

---

## Limitations / Current Status

* **Self-signed certificates:**
  You must visit port 3000 and accept the certificate before the main session on 6901, otherwise browser security will block the keylogging requests.
* **CORS / mixed content:**
  Both the client JS and server use HTTPS; port 3000 must be mapped with `-p 3000:3000` for the PoC to function in your lab.
* **No persistence or exfiltration** outside the container by default (for safe lab use only).
* **Browser-in-browser detection is not implemented**; this PoC is not a phishing lure by itself, but demonstrates a backend infrastructure attack vector that can be adapted for such purposes.

---

## Improvements Planned

* **User experience/ergonomics:**
  Provide clearer logs, optional UI status for researchers, better error handling.
* **Attacker session takeover:**
  Add the ability for the attacker to resume or control the victim's live session after initial compromise (browser-in-browser session hijacking).
* **Production-ready reverse proxy integration:**
  Optionally document/provide a Nginx/Caddy setup with a real domain and Let's Encrypt certificate for seamless usage (no certificate warnings, single origin for both services).

---

## Advanced Setup: No Certificate Popups (Optional)

If you want a seamless experience **without browser certificate warnings**, here are three supported approaches:

### 1. Real Domain + Let's Encrypt Certificate

* Register a real domain name (e.g., `yourlab.example.com`) and point it to your lab server.

* Obtain a TLS certificate via [Let's Encrypt](https://letsencrypt.org/) (e.g., using [Certbot](https://certbot.eff.org/)).

* Set up a reverse proxy (such as **Nginx** or **Caddy**) on port 443 with your Let's Encrypt certificate:

  * Proxy `/` to KasmVNC (`127.0.0.1:6901`)
  * Proxy `/log` to the Node keylogging server (`127.0.0.1:3000`)
  * Example Nginx config:

    ```nginx
    server {
      listen 443 ssl http2;
      server_name yourlab.example.com;

      ssl_certificate     /etc/letsencrypt/live/yourlab.example.com/fullchain.pem;
      ssl_certificate_key /etc/letsencrypt/live/yourlab.example.com/privkey.pem;

      location /log {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
      }

      location / {
        proxy_pass http://127.0.0.1:6901;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
      }
    }
    ```

* Result: The user connects to `https://yourlab.example.com/`, all traffic is encrypted with a trusted certificate, and **no browser warnings or mixed content issues occur**.

### 2. Local CA with [mkcert](https://github.com/FiloSottile/mkcert)

* Install `mkcert` and generate a trusted local certificate for `localhost`/`127.0.0.1`.
* Install the mkcert CA into your OS and browser.
* Use the generated certificate (`.pem`/`.key`) for both KasmVNC and your keylog server.
* Result: No certificate warnings for local development, perfect for air-gapped labs.

### 3. Unified Reverse Proxy (Nginx or Caddy)

* Deploy **Nginx** or **Caddy** as a single HTTPS endpoint.
* Proxy `/` to KasmVNC and `/log` to your keylog server, using either a public or local CA-signed certificate.
* This gives a **single origin**, removes all cross-origin or certificate issues, and can be used with real or internal domains.

**In all cases, the browser sees a trusted HTTPS endpoint and will not prompt the user to accept any certificate, even for the keylogging requests.**

---

## Contributing

This is a personal research project, but pull requests and improvements are welcome.
Feel free to propose ergonomic enhancements, new attack modules (session takeover, browser-in-browser automation), or better defense/detection countermeasures.

---

## Author

Kronk. — [github.com/Kronk-imp](https://github.com/Kronk-imp)


