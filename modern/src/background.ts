import { CONFIG } from "./core/config";
import { authFetch } from "./core/api";
import { extractContextKey, normalizeUrl } from "./core/pins";
import { getSession } from "./core/session";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "pin-pocket-save",
    title: "Save Page to PinPocket",
    contexts: ["page"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "pin-pocket-save" || !tab?.url) return;

  const { userId } = await getSession();
  if (!userId) return;
  const { activeTeamId } = await chrome.storage.local.get(["activeTeamId"]);

  const response = await authFetch("/pins", {
    method: "POST",
    body: JSON.stringify({
      title: tab.title || tab.url,
      url: normalizeUrl(tab.url),
      contextKey: extractContextKey(tab.url),
      time: new Date().toISOString(),
      favicon: tab.favIconUrl || null,
      teamId: activeTeamId || null,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("Failed to save pin from context menu", response.status, body);
  } else {
    console.info("Pin saved from context menu", CONFIG.API_BASE);
  }
});
