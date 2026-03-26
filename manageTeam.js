//#region Imports
import { CONFIG } from './constants.js';
import { authFetch } from "./utils/api.js";
import { toast } from "./utils/toast.js";
import * as Storage from "./utils/storage.js";
import I18N from './i18n.js';
//#endregion

//#region DOM References
const teamSelector = document.getElementById('teamSelector');
const inviteForm = document.getElementById('inviteForm');
const inviteEmail = document.getElementById('inviteEmail');
const memberList = document.getElementById('memberList');
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
let MEMBER_EMPTY_MESSAGE = 'No members yet.';
let TRANSLATIONS = null;
//#endregion

//#region Rendering
function renderMembers(members, ownerId, emptyMessage) {
  const emptyMsg = typeof emptyMessage === 'string' ? emptyMessage : MEMBER_EMPTY_MESSAGE;
  memberList.innerHTML = '';

  if (!Array.isArray(members) || members.length === 0) {
    const li = document.createElement('li');
    li.className = 'list-item list-item--muted';
    li.textContent = emptyMsg;
    memberList.appendChild(li);
    return;
  }

  members.forEach((member) => {
    const memberId = member?._id || member?.id || member;
    const email = member?.email || TRANSLATIONS?.manageTeam?.unknownUser || 'Unknown user';

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
      meta.textContent = TRANSLATIONS?.manageTeam?.ownerLabel || 'Owner';
    } else if (memberId === currentUserId) {
      meta.textContent = TRANSLATIONS?.manageTeam?.youLabel || 'You';
    } else if (member?.role) {
      meta.textContent = member.role;
    } else {
      meta.textContent = TRANSLATIONS?.manageTeam?.memberLabel || 'Member';
    }

    content.appendChild(title);
    content.appendChild(meta);
    li.appendChild(content);

    if (isOwner && memberId !== ownerId) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'icon-button';
      removeBtn.textContent = TRANSLATIONS?.manageTeam?.removeButton || 'Remove';
      removeBtn.addEventListener('click', async () => {
        try {
          const response = await authFetch(`${CONFIG.API_BASE}/teams/${currentTeamId}/remove`, {
            method: 'POST',
            body: JSON.stringify({ userIdToRemove: memberId })
          });

          if (!response.ok) {
            toast.error(TRANSLATIONS?.manageTeam?.feedback?.removeFailed || 'Failed to remove member.');
            return;
          }

          await loadTeams(currentUserId);
          teamSelector.value = currentTeamId ?? '';
          applyTeamState(cachedTeams.find((team) => team._id === currentTeamId) || null);
        } catch (error) {
          console.error('Failed to remove member:', error);
        }
      });

      li.appendChild(removeBtn);
    }

    memberList.appendChild(li);
  });
}

function applyTeamState(team) {
  if (!team) {
    currentTeamId = null;
    isOwner = false;
    ownerControls?.classList.add('hidden');
    if (renameInput) {
      renameInput.value = '';
    }
    renderMembers(null, null, TRANSLATIONS?.manageTeam?.selectTeamMessage || 'Select a team to see members.');
    return;
  }

  currentTeamId = team._id;
  const ownerId = team?.owner?._id || team?.owner;
  isOwner = ownerId === currentUserId;

  if (ownerControls) {
    ownerControls.classList.toggle('hidden', !isOwner);
  }

  if (renameInput) {
    renameInput.value = team?.name || '';
  }

  renderMembers(team?.members || [], ownerId);
}
//#endregion

//#region Data Loading
async function loadTeams(userId) {
  try {
    const res = await authFetch(`${CONFIG.API_BASE}/teams`);

    if (!res.ok) {
      throw new Error('Failed to fetch teams');
    }

    cachedTeams = await res.json();
    const previouslySelected = currentTeamId;

    if (teamSelector) {
        if (teamSelector) {
          const choose = TRANSLATIONS?.manageTeam?.chooseTeam || 'Choose a team...';
          teamSelector.innerHTML = `<option value="">${choose}</option>`;
        }
      cachedTeams.forEach((team) => {
        const option = document.createElement('option');
        option.value = team._id;
        option.textContent = team.name;
        teamSelector.appendChild(option);
      });

      if (previouslySelected && cachedTeams.some((team) => team._id === previouslySelected)) {
        teamSelector.value = previouslySelected;
        applyTeamState(cachedTeams.find((team) => team._id === previouslySelected) || null);
      } else {
        applyTeamState(null);
      }
    }
  } catch (error) {
    console.error('Failed to load teams:', error);
    renderMembers(null, null, TRANSLATIONS?.manageTeam?.unableToLoad || 'Unable to load teams.');
  }
}

async function init() {
  try {
    const stored = await Storage.get(["userId"]);
    currentUserId = stored?.userId || null;
  } catch (error) {
    console.error('Unable to read user from storage:', error);
  }

  if (!currentUserId) {
    window.location.href = 'auth.html';
    return;
  }

  renderMembers(null, null, TRANSLATIONS?.manageTeam?.selectTeamMessage || 'Select a team to see members.');
  await loadTeams(currentUserId);
}
//#endregion

