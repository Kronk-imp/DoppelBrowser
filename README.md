# DoppelBrowser

Remote Browser Environment with Runtime Takeover & Overlay Injection
(Lab / Research Use Only)

---

## ⚠️ Legal Notice

This project is strictly intended for:

* Security research
* Red team laboratory environments
* Infrastructure hardening studies
* Awareness demonstrations

Do **not** deploy this system against real users or infrastructures without explicit authorization.

The author assumes no responsibility for misuse.

---

# Project Evolution

DoppelBrowser started as a **browser-in-browser keylogging PoC**.

In the original version:

* A modified `index.html` injected a JavaScript keylogger
* Keystrokes were exfiltrated to a local Node.js HTTPS server
* The focus was on infrastructure-level input interception

In this new version:

The focus shifted from pure keylogging to **dynamic session takeover and runtime overlay injection**.

The keylogger still exists for lab demonstration purposes,
but it is no longer the core feature of the project.

The main objective is now:

> Demonstrating controlled browser session takeover inside a containerized remote browsing environment.

---

# What DoppelBrowser Does

DoppelBrowser is a Dockerized environment based on KasmVNC / noVNC that allows:

* Remote browser display
* Full kiosk mode enforcement
* Dynamic iframe overlay injection
* Conditional takeover triggering
* Internal static page serving
* Embedded automation bot execution
* CLI orchestration via `DBrowser`

---

# Architecture Overview

```
Client Browser
        ↓
Modified index.html (KasmVNC frontend)
        ↓
Docker Container
        ├── takeover.js      (Port 4000)
        ├── keylog_server.js (Port 3000)
        ├── /page/*.html     (static overlays)
        └── KasmVNC backend
```

---

# Build & Run (Manual Image Build Required)

⚠️ The Docker image must be built manually.

There is currently **no automated remote build system**.

## Clone

```bash
git clone https://github.com/<your-repo>/DoppelBrowser.git
cd DoppelBrowser
```

## Build the image

```bash
docker build -t doppelbrowser .
```

## Run the container

You can use the provided `DBrowser` wrapper:

```bash
./DBrowser 
```

Or run manually if needed.

---

# Core Components

## index.html (Modified KasmVNC Frontend)

* Forces full-screen kiosk mode
* Hides Kasm/noVNC UI
* Captures keyboard events
* Sends buffered events to port 3000 over HTTPS

The keyboard capture logic:

* Uses `keydown`
* Buffers up to 50 entries
* Flushes every 2 seconds

⚠️ Certificate acceptance is still required (see below).

---

## takeover.js (Port 4000)

This is the main control component.

It provides:

* Takeover activation / deactivation
* Keyword-based triggering ( must be in the url ) 
* Dynamic iframe injection
* Overlay page selection
* Embedded automation bot

### API

```
POST /takeover
```

Body:

```json
{
  "enabled": true,
  "keyword": "optional",
  "page": "optional.html"
}
```

### Behavior

| Field         | Effect                                                |
| ------------- | ----------------------------------------------------- |
| enabled=true  | Injects iframe overlay                                |
| enabled=false | Removes iframe                                        |
| keyword set   | Activates takeover only when keyword condition is met |
| page set      | Changes displayed overlay page                        |

The iframe is injected dynamically into the DOM of the remote browser session.

All takeover logic remains server-side.

---

# 🤖 Embedded Automation Bot

Inside `takeover.js`, an automation bot is implemented.

When takeover is triggered:

* The iframe overlay hides the real page
* The bot can execute automated actions in the background

Examples of possible bot actions:

* Filling forms
* Clicking buttons
* Submitting data
* Navigating pages

⚠️ Important:

* The bot is **hardcoded inside `takeover.js`**
* It is **NOT currently controllable via DBrowser**
* To change bot behavior, you must modify the bot logic directly in `takeover.js`

This is intentional for now.

Future versions may expose bot control via API.

---

# /page/ Directory

Contains static HTML pages used as overlays.

Example:

```
/page/login.html
/page/otp.html
```

Requirements:

* The page must physically exist in `/page/`
* The filename must match what is sent to `/takeover`

---

# DBrowser CLI

Wrapper script allowing:

* start
* stop
* remove container
* trigger takeover

⚠️ DBrowser does NOT currently control the embedded bot.

---

# Testing Environment

The embedded automation bot and takeover logic have been tested against the same demonstration target used in the previous version of this project:

**[http://testphp.vulnweb.com/login.php](http://testphp.vulnweb.com/login.php)**

This website is:

* A publicly available vulnerable web application
* Maintained for security testing and training purposes
* Commonly used in labs and demonstrations
* Intended specifically for vulnerability research

It is legitimate to use this platform for:

* Red team simulations
* Automation testing
* Takeover demonstrations
* Controlled security research

If you want to experiment with DoppelBrowser in a safe environment, this site is recommended.

⚠️ Always ensure you have authorization before testing any system outside of designated training platforms.

---

# Certificate Requirement (Still Present)

The certificate issue still exists in this version.

Because:

* keylog_server.js runs HTTPS
* Browser security blocks mixed content

You must:

1. Visit [https://127.0.0.1:3000/](https://127.0.0.1:3000/)
2. Accept the self-signed certificate
3. Then open [https://127.0.0.1:6901/](https://127.0.0.1:6901/)

Otherwise, keyboard logging requests will fail.

---

# 🔧 Advanced Setup (No Certificate Popups – Optional)

To remove browser warnings:

### Option 1 – Real Domain + Let's Encrypt

* Use a real domain
* Configure reverse proxy (Nginx / Caddy)
* Proxy:

  * `/` → 6901
  * `/log` → 3000

### Option 2 – mkcert (Local CA)

* Generate local trusted certificate
* Use it for both services
* Ideal for air-gapped labs

### Option 3 – Unified Reverse Proxy

Single HTTPS entry point → no mixed content, no warnings.

---

# Research Value

This project demonstrates:

* Runtime browser session manipulation
* Infrastructure-level overlay injection
* Automation hidden behind user interface masking
* Supply chain / container tampering impact
* Detection complexity from victim perspective

It is useful for:

* Red team labs
* Blue team awareness
* Cloud browsing security research
* Container hardening studies

---

# Roadmap

Planned improvements:

* Bot control via API
* Event-driven bot orchestration
* Multi-overlay management
* Cleaner modular separation
* Optional defensive detection mode
* Reverse proxy production template

---

# Intended Usage

DoppelBrowser is a lab research environment.

Use only in:

* Controlled environments
* Authorized testing
* Security research scenarios

