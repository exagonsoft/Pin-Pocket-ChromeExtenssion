import { CONFIG } from "./constants.js";
import { authFetch } from "./utils/api.js";
import { toast } from "./utils/toast.js";
import * as Storage from "./utils/storage.js";
import { showLoader, hideLoader } from "./utils/loader.js";
import { setUpNav, loadUserData } from "./utils/nav.js";
import I18N from "./i18n.js";

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
let _popupStrings = null;

function t(key, vars = {}) {
  try {
    const strings = _popupStrings || window.__I18N_STRINGS || {};
    let val = key.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), strings);
    if (typeof val !== "string") return "";
    Object.keys(vars).forEach((k) => {
      val = val.replace(new RegExp(`\\{${k}\\}`, "g"), String(vars[k]));
    });
    return val;
  } catch { return ""; }
}

//#endregion

setListMessage(t("popup.loading") || "Loading...");

(async () => {
  const { userId, email, token, plan, planName, picture } = await Storage.get([
    "userId",
    "email",
    "token",
    "plan",
    "planName",
    "picture",
  ]);

  if (!userId || !token) {
    window.location.href = "auth.html";
    return;
  }

  // 🔒 Validate token server-side; attempt silent refresh on 401
  try {
    const verifyRes = await authFetch(`${CONFIG.API_BASE}/auth/verifyCookies`);
    if (!verifyRes.ok) {
      await Storage.clear();
      window.location.href = "auth.html";
      return;
    }
  } catch {
    // authFetch already handles redirect on auth failure — nothing more to do
    return;
  }

  if (emailDisplay) {
    if (email) {
      const tpl = t("popup.loggedInAs") || 'Logged in as: {email}';
      emailDisplay.textContent = tpl.replace('{email}', email || '');
    } else {
      emailDisplay.textContent = "";
    }
  }

  setUpNav();
  applyPlanRestrictions(planName);
  loadUserData(picture);
  loadTeams(userId);
  loadPages(userId, selectedTeamId);
})();

// One-time filter setup — runs once on page load, not on every loadPages() call
(function setupFilterListener() {
  const filterInput = document.getElementById("pin-filter");
  if (!filterInput) return;
  filterInput.addEventListener("input", () => {
    const q = filterInput.value.trim().toLowerCase();
    if (!q) {
      renderPins(allPins);
      return;
    }
    const filtered = allPins.filter(
      (pin) =>
        pin.title?.toLowerCase().includes(q) ||
        pin.url?.toLowerCase().includes(q)
    );
    renderPins(filtered);
  });
})();

//#region Data Handlers

async function loadTeams(userId) {
  try {
    showLoader(t("popup.feedback.loadingTeams") || "Loading teams…");
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
    toast.error(t("popup.feedback.loadTeamsFailed"));
    hideLoader();
  }
}

async function loadPages(userId, teamId = null) {
  try {
    showLoader(t("popup.feedback.loadingPins") || "Loading pins…");

    const query = teamId ? `?team=${teamId}` : "";
    const res = await authFetch(`${CONFIG.API_BASE}/pins${query}`);

    if (!res.ok) {
      setListMessage(t("popup.errorLoading") || "Error loading pins.");
      hideLoader();
      return;
    }

    const result = await res.json();
    const pins = result.data ?? result; // support both paginated and legacy flat responses
    allPins = pins; // 🔥 cache for filtering

    // 💾 Persist to local storage for offline fallback
    await Storage.setLocal({ cachedPins: pins, cachedPinsAt: Date.now() });

    renderPins(pins);

    if (!pins.length) {
      setListMessage(t("popup.emptyListMessage") || "No pinned pages yet.");
      hideLoader();
      return;
    }

    hideLoader();
  } catch (err) {
    // 📴 Network failure — try offline cache
    try {
      const { cachedPins } = await Storage.getLocal(["cachedPins"]);
      if (cachedPins && cachedPins.length > 0) {
        allPins = cachedPins;
        renderPins(cachedPins);
        setListMessage(t("popup.offlineMode") || "⚡ Offline mode — showing cached pins.");
        hideLoader();
        return;
      }
    } catch {
      // Local storage unavailable — fall through to error message
    }

    toast.error(t("popup.feedback.loadPinsFailed"));
    setListMessage(t("popup.feedback.loadPinsFailed") || "Failed to load pins.");
    hideLoader();
  }
}

