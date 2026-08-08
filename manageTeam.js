//#region Imports
import { CONFIG } from './constants.js';
import { authFetch } from "./utils/api.js";
import { toast } from "./utils/toast.js";
import * as Storage from "./utils/storage.js";
import I18N from "./i18n.js";
//#endregion

//#region DOM References
const teamSelector = document.getElementById('teamSelector');
const inviteForm = document.getElementById('inviteForm');
const inviteEmailInput = document.getElementById('inviteEmail');
const memberList = document.getElementById('memberList');
const pendingList = document.getElementById('pendingList');
const renameInput = document.getElementById('renameInput');
const renameButton = document.getElementById('renameButton');
const deleteTeamButton = document.getElementById('deleteTeam');
const ownerControls = document.getElementById('ownerControls');
const newTeamNameInput = document.getElementById('newTeamName');
const createTeamButton = document.getElementById('createTeam');
//#endregion

//#region State
let currentTeamId = null;
let currentUserId = null;
let isOwner = false;
let cachedTeams = [];
//#endregion

//#region Translation Helper
function t(key, fallback = '') {
  const strings = window.__I18N_STRINGS || {};
  const val = key.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), strings);
  return typeof val === 'string' ? val : fallback;
}
//#endregion

//#region Member Rendering
function renderMembers(members, ownerId) {
  if (!memberList) return;
  memberList.innerHTML = '';

  if (!Array.isArray(members) || members.length === 0) {
    const li = document.createElement('li');
    li.className = 'list-item list-item--muted';
    li.textContent = t('manageTeam.noMembers', 'No members yet.');
    memberList.appendChild(li);
    return;
  }

  members.forEach((member) => {
    const memberId = member?._id || member?.id || member;
    const email = member?.email || String(memberId || 'Unknown user');

    const li = document.createElement('li');
    li.className = 'list-item';

    const content = document.createElement('div');
    content.className = 'list-item__content';

    const title = document.createElement('span');
    title.className = 'list-item__title';
    title.textContent = email;

    const meta = document.createElement('span');
    meta.className = 'list-item__meta';
    if (memberId === ownerId) {
      meta.textContent = t('manageTeam.ownerLabel', 'Owner');
    } else if (memberId === currentUserId) {
      meta.textContent = t('manageTeam.youLabel', 'You');
    } else if (member?.role) {
      meta.textContent = member.role;
    } else {
      meta.textContent = t('manageTeam.memberLabel', 'Member');
    }

    content.appendChild(title);
    content.appendChild(meta);
    li.appendChild(content);

    if (isOwner && memberId !== ownerId) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'icon-button';
      removeBtn.textContent = t('manageTeam.members.remove', 'Remove');
      removeBtn.setAttribute('aria-label', `Remove ${email}`);
      removeBtn.addEventListener('click', async () => {
        try {
          const response = await authFetch(`${CONFIG.API_BASE}/teams/${currentTeamId}/remove`, {
            method: 'POST',
            body: JSON.stringify({ userIdToRemove: memberId }),
          });
          if (!response.ok) {
            toast.error(t('manageTeam.members.removeFailed', 'Failed to remove member.'));
            return;
          }
          toast.success(t('manageTeam.members.removeSuccess', 'Member removed.'));
          await reloadCurrentTeam();
        } catch (err) {
          console.error('Failed to remove member:', err);
          toast.error(t('manageTeam.members.removeFailed', 'Failed to remove member.'));
        }
      });
      li.appendChild(removeBtn);
    }

    memberList.appendChild(li);
  });
}
//#endregion

