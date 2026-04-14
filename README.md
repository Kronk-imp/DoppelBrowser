# DoppelBrowser

**DoppelBrowser** is a proof of concept (POC) that demonstrates an advanced "cloud browsing" architecture with dynamic session takeover capabilities. It combines a Chromium browser running inside a Docker container, ultra‑responsive remote display via kasmVNC, and an orchestration layer (API + JavaScript injection) that enables real‑time modification of the user experience.

> **Disclaimer**  
> This project was developed for **cybersecurity research** and **awareness** purposes only.  
> Using DoppelBrowser to intercept personal data, hijack sessions, or conduct phishing attacks without explicit consent is **illegal** and unethical.  
> The author assumes no responsibility for any malicious use of this code.  
> Use it exclusively in controlled environments and with the consent of all parties involved.

---

## General Concept

The project rests on three pillars:

1. **An isolated browser inside a container**  
   Chromium runs in *kiosk* mode within a Docker container. The user interface is reduced to the single displayed web page, with no address bar or tabs.

2. **Streaming via kasmVNC**  
   The graphical output is transmitted to the client with minimal latency thanks to the VNC protocol. This enables a smooth experience, comparable to *cloud gaming* depending on the configuration.

3. **A control service (takeover)**  
   A Node.js service (`takeover.js`) communicates with the browser via the **Chrome DevTools Protocol** (CDP) and exposes a REST API. It can operate at two levels:
   - **At the noVNC page level (`index.html`)** : display of an HTML *overlay* superimposed on the VNC interface (more discreet, does not affect the browser itself).
   - **At the remote Chromium browser level** : injection of a JavaScript script (`bot.js`) that executes in the context of visited pages, enabling automated actions (typing, navigation, etc.).

---

### Two Injection Vectors

| Level               | Mechanism                                                                  | Stealth     | Typical Use Case                                   |
|---------------------|----------------------------------------------------------------------------|-------------|----------------------------------------------------|
| **noVNC Page**      | HTML overlay injected into `index.html`                                    | High        | Fake login page, maintenance message               |
| **Remote Browser**  | `bot.js` script injected via CDP (`Page.addScriptToEvaluateOnNewDocument`) | Low         | Automation, form filling, DOM capture |

The operator chooses one method or the other depending on their needs and the desired level of discretion.

---
## Building the Docker Image

The Docker image bundles Chromium, kasmVNC, the Node.js takeover service, all static assets (including the fake overlay pages), and the SSL certificates required for the HTTPS API. **All of these resources are copied into the image at build time**, so any changes to them require a full rebuild of the image.

### Prerequisites Before Building
- Ensure that any custom overlay pages you want to use are placed in the `pages/` directory (e.g., `otp.html`, `loading.html`).
- Make sure the SSL certificates are available in the `certs/` directory (`key.pem` and `cert.pem`). If you do not have certificates yet, you can generate self‑signed ones

### Building the Image
Run the following command from the root of the repository:
```bash
docker build -t doppelbrowser .
```

### Important: Applying Code Changes
Because the Dockerfile copies files during the build, **any modification to the source code (e.g., `takeover.js`, `bot.js`, `index.html`, overlay pages, or certificates) will not take effect until you rebuild the image**.

## Usage with DBrowser

The project is designed to be controlled by **DBrowser**, a management interface that communicates with the `takeover` API.  
**There is no need to manually run `docker run`** ; DBrowser handles launching and configuring the containers, and includes built‑in commands for interacting with the target.

---

## POC Features

### 1. Overlay in the noVNC Page
- An `<iframe>` is dynamically injected into `index.html` when the API sets `enabled: true`.
- The overlay is served locally from `/pages/` (e.g., `otp.html`).
- No modification of the remote browser – the user simply sees an overlay on top of the VNC stream.

### 2. Bot Injection into Chromium
- `bot.js` is loaded **before any page is loaded** via `Page.addScriptToEvaluateOnNewDocument`.
- The bot can:
  - Block certain APIs (e.g., WebAuthn).
  - Wait for DOM elements.
  - Simulate human‑like typing (`typeLikeHuman`).
  - Simulate user actions.

### 3. Arbitrary Code Execution via CDP
- From `takeover.js`, calling `Runtime.evaluate` allows execution of any JavaScript in the browser context.
- Demonstrated capabilities: cookie retrieval, DOM capture, programmatic navigation.

### 4. Direct Data Retrieval from the Container
- The Chromium profile is stored inside the container (e.g., `~/.config/chromium`).
- An operator with access to the container can directly extract cookies, browsing history, saved passwords, etc., without using CDP.

---

## Security Risks and Extension Possibilities

This architecture, although a POC, illustrates several realistic attack vectors:

- **Full access to session data** : cookies, `localStorage`, and stored passwords are accessible either via CDP or by reading Chromium profile files inside the container.
- **Transparent phishing** : overlaying a fake page while a bot silently fills legitimate fields.

### Trivial Extensions (Not Implemented)
- Session hijacking, manual takeover of the VNC session.
- Real‑time spying – an operator can connect to the same noVNC session and observe the user's screen unnoticed.
- Session video recording (screen recording).
- Periodic screenshot capture.
- Automatic cookie exfiltration to a remote server.

In reality, anything achievable via CDP or by interacting with the container is possible.  
These enhancements are deliberately omitted from the public code, but their feasibility is demonstrated by the implemented architecture.

---

## Project Structure

| File / Directory        | Role                                                                 |
|-------------------------|----------------------------------------------------------------------|
| `Dockerfile`            | Builds the image containing Chromium, KasmVNC, Node.js, etc.         |
| `index.html`            | Custom noVNC page (hides Kasm UI, includes state polling)            |
| `takeover.js`           | Node.js service: REST API + CDP connection + bot injection           |
| `bot.js`                | Script injected into the browser (WebAuthn blocking, human typing)   |
| `startup-wrapper.sh`    | Container entrypoint script (launches KasmVNC + takeover)            |
| `pages/`                | Folder containing HTML overlays (e.g., `otp.html`, `loading.html`)   |
| `certs/`                | Self‑signed SSL certificates for the HTTPS API                       |

---

## License

This project is distributed under the **MIT** license. See the `LICENSE` file for more details.

---

*This project is a research tool. Use it responsibly and ethically.*
