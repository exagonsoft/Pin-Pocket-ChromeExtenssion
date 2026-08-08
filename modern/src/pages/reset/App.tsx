import { useState } from "react";
import type { FormEvent } from "react";
import { CONFIG } from "../../core/config";
import { PageHeader } from "../../ui/PageHeader";
import { useNotice } from "../../ui/useNotice";

export default function ResetApp() {
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const { notice, show } = useNotice();

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const res = await fetch(`${CONFIG.API_BASE}/auth/reset/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return show(json?.error || "Reset failed", "error");
    show("Password updated. Please log in.", "success");
    setTimeout(() => {
      window.location.href = "auth.html";
    }, 800);
  };

  return (
    <div className="app stack">
      <PageHeader
        eyebrow="Recovery"
        title="Reset Password"
        subtitle="Use the token sent by email to set a new password."
      />
      {notice && <div className={`notice ${notice.tone} fade-up`}>{notice.text}</div>}
      <form className="card stack fade-up" onSubmit={onSubmit}>
        <input className="input" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Reset token" required />
        <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" required />
        <button className="btn btn-primary" type="submit">Update password</button>
      </form>
      <button className="btn" onClick={() => (window.location.href = "auth.html")}>Back to auth</button>
    </div>
  );
}
