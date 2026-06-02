//#region Environment
const isDev = !("update_url" in chrome.runtime.getManifest());

// ⚠️ DEV ONLY: update this to match your current devtunnel or local server URL.
// Run: `devtunnel host -p 3000` and paste the generated URL here.
const DEV_SERVER = "https://85kg1nl8-3000.brs.devtunnels.ms";
//#endregion

//#region API Configuration
export const CONFIG = {
  API_BASE: isDev ? `${DEV_SERVER}/api` : "https://pinity.uk/api",
  BACKEND_BASE: isDev ? DEV_SERVER : "https://pinity.uk",
};
//#endregion
