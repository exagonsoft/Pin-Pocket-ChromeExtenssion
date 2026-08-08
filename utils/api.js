// utils/api.js
//#region Imports
import { CONFIG } from "../constants.js";
import * as Storage from "./storage.js";
//#endregion

//#region Token Cache
// Cache token in memory to avoid a storage round-trip on every request.
let _cachedToken = null;
let _refreshInFlight = null;
const GET_CACHE_PREFIX = "__httpCache:";
const GET_CACHE_TTL_MS = 30 * 1000;

async function getToken() {
  if (_cachedToken) return _cachedToken;
  const { token } = await Storage.get(["token"]);
  _cachedToken = token || null;
  return _cachedToken;
}

export function invalidateTokenCache() {
  _cachedToken = null;
}
//#endregion

//#region Response Cache
function getMethod(options = {}) {
  return String(options.method || "GET").toUpperCase();
}

function shouldUseResponseCache(options = {}) {
  return getMethod(options) === "GET" && options.skipCache !== true;
}

function buildResponseCacheKey(url, token) {
  const tokenHint = token ? token.slice(-16) : "anon";
  return `${GET_CACHE_PREFIX}${tokenHint}:${url}`;
}

async function readCachedResponse(url, token) {
  const key = buildResponseCacheKey(url, token);
  const data = await Storage.get([key]);
  const entry = data?.[key];
  if (!entry || typeof entry !== "object") return null;

  const age = Date.now() - Number(entry.ts || 0);
  if (age > GET_CACHE_TTL_MS) {
    await Storage.remove([key]);
    return null;
  }

  return new Response(JSON.stringify(entry.body), {
    status: Number(entry.status || 200),
    headers: {
      "Content-Type": "application/json",
      "X-Pinity-Cache": "HIT",
    },
  });
}

async function cacheResponse(url, token, response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return;

  const body = await response.clone().json().catch(() => null);
  if (body === null) return;

  const key = buildResponseCacheKey(url, token);
  await Storage.set({
    [key]: {
      ts: Date.now(),
      status: response.status,
      body,
    },
  });
}

async function clearResponseCacheForToken(token) {
  const tokenHint = token ? token.slice(-16) : "anon";
  const prefix = `${GET_CACHE_PREFIX}${tokenHint}:`;
  const all = await Storage.get(null);
  const keys = Object.keys(all || {}).filter((k) => k.startsWith(prefix));
  if (keys.length) await Storage.remove(keys);
}
//#endregion

//#region Refresh Flow
async function tryRefreshToken() {
  if (_refreshInFlight) return _refreshInFlight;

  _refreshInFlight = (async () => {
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
    const body = await res.json().catch(() => ({}));
    const newToken = body?.token;
    if (!newToken) return null;

    await Storage.set({ token: newToken });
    _cachedToken = newToken;
    return newToken;
  })().finally(() => {
    _refreshInFlight = null;
  });

  return _refreshInFlight;
}
//#endregion

//#region Authenticated Fetch
function buildHeaders(token, options = {}) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };
}

async function doRequest(url, options, token) {
  return fetch(url, {
    ...options,
    headers: buildHeaders(token, options),
  });
}

export async function authFetch(url, options = {}) {
  const method = getMethod(options);
  const token = await getToken();

  if (!token) {
    redirectToAuth();
    throw new Error("No token");
  }

  if (shouldUseResponseCache(options)) {
    const cached = await readCachedResponse(url, token);
    if (cached) return cached;
  }

  let res = await doRequest(url, options, token);
  if (res.status === 401) {
    // Try silent refresh once before forcing re-auth.
    invalidateTokenCache();
    const refreshedToken = await tryRefreshToken();
    if (refreshedToken) {
      res = await doRequest(url, options, refreshedToken);
    }
  }

  if (res.status === 401) {
    invalidateTokenCache();
    await Storage.clear();
    await chrome.storage.local.remove("importedOnce");
    redirectToAuth();
    throw new Error("Unauthorized");
  }

  if (res.ok && shouldUseResponseCache(options)) {
    await cacheResponse(url, token, res);
  } else if (res.ok && method !== "GET") {
    await clearResponseCacheForToken(token);
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
