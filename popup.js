import { CONFIG } from "./constants.js";
import { authFetch } from "./utils/api.js";
import { toast } from "./utils/toast.js";
import * as Storage from "./utils/storage.js";
import { showLoader, hideLoader } from "./utils/loader.js";
import { setUpNav, loadUserData } from "./utils/nav.js";

//#region UI ELEMENTS & STATE

const list = document.getElementById("pageList");
const emailDisplay = document.getElementById("email");
const logoutButton = document.getElementById("logout-button");
const importSpinner = document.getElementById("import-spinner");
const reimportButton = document.getElementById("reimport-button");
const teamSelect = document.getElementById("teamSelect");
const userIcon = document.getElementById("user-icon");
const navMenuPins = document.getElementById("nav-menu-pins");
const navMenuProfile = document.getElementById("nav-menu-profile");
const navMenuSettings = document.getElementById("nav-menu-settings");

let selectedTeamId = null;
let allPins = [];

//#endregion

setListMessage("Loading...");

(async () => {
  const { userId, email, token, plan, planName, picture } = await Storage.get([
    "userId",
    "email",
    "token",
    "plan",
    "planName",
    "picture",
  ]);

  if (!userId) {
    window.location.href = "auth.html";
    return;
  }

  if (emailDisplay) {
    if (email) {
      if (emailDisplay) {
        const tpl = window.__I18N_STRINGS?.popup?.loggedInAs || 'Logged in as: {email}';
        emailDisplay.textContent = tpl.replace('{email}', email || '');
      }
    } else {
      // Clear the 'Checking session...' placeholder when there's no email
      emailDisplay.textContent = "";
    }
  }

  setUpNav();
  applyPlanRestrictions(planName);
  loadUserData(picture);
  loadTeams(userId);
  loadPages(userId, selectedTeamId);
})();

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

    teams.forEach((team) => {
      const option = document.createElement("option");
      option.value = team._id;
      option.textContent = team.name;
      teamSelect?.appendChild(option);
    });
    hideLoader();
  } catch (err) {
    toast.error("Failed to load teams:", err);
    hideLoader();
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
    allPins = pins; // 🔥 cache for filtering
    renderPins(pins);

    if (!pins.length) {
      setListMessage("No pinned pages yet.");
      hideLoader();
      return;
    }

    const filterInput = document.getElementById("pin-filter");

    filterInput?.addEventListener("input", () => {
      const q = filterInput.value.trim().toLowerCase();

      if (!q) {
        renderPins(allPins);
        hideLoader();
        return;
      }

      const filtered = allPins.filter((pin) => {
        return (
          pin.title?.toLowerCase().includes(q) ||
          pin.url?.toLowerCase().includes(q)
        );
      });

      renderPins(filtered);
    });
    hideLoader();
  } catch (err) {
    toast.error("Load error:", err);
    setListMessage("Failed to load pins. Try again.");
    hideLoader();
  }
}

async function importPinnedTabs(userId) {
  try {
    showLoader("Importing pinned tabs…");

    // 1️⃣ User plan
    const { planName } = await Storage.get(["planName"]);
    const isUnlimited = ["pro", "team"].includes(planName);

    // 2️⃣ Browser pinned tabs
    const tabs = await new Promise((resolve) => {
      chrome.tabs.query({ pinned: true }, resolve);
    });

    // 3️⃣ Existing pins (already saved)
    const res = await authFetch(`${CONFIG.API_BASE}/pins`);
    if (!res.ok) throw new Error("Failed to fetch existing pins");

    const existingPins = await res.json();
    const existingContexts = new Set(existingPins.map((pin) => pin.contextKey));

    // 4️⃣ Only NEW tabs (this is key)
    let newTabs = tabs.filter((tab) => {
      if (!tab.url) return false;

      const contextKey = extractContextKey(tab.url);
      return !existingContexts.has(contextKey);
    });

    if (newTabs.length === 0) {
      toast.info("All your pinned tabs are already saved.");
      return;
    }

    const currentCount = existingPins.length;

    // 5️⃣ Free plan enforcement
    if (!isUnlimited) {
      const MAX_PINS = 5;
      const remainingSlots = MAX_PINS - currentCount;

      if (remainingSlots <= 0) {
        toast.warn(
          "You’ve reached the free plan limit (5 pins). Upgrade to Pro to add more."
        );
        return;
      }

      if (newTabs.length > remainingSlots) {
        toast.info(
          `Free plan allows ${remainingSlots} more pin${
            remainingSlots > 1 ? "s" : ""
          }. Only the first ${remainingSlots} will be imported.`
        );

        newTabs = newTabs.slice(0, remainingSlots);
      }
    }

    // 6️⃣ Import only allowed NEW pins
    await Promise.all(
      newTabs.map((tab) =>
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
      )
    );

    toast.success(
      `Imported ${newTabs.length} new pinned tab${
        newTabs.length > 1 ? "s" : ""
      }.`
    );

    loadPages(userId, selectedTeamId);
  } catch (err) {
    toast.error("Failed to import pinned tabs.");
  } finally {
    hideLoader();
  }
}

