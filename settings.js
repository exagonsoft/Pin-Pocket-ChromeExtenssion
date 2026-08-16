//#region Imports
import { toast } from "./utils/toast.js";
import { setUpNav, loadUserData } from "./utils/nav.js";
import I18N from "./i18n.js";
import { logError } from "./logger.js";
//#endregion

//#region DOM References
const useSync = document.getElementById("useSync");
const useEncryption = document.getElementById("useEncryption");
const clearBtn = document.getElementById("clear");
const userIcon = document.getElementById("user-icon");
const navMenuPins = document.getElementById("nav-menu-pins");
const navMenuProfile = document.getElementById("nav-menu-profile");
const navMenuSettings = document.getElementById("nav-menu-settings");
const resetSettingsBtn = document.getElementById("reset-settings");
const themeRadios = document.querySelectorAll("input[name='theme-choice']");
const languageSelector = document.getElementById("settings-language");
const languageNote = document.getElementById("language-detected-note");
//#endregion

//#region Session And Initial Settings
chrome.storage.local.get(
  ["userId", "email", "token", "plan", "picture", "useSync", "useEncryption"],
  (data) => {
    if (!data.userId) {
      window.location.href = "auth.html";
      return;
    }

    if (useSync) useSync.checked = data.useSync || false;
    if (useEncryption) useEncryption.checked = data.useEncryption || false;

    setUpNav();
    loadUserData(data.picture);
  }
);
//#endregion

//#region Theme Helpers
    // Theme helper (applies theme but does NOT persist)
    let _systemMq = null;
    function _handleSystemChange(e) {
      const resolved = e.matches ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", resolved);
    }

    function applyTheme(theme) {
      if (!theme) return;
      // If user selected 'system', resolve to the current system preference
      if (theme === "system") {
        try {
          _systemMq = window.matchMedia("(prefers-color-scheme: dark)");
          const resolved = _systemMq.matches ? "dark" : "light";
          document.documentElement.setAttribute("data-theme", resolved);
          document.documentElement.setAttribute("data-theme-source", "system");
          // listen for system preference changes
          _systemMq.removeEventListener?.("change", _handleSystemChange);
          _systemMq.addEventListener?.("change", _handleSystemChange);
        } catch (e) {
          document.documentElement.setAttribute("data-theme", "light");
        }
      } else {
        // remove any system listener
        if (_systemMq) {
          _systemMq.removeEventListener?.("change", _handleSystemChange);
          _systemMq = null;
        }
        document.documentElement.setAttribute("data-theme", theme);
        document.documentElement.removeAttribute("data-theme-source");
      }
    }

    // Compact mode helper (applies compact mode but does NOT persist)
    function applyCompactMode(enabled) {
      if (enabled) {
        document.documentElement.setAttribute("data-compact", "true");
      } else {
        document.documentElement.removeAttribute("data-compact");
      }
    }
//#endregion

//#region Toggle And Reset Handlers
// use shared `loadUserData` from utils/nav.js

// Enhance error handling for storage operations (guard DOM elements)
if (useSync) {
  useSync.onchange = () => {
    chrome.storage.local.set({ useSync: useSync.checked }, () => {
      if (chrome.runtime.lastError) {
        toast.error("Failed to update sync setting.");
      } else {
        toast.success("Sync setting updated.");
      }
    });
  };
}

if (useEncryption) {
  useEncryption.onchange = () => {
    chrome.storage.local.set({ useEncryption: useEncryption.checked }, () => {
      if (chrome.runtime.lastError) {
        toast.error("Failed to update encryption setting.");
      } else {
        toast.success("Encryption setting updated.");
      }
    });
  };
}

// Add reset settings feature
if (resetSettingsBtn) {
  resetSettingsBtn.onclick = () => {
    chrome.storage.local.clear(() => {
      if (chrome.runtime.lastError) {
        toast.error("Failed to reset settings.");
      } else {
        toast.success("Settings reset to default.");
        if (useSync) useSync.checked = false;
        if (useEncryption) useEncryption.checked = false;
      }
    });
  };
}

if (clearBtn) {
  clearBtn.onclick = () => {
    chrome.storage.local.set({ pinnedPages: [] });
    toast.success("All pinned pages cleared.");
  };
}
//#endregion

//#region Theme Persistence And Preview
// Load the saved theme on page load
chrome.storage.local.get("theme", (data) => {
  const savedTheme = data.theme || "system";
  applyTheme(savedTheme);
  themeRadios.forEach((radio) => {
    if (radio.value === savedTheme) {
      radio.checked = true;
    }
  });
});

