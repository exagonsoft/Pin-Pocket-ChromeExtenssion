import { storage } from "./storage";

export interface SessionData {
  userId?: string;
  email?: string;
  token?: string;
  refreshToken?: string;
  plan?: string;
  planName?: string;
  team?: string;
  teamOwner?: boolean;
  picture?: string;
  language?: string;
  languagePreference?: string;
}

export const AUTH_STORAGE_KEYS = [
  "userId",
  "email",
  "token",
  "refreshToken",
  "plan",
  "planName",
  "team",
  "teamOwner",
  "picture",
] as const;

let refreshPromise: Promise<string | null> | null = null;

export async function getSession() {
  const local = await storage.getLocal<SessionData>([...AUTH_STORAGE_KEYS]);
  if (local.userId && local.token) {
    return local;
  }

  const legacy = await storage.getSync<SessionData>([...AUTH_STORAGE_KEYS]);
  if (legacy.userId && legacy.token) {
    await storage.setLocal(legacy);
    await storage.removeSync([...AUTH_STORAGE_KEYS]);
    return legacy;
  }

  return local;
}

export async function requireSession() {
  const session = await getSession();
  if (!session.userId || !session.token) {
    window.location.href = "auth.html";
    throw new Error("NO_SESSION");
  }
  return session;
}

export async function clearSession() {
  await storage.removeLocal([...AUTH_STORAGE_KEYS]);
  await storage.removeSync([...AUTH_STORAGE_KEYS]);
  await storage.removeLocal(["importedOnce"]);
}

export async function tryRefreshToken(apiBase: string) {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const { refreshToken } = await getSession();
    if (!refreshToken) return null;

    const res = await fetch(`${apiBase}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${refreshToken}`,
      },
    });

    if (!res.ok) return null;

    const json = await res.json();
    if (!json?.token) return null;
    await storage.setLocal({ token: json.token });
    return json.token as string;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}
