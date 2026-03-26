//#region Imports
import { CONFIG } from './constants.js';
import { toast } from "./utils/toast.js";
import I18N from './i18n.js';
//#endregion

//#region State
let TRANSLATIONS = null;
//#endregion

//#region i18n Helper
function t(key, vars = {}) {
  try {
    const strings = window.__I18N_STRINGS || {};
    let val = key.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), strings);
    if (typeof val !== "string") return "";
    Object.keys(vars).forEach((k) => {
      val = val.replace(new RegExp(`\\{${k}\\}`, "g"), String(vars[k]));
    });
    return val;
  } catch { return ""; }
}
//#endregion

//#region Translation Rendering
function applyResetTranslations(strings) {
  TRANSLATIONS = strings;
  window.__I18N_STRINGS = strings;
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

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('reset-form');
  const tokenInput = document.getElementById('reset-token');
  const passwordInput = document.getElementById('new-password');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const token = tokenInput.value.trim();
    const newPassword = passwordInput.value.trim();

    if (!token || !newPassword) {
      toast.warn(t("reset.feedback.enterBoth") || 'Please enter both token and new password.');
      return;
    }

    try {
      const response = await fetch(`${CONFIG.API_BASE}/auth/reset/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });

      if (response.ok) {
        toast.success(t("reset.feedback.success") || 'Password updated successfully. Please log in.');
        window.location.href = 'auth.html';
        return;
      }

      const { error } = await response.json();
      toast.error(`${t("reset.feedback.failed") || 'Reset failed'}: ${error || response.statusText}`);
    } catch (error) {
      console.error('Reset error:', error);
      toast.error(t("reset.feedback.networkError") || 'Network error. Please try again.');
    }
  });

  // Load translations for this page
  chrome.storage.local.get(['language', 'languagePreference'], (data) => {
    const lang = (data && data.languagePreference) || (data && data.language) || 'auto';
    fetch('i18n.json')
      .then((r) => r.json())
      .then((t) => {
        const resolvedLanguage = I18N.resolveLocaleKey(t, lang);
        applyResetTranslations(t[resolvedLanguage] || t['en-US']);
      })
      .catch((e) => console.error('i18n load error', e));
  });
});
//#endregion