// Add theme switching functionality
// preview theme radios (do not persist here; persisted when user clicks Save)
themeRadios.forEach((radio) => {
  radio.addEventListener("change", () => {
    const selectedTheme = radio.value;
    applyTheme(selectedTheme);
  });
});
//#endregion

//#region Language Controls
// Auto-detect system language on page load
const systemLanguage = navigator.language || "en-US";
// expose vars for i18n placeholders (e.g. {lang}) so translations can be formatted
window.__I18N_VARS = Object.assign(window.__I18N_VARS || {}, { lang: systemLanguage });
// initial note will be populated by the i18n loader once translations load

function getStoredLanguagePreference(data) {
  if (data && typeof data.languagePreference === "string") return data.languagePreference;
  if (data && typeof data.language === "string") return data.language;
  return "auto";
}

function normalizeSelectorLanguage(value) {
  if (!languageSelector) return "auto";
  const available = new Set(Array.from(languageSelector.options).map((option) => option.value));
  return available.has(value) ? value : "auto";
}

// Load saved language or default to system language
chrome.storage.local.get(["language", "languagePreference"], async (data) => {
  const savedPreference = normalizeSelectorLanguage(getStoredLanguagePreference(data));
  if (languageSelector) languageSelector.value = savedPreference;
  const resolvedLanguage = await I18N.resolveLanguage(savedPreference === "auto" ? systemLanguage : savedPreference);
  window.__I18N_VARS = Object.assign(window.__I18N_VARS || {}, { lang: resolvedLanguage });
  applyLanguage(resolvedLanguage);
});

// Save language selection and apply it
if (languageSelector) {
  languageSelector.addEventListener("change", async () => {
    const selectedLanguage = languageSelector.value;
    const resolvedLanguage = await I18N.resolveLanguage(selectedLanguage === "auto" ? systemLanguage : selectedLanguage);
    chrome.storage.local.set(
      { languagePreference: selectedLanguage, language: resolvedLanguage },
      () => {
        if (chrome.runtime.lastError) {
          toast.error("Failed to save language setting.");
        } else {
          toast.success("Language updated to " + selectedLanguage);
          window.__I18N_VARS = Object.assign(window.__I18N_VARS || {}, { lang: resolvedLanguage });
          applyLanguage(resolvedLanguage);
        }
      },
    );
  });
}

function applyLanguage(language) {
  if (!language) return;
  // language may be like 'en-US' or 'es-ES'
  try {
    I18N.loadAndApplyForLang(language);
  } catch (e) {
    logError("settings.i18n", "Failed to apply language via I18N", e);
  }
}
// Rely on the shared `i18n.js` module to load/apply translations
//#endregion

//#region Save Action
// Save preferences button: persist and apply atomically
const saveBtn = document.getElementById("settings-save");
if (saveBtn) {
  saveBtn.addEventListener("click", async () => {
    const selectedThemeEl = Array.from(themeRadios).find((r) => r.checked);
    const selectedTheme = selectedThemeEl ? selectedThemeEl.value : "system";
    const selectedLanguage = languageSelector ? languageSelector.value : "auto";
    const resolvedLanguage = await I18N.resolveLanguage(selectedLanguage === "auto" ? systemLanguage : selectedLanguage);
    const compactEl = document.getElementById("compact-mode");
    const compactEnabled = compactEl ? compactEl.checked : false;
    const syncEnabled = useSync ? useSync.checked : false;
    const encryptionEnabled = useEncryption ? useEncryption.checked : false;

    const payload = {
      theme: selectedTheme,
      languagePreference: selectedLanguage,
      language: resolvedLanguage,
      compactMode: compactEnabled,
      useSync: syncEnabled,
      useEncryption: encryptionEnabled,
    };

    chrome.storage.local.set(payload, () => {
      if (chrome.runtime.lastError) {
        toast.error("Failed to save settings.");
        return;
      }

      // Apply changes now
      applyTheme(selectedTheme);
      applyCompactMode(compactEnabled);
      window.__I18N_VARS = Object.assign(window.__I18N_VARS || {}, { lang: resolvedLanguage });
      applyLanguage(resolvedLanguage);

      toast.success("Settings saved and applied.");
    });
  });
}
//#endregion

//#region Bootstrap I18N
// Language is loaded in the Language Controls bootstrap above.
//#endregion