//#region Event Handlers
teamSelector?.addEventListener('change', () => {
  if (!teamSelector) {
    return;
  }

  const nextId = teamSelector.value || null;
  const team = cachedTeams.find((entry) => entry._id === nextId) || null;
  applyTeamState(team);
});

inviteForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!currentTeamId) {
    toast.warn(TRANSLATIONS?.manageTeam?.selectTeamFirst || 'Select a team first.');
    return;
  }

  const email = inviteEmail?.value.trim();
  if (!email) {
    toast.warn(TRANSLATIONS?.manageTeam?.enterValidEmail || 'Please enter a valid email.');
    return;
  }

  try {
    const response = await authFetch(`${CONFIG.API_BASE}/teams/${currentTeamId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ emails: [email] })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      toast.error(TRANSLATIONS?.manageTeam?.feedback?.inviteFailed || 'Failed to send invite.');
      return;
    }

    if (inviteEmail) {
      inviteEmail.value = '';
    }

    await loadTeams(currentUserId);
    teamSelector.value = currentTeamId ?? '';
    applyTeamState(cachedTeams.find((team) => team._id === currentTeamId) || null);
  } catch (error) {
    console.error('Invite error:', error);
    toast.error(TRANSLATIONS?.manageTeam?.feedback?.inviteError || 'Failed to send invite. Please try again.');
  }
});

renameButton?.addEventListener('click', async () => {
    if (!currentTeamId) {
    toast.warn(TRANSLATIONS?.manageTeam?.selectTeamFirst || 'Select a team first.');
    return;
  }

  const newName = renameInput?.value.trim();
  if (!newName) {
    toast.warn(TRANSLATIONS?.manageTeam?.enterNewTeamName || 'Enter a new team name.');
    return;
  }

  try {
    const response = await authFetch(`${CONFIG.API_BASE}/teams/${currentTeamId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: newName })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      toast.error(TRANSLATIONS?.manageTeam?.feedback?.renameFailed || 'Failed to rename team.');
      return;
    }

    await loadTeams(currentUserId);
    teamSelector.value = currentTeamId ?? '';
    applyTeamState(cachedTeams.find((team) => team._id === currentTeamId) || null);
    toast.success(TRANSLATIONS?.manageTeam?.feedback?.renameDone || 'Team renamed.');
  } catch (error) {
    console.error('Rename error:', error);
    toast.error(TRANSLATIONS?.manageTeam?.feedback?.renameFailed || 'Could not rename the team.');
  }
});

