export function normalizeUrl(url: string) {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}

export function extractContextKey(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("chat.openai.com")) {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "c" && parts.length >= 3) {
        return `chatgpt:${parts[1]}:${parts[2]}`;
      }
    }
    if (u.hostname === "github.com") {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[2] === "issues" && parts[3]) {
        return `github:${parts[0]}/${parts[1]}#${parts[3]}`;
      }
    }
    if (u.pathname.includes("/browse/")) {
      const key = u.pathname.split("/browse/")[1];
      return `jira:${key}`;
    }
    return `url:${normalizeUrl(url)}`;
  } catch {
    return `url:${url}`;
  }
}

export function parseTags(raw: string) {
  const tags = raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const uniq = [...new Set(tags)];
  for (const tag of uniq) {
    if (tag.length > 30) {
      throw new Error("Each tag must be at most 30 chars");
    }
    if (!/^[a-z0-9-_]+$/.test(tag)) {
      throw new Error("Tags only allow letters, numbers, '-' and '_'");
    }
  }
  return uniq.slice(0, 10);
}
