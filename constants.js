//#region Environment
const manifest = chrome.runtime.getManifest();
const isDevInstall = !("update_url" in manifest);

// Safety-first default: production endpoints unless explicitly enabled for local dev.
// Set to true only when running an unpacked local build against a dev tunnel.
const USE_DEV_TUNNEL = false;
const isDev = isDevInstall && USE_DEV_TUNNEL;
//#endregion

//#region API Configuration
export const CONFIG = {
  API_BASE: !isDev
    ? "https://9v95nf8w-3000.brs.devtunnels.ms/api"
    : "https://pinity.uk/api",
  BACKEND_BASE: !isDev
    ? "https://9v95nf8w-3000.brs.devtunnels.ms"
    : "https://pinity.uk",
  // Public OAuth client ID for extension-native Google login (no hosted auth page).
  GOOGLE_OAUTH_CLIENT_ID: "582777025605-7t376oiq9lkh2r7dhdg1fmbar8j59s7n.apps.googleusercontent.com",
};
//#endregion
