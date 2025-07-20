import { CONFIG } from './constants.js';

const list = document.getElementById("pageList");
const emailDisplay = document.getElementById("email");
const logoutButton = document.getElementById("logout-button");
const importSpinner = document.getElementById('import-spinner');
const reimportButton = document.getElementById('reimport-button');
const teamSelect = document.getElementById('teamSelect');

let selectedTeamId = null; // null = personal

function showSpinner() {
  importSpinner.style.display = 'block';
  reimportButton.disabled = true;
}

function hideSpinner() {
  importSpinner.style.display = 'none';
  reimportButton.disabled = false;
}

// 🔀 Show loading state initially
list.innerHTML = '<li>Loading...</li>';

// 🔐 Enforce login and get user info
chrome.storage.sync.get(['userId', 'email'], (data) => {
  if (!data.userId) {
    window.location.href = 'auth.html';
    return;
  }

  if (emailDisplay && data.email) {
    emailDisplay.textContent = `Logged in as: ${data.email}`;
  }

  loadTeams(data.userId);
  loadPages(data.userId, selectedTeamId);

  // ✅ Import once per session
  chrome.storage.local.get(['importedOnce'], async (result) => {
    if (!result.importedOnce) {
      showSpinner();
      await importPinnedTabs(data.userId);
      hideSpinner();
      chrome.storage.local.set({ importedOnce: true });
    }
  });
});

reimportButton?.addEventListener('click', async () => {
  chrome.storage.sync.get(['userId'], async ({ userId }) => {
    if (!userId) return;
    showSpinner();
    await importPinnedTabs(userId);
    hideSpinner();
  });
});

teamSelect.addEventListener('change', () => {
  selectedTeamId = teamSelect.value === '__me' ? null : teamSelect.value;
  chrome.storage.sync.get(['userId'], ({ userId }) => {
    if (userId) loadPages(userId, selectedTeamId);
  });
});

async function loadTeams(userId) {
  try {
    const res = await fetch(`${CONFIG.API_BASE}/teams`, {
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId
      }
    });

    const teams = await res.json();

    teams.forEach(team => {
      const option = document.createElement('option');
      option.value = team._id;
      option.textContent = `👥 ${team.name}`;
      teamSelect.appendChild(option);
    });
  } catch (err) {
    console.error('Failed to load teams:', err);
  }
}

// 🔈 Logout handler
logoutButton?.addEventListener('click', async () => {
  await chrome.storage.sync.clear();
  await chrome.storage.local.remove('importedOnce');
  window.location.href = 'auth.html';
});

async function loadPages(userId, teamId = null) {
  try {
    const query = teamId ? `?team=${teamId}` : '';
    const res = await fetch(`${CONFIG.API_BASE}/pins${query}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId
      }
    });

    if (!res.ok) {
      list.innerHTML = '<li>Error loading pins</li>';
      return;
    }

    const pins = await res.json();
    list.innerHTML = '';

    if (!pins.length) {
      const li = document.createElement("li");
      li.textContent = "No pinned pages yet.";
      li.style.backgroundColor = '#fff';
      li.style.border = '1px solid #ddd';
      li.style.borderRadius = '4px';
      li.style.padding = '6px 8px';
      li.style.fontSize = '14px';
      li.style.textAlign = 'center';
      list.appendChild(li);
      return;
    }

    pins.forEach(pin => {
      const li = document.createElement("li");

      const link = document.createElement("a");
      link.href = pin.url;
      link.target = "_blank";
      link.textContent = pin.title;

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "🗑️";
      removeBtn.className = "remove";
      removeBtn.onclick = async () => {
        try {
          const res = await fetch(`${CONFIG.API_BASE}/pins/${pin._id}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'x-user-id': userId
            }
          });

          if (!res.ok) {
            alert('Failed to remove pin.');
            return;
          }

          loadPages(userId, teamId); // Refresh list
        } catch (err) {
          console.error('Delete error:', err);
        }
      };

      li.appendChild(link);
      li.appendChild(removeBtn);
      list.appendChild(li);
    });
  } catch (err) {
    console.error('Load error:', err);
    list.innerHTML = '<li>Failed to load pins. Try again.</li>';
  }
}

// 📌 Pin current tab on button click
document.getElementById('pin-current')?.addEventListener('click', () => {
  chrome.storage.sync.get(['userId'], ({ userId }) => {
    if (!userId) {
      alert('You are not logged in.');
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.url) {
        alert('No active tab found.');
        return;
      }

      fetch(`${CONFIG.API_BASE}/pins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify({
          title: tab.title || tab.url,
          url: tab.url,
          time: new Date().toISOString(),
          teamId: selectedTeamId || null
        })
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json();
          alert(`Failed to pin: ${err?.error || res.statusText}`);
        } else {
          loadPages(userId, selectedTeamId); // Refresh the list
        }
      }).catch(err => {
        console.error('Pin error:', err);
        alert('Something went wrong.');
      });
    });
  });
});

// 📥 Import all currently pinned tabs (without duplicates)
async function importPinnedTabs(userId) {
  try {
    const tabs = await new Promise(resolve => {
      chrome.tabs.query({ pinned: true }, resolve);
    });

    const res = await fetch(`${CONFIG.API_BASE}/pins`, {
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId
      }
    });

    if (!res.ok) throw new Error('Failed to fetch existing pins');
    const existingPins = await res.json();
    const existingUrls = new Set(existingPins.map(pin => pin.url));

    const newTabs = tabs.filter(tab => tab.url && !existingUrls.has(tab.url));

    await Promise.all(newTabs.map(tab =>
      fetch(`${CONFIG.API_BASE}/pins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify({
          title: tab.title || tab.url,
          url: tab.url,
          time: new Date().toISOString(),
          teamId: selectedTeamId || null
        })
      })
    ));

    if (newTabs.length > 0) {
      console.log(`📥 Imported ${newTabs.length} pinned tabs`);
      loadPages(userId, selectedTeamId); // Refresh list
    }
  } catch (err) {
    console.error('Failed to import pinned tabs:', err);
  }
}
