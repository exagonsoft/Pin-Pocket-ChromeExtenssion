import { CONFIG } from "./constants.js";
import { authFetch } from "./utils/api.js";
import { toast } from "./utils/toast.js";
import * as Storage from "./utils/storage.js";
import { showLoader, hideLoader } from "./utils/loader.js";
import { setUpNav, loadUserData } from "./utils/nav.js";

//#region Plan Constants
const PLAN_PIN_LIMITS = { standard: 50, pro: Infinity, team: Infinity };

function getPinLimit(planName) {
  return PLAN_PIN_LIMITS[String(planName || "standard").toLowerCase()] ?? 50;
}

function isTeamPlan(planName) {
  return String(planName || "").toLowerCase() === "team";
}
//#endregion

//#region Translation Helper
function t(key, vars = {}, fallback = "") {
  const strings = window.__I18N_STRINGS || {};
  let val = key.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), strings);
  if (typeof val !== "string") return fallback;
  Object.keys(vars).forEach((k) => { val = val.replace(`{${k}}`, vars[k]); });
  return val;
}
//#endregion

//#region UI Elements
const list = document.getElementById("pageList");
const logoutButton = document.getElementById("logout-button");
const teamSelect = document.getElementById("teamSelect");
const teamSelectorRow = document.getElementById("team-selector-row");
const manageTeamSection = document.getElementById("manage-team-section");
const pinActionsRow = document.getElementById("pin-actions-row");
const readonlyBadgeRow = document.getElementById("readonly-badge-row");
const incomingInvitesSection = document.getElementById("incoming-invites-section");
const incomingInvitesList = document.getElementById("incoming-invites-list");

// Single shared tooltip — reused on hover to prevent DOM accumulation
const sharedTooltip = (function () {
  const el = document.getElementById("pin-tooltip-shared") || document.createElement("div");
  el.id = "pin-tooltip-shared";
  el.className = "pin-tooltip";
  el.setAttribute("aria-hidden", "true");
  if (!el.parentElement) document.body.appendChild(el);
  return el;
})();
//#endregion

//#region State
let selectedTeamId = null;
let ownedTeamIds = new Set();   // teams where current user is owner
let currentUserId = null;
let allPins = [];
let currentPlanName = "standard";
let manageTeamUrl = "manageTeam.html";
//#endregion

//#region Language-Aware Links
function resolveSelectedLanguage(languagePreference, language) {
  return (languagePreference && languagePreference !== "auto")
    ? languagePreference
    : (language || "auto");
}

function updateManageTeamLinks(languagePreference, language) {
  const lang = resolveSelectedLanguage(languagePreference, language);
  manageTeamUrl = `manageTeam.html?lang=${encodeURIComponent(lang)}`;

  const inlineLink = manageTeamSection?.querySelector('a[href^="manageTeam.html"]');
  if (inlineLink) inlineLink.href = manageTeamUrl;
}
//#endregion

//#region Filter (registered once)
const filterInput = document.getElementById("pin-filter");
filterInput?.addEventListener("input", () => {
  const q = filterInput.value.trim().toLowerCase();
  renderPins(q
    ? allPins.filter((p) => p.title?.toLowerCase().includes(q) || p.url?.toLowerCase().includes(q))
    : allPins
  );
});
//#endregion

setListMessage("Loading...");

(async () => {
  const { userId, email, planName, picture, language, languagePreference } = await Storage.get([
    "userId", "email", "planName", "picture", "language", "languagePreference",
  ]);

  if (!userId) {
    window.location.href = "auth.html";
    return;
  }

  currentUserId = userId;
  currentPlanName = planName || "standard";
  updateManageTeamLinks(languagePreference, language);

  const emailDisplay = document.getElementById("email");
  if (emailDisplay && email) {
    emailDisplay.textContent = t("popup.loggedInAs", { email }, `Logged in as: ${email}`);
  }

  setUpNav();
  loadUserData(picture);

  // Run team invites check and plan UI in parallel
  await Promise.all([
    loadIncomingInvites(),
    applyPlanUI(currentPlanName, userId),
  ]);
})();

