// utils/api.module.js
//#region Imports
import * as Storage from "./storage.js";
//#endregion

//#region Authenticated Fetch
export async function authFetch(url, options = {}) {
  const { token } = await Storage.get(["token"]);

  if (!token) {
    redirectToAuth();
    throw new Error("No token");
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    await Storage.clear();
    await chrome.storage.local.remove("importedOnce");
    redirectToAuth();
    throw new Error("Unauthorized");
  }

  return res;
}
//#endregion

//#region Navigation
function redirectToAuth() {
  if (!location.pathname.endsWith("auth.html")) {
    location.href = "auth.html";
  }
}
//#endregion
