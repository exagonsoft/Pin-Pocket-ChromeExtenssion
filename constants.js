//#region Environment
const isDev = !("update_url" in chrome.runtime.getManifest());
//#endregion

//#region API Configuration
export const CONFIG = {
  API_BASE: isDev
    ? "https://vsmjz9ds-3000.brs.devtunnels.ms/api"
    : "https://pinity.uk/api",
  BACKEND_BASE: isDev
    ? "https://vsmjz9ds-3000.brs.devtunnels.ms"
    : "https://pinity.uk",
};
//#endregion
