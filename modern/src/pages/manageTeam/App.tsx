import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch, authJson } from "../../core/api";
import { requireSession } from "../../core/session";
import type { Team, TeamInvite } from "../../core/types";
import { usePreferences } from "../../ui/usePreferences";
import { PageHeader } from "../../ui/PageHeader";
import { useNotice } from "../../ui/useNotice";

function ownerIdOf(team: Team) {
  return typeof team.owner === "string" ? team.owner : team.owner?._id || "";
}

type BusyAction = "create" | "rename" | "delete" | "invite" | "remove" | "refresh";

function inviteCreatedAt(invite: TeamInvite) {
  if (!invite.createdAt) return "Unknown date";
  const value = new Date(invite.createdAt);
  return Number.isNaN(value.getTime()) ? "Unknown date" : value.toLocaleDateString();
}

export default function ManageTeamApp() {
  const [userId, setUserId] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [pendingInvites, setPendingInvites] = useState<TeamInvite[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [renameTo, setRenameTo] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [isBooting, setIsBooting] = useState(true);
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null);
  const { notice, show } = useNotice();
  const { uiStrings } = usePreferences();

  const ownedTeams = useMemo(
    () => teams.filter((team) => ownerIdOf(team) === userId),
    [teams, userId],
  );

  const selectedTeam = useMemo(
    () => ownedTeams.find((team) => team._id === selectedTeamId) || null,
    [ownedTeams, selectedTeamId],
  );

  const ownerId = selectedTeam ? ownerIdOf(selectedTeam) : "";

  const selectedMembers = useMemo(() => {
    const members = selectedTeam?.members || [];
    return [...members].sort((left, right) => {
      const leftLabel = typeof left === "string" ? left : left.email || left.name || left._id;
      const rightLabel = typeof right === "string" ? right : right.email || right.name || right._id;
      return leftLabel.localeCompare(rightLabel);
    });
  }, [selectedTeam]);

  const loadPendingInvites = useCallback(async (teamId: string) => {
    if (!teamId) return setPendingInvites([]);
    const payload = await authJson<{ invites?: TeamInvite[] }>(`/teams/${teamId}/invites`);
    setPendingInvites(Array.isArray(payload?.invites) ? payload.invites : []);
  }, []);

  const loadTeams = useCallback(async (sessionUserId: string, preferredTeamId?: string) => {
    const list = await authJson<Team[]>("/teams");
    const owners = (Array.isArray(list) ? list : []).filter(
      (team) => ownerIdOf(team) === sessionUserId,
    );
    setTeams(Array.isArray(list) ? list : []);

    const nextSelectedId =
      owners.find((team) => team._id === preferredTeamId)?._id ||
      owners[0]?._id ||
      "";
    setSelectedTeamId(nextSelectedId);
    setRenameTo(owners.find((team) => team._id === nextSelectedId)?.name || "");
    return nextSelectedId;
  }, []);

  const onSelectTeam = useCallback((teamId: string) => {
    setSelectedTeamId(teamId);
    const team = ownedTeams.find((entry) => entry._id === teamId) || null;
    setRenameTo(team?.name || "");
    void loadPendingInvites(teamId);
  }, [loadPendingInvites, ownedTeams]);

  useEffect(() => {
    const previous = document.documentElement.dataset.layout;
    document.documentElement.dataset.layout = "page";
    return () => {
      if (previous) {
        document.documentElement.dataset.layout = previous;
        return;
      }
      delete document.documentElement.dataset.layout;
    };
  }, []);

  useEffect(() => {
    requireSession()
      .then(async (session) => {
        const nextUserId = session.userId || "";
        setUserId(nextUserId);
        const teamId = await loadTeams(nextUserId);
        onSelectTeam(teamId);
        setIsBooting(false);
      })
      .catch(() => setIsBooting(false));
  }, [loadTeams, onSelectTeam]);

  const createTeam = async () => {
    if (!newTeamName.trim()) return show("Enter a team name", "warn");
    setBusyAction("create");
    const res = await authFetch("/teams", {
      method: "POST",
      body: JSON.stringify({ name: newTeamName.trim() }),
    });
    setBusyAction(null);
    if (!res.ok) return show("Failed to create team", "error");
    setNewTeamName("");
    const teamId = await loadTeams(userId, selectedTeamId);
    await loadPendingInvites(teamId);
    show("Team created", "success");
  };

  const renameTeam = async () => {
    if (!selectedTeamId || !renameTo.trim()) return show("Enter a new team name", "warn");
    setBusyAction("rename");
    const res = await authFetch(`/teams/${selectedTeamId}`, {
      method: "PATCH",
      body: JSON.stringify({ name: renameTo.trim() }),
    });
    setBusyAction(null);
    if (!res.ok) return show("Failed to rename team", "error");
    const teamId = await loadTeams(userId, selectedTeamId);
    await loadPendingInvites(teamId);
    show("Team renamed", "success");
  };

  const deleteTeam = async () => {
    if (!selectedTeamId) return;
    const ok = window.confirm("Delete this team and all team pins?");
    if (!ok) return;
    setBusyAction("delete");
    const res = await authFetch(`/teams/${selectedTeamId}`, { method: "DELETE" });
    setBusyAction(null);
    if (!res.ok) return show("Failed to delete team", "error");
    const teamId = await loadTeams(userId);
    await loadPendingInvites(teamId);
    show("Team deleted", "success");
  };

  const sendInvite = async () => {
    if (!selectedTeamId) return show("Select a team first", "warn");
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return show("Enter an email", "warn");
    setBusyAction("invite");
    const res = await authFetch(`/teams/${selectedTeamId}/invites`, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    setBusyAction(null);
    if (!res.ok) return show("Failed to send invite", "error");
    setInviteEmail("");
    await loadPendingInvites(selectedTeamId);
    show("Invite sent", "success");
  };

  const removeMember = async (memberId: string) => {
    if (!selectedTeamId) return;
    setBusyAction("remove");
    const res = await authFetch(`/teams/${selectedTeamId}/remove`, {
      method: "POST",
      body: JSON.stringify({ userIdToRemove: memberId }),
    });
    setBusyAction(null);
    if (!res.ok) return show("Failed to remove member", "error");
    const teamId = await loadTeams(userId, selectedTeamId);
    await loadPendingInvites(teamId);
    show("Member removed", "success");
  };

  const refreshData = async () => {
    if (!userId) return;
    setBusyAction("refresh");
    const teamId = await loadTeams(userId, selectedTeamId);
    await loadPendingInvites(teamId);
    setBusyAction(null);
  };

  if (isBooting) {
    return (
      <div className="app app--page stack">
        <PageHeader
          eyebrow={uiStrings.teamsEyebrow}
          title={uiStrings.teamsTitle}
          subtitle="Loading owner controls..."
        />
      </div>
    );
  }

  return (
    <div className="app app--page stack">
      <PageHeader
        eyebrow={uiStrings.teamsEyebrow}
        title={uiStrings.teamsTitle}
        subtitle={uiStrings.teamsSubtitle}
      />
      {notice && <div className={`notice ${notice.tone} fade-up`}>{notice.text}</div>}

      {ownedTeams.length === 0 ? (
        <div className="card stack fade-up">
          <div className="notice warn">Only team owners can open this page.</div>
          <button className="btn btn-primary" onClick={() => (window.location.href = "popup.html")}>
            Back to pins
          </button>
        </div>
      ) : (
        <>
          <div className="stats-grid fade-up">
            <div className="card stat-card">
              <span className="muted">Owned teams</span>
              <strong>{ownedTeams.length}</strong>
            </div>
            <div className="card stat-card">
              <span className="muted">Members</span>
              <strong>{selectedMembers.length}</strong>
            </div>
            <div className="card stat-card">
              <span className="muted">Pending invites</span>
              <strong>{pendingInvites.length}</strong>
            </div>
          </div>

          <div className="card stack fade-up">
            <div className="section-title">
              <strong>Create team</strong>
              <button className="btn" disabled={busyAction !== null} onClick={() => void refreshData()}>
                Refresh
              </button>
            </div>
            <div className="field-action">
              <input
                className="input"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="New team name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void createTeam();
                }}
                disabled={busyAction !== null}
              />
              <button
                className="btn btn-primary"
                onClick={() => void createTeam()}
                disabled={busyAction !== null}
              >
                Create
              </button>
            </div>
          </div>

          <div className="card stack fade-up">
            <strong>Active team</strong>
            <select
              value={selectedTeamId}
              onChange={(e) => onSelectTeam(e.target.value)}
              disabled={busyAction !== null}
            >
              {ownedTeams.map((team) => (
                <option key={team._id} value={team._id}>
                  {team.name}
                </option>
              ))}
            </select>
            <span className="muted">Selected team owner: you</span>
            <div className="actions actions--split">
              <input
                className="input"
                value={renameTo}
                onChange={(e) => setRenameTo(e.target.value)}
                placeholder="Rename team"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void renameTeam();
                }}
                disabled={busyAction !== null}
              />
              <button
                className="btn btn-primary"
                onClick={() => void renameTeam()}
                disabled={busyAction !== null}
              >
                Rename
              </button>
              <button
                className="btn btn-danger"
                onClick={() => void deleteTeam()}
                disabled={busyAction !== null}
              >
                Delete
              </button>
            </div>
          </div>

          <div className="card stack fade-up">
            <strong>Invite member</strong>
            <div className="field-action">
              <input
                className="input"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="member@example.com"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void sendInvite();
                }}
                disabled={busyAction !== null}
              />
              <button
                className="btn btn-primary"
                onClick={() => void sendInvite()}
                disabled={busyAction !== null}
              >
                Send invite
              </button>
            </div>
          </div>

          <div className="card stack fade-up">
            <div className="section-title">
              <strong>Members</strong>
              <span>{selectedMembers.length}</span>
            </div>
            <ul className="list">
              {selectedMembers.map((member) => {
                const id = typeof member === "string" ? member : member._id;
                const email = typeof member === "string" ? member : member.email || member.name || id;
                const isOwner = id === ownerId;
                return (
                  <li className="item link-row" key={id}>
                    <span className="text-ellipsis">{email}</span>
                    {isOwner ? (
                      <span className="badge">Owner</span>
                    ) : (
                      <button
                        className="btn btn-danger"
                        onClick={() => void removeMember(id)}
                        disabled={busyAction !== null}
                      >
                        Remove
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="card stack fade-up">
            <div className="section-title">
              <strong>Pending invites</strong>
              <span>{pendingInvites.length}</span>
            </div>
            <ul className="list">
              {pendingInvites.length === 0 && <li className="item muted">No pending invites.</li>}
              {pendingInvites.map((invite) => (
                <li className="item meta-line" key={invite._id}>
                  <span className="text-ellipsis">{invite.invitedEmail}</span>
                  <span>{invite.status} • {inviteCreatedAt(invite)}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
