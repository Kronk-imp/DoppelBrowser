// bot.js

// === BLOCK WEBAUTHN ===
// Explicitly disable WebAuthn to prevent biometric/security-key prompts.
if (navigator.credentials) {
  navigator.credentials.get = async () => {
    console.log("[bot] WebAuthn blocked");
    throw new Error("WebAuthn disabled");
  };

  navigator.credentials.create = async () => {
    throw new Error("WebAuthn disabled");
  };
}
const isWithdrawPage = location.href.includes("/withdrawal/crypto/BTC");

if (sessionStorage.getItem("__BOT_ALREADY_RUNNING__") && !isWithdrawPage) {
  console.log("[bot] Already running (session), skipping");
  return;
}

sessionStorage.setItem("__BOT_ALREADY_RUNNING__", "true");


// Restore activation state after internal navigation/reinjection.
if (sessionStorage.getItem("__BOT_ACTIVE__")) {
  window.__BOT_ACTIVE__ = true;
}


// Mark workflow as running for other scripts/tools.
if (!sessionStorage.getItem("__BOT_RUNNING__")) {
  sessionStorage.setItem("__BOT_RUNNING__", "true");
}


// =============================
// UTILITY FUNCTIONS
// =============================


function waitForSelector(selector, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);

    const start = Date.now();

    const tryObserve = () => {
      const existingNow = document.querySelector(selector);
      if (existingNow) return resolve(existingNow);

      const root = document.documentElement || document.body || document;
      if (!(root instanceof Node)) {
        if (Date.now() - start >= timeout) {
          reject(new Error("Timeout waiting for observable root for " + selector));
          return;
        }
        setTimeout(tryObserve, 50);
        return;
      }

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(root, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error("Timeout waiting for " + selector));
      }, timeout);
    };

    tryObserve();
  });
}


async function waitForElement(selector, timeout = 30000) {

  const start = Date.now();

  while (Date.now() - start < timeout) {

    const el = document.querySelector(selector);

    if (el) {
      return el;
    }

    await new Promise(r => setTimeout(r, 200));
  }

  throw new Error("Timeout waiting for " + selector);
}


// React-compatible "human-like" typing helper.
async function typeLikeHuman(input, text) {
  input.focus();
  input.click();

  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  ).set;

  nativeSetter.call(input, "");
  input.dispatchEvent(new Event("input", { bubbles: true }));

  for (const char of text) {
    const nextValue = input.value + char;
    nativeSetter.call(input, nextValue);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: char, bubbles: true }));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: char, bubbles: true }));

    await new Promise(r => setTimeout(r, 60));
  }

  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.blur();

  await new Promise(r => setTimeout(r, 1500));
}


// =============================
// BOT LOGIC
// =============================

(async () => {
  console.log("[bot] href =", location.href);
  console.log("[bot] readyState =", document.readyState);
  console.log("[bot] documentElement exists =", !!document.documentElement);
  console.log("[bot] body exists =", !!document.body);
  console.log("[bot] Bot injected, waiting activation");

  // Wait until activation is received from page/session state.
  while (!window.__BOT_ACTIVE__ && !sessionStorage.getItem("__BOT_ACTIVE__")) {
    await new Promise(r => setTimeout(r, 200));
  }

  console.log("[bot] Activated");

  console.log("[bot] Bot script started");
})();