//#region Incoming Invite Notifications
async function loadIncomingInvites() {
  try {
    const res = await authFetch(`${CONFIG.API_BASE}/teams/invites/my`);
    if (!res.ok) return;

    const { invites } = await res.json();
    if (!invites || invites.length === 0) return;

    incomingInvitesList.innerHTML = "";
    invites.forEach((invite) => renderInviteCard(invite));
    incomingInvitesSection?.classList.remove("hidden");
  } catch (_) {
    // Invites are non-critical — fail silently
  }
}

function renderInviteCard(invite) {
  const teamName = invite.team?.name || "a team";
  const inviterName = invite.invitedBy?.name || invite.invitedBy?.email || "someone";

  const li = document.createElement("li");
  li.className = "list-item list-item--invite";
  li.dataset.inviteId = invite._id;

  const info = document.createElement("div");
  info.className = "list-item__content";

  const msg = document.createElement("span");
  msg.className = "list-item__title";
  msg.textContent = t("popup.invites.from", { team: teamName, inviter: inviterName },
    `Invited to ${teamName} by ${inviterName}`);

  info.appendChild(msg);
  li.appendChild(info);

  const actions = document.createElement("div");
  actions.className = "list-item__actions";

  const acceptBtn = document.createElement("button");
  acceptBtn.className = "button-primary button--xs";
  acceptBtn.textContent = t("popup.invites.accept", {}, "Accept");
  acceptBtn.addEventListener("click", async () => {
    try {
      acceptBtn.disabled = true;
      declineBtn.disabled = true;
      const res = await authFetch(`${CONFIG.API_BASE}/teams/invites/${invite._id}/accept`, { method: "POST" });
      if (!res.ok) throw new Error("accept failed");
      toast.success(t("popup.invites.acceptSuccess", { team: teamName }, `You joined ${teamName}!`));
      li.remove();
      if (incomingInvitesList.children.length === 0) {
        incomingInvitesSection?.classList.add("hidden");
      }
      // Refresh teams list and pins so newly joined team appears
      if (isTeamPlan(currentPlanName)) {
        await loadTeams(currentUserId);
      }
    } catch (_) {
      toast.error(t("popup.invites.actionFailed", {}, "Action failed. Please try again."));
      acceptBtn.disabled = false;
      declineBtn.disabled = false;
    }
  });

  const declineBtn = document.createElement("button");
  declineBtn.className = "button-muted button--xs";
  declineBtn.textContent = t("popup.invites.decline", {}, "Decline");
  declineBtn.addEventListener("click", async () => {
    try {
      acceptBtn.disabled = true;
      declineBtn.disabled = true;
      const res = await authFetch(`${CONFIG.API_BASE}/teams/invites/${invite._id}/reject`, { method: "POST" });
      if (!res.ok) throw new Error("decline failed");
      toast.info(t("popup.invites.declineSuccess", {}, "Invite declined."));
      li.remove();
      if (incomingInvitesList.children.length === 0) {
        incomingInvitesSection?.classList.add("hidden");
      }
    } catch (_) {
      toast.error(t("popup.invites.actionFailed", {}, "Action failed. Please try again."));
      acceptBtn.disabled = false;
      declineBtn.disabled = false;
    }
  });

  actions.appendChild(acceptBtn);
  actions.appendChild(declineBtn);
  li.appendChild(actions);
  incomingInvitesList.appendChild(li);
}
//#endregion

//#region Role-Aware UI
function isOwnerOfTeam(teamId) {
  if (!teamId) return true; // personal context → full access
  return ownedTeamIds.has(teamId);
}

function applyTeamRoleUI(teamId) {
  const isOwner = isOwnerOfTeam(teamId);

  if (isOwner) {
    pinActionsRow?.classList.remove("hidden");
    readonlyBadgeRow?.classList.add("hidden");
    // Show manage link only when viewing an owned team (not personal pins)
    if (teamId) {
      manageTeamSection?.classList.remove("hidden");
    } else {
      // Personal context: only show manage link if user owns at least one team
      if (ownedTeamIds.size > 0) {
        manageTeamSection?.classList.remove("hidden");
      } else {
        manageTeamSection?.classList.add("hidden");
      }
    }
  } else {
    // Member-only view: hide save actions, show read-only notice
    pinActionsRow?.classList.add("hidden");
    readonlyBadgeRow?.classList.remove("hidden");
    manageTeamSection?.classList.add("hidden");
  }
}
//#endregion

