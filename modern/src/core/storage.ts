export const storage = {
  getSync<T extends object>(keys: string[]) {
    return new Promise<T>((resolve) => chrome.storage.sync.get(keys, (d) => resolve(d as T)));
  },
  setSync<T extends object>(data: T) {
    return new Promise<void>((resolve) => chrome.storage.sync.set(data, () => resolve()));
  },
  removeSync(keys: string[]) {
    return new Promise<void>((resolve) => chrome.storage.sync.remove(keys, () => resolve()));
  },
  clearSync() {
    return new Promise<void>((resolve) => chrome.storage.sync.clear(() => resolve()));
  },
  getLocal<T extends object>(keys: string[]) {
    return new Promise<T>((resolve) => chrome.storage.local.get(keys, (d) => resolve(d as T)));
  },
  setLocal<T extends object>(data: T) {
    return new Promise<void>((resolve) => chrome.storage.local.set(data, () => resolve()));
  },
  removeLocal(keys: string[]) {
    return new Promise<void>((resolve) => chrome.storage.local.remove(keys, () => resolve()));
  },
};
