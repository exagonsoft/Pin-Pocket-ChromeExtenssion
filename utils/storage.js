//#region Local Auth Storage
// Auth tokens and user data are stored in chrome.storage.local (NOT sync)
// to prevent sensitive tokens from syncing across devices via the user's Google account.
// utils/storage.js
export const get = (keys) =>
  new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });

export const set = (data) =>
  new Promise((resolve) => {
    chrome.storage.local.set(data, resolve);
  });

export const remove = (keys) =>
  new Promise((resolve) => {
    chrome.storage.local.remove(keys, resolve);
  });

export const clear = () =>
  new Promise((resolve) => {
    chrome.storage.local.clear(resolve);
  });
//#endregion

//#region Alias (backward compat)
export const getLocal = get;
export const setLocal = set;
export const removeLocal = remove;
//#endregion
