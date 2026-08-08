// utils/auth.js

//#region Imports
import { get, clear } from "./storage.js";
//#endregion

//#region Session Helpers
/**
 * Checks if user is authenticated.
 * Returns true if token exists, false otherwise.
 */
export async function requireAuth() {
  const { token } = await get(["token"]);
  return Boolean(token);
}

/**
 * Clears auth state.
 * Caller decides navigation / UI reaction.
 */
export async function logout() {
  await clear();
  await chrome.storage.local.remove("importedOnce");
}
//#endregion
