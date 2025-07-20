const isDev = !('update_url' in chrome.runtime.getManifest());

export const CONFIG = {
  API_BASE: isDev
    ? 'http://localhost:3000/api'
    : 'https://pinpocket.exagon-softcom/api'
};