//#region Pending Invites Rendering
async function loadPendingInvites() {
  if (!pendingList || !currentTeamId || !isOwner) return;

  pendingList.innerHTML = '';

  try {
    const res = await authFetch(`${CONFIG.API_BASE}/teams/${currentTeamId}/invites`);
    if (!res.ok) throw new Error('Failed to load invites');

    const { invites } = await res.json();

    if (!invites || invites.length === 0) {
      const li = document.createElement('li');
      li.className = 'list-item list-item--muted';
      li.textContent = t('manageTeam.pendingInvites.none', 'No pending invites.');
      pendingList.appendChild(li);
      return;
    }

    invites.forEach((invite) => {
      const li = document.createElement('li');
      li.className = 'list-item';

      const content = document.createElement('div');
      content.className = 'list-item__content';

      const email = document.createElement('span');
      email.className = 'list-item__title';
      email.textContent = invite.invitedEmail;

      const meta = document.createElement('span');
      meta.className = 'list-item__meta';
      meta.textContent = invite.createdAt
        ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(invite.createdAt))
        : '';

      content.appendChild(email);
      content.appendChild(meta);
      li.appendChild(content);

      const revokeBtn = document.createElement('button');
      revokeBtn.className = 'icon-button icon-button--danger';
      revokeBtn.textContent = t('manageTeam.pendingInvites.revoke', 'Revoke');
      revokeBtn.setAttribute('aria-label', `Revoke invite for ${invite.invitedEmail}`);
      revokeBtn.addEventListener('click', async () => {
        try {
          const response = await authFetch(
            `${CONFIG.API_BASE}/teams/${currentTeamId}/invites/${invite._id}`,
            { method: 'DELETE' }
          );
          if (!response.ok) {
            toast.error(t('manageTeam.pendingInvites.revokeFailed', 'Failed to revoke invite.'));
            return;
          }
          toast.success(t('manageTeam.pendingInvites.revokeSuccess', 'Invite revoked.'));
          await loadPendingInvites();
        } catch (err) {
          console.error('Revoke invite error:', err);
          toast.error(t('manageTeam.pendingInvites.revokeFailed', 'Failed to revoke invite.'));
        }
      });

      li.appendChild(revokeBtn);
      pendingList.appendChild(li);
    });
  } catch (err) {
    console.error('Failed to load pending invites:', err);
    const li = document.createElement('li');
    li.className = 'list-item list-item--muted';
    li.textContent = t('manageTeam.pendingInvites.loadFailed', 'Could not load pending invites.');
    pendingList.appendChild(li);
  }
}
//#endregion

//#region Team State
function applyTeamState(team) {
  if (!team) {
    currentTeamId = null;
    isOwner = false;
    ownerControls?.classList.add('hidden');
    if (renameInput) renameInput.value = '';
    renderMembers([], null);
    hidePendingInvites();
    return;
  }

  currentTeamId = team._id;
  const ownerId = team?.owner?._id || team?.owner;
  isOwner = String(ownerId) === String(currentUserId);

  if (ownerControls) {
    ownerControls.classList.toggle('hidden', !isOwner);
  }

  if (renameInput) renameInput.value = team?.name || '';

  renderMembers(team?.members || [], ownerId);

  if (isOwner) {
    showPendingInvites();
    loadPendingInvites();
  } else {
    hidePendingInvites();
  }
}

function showPendingInvites() {
  const section = document.getElementById('pending-invites-section');
  if (section) section.classList.remove('hidden');
}

function hidePendingInvites() {
  const section = document.getElementById('pending-invites-section');
  if (section) section.classList.add('hidden');
  if (pendingList) pendingList.innerHTML = '';
}
//#endregion

//#region Data Loading
async function loadTeams(userId) {
  try {
    const res = await authFetch(`${CONFIG.API_BASE}/teams`);
    if (!res.ok) throw new Error('Failed to fetch teams');

    cachedTeams = await res.json();
    const previouslySelected = currentTeamId;

    if (teamSelector) {
      const placeholder = t('manageTeam.chooseTeam', 'Choose a team…');
      teamSelector.innerHTML = `<option value="">${placeholder}</option>`;

      cachedTeams.forEach((team) => {
        const option = document.createElement('option');
        option.value = team._id;
        option.textContent = team.name;
        teamSelector.appendChild(option);
      });

      if (previouslySelected && cachedTeams.some((t) => t._id === previouslySelected)) {
        teamSelector.value = previouslySelected;
        applyTeamState(cachedTeams.find((t) => t._id === previouslySelected) || null);
      } else {
        applyTeamState(null);
      }
    }
  } catch (err) {
    console.error('Failed to load teams:', err);
    renderMembers([], null);
  }
}

async function reloadCurrentTeam() {
  await loadTeams(currentUserId);
  if (currentTeamId && teamSelector) {
    teamSelector.value = currentTeamId;
    applyTeamState(cachedTeams.find((t) => t._id === currentTeamId) || null);
  }
}
//#endregion

//#region Event Handlers
teamSelector?.addEventListener('change', () => {
  const nextId = teamSelector.value || null;
  const team = cachedTeams.find((t) => t._id === nextId) || null;
  applyTeamState(team);
});

inviteForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!currentTeamId) {
    toast.warn(t('manageTeam.selectTeamFirst', 'Select a team first.'));
    return;
  }

  const email = inviteEmailInput?.value.trim();
  if (!email) {
    toast.warn(t('manageTeam.enterValidEmail', 'Please enter a valid email address.'));
    return;
  }

  try {
    const response = await authFetch(`${CONFIG.API_BASE}/teams/${currentTeamId}/invites`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 409) {
        toast.warn(t('manageTeam.inviteAlreadyPending', 'An invite is already pending for this email.'));
        return;
      }
      toast.error(body?.error || t('manageTeam.inviteFailed', 'Failed to send invite.'));
      return;
    }

    if (inviteEmailInput) inviteEmailInput.value = '';
    toast.success(t('manageTeam.inviteSuccess', 'Invitation sent.'));
    await loadPendingInvites();
  } catch (err) {
    console.error('Invite error:', err);
    toast.error(t('manageTeam.inviteFailed', 'Failed to send invite.'));
  }
});

renameButton?.addEventListener('click', async () => {
  if (!currentTeamId) {
    toast.warn(t('manageTeam.selectTeamFirst', 'Select a team first.'));
    return;
  }

  const newName = renameInput?.value.trim();
  if (!newName) {
    toast.warn(t('manageTeam.enterNewTeamName', 'Enter a new team name.'));
    return;
  }

  try {
    const response = await authFetch(`${CONFIG.API_BASE}/teams/${currentTeamId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: newName }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      toast.error(body?.error || 'Failed to rename team.');
      return;
    }

    await reloadCurrentTeam();
    toast.success('Team renamed.');
  } catch (err) {
    console.error('Rename error:', err);
    toast.error('Could not rename the team. Please try again.');
  }
});

deleteTeamButton?.addEventListener('click', async () => {
  if (!currentTeamId) {
    toast.warn(t('manageTeam.selectTeamFirst', 'Select a team first.'));
    return;
  }

  const confirmed = confirm(t('manageTeam.deleteConfirm', 'Are you sure you want to delete this team and all its pins? This cannot be undone.'));
  if (!confirmed) return;

  try {
    const response = await authFetch(`${CONFIG.API_BASE}/teams/${currentTeamId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      toast.error(body?.error || 'Failed to delete team.');
      return;
    }

    currentTeamId = null;
    await loadTeams(currentUserId);
    toast.success('Team deleted.');
  } catch (err) {
    console.error('Delete error:', err);
    toast.error('Could not delete the team. Please try again.');
  }
});

createTeamButton?.addEventListener('click', async () => {
  const name = newTeamNameInput?.value.trim();
  if (!name) {
    toast.warn(t('manageTeam.enterTeamNameFirst', 'Enter a team name first.'));
    return;
  }

  try {
    const response = await authFetch(`${CONFIG.API_BASE}/teams`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      toast.error(body?.error || t('manageTeam.createFailed', 'Could not create the team. Please try again.'));
      return;
    }

    if (newTeamNameInput) newTeamNameInput.value = '';
    await loadTeams(currentUserId);
    toast.success(t('manageTeam.teamCreated', 'Team created successfully.'));
  } catch (err) {
    console.error('Create team error:', err);
    toast.error(t('manageTeam.createFailed', 'Could not create the team. Please try again.'));
  }
});
//#endregion

//#region Bootstrap
async function init() {
  try {
    const stored = await Storage.get(["userId"]);
    currentUserId = stored?.userId || null;
  } catch (err) {
    console.error('Unable to read user from storage:', err);
  }

  if (!currentUserId) {
    window.location.href = 'auth.html';
    return;
  }

  renderMembers([], null);
  await loadTeams(currentUserId);
}

// Load language first, then initialize
chrome.storage.local.get(["language", "languagePreference"], (data) => {
  const urlLang = new URLSearchParams(window.location.search).get("lang");
  // When preference is "auto", use the already-resolved language from storage
  // instead of re-running browser detection — ensures the same language as the popup
  const pref = data?.languagePreference;
  const lang = urlLang || ((pref && pref !== "auto") ? pref : (data?.language || "auto"));
  I18N.loadAndApplyForLang(lang)
    .then(() => init())
    .catch(() => init());
});
//#endregion
