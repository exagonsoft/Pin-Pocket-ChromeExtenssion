// Shared extension logger — downgrade errors to warnings in console,
// and silently report them to the server for monitoring.

import { CONFIG } from "./constants.js";

const REPORT_ENDPOINT = `${CONFIG.API_BASE}/extention/errors`;

function getStoredUserId() {
  try {
    // Attempt sync read from extension storage — falls back to undefined.
    // Async reads aren't safe here; userId is best-effort context only.
    const runtime =
      (globalThis.chrome && chrome.storage) ||
      (globalThis.browser && browser.storage);
    if (!runtime) return undefined;
  } catch (_) {}
  return undefined;
}

function serializeError(err) {
  if (!err) return {};
  if (err instanceof Error) {
    return { errorName: err.name, errorMessage: err.message };
  }
  if (typeof err === "string") return { errorMessage: err };
  try {
    return { errorMessage: JSON.stringify(err) };
  } catch (_) {
    return { errorMessage: String(err) };
  }
}

/**
 * Log a warning to the console and silently report it to the server.
 * @param {string} scope  e.g. "profile.billing", "auth.login"
 * @param {string} message  Human-readable message
 * @param {unknown} [error]  Optional error object or context
 */
export function logError(scope, message, error) {
  const context = serializeError(error);
  console.warn(`[${scope}] ${message}`, error ?? "");

  const payload = {
    scope,
    message,
    context,
    userId: getStoredUserId(),
  };

  // Fire-and-forget — never block the caller.
  try {
    fetch(REPORT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch (_) {}
}