async function importPinnedTabs(userId) {
  try {
    showLoader(t("popup.feedback.importingTabs") || "Importing pinned tabs…");

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
      toast.info(t("popup.feedback.alreadySaved"));
      return;
    }

    const currentCount = existingPins.length;

    // 5️⃣ Free plan enforcement
    if (!isUnlimited) {
      const MAX_PINS = 5;
      const remainingSlots = MAX_PINS - currentCount;

      if (remainingSlots <= 0) {
        toast.warn(t("popup.feedback.planLimitReached") || "Free plan limit reached.");
        return;
      }

      if (newTabs.length > remainingSlots) {
        toast.info(
          t("popup.feedback.planLimitPartial", { remaining: remainingSlots }) ||
          `Only the first ${remainingSlots} will be imported.`
        );

        newTabs = newTabs.slice(0, remainingSlots);
      }
    }

    // 6️⃣ Import only allowed NEW pins
    const results = await Promise.allSettled(
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

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - succeeded;

    if (succeeded > 0) {
      toast.success(
        failed > 0
          ? t("popup.feedback.importedWithFailures", { count: succeeded, total: newTabs.length, failed }) || `Imported ${succeeded} of ${newTabs.length} (${failed} failed).`
          : t("popup.feedback.imported", { count: succeeded, total: newTabs.length }) || `Imported ${succeeded} of ${newTabs.length} tab(s).`
      );
    } else {
      toast.error(t("popup.feedback.importFailed"));
    }

    loadPages(userId, selectedTeamId);
  } catch (err) {
    toast.error(t("popup.feedback.importFailed"));
  } finally {
    hideLoader();
  }
}

//#endregion

//#region Event Listeners

// `setUpNav` and `loadUserData` are provided by `utils/nav.js`.

logoutButton?.addEventListener("click", async () => {
  try {
    await authFetch(`${CONFIG.API_BASE}/auth/logout`, { method: "POST" });
  } catch {
    // Ignore network errors — clear local state regardless
  }
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
    toast.warn(t("popup.feedback.notLoggedIn"));
    return;
  }
  showLoader(t("popup.feedback.pinningTab") || "Pinning current tab…");
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.url) {
      hideLoader();
      toast.warn(t("popup.feedback.noActiveTab"));
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
          toast.error(t("popup.feedback.pinFailed"));
        } else {
          loadPages(userId, selectedTeamId);
        }
      })
      .catch((error) => {
        hideLoader();
        toast.error(t("popup.feedback.pinError"));
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
  if (reimportButton.disabled) return;
  reimportButton.disabled = true;
  try {
    const { userId } = await Storage.get(["userId"]);
    if (!userId) return;
    await importPinnedTabs(userId);
  } finally {
    reimportButton.disabled = false;
  }
});

window.addEventListener("unhandledrejection", () => {
  document.body.classList.remove("loading");
});

//#endregion

//#region Private Functions

// use shared implementation from utils/nav.js

function renderPins(pins) {
  if (!list) return;
  list.innerHTML = "";

  if (!pins.length) {
    setListMessage(t("popup.feedback.noMatches") || "No matching pins.");
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
      if (meta) meta.textContent = t("popup.unknownSource") || 'Unknown source';
    }

    content.appendChild(linkRow);
    content.appendChild(meta);

    const removeBtn = document.createElement("button");
    if (removeBtn) removeBtn.textContent = t("popup.remove") || 'Remove';
    removeBtn.className = "icon-button";
    removeBtn.onclick = async () => {
      try {
        showLoader(t("popup.feedback.removingPin") || "Removing pin…");
        const res = await authFetch(`${CONFIG.API_BASE}/pins/${pin._id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          hideLoader();
          toast.success(t("popup.feedback.pinRemoved"));
          loadPages(null, selectedTeamId);
        } else {
          const err = await res.json();
          hideLoader();
          toast.error(t("popup.feedback.deleteError"));
        }
      } catch (err) {
        hideLoader();
        toast.error(t("popup.feedback.deleteError"));
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


// Load popup strings (use existing `list` element)
function loadPopupStrings(language) {
  fetch("i18n.json")
    .then((response) => response.json())
    .then((translations) => {
      const resolvedLanguage = I18N.resolveLocaleKey(translations, language);
      const strings = translations[resolvedLanguage] || translations["en-US"];
      window.__I18N_STRINGS = strings;
      _popupStrings = strings;
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