deleteTeamButton?.addEventListener('click', async () => {
  if (!currentTeamId) {
    toast.warn(TRANSLATIONS?.manageTeam?.selectTeamFirst || 'Select a team first.');
    return;
  }

  const confirmed = confirm(TRANSLATIONS?.manageTeam?.deleteConfirm || 'Are you sure you want to delete this team and all its pins?');
  if (!confirmed) {
    return;
  }

  try {
    const response = await authFetch(`${CONFIG.API_BASE}/teams/${currentTeamId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      toast.error(TRANSLATIONS?.manageTeam?.feedback?.deleteFailed || 'Failed to delete team.');
      return;
    }

    currentTeamId = null;
    await loadTeams(currentUserId);
    toast.success(TRANSLATIONS?.manageTeam?.feedback?.deleteDone || 'Team deleted.');
  } catch (error) {
    console.error('Delete error:', error);
    toast.error(TRANSLATIONS?.manageTeam?.feedback?.deleteFailed || 'Could not delete the team.');
  }
});

createTeamButton?.addEventListener('click', async () => {
  const name = newTeamNameInput?.value.trim();
  if (!name) {
    toast.warn(TRANSLATIONS?.manageTeam?.enterTeamNameFirst || 'Enter a team name first.');
    return;
  }

  try {
    const response = await authFetch(`${CONFIG.API_BASE}/teams`, {
      method: 'POST',
      body: JSON.stringify({ name })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      toast.error(TRANSLATIONS?.manageTeam?.feedback?.createFailed || 'Failed to create team.');
      return;
    }

    if (newTeamNameInput) {
      newTeamNameInput.value = '';
    }

    await loadTeams(currentUserId);
    toast.success(TRANSLATIONS?.manageTeam?.feedback?.createDone || TRANSLATIONS?.manageTeam?.teamCreated || 'Team created.');
  } catch (error) {
    console.error('Create team error:', error);
    toast.error(TRANSLATIONS?.manageTeam?.feedback?.createFailed || 'Could not create the team.');
  }
});
//#endregion

//#region Translation Loading
// Load team management strings (no redeclaration of `teamSelector`)

function loadTeamManagementStrings(language) {
  fetch("i18n.json")
    .then((response) => response.json())
    .then((translations) => {
      const resolvedLanguage = I18N.resolveLocaleKey(translations, language);
      const strings = translations[resolvedLanguage] || translations["en-US"];
      TRANSLATIONS = strings;

      // Document-level strings
      if (strings.manageTeam) {
        document.title = strings.manageTeam.title || document.title;
        const headerH1 = document.querySelector('header.brand-banner h1');
        if (headerH1) headerH1.textContent = strings.manageTeam.title || headerH1.textContent;
        const headerP = document.querySelector('header.brand-banner p');
        if (headerP) headerP.textContent = strings.manageTeam.description || headerP.textContent;

        // Create team section
        const createH4 = document.querySelector('.settings-section:nth-of-type(1) header h4');
        if (createH4) createH4.textContent = strings.manageTeam.createTitle || createH4.textContent;
        const createP = document.querySelector('.settings-section:nth-of-type(1) header p');
        if (createP) createP.textContent = strings.manageTeam.createDesc || createP.textContent;
        const teamLabel = document.querySelector('label[for="newTeamName"] span');
        if (teamLabel) teamLabel.textContent = strings.manageTeam.teamNameLabel || teamLabel.textContent;
        if (newTeamNameInput) newTeamNameInput.placeholder = strings.manageTeam.teamNamePlaceholder || newTeamNameInput.placeholder;
        if (createTeamButton) createTeamButton.textContent = strings.manageTeam.createTeamButton || createTeamButton.textContent;

        // Select team section
        const selectH4 = document.querySelector('.settings-section:nth-of-type(2) header h4');
        if (selectH4) selectH4.textContent = strings.manageTeam.selectTitle || selectH4.textContent;
        const selectP = document.querySelector('.settings-section:nth-of-type(2) header p');
        if (selectP) selectP.textContent = strings.manageTeam.selectDesc || selectP.textContent;
        const activeTeamLabel = document.querySelector('label[for="teamSelector"] span');
        if (activeTeamLabel) activeTeamLabel.textContent = strings.manageTeam.activeTeamLabel || activeTeamLabel.textContent;

        // Owner controls
        const ownerH4 = document.querySelector('#ownerControls header h4');
        if (ownerH4) ownerH4.textContent = strings.manageTeam.ownerControlsTitle || ownerH4.textContent;
        const ownerP = document.querySelector('#ownerControls header p');
        if (ownerP) ownerP.textContent = strings.manageTeam.ownerControlsDesc || ownerP.textContent;
        const renameLabel = document.querySelector('label[for="renameInput"] span');
        if (renameLabel) renameLabel.textContent = strings.manageTeam.renameLabel || renameLabel.textContent;
        if (renameInput) renameInput.placeholder = strings.manageTeam.renamePlaceholder || renameInput.placeholder;
        if (renameButton) renameButton.textContent = strings.manageTeam.renameButton || renameButton.textContent;
        if (deleteTeamButton) deleteTeamButton.textContent = strings.manageTeam.deleteTeamButton || deleteTeamButton.textContent;

        // Invite section
        const inviteH4 = document.querySelector('.settings-section:nth-of-type(3) header h4');
        if (inviteH4) inviteH4.textContent = strings.manageTeam.inviteTitle || inviteH4.textContent;
        const inviteP = document.querySelector('.settings-section:nth-of-type(3) header p');
        if (inviteP) inviteP.textContent = strings.manageTeam.inviteDesc || inviteP.textContent;
        const inviteLabel = document.querySelector('label[for="inviteEmail"] span');
        if (inviteLabel) inviteLabel.textContent = strings.manageTeam.inviteEmailLabel || inviteLabel.textContent;
        if (inviteEmail) inviteEmail.placeholder = strings.manageTeam.inviteEmailPlaceholder || inviteEmail.placeholder;
        const inviteBtn = document.querySelector('form#inviteForm button[type="submit"]');
        if (inviteBtn) inviteBtn.textContent = strings.manageTeam.inviteButton || inviteBtn.textContent;

        // Members section
        const membersH4 = document.querySelector('.settings-section:nth-of-type(4) header h4');
        if (membersH4) membersH4.textContent = strings.manageTeam.membersTitle || membersH4.textContent;
        const membersP = document.querySelector('.settings-section:nth-of-type(4) header p');
        if (membersP) membersP.textContent = strings.manageTeam.membersDesc || membersP.textContent;

        // Defaults
        MEMBER_EMPTY_MESSAGE = strings.manageTeam.membersEmpty || MEMBER_EMPTY_MESSAGE;
      }

      if (teamSelector) {
        if (teamSelector) {
          const choose = TRANSLATIONS?.manageTeam?.chooseTeam || 'Choose a team...';
          teamSelector.innerHTML = `<option value="">${choose}</option>`;
        }
      }
    })
    .catch((e) => {
      console.error('Failed to load i18n.json', e);
    });
}
//#endregion

//#region Bootstrap
// Load language dynamically
chrome.storage.local.get(["language", "languagePreference"], (data) => {
  const language = (data && data.languagePreference) || (data && data.language) || "auto";
  loadTeamManagementStrings(language);
});

init();
//#endregion
