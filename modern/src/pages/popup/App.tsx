import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch, authJson, authPost } from "../../core/api";
import { extractContextKey, normalizeUrl, parseTags } from "../../core/pins";
import { requireSession, clearSession } from "../../core/session";
import { storage } from "../../core/storage";
import type { Pin, Team, TeamInvite } from "../../core/types";
import { PageHeader } from "../../ui/PageHeader";
import { Nav } from "../../ui/Nav";
import { usePreferences } from "../../ui/usePreferences";
import { useNotice } from "../../ui/useNotice";

function normalizePins(payload: unknown): Pin[] {
  if (Array.isArray(payload)) return payload as Pin[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown[] }).data)) {
    return (payload as { data: Pin[] }).data;
  }
  return [];
}

export default function PopupApp() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const { notice, show } = useNotice();
  const { uiStrings } = usePreferences();

  const ownerIdOf = (team: Team) =>
    typeof team.owner === "string" ? team.owner : team.owner?._id || "";

  const isOwnerOfActiveTeam = useMemo(() => {
    if (!activeTeamId) return false;
    const team = teams.find((t) => t._id === activeTeamId);
    if (!team) return false;
    return ownerIdOf(team) === userId;
  }, [activeTeamId, teams, userId]);

  const ownedTeams = useMemo(
    () => teams.filter((team) => ownerIdOf(team) === userId),
    [teams, userId],
  );

  const filteredPins = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return pins;
    return pins.filter((p) => p.title?.toLowerCase().includes(q) || p.url?.toLowerCase().includes(q));
  }, [pins, filter]);

  const hostOf = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return uiStrings.unknownSource;
    }
  };

  const loadPins = useCallback(async (teamId: string | null) => {
    const payload = await authJson<unknown>(teamId ? `/pins?team=${teamId}` : "/pins");
    const normalized = normalizePins(payload);
    setPins(normalized);
    await storage.setLocal({ cachedPins: normalized, cachedPinsAt: Date.now() });
  }, []);

  const loadTeams = useCallback(async (sessionUserId: string) => {
    const nextTeams = await authJson<Team[]>("/teams");
    setTeams(Array.isArray(nextTeams) ? nextTeams : []);

    const stored = await storage.getLocal<{ activeTeamId?: string }>(["activeTeamId"]);
    const stillAvailable = nextTeams.some((team) => team._id === stored.activeTeamId);
    const nextActiveTeamId = stillAvailable ? (stored.activeTeamId || null) : null;
    setActiveTeamId(nextActiveTeamId);
    await storage.setLocal({ activeTeamId: nextActiveTeamId });

    const hasOwnerTeam = nextTeams.some((team) => ownerIdOf(team) === sessionUserId);
    await storage.setLocal({ hasOwnerTeam });

    return nextActiveTeamId;
  }, []);

  const loadInvites = useCallback(async () => {
    const payload = await authJson<{ invites?: TeamInvite[] }>("/teams/invites/my");
    setInvites(Array.isArray(payload?.invites) ? payload.invites : []);
  }, []);

  useEffect(() => {
    (async () => {
      const session = await requireSession();
      setEmail(session.email || "");
      setUserId(session.userId || "");
      try {
        const verifyRes = await authFetch("/auth/verifyCookies");
        if (!verifyRes.ok) {
          await clearSession();
          window.location.href = "auth.html";
          return;
        }
      } catch {
        return;
      }
      const nextActiveTeamId = await loadTeams(session.userId || "");
      await Promise.all([loadPins(nextActiveTeamId), loadInvites()]);
    })().catch(() => undefined);
  }, [loadInvites, loadPins, loadTeams]);

  const changeTeamContext = async (nextTeamId: string | null) => {
    setActiveTeamId(nextTeamId);
    await storage.setLocal({ activeTeamId: nextTeamId });
    await loadPins(nextTeamId);
  };

  const pinCurrent = async () => {
    if (activeTeamId && !isOwnerOfActiveTeam) {
      return show(uiStrings.onlyOwnersPin, "warn");
    }

    const tags = parseTags(tagInput);
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.url) return show(uiStrings.noActiveTab, "warn");

    await authPost("/pins", {
      title: tab.title || tab.url,
      url: normalizeUrl(tab.url),
      contextKey: extractContextKey(tab.url),
      time: new Date().toISOString(),
      favicon: tab.favIconUrl || null,
      teamId: activeTeamId || null,
      tags,
    });
    await loadPins(activeTeamId);
    show(uiStrings.pinnedCurrentTab, "success");
  };

  const importPinned = async () => {
    if (activeTeamId && !isOwnerOfActiveTeam) {
      return show(uiStrings.onlyOwnersPin, "warn");
    }

    const tabs = await chrome.tabs.query({ pinned: true });
    if (!tabs.length) return show(uiStrings.noBrowserPinnedTabs, "warn");

    const existing = await authJson<unknown>(activeTeamId ? `/pins?team=${activeTeamId}` : "/pins");
    const existingPins = normalizePins(existing);
    const contexts = new Set(existingPins.map((p) => extractContextKey(p.url)));

    let success = 0;
    for (const tab of tabs) {
      if (!tab.url) continue;
      const contextKey = extractContextKey(tab.url);
      if (contexts.has(contextKey)) continue;
      const res = await authFetch("/pins", {
        method: "POST",
        body: JSON.stringify({
          title: tab.title || tab.url,
          url: normalizeUrl(tab.url),
          contextKey,
          time: new Date().toISOString(),
          favicon: tab.favIconUrl || null,
          teamId: activeTeamId || null,
        }),
      });
      if (res.ok) success += 1;
    }
    await loadPins(activeTeamId);
    show(uiStrings.importedPinnedTabs.replace("{count}", String(success)), "success");
  };

  const removePin = async (id: string) => {
    if (activeTeamId && !isOwnerOfActiveTeam) {
      return show(uiStrings.onlyOwnersDelete, "warn");
    }
    const res = await authFetch(`/pins/${id}`, { method: "DELETE" });
    if (!res.ok) return show(uiStrings.failedDeletePin, "error");
    await loadPins(activeTeamId);
    show(uiStrings.pinRemoved, "success");
  };

  const handleInviteAction = async (inviteId: string, action: "accept" | "reject") => {
    const res = await authFetch(`/teams/invites/${inviteId}/${action}`, { method: "POST" });
    if (!res.ok) return show(uiStrings.failedInviteAction.replace("{action}", action), "error");
    await Promise.all([loadInvites(), loadTeams(userId)]);
    show(action === "accept" ? uiStrings.inviteAccepted : uiStrings.inviteDeclined, "success");
  };

  const logout = async () => {
    try {
      await authFetch("/auth/logout", { method: "POST" });
    } finally {
      await clearSession();
      window.location.href = "auth.html";
    }
  };

  return (
    <div className="app stack">
      <PageHeader
        eyebrow={uiStrings.popupEyebrow}
        title="PinPocket"
        subtitle={uiStrings.popupSubtitle}
      />
      <Nav current="pins" />
      <div className="meta-line">
        <span>{email ? uiStrings.signedIn : uiStrings.checkingSession}</span>
        <span>{email || "—"}</span>
      </div>
      {notice && <div className={`notice ${notice.tone} fade-up`}>{notice.text}</div>}

      <div className="card stack fade-up">
        <div className="section-title">
          <strong>{uiStrings.workspace}</strong>
          <span>{activeTeamId ? uiStrings.teamContext : uiStrings.personalContext}</span>
        </div>
        <select
          value={activeTeamId || "__personal"}
          onChange={(e) => void changeTeamContext(e.target.value === "__personal" ? null : e.target.value)}
        >
          <option value="__personal">{uiStrings.personal}</option>
          {teams.map((team) => (
            <option key={team._id} value={team._id}>
              {team.name}
            </option>
          ))}
        </select>
        {activeTeamId && !isOwnerOfActiveTeam && (
          <div className="notice info">{uiStrings.memberMode}</div>
        )}
        {ownedTeams.length > 0 && (
          <button
            className="btn"
            onClick={() =>
              chrome.tabs.create({ url: chrome.runtime.getURL("manageTeam.html") })
            }
          >
            {uiStrings.openTeamManage}
          </button>
        )}
      </div>

      {invites.length > 0 && (
        <div className="card stack fade-up">
          <div className="section-title">
            <strong>{uiStrings.teamInvites}</strong>
            <span>{invites.length} {uiStrings.pending}</span>
          </div>
          <ul className="list">
            {invites.map((invite) => {
              const teamName =
                typeof invite.team === "string" ? uiStrings.team : invite.team?.name || uiStrings.team;
              return (
                <li className="item stack" key={invite._id}>
                  <div className="meta-line">
                    <span>{teamName}</span>
                    <span>{invite.invitedEmail}</span>
                  </div>
                  <div className="actions actions--split">
                    <button className="btn btn-primary" onClick={() => void handleInviteAction(invite._id, "accept")}>
                      {uiStrings.accept}
                    </button>
                    <button className="btn btn-danger" onClick={() => void handleInviteAction(invite._id, "reject")}>
                      {uiStrings.decline}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="card stack fade-up">
        <div className="section-title">
          <strong>{uiStrings.quickActions}</strong>
          <span>{activeTeamId ? uiStrings.teamOperations : uiStrings.personalOperations}</span>
        </div>
        <div className="actions actions--split">
          <button className="btn btn-primary" onClick={pinCurrent} disabled={Boolean(activeTeamId && !isOwnerOfActiveTeam)}>
            {uiStrings.pinCurrentTab}
          </button>
          <button className="btn" onClick={importPinned} disabled={Boolean(activeTeamId && !isOwnerOfActiveTeam)}>
            {uiStrings.importPinnedTabs}
          </button>
        </div>

        <input className="input" value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder={uiStrings.tagsPlaceholder} />
        <input className="input" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={uiStrings.filterPinsPlaceholder} />
      </div>

      <ul className="list">
        {filteredPins.length === 0 && <li className="item muted fade-up">{uiStrings.noPinsFound}</li>}
        {filteredPins.map((pin) => (
          <li className="item stack fade-up" key={pin._id}>
            <div className="link-row">
              <div className="pin-title-row">
                {pin.favicon && <img src={pin.favicon} alt="" className="pin-icon" />}
                <a className="pin-link" href={pin.url} target="_blank" rel="noreferrer">{pin.title || pin.url}</a>
              </div>
              <button
                className="btn btn-danger"
                disabled={Boolean(activeTeamId && !isOwnerOfActiveTeam)}
                onClick={() => void removePin(pin._id)}
              >
                {uiStrings.remove}
              </button>
            </div>
            <div className="meta-line">
              <span>{hostOf(pin.url)}</span>
              <span>{pin.tags?.length ? `${pin.tags.length} ${uiStrings.tagsSuffix}` : uiStrings.noTags}</span>
            </div>
            {!!pin.tags?.length && <div className="muted">{pin.tags.map((t) => `#${t}`).join(" ")}</div>}
          </li>
        ))}
      </ul>

      <button className="btn btn-danger" onClick={logout}>{uiStrings.logout}</button>
    </div>
  );
}
