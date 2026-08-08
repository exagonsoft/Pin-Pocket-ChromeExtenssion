import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { CONFIG } from "../../core/config";
import { AUTH_STORAGE_KEYS } from "../../core/session";
import { storage } from "../../core/storage";
import { PageHeader } from "../../ui/PageHeader";
import { usePreferences } from "../../ui/usePreferences";
import { useNotice } from "../../ui/useNotice";

type Mode = "login" | "register" | "forgot";

interface AuthUserPayload {
  _id?: string;
  email?: string;
  plan?: string;
  planName?: string;
  team?: string;
  teamOwner?: string;
  picture?: string;
}

interface AuthPayload {
  type?: string;
  userId?: string;
  email?: string;
  token?: string;
  refreshToken?: string;
  plan?: string;
  planName?: string;
  team?: string;
  teamOwner?: string;
  picture?: string;
  user?: AuthUserPayload;
}

export default function AuthApp() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState("");
  const { notice, show } = useNotice();
  const { uiStrings } = usePreferences();

  const persistSession = async (json: AuthPayload) => {
    await storage.setLocal({
      userId: json.userId ?? json.user?._id,
      email: json.email ?? json.user?.email,
      token: json.token,
      refreshToken: json.refreshToken,
      plan: json.plan ?? json.user?.plan,
      planName: json.planName ?? json.user?.planName,
      team: json.team ?? json.user?.team,
      teamOwner: json.teamOwner ?? json.user?.teamOwner,
      picture: json.picture ?? json.user?.picture,
    });
    await storage.removeSync([...AUTH_STORAGE_KEYS]);
  };

  useEffect(() => {
    const handleAuthMessage = async (event: MessageEvent) => {
      if (event.origin !== CONFIG.BACKEND_BASE) return;
      const data = event.data as AuthPayload;
      if (!data || data.type !== "authSuccess") return;
      if (!data.token || !data.userId) {
        show("Invalid auth response from popup.", "error");
        return;
      }

      try {
        await persistSession(data);
        await storage.removeLocal(["importedOnce"]);
        window.location.href = "popup.html";
      } catch {
        show("Failed to save session from popup login.", "error");
      }
    };

    window.addEventListener("message", handleAuthMessage);
    return () => window.removeEventListener("message", handleAuthMessage);
  }, [show]);

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${CONFIG.API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return show(json?.error || "Login failed", "error");

    await persistSession(json);
    window.location.href = "popup.html";
  };

  const onRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return show("Password must be at least 8 chars", "warn");
    if (password !== confirm) return show("Passwords do not match", "warn");

    const res = await fetch(`${CONFIG.API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return show(json?.error || "Registration failed", "error");
    await persistSession(json);
    window.location.href = "popup.html";
  };

  const onForgot = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${CONFIG.API_BASE}/auth/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) return show("Reset request failed", "error");
    show("If your account exists, reset instructions were sent.", "success");
    setMode("login");
  };

  return (
    <div className="app stack">
      <PageHeader
        eyebrow={uiStrings.authEyebrow}
        title="PinPocket"
        subtitle={uiStrings.authSubtitle}
      />

      <div className="pill-nav fade-up" role="tablist" aria-label="Authentication modes">
        <button className="btn" aria-current={mode === "login" ? "page" : undefined} onClick={() => setMode("login")} disabled={mode === "login"}>Login</button>
        <button className="btn" aria-current={mode === "register" ? "page" : undefined} onClick={() => setMode("register")} disabled={mode === "register"}>Register</button>
        <button className="btn" aria-current={mode === "forgot" ? "page" : undefined} onClick={() => setMode("forgot")} disabled={mode === "forgot"}>Recover</button>
      </div>

      {notice && <div className={`notice ${notice.tone} fade-up`}>{notice.text}</div>}

      {mode === "login" && (
        <form className="card stack fade-up" onSubmit={onLogin}>
          <div className="meta-grid">
            <strong>Welcome back</strong>
            <span className="muted">Use your email or Google to continue.</span>
          </div>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
          <div className="actions actions--stack">
            <button className="btn btn-primary" type="submit">Login</button>
            <button
              className="btn"
              type="button"
              onClick={() => {
                const popup = window.open(
                  `${CONFIG.BACKEND_BASE}/auth/firebase`,
                  "_blank",
                  "width=500,height=650",
                );
                if (!popup) show("Popup blocked by browser.", "warn");
              }}
            >
              Continue with Google
            </button>
          </div>
          <div className="meta-line">
            <span>Need help?</span>
            <a href="reset.html">Reset password</a>
          </div>
        </form>
      )}

      {mode === "register" && (
        <form className="card stack fade-up" onSubmit={onRegister}>
          <div className="meta-grid">
            <strong>Create your account</strong>
            <span className="muted">Keep access synced across your devices.</span>
          </div>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required />
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
          <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" required />
          <button className="btn btn-primary" type="submit">Create account</button>
        </form>
      )}

      {mode === "forgot" && (
        <form className="card stack fade-up" onSubmit={onForgot}>
          <div className="meta-grid">
            <strong>Recover access</strong>
            <span className="muted">We’ll send reset instructions if the account exists.</span>
          </div>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
          <div className="actions actions--split">
            <button className="btn btn-primary" type="submit">Send reset</button>
            <a className="btn" href="reset.html">Token form</a>
          </div>
        </form>
      )}
    </div>
  );
}