//#region Plan UI
async function applyPlanUI(planName, userId) {
  if (isTeamPlan(planName)) {
    teamSelectorRow?.classList.remove("hidden");
    const { selectedTeamId: stored } = await Storage.get(["selectedTeamId"]);
    selectedTeamId = stored || null;
    await loadTeams(userId);
  } else {
    applyTeamRoleUI(null); // personal context, no team
    await loadPages(userId, null);
  }
}
//#endregion

//#region Data Handlers
async function loadTeams(userId) {
  try {
    showLoader("Loading teams…");
    const res = await authFetch(`${CONFIG.API_BASE}/extention/teams`);
    if (!res.ok) {
      hideLoader();
      throw new Error("Failed to fetch teams");
    }

    const teams = await res.json();

    // Track which teams the current user owns
    ownedTeamIds = new Set(
      teams
        .filter((team) => {
          const ownerId = team.owner?._id || team.owner;
          return String(ownerId) === String(userId);
        })
        .map((team) => team._id)
    );

    teamSelect.innerHTML = `<option value="">${t("popup.teamSelect.personal", {}, "My pins")}</option>`;

    if (teams.length === 0) {
      // No teams yet — guide the user to create one
      hideLoader();
      applyTeamRoleUI(null);
      showNoTeamsState();
      await loadPages(userId, null);
      return;
    }

    teams.forEach((team) => {
      const option = document.createElement("option");
      option.value = team._id;
      const isOwner = ownedTeamIds.has(team._id);
      option.textContent = isOwner ? team.name : `${team.name} (member)`;
      teamSelect.appendChild(option);
    });

    // Restore previously selected team if it still exists
    if (selectedTeamId && teams.some((t) => t._id === selectedTeamId)) {
      teamSelect.value = selectedTeamId;
    } else {
      selectedTeamId = null;
      teamSelect.value = "";
    }

    hideLoader();
    applyTeamRoleUI(selectedTeamId);
    await loadPages(userId, selectedTeamId);
  } catch (err) {
    toast.error("Failed to load teams.");
    hideLoader();
    applyTeamRoleUI(null);
    await loadPages(userId, null);
  }
}

async function loadPages(userId, teamId = null) {
  try {
    showLoader("Loading pins…");
    const query = teamId ? `?team=${teamId}` : "";
    const res = await authFetch(`${CONFIG.API_BASE}/pins${query}`);

    if (!res.ok) {
      setListMessage("Error loading pins.");
      hideLoader();
      return;
    }

    const pins = await res.json();
    allPins = pins.data;
    renderPins(pins.data);

    if (!pins.data.length) setListMessage("No pinned pages yet.");
    hideLoader();
  } catch (err) {
    toast.error("Load error.");
    setListMessage("Failed to load pins. Try again.");
    hideLoader();
  }
}

async function importPinnedTabs(userId) {
  try {
    showLoader("Importing pinned tabs…");

    const { planName } = await Storage.get(["planName"]);
    const limit = getPinLimit(planName);

    const tabs = await new Promise((resolve) => chrome.tabs.query({ pinned: true }, resolve));

    const res = await authFetch(`${CONFIG.API_BASE}/pins`);
    if (!res.ok) throw new Error("Failed to fetch existing pins");

    const existingPins = await res.json();
    const existingContexts = new Set(existingPins.data.map((p) => p.contextKey));
    const currentCount = existingPins.data.length;

    let newTabs = tabs.filter((tab) => tab.url && !existingContexts.has(extractContextKey(tab.url)));

    if (newTabs.length === 0) {
      toast.info("All your pinned tabs are already saved.");
      return;
    }

    if (limit !== Infinity) {
      const remaining = limit - currentCount;
      if (remaining <= 0) {
        toast.warn(t("popup.pinLimitReached", {}, "You've reached your plan's pin limit. Upgrade to unlock more."));
        return;
      }
      if (newTabs.length > remaining) {
        toast.info(`Your plan allows ${remaining} more pin${remaining > 1 ? "s" : ""}. Only the first ${remaining} will be imported.`);
        newTabs = newTabs.slice(0, remaining);
      }
    }

    await Promise.all(newTabs.map((tab) =>
      authFetch(`${CONFIG.API_BASE}/pins`, {
        method: "POST",
        body: JSON.stringify({
          title: tab.title || tab.url,
          url: normalizeUrl(tab.url),
          contextKey: extractContextKey(tab.url),
          time: new Date().toISOString(),
          teamId: selectedTeamId || null,
          favicon: tab.favIconUrl || null,
        }),
      })
    ));

    toast.success(`Imported ${newTabs.length} new pinned tab${newTabs.length > 1 ? "s" : ""}.`);
    loadPages(userId, selectedTeamId);
  } catch (err) {
    toast.error("Failed to import pinned tabs.");
  } finally {
    hideLoader();
  }
}
//#endregion

