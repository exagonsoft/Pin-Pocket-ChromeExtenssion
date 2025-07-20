import { CONFIG } from './constants.js';

const teamSelector = document.getElementById('teamSelector');
const inviteForm = document.getElementById('inviteForm');
const inviteEmail = document.getElementById('inviteEmail');
const memberList = document.getElementById('memberList');
const renameInput = document.getElementById('renameInput');
const renameButton = document.getElementById('renameButton');
const deleteTeamButton = document.getElementById('deleteTeam');
const ownerControls = document.getElementById('ownerControls');

let currentTeamId = null;
let isOwner = false;

chrome.storage.sync.get(['userId'], ({ userId }) => {
  if (!userId) return (window.location.href = 'auth.html');
  loadTeams(userId);
});

async function loadTeams(userId) {
  const res = await fetch(`${CONFIG.API_BASE}/teams`, {
    headers: { 'x-user-id': userId }
  });
  const teams = await res.json();

  teams.forEach(team => {
    const option = document.createElement('option');
    option.value = team._id;
    option.textContent = team.name;
    teamSelector.appendChild(option);
  });
}

teamSelector.addEventListener('change', async () => {
  currentTeamId = teamSelector.value || null;
  if (!currentTeamId) return;

  chrome.storage.sync.get(['userId'], async ({ userId }) => {
    const teamRes = await fetch(`${CONFIG.API_BASE}/teams`, {
      headers: { 'x-user-id': userId }
    });
    const teams = await teamRes.json();
    const team = teams.find(t => t._id === currentTeamId);

    isOwner = team?.owner?._id === userId || team?.owner === userId;
    ownerControls.style.display = isOwner ? 'block' : 'none';
    renameInput.value = team?.name || '';
    renderMembers(team?.members || []);
  });
});

function renderMembers(members) {
  memberList.innerHTML = '';
  members.forEach(member => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${member.email || member}</span>
      ${isOwner ? `<button class="remove" data-id="${member._id || member}">×</button>` : ''}
    `;
    memberList.appendChild(li);
  });

  if (isOwner) {
    memberList.querySelectorAll('.remove').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        await fetch(`${CONFIG.API_BASE}/teams/${currentTeamId}/remove`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': (await chrome.storage.sync.get(['userId'])).userId
          },
          body: JSON.stringify({ userIdToRemove: id })
        });
        teamSelector.dispatchEvent(new Event('change'));
      });
    });
  }
}

inviteForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentTeamId) return alert('Select a team first.');

  const email = inviteEmail.value.trim();
  if (!email) return alert('Please enter a valid email.');

  await fetch(`${CONFIG.API_BASE}/teams/${currentTeamId}/invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': (await chrome.storage.sync.get(['userId'])).userId
    },
    body: JSON.stringify({ emails: [email] })
  });

  inviteEmail.value = '';
  teamSelector.dispatchEvent(new Event('change'));
});

renameButton.addEventListener('click', async () => {
  const newName = renameInput.value.trim();
  if (!newName) return alert('Enter a new team name.');

  await fetch(`${CONFIG.API_BASE}/teams/${currentTeamId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': (await chrome.storage.sync.get(['userId'])).userId
    },
    body: JSON.stringify({ name: newName })
  });

  alert('Team renamed.');
  location.reload();
});

deleteTeamButton.addEventListener('click', async () => {
  if (!confirm('Are you sure you want to delete this team and all its pins?')) return;

  await fetch(`${CONFIG.API_BASE}/teams/${currentTeamId}`, {
    method: 'DELETE',
    headers: {
      'x-user-id': (await chrome.storage.sync.get(['userId'])).userId
    }
  });

  alert('Team deleted.');
  location.reload();
});
