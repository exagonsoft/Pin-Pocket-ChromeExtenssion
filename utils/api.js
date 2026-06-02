// utils/api.module.js
//#region Imports
import * as Storage from "./storage.js";
import { CONFIG } from "../constants.js";
//#endregion

//#region Refresh lock — prevents concurrent refresh calls
let refreshPromise = null;
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

  // Attempt silent token refresh on 401
  if (res.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      // Retry original request with new token
      const retryRes = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${refreshed}`,
          ...(options.headers || {}),
        },
      });
      if (retryRes.status === 401) {
        await Storage.clear();
        await chrome.storage.local.remove("importedOnce");
        redirectToAuth();
        throw new Error("Unauthorized");
      }
      return retryRes;
    }

    await Storage.clear();
    await chrome.storage.local.remove("importedOnce");
    redirectToAuth();
    throw new Error("Unauthorized");
  }

  return res;
}

/** Attempt to get a new access token using the stored refresh token.
 *  Uses a shared promise so concurrent 401s only trigger one refresh call. */
async function tryRefreshToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const { refreshToken } = await Storage.get(["refreshToken"]);
      if (!refreshToken) return null;

      const res = await fetch(`${CONFIG.API_BASE}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${refreshToken}`,
        },
      });

      if (!res.ok) return null;

      const { token } = await res.json();
      if (!token) return null;

      await Storage.set({ token });
      return token;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}
//#endregion

//#region Navigation
function redirectToAuth() {
  if (typeof location !== "undefined" && !location.pathname.endsWith("auth.html")) {
    location.href = "auth.html";
  }
}
//#endregion
