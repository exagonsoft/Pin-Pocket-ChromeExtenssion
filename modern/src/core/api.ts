import { CONFIG } from "./config";
import { clearSession, getSession, tryRefreshToken } from "./session";

type JsonBody = Record<string, unknown> | Array<unknown> | null;

export async function authFetch(path: string, init: RequestInit = {}) {
  const { token } = await getSession();
  if (!token) {
    await clearSession();
    window.location.href = "auth.html";
    throw new Error("NO_TOKEN");
  }

  const request = async (accessToken: string) =>
    fetch(`${CONFIG.API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(init.headers || {}),
      },
    });

  let res = await request(token);
  if (res.status !== 401) return res;

  const nextToken = await tryRefreshToken(CONFIG.API_BASE);
  if (!nextToken) {
    await clearSession();
    window.location.href = "auth.html";
    throw new Error("UNAUTHORIZED");
  }

  res = await request(nextToken);
  if (res.status === 401) {
    await clearSession();
    window.location.href = "auth.html";
    throw new Error("UNAUTHORIZED");
  }
  return res;
}

export async function authJson<T>(path: string, init: RequestInit = {}) {
  const res = await authFetch(path, init);
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((json as { error?: string } | null)?.error || `HTTP_${res.status}`);
  }
  return json as T;
}

export async function authPost<T>(path: string, body: JsonBody) {
  return authJson<T>(path, { method: "POST", body: JSON.stringify(body || {}) });
}