//#region Event Listeners
logoutButton?.addEventListener("click", async () => {
  await Storage.clear();
  window.location.href = "auth.html";
});

document.getElementById("pin-current")?.addEventListener("click", async () => {
  const { userId, planName } = await Storage.get(["userId", "planName"]);
  if (!userId) { toast.warn("You are not logged in."); return; }

  showLoader("Pinning current tab…");
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const tab = tabs[0];
    if (!tab?.url) {
      hideLoader();
      toast.warn("No active tab found.");
      return;
    }

    // Enforce pin limit for non-unlimited plans
    const limit = getPinLimit(planName);
    if (limit !== Infinity) {
      try {
        const check = await authFetch(`${CONFIG.API_BASE}/pins`);
        if (check.ok) {
          const existing = await check.json();
          if (existing.data.length >= limit) {
            hideLoader();
            toast.warn(t("popup.pinLimitReached", {}, "You've reached your plan's pin limit. Upgrade to unlock more."));
            return;
          }
        }
      } catch (_) { /* proceed optimistically */ }
    }

    authFetch(`${CONFIG.API_BASE}/pins`, {
      method: "POST",
      body: JSON.stringify({
        title: tab.title || tab.url,
        url: normalizeUrl(tab.url),
        contextKey: extractContextKey(tab.url),
        time: new Date().toISOString(),
        teamId: selectedTeamId || null,
        favicon: tab.favIconUrl || null,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const err = await response.json();
          hideLoader();
          toast.error(`Failed to pin: ${err?.error || response.statusText}`);
        } else {
          loadPages(userId, selectedTeamId);
        }
      })
      .catch((error) => {
        hideLoader();
        toast.error(`Something went wrong. ${error.message}`);
      });
  });
});

teamSelect?.addEventListener("change", async () => {
  selectedTeamId = teamSelect.value || null;
  await Storage.set({ selectedTeamId: selectedTeamId || "" });
  applyTeamRoleUI(selectedTeamId);
  const { userId } = await Storage.get(["userId"]);
  if (userId) loadPages(userId, selectedTeamId);
});

document.getElementById("reimport-button")?.addEventListener("click", async () => {
  const { userId } = await Storage.get(["userId"]);
  if (!userId) return;
  await importPinnedTabs(userId);
});

window.addEventListener("unhandledrejection", () => {
  document.body.classList.remove("loading");
});
//#endregion

