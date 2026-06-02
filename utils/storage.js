//#region Sync Storage
// utils/storage.js
export const get = (keys) =>
  new Promise((resolve) => {
    chrome.storage.sync.get(keys, resolve);
  });

export const set = (data) =>
  new Promise((resolve) => {
    chrome.storage.sync.set(data, resolve);
  });

export const remove = (keys) =>
  new Promise((resolve) => {
    chrome.storage.sync.remove(keys, resolve);
  });

export const clear = () =>
  new Promise((resolve) => {
    chrome.storage.sync.clear(resolve);
  });
//#endregion

//#region Local Storage
export const getLocal = (keys) =>
  new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });

export const setLocal = (data) =>
  new Promise((resolve) => {
    chrome.storage.local.set(data, resolve);
  });

export const removeLocal = (keys) =>
  new Promise((resolve) => {
    chrome.storage.local.remove(keys, resolve);
  });
//#endregion
