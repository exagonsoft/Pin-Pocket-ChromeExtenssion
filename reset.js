//#region Imports
import { CONFIG } from './constants.js';
import { toast } from "./utils/toast.js";
//#endregion

//#region State
let TRANSLATIONS = null;
//#endregion

//#region Translation Rendering
function applyResetTranslations(strings) {
  TRANSLATIONS = strings;
  if (!strings || !strings.reset) return;

  document.title = strings.reset.title || document.title;
  const headerH1 = document.querySelector('header.brand-banner h1');
  if (headerH1) headerH1.textContent = strings.reset.heading || headerH1.textContent;
  const headerP = document.querySelector('header.brand-banner p');
  if (headerP) headerP.textContent = strings.reset.description || headerP.textContent;

  const tokenLabel = document.querySelector('label[for="reset-token"] span');
  if (tokenLabel) tokenLabel.textContent = strings.reset.tokenLabel || tokenLabel.textContent;
  const tokenInput = document.getElementById('reset-token');
  if (tokenInput) tokenInput.placeholder = strings.reset.tokenPlaceholder || tokenInput.placeholder;

  const passLabel = document.querySelector('label[for="new-password"] span');
  if (passLabel) passLabel.textContent = strings.reset.newPasswordLabel || passLabel.textContent;
  const passInput = document.getElementById('new-password');
  if (passInput) passInput.placeholder = strings.reset.newPasswordPlaceholder || passInput.placeholder;

  const submitBtn = document.querySelector('form#reset-form button[type="submit"]');
  if (submitBtn) submitBtn.textContent = strings.reset.submitButton || submitBtn.textContent;

  const backLink = document.querySelector('a.link-inline');
  if (backLink) backLink.textContent = strings.reset.backToLogin || backLink.textContent;
}
//#endregion

//#region Bootstrap
function resolveLocaleKey(translations, preferredLanguage) {
  const keys = Object.keys(translations || {});
  if (!keys.length) return "en-US";

  const normalize = (locale) => {
    if (!locale || typeof locale !== 'string') return '';
    const parts = locale.trim().replace(/_/g, '-').split('-').filter(Boolean);
    if (!parts.length) return '';
    if (parts[0] === 'auto') return 'auto';
    if (parts.length === 1) return parts[0].toLowerCase();
    return `${parts[0].toLowerCase()}-${parts[1].toUpperCase()}`;
  };

  const normalizedMap = new Map();
  keys.forEach((key) => normalizedMap.set(normalize(key), key));

  const findMatch = (candidate) => {
    const normalized = normalize(candidate);
    if (!normalized || normalized === 'auto') return null;
    if (normalizedMap.has(normalized)) return normalizedMap.get(normalized);
    const base = normalized.split('-')[0];
    if (!base) return null;
    return keys.find((key) => normalize(key).split('-')[0] === base) || null;
  };

  const candidates = [];
  if (preferredLanguage) candidates.push(preferredLanguage);
  if (navigator.language) candidates.push(navigator.language);
  if (Array.isArray(navigator.languages)) candidates.push(...navigator.languages);
  candidates.push('en-US');

  for (let i = 0; i < candidates.length; i += 1) {
    const match = findMatch(candidates[i]);
    if (match) return match;
  }

  return translations['en-US'] ? 'en-US' : keys[0];
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('reset-form');
  const tokenInput = document.getElementById('reset-token');
  const passwordInput = document.getElementById('new-password');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const token = tokenInput.value.trim();
    const newPassword = passwordInput.value.trim();

    if (!token || !newPassword) {
      toast.warn(TRANSLATIONS?.reset?.enterBoth || 'Please enter both token and new password.');
      return;
    }

    try {
      const response = await fetch(`${CONFIG.API_BASE}/auth/reset/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });

      if (response.ok) {
        toast.success(TRANSLATIONS?.reset?.success || 'Password updated successfully. Please log in.');
        window.location.href = 'auth.html';
        return;
      }

      const { error } = await response.json();
      toast.error(`${TRANSLATIONS?.reset?.failedPrefix || 'Reset failed:'} ${error || response.statusText}`);
    } catch (error) {
      console.error('Reset error:', error);
      toast.error(TRANSLATIONS?.reset?.networkError || 'Network error. Please try again.');
    }
  });

  // Load translations for this page
  chrome.storage.local.get(['language', 'languagePreference'], (data) => {
    const lang = (data && data.languagePreference) || (data && data.language) || 'auto';
    fetch('i18n.json')
      .then((r) => r.json())
      .then((t) => {
        const resolvedLanguage = resolveLocaleKey(t, lang);
        applyResetTranslations(t[resolvedLanguage] || t['en-US']);
      })
      .catch((e) => console.error('i18n load error', e));
  });
});
//#endregion
