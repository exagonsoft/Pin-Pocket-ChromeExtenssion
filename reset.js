//#region Imports
import { CONFIG } from './constants.js';
import { toast } from "./utils/toast.js";
import I18N from "./i18n.js";
//#endregion

//#region Translation Helper
function t(key, fallback = '') {
  const strings = window.__I18N_STRINGS || {};
  const val = key.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), strings);
  return typeof val === 'string' ? val : fallback;
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
      toast.warn(t('reset.errors.enterBoth', 'Please enter both token and new password.'));
      return;
    }

    try {
      const response = await fetch(`${CONFIG.API_BASE}/auth/reset/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      if (response.ok) {
        toast.success(t('reset.success', 'Password updated successfully. Please log in.'));
        window.location.href = 'auth.html';
        return;
      }

      const { error } = await response.json();
      toast.error(`${t('reset.errors.failedPrefix', 'Reset failed:')} ${error || response.statusText}`);
    } catch (err) {
      console.error('Reset error:', err);
      toast.error(t('reset.errors.network', 'Network error. Please try again.'));
    }
  });

  // Load the same language as the rest of the extension
  chrome.storage.local.get(['language', 'languagePreference'], (data) => {
    const pref = data?.languagePreference;
    const lang = (pref && pref !== 'auto') ? pref : (data?.language || 'auto');
    I18N.loadAndApplyForLang(lang);
  });
});
//#endregion
