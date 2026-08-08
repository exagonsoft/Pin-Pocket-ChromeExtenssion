//#region Environment
const manifest = browser.runtime.getManifest();
const declaredGeckoId = manifest?.browser_specific_settings?.gecko?.id || "";
const runtimeId = browser.runtime?.id || "";

// Firefox temporary installs use a random runtime id, while signed production
// builds use the declared gecko id from the manifest.
const isDev = !declaredGeckoId || runtimeId !== declaredGeckoId;
//#endregion

//#region API Configuration
export const CONFIG = {
  API_BASE: isDev
    ? "https://9v95nf8w-3000.brs.devtunnels.ms/api"
    : "https://pinity.uk/api",
  BACKEND_BASE: isDev
    ? "https://9v95nf8w-3000.brs.devtunnels.ms"
    : "https://pinity.uk",
  // Public OAuth client ID for extension-native Google login (no hosted auth page).
  GOOGLE_OAUTH_CLIENT_ID: "582777025605-7t376oiq9lkh2r7dhdg1fmbar8j59s7n.apps.googleusercontent.com",
};
//#endregion