//#endregion

//#region Event Listeners

// `setUpNav` and `loadUserData` are provided by `utils/nav.js`.

logoutButton?.addEventListener("click", async () => {
  await Storage.clear();
  await Storage.removeLocal("importedOnce");
  window.location.href = "auth.html";
});

///
/// Pin Current Tab
///
document.getElementById("pin-current")?.addEventListener("click", async () => {
  const { userId } = await Storage.get(["userId"]);

  if (!userId) {
    toast.warn("You are not logged in.");
    return;
  }
  showLoader("Pinning current tab…");
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.url) {
      hideLoader();
      toast.warn("No active tab found.");
      return;
    }

    const favicon = tab.favIconUrl || null; // 🆕 use favicon instead

    authFetch(`${CONFIG.API_BASE}/pins`, {
      method: "POST",
      body: JSON.stringify({
        title: tab.title || tab.url,
        url: normalizeUrl(tab.url),
        contextKey: extractContextKey(tab.url),
        time: new Date().toISOString(),
        teamId: selectedTeamId || null,
        favicon,
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
  selectedTeamId = teamSelect.value === "__me" ? null : teamSelect.value;

  const { userId } = await Storage.get(["userId"]);
  if (userId) {
    loadPages(userId, selectedTeamId);
  }
});

reimportButton?.addEventListener("click", async () => {
  const { userId } = await Storage.get(["userId"]);
  if (!userId) return;

  await importPinnedTabs(userId);
});

window.addEventListener("unhandledrejection", () => {
  document.body.classList.remove("loading");
});

//#endregion

//#region Private Functions

// use shared implementation from utils/nav.js

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
      img.alt = "Favicon";
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
    try {
      meta.textContent = new URL(pin.url).hostname;
    } catch {
      if (meta) meta.textContent = window.__I18N_STRINGS?.popup?.unknownSource || 'Unknown source';
    }

    content.appendChild(linkRow);
    content.appendChild(meta);

    const removeBtn = document.createElement("button");
    if (removeBtn) removeBtn.textContent = window.__I18N_STRINGS?.popup?.remove || 'Remove';
    removeBtn.className = "icon-button";
    removeBtn.onclick = async () => {
      try {
        showLoader("Removing pin…");
        const res = await authFetch(`${CONFIG.API_BASE}/pins/${pin._id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          hideLoader();
          toast.success("Pin removed.");
          loadPages(null, selectedTeamId);
        } else {
          const err = await res.json();
          hideLoader();
          toast.error("Delete error:", err?.error || res.statusText);
        }
      } catch (err) {
        hideLoader();
        toast.error("Delete error:", err);
      }
    };

    const tooltip = createTooltip(pin);

    if (tooltip) {
      li.addEventListener("mouseenter", () => {
        const rect = li.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        tooltip.style.top = `${
          rect.top + window.scrollY - tooltipRect.height - 8
        }px`;

        tooltip.style.left = `${rect.left + window.scrollX + rect.width / 2}px`;

        tooltip.style.transform = "translateX(-50%)";
        tooltip.classList.add("visible");
      });

      li.addEventListener("mouseleave", () => {
        tooltip.classList.remove("visible");
      });
    }

    li.appendChild(content);
    li.appendChild(removeBtn);
    list.appendChild(li);
  });
}

function setListMessage(message) {
  if (!list) {
    return;
  }

  list.innerHTML = "";
  const li = document.createElement("li");
  li.className = "list-item list-item--muted";
  li.textContent = message;
  list.appendChild(li);
}

function applyPlanRestrictions(teamOwner) {
  const teamSections = document.getElementById("manage-team-section");

  const isTeamEnabled = teamOwner;

  // Safety: reset selection if teams are disabled
  if (!isTeamEnabled && teamSelect) {
    teamSelect.value = "__me";
    selectedTeamId = null;
  }
}
normalizeUrl;

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = ""; // remove #anchors
    return u.toString();
  } catch {
    return url;
  }
}

function extractContextKey(url) {
  try {
    const u = new URL(url);

    // ChatGPT
    if (u.hostname.includes("chat.openai.com")) {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "c" && parts.length >= 3) {
        return `chatgpt:${parts[1]}:${parts[2]}`;
      }
    }

    // GitHub issues
    if (u.hostname === "github.com") {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[2] === "issues" && parts[3]) {
        return `github:${parts[0]}/${parts[1]}#${parts[3]}`;
      }
    }

    // Jira (basic)
    if (u.pathname.includes("/browse/")) {
      const key = u.pathname.split("/browse/")[1];
      return `jira:${key}`;
    }

    // Fallback
    return `url:${normalizeUrl(url)}`;
  } catch {
    return `url:${url}`;
  }
}

function createTooltip(pin) {
  if (!pin.summary && (!pin.tags || !pin.tags.length)) return null;

  const tooltip = document.createElement("div");
  tooltip.className = "pin-tooltip";

  if (pin.summary) {
    const summary = document.createElement("div");
    summary.className = "pin-tooltip__summary";
    summary.textContent = pin.summary;
    tooltip.appendChild(summary);
  }

  if (pin.tags?.length) {
    const tags = document.createElement("div");
    tags.className = "pin-tooltip__tags";

    pin.tags.forEach((tag) => {
      const span = document.createElement("span");
      span.textContent = `#${tag}`;
      tags.appendChild(span);
    });

    tooltip.appendChild(tags);
  }

  document.body.appendChild(tooltip);
  return tooltip;
}

//#endregion

function resolveLocaleKey(translations, preferredLanguage) {
  const keys = Object.keys(translations || {});
  if (!keys.length) return "en-US";

  const normalize = (locale) => {
    if (!locale || typeof locale !== "string") return "";
    const parts = locale.trim().replace(/_/g, "-").split("-").filter(Boolean);
    if (!parts.length) return "";
    if (parts[0] === "auto") return "auto";
    if (parts.length === 1) return parts[0].toLowerCase();
    return `${parts[0].toLowerCase()}-${parts[1].toUpperCase()}`;
  };

  const normalizedMap = new Map();
  keys.forEach((key) => normalizedMap.set(normalize(key), key));

  const findMatch = (candidate) => {
    const normalized = normalize(candidate);
    if (!normalized || normalized === "auto") return null;
    if (normalizedMap.has(normalized)) return normalizedMap.get(normalized);
    const base = normalized.split("-")[0];
    if (!base) return null;
    return keys.find((key) => normalize(key).split("-")[0] === base) || null;
  };

  const candidates = [];
  if (preferredLanguage) candidates.push(preferredLanguage);
  if (navigator.language) candidates.push(navigator.language);
  if (Array.isArray(navigator.languages)) candidates.push(...navigator.languages);
  candidates.push("en-US");

  for (let i = 0; i < candidates.length; i += 1) {
    const match = findMatch(candidates[i]);
    if (match) return match;
  }

  return translations["en-US"] ? "en-US" : keys[0];
}

// Load popup strings (use existing `list` element)
function loadPopupStrings(language) {
  fetch("i18n.json")
    .then((response) => response.json())
    .then((translations) => {
      const resolvedLanguage = resolveLocaleKey(translations, language);
      const strings = translations[resolvedLanguage] || translations["en-US"];
      try {
        // Apply general UI translations
        document.title = strings.settings?.title || document.title;
        const brandP = document.querySelector('header.brand-banner p');
        if (brandP) brandP.textContent = strings.popup.brandDescription;

        const navPins = document.getElementById('nav-menu-pins');
        const navProfile = document.getElementById('nav-menu-profile');
        const navSettings = document.getElementById('nav-menu-settings');
        if (navPins) navPins.textContent = strings.popup.nav.pins;
        if (navProfile) navProfile.textContent = strings.popup.nav.profile;
        if (navSettings) navSettings.textContent = strings.popup.nav.settings;

        const sectionTitle = document.querySelector('.section-title');
        if (sectionTitle) sectionTitle.textContent = strings.popup.sectionTitle;

        const emailEl = document.getElementById('email');
        if (emailEl) emailEl.textContent = strings.popup.emailChecking;

        const pinCurrent = document.getElementById('pin-current');
        const importBtn = document.getElementById('reimport-button');
        if (pinCurrent) pinCurrent.textContent = strings.popup.pinCurrent;
        if (importBtn) importBtn.textContent = strings.popup.importPinned;

        const manageLink = document.querySelector('#manage-team-section a');
        if (manageLink) manageLink.textContent = strings.popup.manageTeam;

        const savedH4 = document.querySelector('#list-container header h4');
        const savedP = document.querySelector('#list-container header p');
        if (savedH4) savedH4.textContent = strings.popup.savedLinksTitle;
        if (savedP) savedP.textContent = strings.popup.savedLinksDesc;

        const filter = document.getElementById('pin-filter');
        if (filter) filter.placeholder = strings.popup.filterPlaceholder;

        const logout = document.getElementById('logout-button');
        if (logout) logout.textContent = strings.popup.logout;

        const loaderText = document.getElementById('loader-text');
        if (loaderText) loaderText.textContent = strings.popup.loaderText;

        // List-specific message
        if (list) {
          list.innerHTML = "";
          const li = document.createElement('li');
          li.className = 'list-item list-item--muted';
          li.textContent = strings.popup.emptyListMessage;
          list.appendChild(li);
        }
      } catch (e) {
        console.error('Failed applying popup translations', e);
      }
    })
    .catch((e) => console.error('Failed to load i18n.json', e));
}

// Load language dynamically
chrome.storage.local.get(["language", "languagePreference"], (data) => {
  const language = (data && data.languagePreference) || (data && data.language) || "auto";
  loadPopupStrings(language);
});
