// background.js (or service_worker.js)

//#region Imports
import { CONFIG } from "./constants.js";
import * as Storage from "./utils/storage.js";
import { authFetch } from "./utils/api.js";
//#endregion

//#region OAuth Helpers
function randomBase64Url(byteLength = 24) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function parseFragmentParams(callbackUrl) {
  const hash = new URL(callbackUrl).hash || "";
  const trimmed = hash.startsWith("#") ? hash.slice(1) : hash;
  return new URLSearchParams(trimmed);
}

async function startGoogleAuthFlow() {
  const clientId = CONFIG.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) return { ok: false, error: "Google sign-in is not configured." };

  const redirectUri = chrome.identity.getRedirectURL();
  const state = randomBase64Url(24);

  const oauthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  oauthUrl.searchParams.set("client_id", clientId);
  oauthUrl.searchParams.set("redirect_uri", redirectUri);
  oauthUrl.searchParams.set("response_type", "token");
  oauthUrl.searchParams.set("scope", "openid email profile");
  oauthUrl.searchParams.set("prompt", "select_account");
  oauthUrl.searchParams.set("state", state);

  const callbackUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: oauthUrl.toString(), interactive: true },
      (url) => {
        if (chrome.runtime.lastError || !url) {
          const msg = chrome.runtime.lastError?.message || "Google auth failed";
          reject(new Error(msg));
          return;
        }
        resolve(url);
      }
    );
  });

  const params = parseFragmentParams(callbackUrl);
  const oauthError = params.get("error");
  if (oauthError) return { ok: false, error: oauthError };

  const returnedState = params.get("state");
  if (returnedState !== state) return { ok: false, error: "Invalid auth state." };

  const accessToken = params.get("access_token");
  if (!accessToken) return { ok: false, error: "No Google access token received." };

  const exchangeRes = await fetch(`${CONFIG.API_BASE}/auth/google/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: accessToken,
      redirect_uri: redirectUri,
    }),
  });

  if (!exchangeRes.ok) {
    const body = await exchangeRes.json().catch(() => ({}));
    return {
      ok: false,
      error: body?.providerError || body?.error || "Google sign-in failed.",
    };
  }

  const data = await exchangeRes.json();
  await Storage.set({
    userId: data.user._id,
    email: data.user.email,
    token: data.token,
    refreshToken: data.refreshToken,
    plan: data.user.plan,
    planName: data.user.planName,
    team: data.user.team,
    teamOwner: data.user.teamOwner,
    picture: data.user.picture,
  });
  await Storage.remove("importedOnce");

  return { ok: true };
}
//#endregion

//#region Context Menu Registration
/* =========================================================
   CONTEXT MENU
========================================================= */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "pin-pocket-save",
    title: "Save Page to Pinity",
    contexts: ["page"],
  });
});

// Notify extension pages when storage keys change (useful as alternative to storage.onChanged)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  Object.keys(changes).forEach((key) => {
    const newValue = changes[key].newValue;
    // Fire-and-forget: suppress "Receiving end does not exist" when no page is listening
    chrome.runtime.sendMessage({ type: "storage-changed", key, value: newValue }, () => {
      void chrome.runtime.lastError;
    });
  });
});
//#endregion

//#region Runtime Actions
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg !== "object") return;
  if (msg.type !== "google-auth-start") return;

  (async () => {
    try {
      const result = await startGoogleAuthFlow();
      sendResponse(result);
    } catch (err) {
      const message = err?.message || "Google sign-in failed.";
      sendResponse({ ok: false, error: message });
    }
  })();

  return true;
});
//#endregion

//#region Context Menu Action
/* =========================================================
   CONTEXT MENU ACTION
========================================================= */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "pin-pocket-save") return;
  if (!tab?.url) return;

  try {
    const { userId, planName } = await Storage.get(["userId", "planName"]);

    if (!userId) {
      console.warn("PinitY: Not authenticated — pin ignored");
      return;
    }

    // Enforce plan pin limits (Standard: 50, Pro/Team: unlimited)
    const planLimits = { standard: 50, pro: Infinity, team: Infinity };
    const limit = planLimits[String(planName || "standard").toLowerCase()] ?? 50;

    if (limit !== Infinity) {
      const checkRes = await authFetch(`${CONFIG.API_BASE}/pins`);
      if (checkRes.ok) {
        const existing = await checkRes.json();
        if (existing.data.length >= limit) {
          console.warn(`PinitY: Pin limit (${limit}) reached for plan "${planName}". Upgrade to add more.`);
          return;
        }
      }
    }

    const res = await authFetch(`${CONFIG.API_BASE}/pins`, {
      method: "POST",
      body: JSON.stringify({
        title: tab.title || tab.url,
        url: tab.url,
        time: new Date().toISOString(),
        favicon: tab.favIconUrl || null,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("PinitY: Failed to store pin:", err?.error || res.statusText);
      return;
    }

    console.log("PinitY: Pin saved successfully.");
  } catch (err) {
    console.error("PinitY: Error saving pin:", err);
  }
});
//#endregion
