//#region Environment
const manifest = chrome.runtime.getManifest();

// Unpacked (sideloaded) installs lack an update_url — used to detect dev mode.
// Swap API_BASE below when developing against a local tunnel, then revert before publishing.
const isDev = !("update_url" in manifest);
//#endregion

//#region API Configuration
export const CONFIG = {
  API_BASE: isDev
    ? "https://pinity.uk/api"   // replace with tunnel URL for local dev
    : "https://pinity.uk/api",
  BACKEND_BASE: isDev
    ? "https://pinity.uk"       // replace with tunnel URL for local dev
    : "https://pinity.uk",
  // Public OAuth client ID for extension-native Google login (no hosted auth page).
  GOOGLE_OAUTH_CLIENT_ID: "582777025605-7t376oiq9lkh2r7dhdg1fmbar8j59s7n.apps.googleusercontent.com",
};
//#endregion