//#region Render
function renderPins(pins) {
  list.innerHTML = "";

  if (!pins.length) {
    setListMessage("No matching pins.");
    return;
  }

  pins.forEach((pin) => {
    const li = document.createElement("li");
    li.className = "list-item";

    const content = document.createElement("div");
    const linkRow = document.createElement("div");
    content.className = "list-item__content";
    linkRow.className = "list-item__link-row";

    if (pin.favicon) {
      const img = document.createElement("img");
      img.src = pin.favicon;
      img.alt = "";
      img.setAttribute("aria-hidden", "true");
      img.className = "list-item__favicon";
      linkRow.appendChild(img);
    }

    const link = document.createElement("a");
    link.href = pin.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "list-item__link";
    link.textContent = pin.title || pin.url;
    linkRow.appendChild(link);

    const meta = document.createElement("span");
    meta.className = "list-item__meta";
    try { meta.textContent = new URL(pin.url).hostname; }
    catch { meta.textContent = t("popup.unknownSource", {}, "Unknown source"); }

    content.appendChild(linkRow);
    content.appendChild(meta);

    // Only show remove button if user can manage this context
    if (isOwnerOfTeam(selectedTeamId)) {
      const removeBtn = document.createElement("button");
      removeBtn.textContent = t("popup.remove", {}, "Remove");
      removeBtn.setAttribute("aria-label", `Remove ${pin.title || pin.url}`);
      removeBtn.className = "icon-button";
      removeBtn.onclick = async () => {
        try {
          showLoader("Removing pin…");
          const res = await authFetch(`${CONFIG.API_BASE}/pins/${pin._id}`, { method: "DELETE" });
          if (res.ok) {
            hideLoader();
            toast.success("Pin removed.");
            loadPages(null, selectedTeamId);
          } else {
            const err = await res.json();
            hideLoader();
            toast.error(err?.error || "Failed to remove pin.");
          }
        } catch (_) {
          hideLoader();
          toast.error("Failed to remove pin.");
        }
      };
      li.appendChild(removeBtn);
    }

    if (pin.summary || pin.tags?.length) {
      li.addEventListener("mouseenter", () => {
        sharedTooltip.innerHTML = "";
        if (pin.summary) {
          const el = document.createElement("div");
          el.className = "pin-tooltip__summary";
          el.textContent = pin.summary;
          sharedTooltip.appendChild(el);
        }
        if (pin.tags?.length) {
          const el = document.createElement("div");
          el.className = "pin-tooltip__tags";
          pin.tags.forEach((tag) => {
            const span = document.createElement("span");
            span.textContent = `#${tag}`;
            el.appendChild(span);
          });
          sharedTooltip.appendChild(el);
        }
        const rect = li.getBoundingClientRect();
        sharedTooltip.style.top = `${rect.top + window.scrollY - 8}px`;
        sharedTooltip.style.left = `${rect.left + window.scrollX + rect.width / 2}px`;
        sharedTooltip.style.transform = "translateX(-50%) translateY(-100%)";
        sharedTooltip.removeAttribute("aria-hidden");
        sharedTooltip.classList.add("visible");
      });
      li.addEventListener("mouseleave", () => {
        sharedTooltip.classList.remove("visible");
        sharedTooltip.setAttribute("aria-hidden", "true");
      });
    }

    li.appendChild(content);
    list.appendChild(li);
  });
}

function showNoTeamsState() {
  if (!list) return;
  list.innerHTML = "";
  const li = document.createElement("li");
  li.className = "list-item list-item--muted";

  const msg = document.createElement("span");
  msg.textContent = t("popup.noTeamsYet", {}, "You haven't created a team yet.");
  li.appendChild(msg);

  const ctaLink = document.createElement("a");
  ctaLink.href = manageTeamUrl;
  ctaLink.target = "_blank";
  ctaLink.rel = "noopener noreferrer";
  ctaLink.className = "link-inline";
  ctaLink.style.marginLeft = "6px";
  ctaLink.textContent = t("popup.createFirstTeam", {}, "Create your first team →");
  li.appendChild(ctaLink);

  list.appendChild(li);

  // Ensure manage team link is visible so user knows where to go
  manageTeamSection?.classList.remove("hidden");
}

function setListMessage(message) {
  if (!list) return;
  list.innerHTML = "";
  const li = document.createElement("li");
  li.className = "list-item list-item--muted";
  li.textContent = message;
  list.appendChild(li);
}

function normalizeUrl(url) {
  try { const u = new URL(url); u.hash = ""; return u.toString(); }
  catch { return url; }
}

function extractContextKey(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("chat.openai.com")) {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "c" && parts.length >= 3) return `chatgpt:${parts[1]}:${parts[2]}`;
    }
    if (u.hostname === "github.com") {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[2] === "issues" && parts[3]) return `github:${parts[0]}/${parts[1]}#${parts[3]}`;
    }
    if (u.pathname.includes("/browse/")) return `jira:${u.pathname.split("/browse/")[1]}`;
    return `url:${normalizeUrl(url)}`;
  } catch { return `url:${url}`; }
}
//#endregion
