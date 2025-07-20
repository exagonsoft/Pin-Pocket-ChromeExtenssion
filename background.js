import { CONFIG } from './constants.js';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "pin-pocket-save",
    title: "Save Page to PinPocket",
    contexts: ["page"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "pin-pocket-save" || !tab?.url) return;

  chrome.storage.sync.get(['userId'], async ({ userId }) => {
    if (!userId) {
      console.warn('❌ User not authenticated — cannot save pin.');
      return;
    }

    try {
      const res = await fetch(`${CONFIG.API_BASE}/pins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify({
          title: tab.title,
          url: tab.url,
          time: new Date().toISOString()
        })
      });

      if (!res.ok) {
        const err = await res.json();
        console.error('❌ Failed to store pin:', err?.error || res.statusText);
      } else {
        console.log('✅ Pin saved successfully!');
      }
    } catch (err) {
      console.error('❌ Error saving pin:', err);
    }
  });
});
