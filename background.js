// background.js (or service_worker.js)

//#region Imports
import { CONFIG } from "./constants.js";
import * as Storage from "./utils/storage.js";
import { authFetch } from "./utils/api.js";
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
  try {
    Object.keys(changes).forEach((key) => {
      const newValue = changes[key].newValue;
      // send a lightweight runtime message; pages may listen for this
      chrome.runtime.sendMessage({ type: "storage-changed", key, value: newValue });
    });
  } catch (e) {
    // ignore
  }
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
    // 🔐 optional: read user info only for logging / analytics
    const { userId } = await Storage.get(["userId"]);

    if (!userId) {
      console.warn("[PinPocket] Not authenticated — pin ignored");
      return;
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
      const err = await res.json().catch(() => ({}));
      console.error("[PinPocket] Failed to save pin:", err?.error || res.statusText);
      return;
    }

    console.info("[PinPocket] Pin saved successfully:", tab.url);
  } catch (err) {
    console.error("[PinPocket] Error saving pin:", err);
  }
});
//#endregion
