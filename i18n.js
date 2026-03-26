//#region I18N Module
// Shared i18n loader: finds elements with data-i18n attributes and applies translations.
const I18N = (function () {
  //#region Core Helpers
  function get(obj, path) {
    if (!obj) return undefined;
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
  }

  let translationsCachePromise = null;

  function normalizeLocale(locale) {
    if (!locale || typeof locale !== 'string') return '';
    const value = locale.trim();
    if (!value) return '';
    if (value === 'auto') return 'auto';
    const parts = value.replace(/_/g, '-').split('-').filter(Boolean);
    if (!parts.length) return '';
    const base = parts[0].toLowerCase();
    if (parts.length === 1) return base;
    const region = parts[1].toUpperCase();
    const rest = parts
      .slice(2)
      .map((part) => (part.length === 4 ? `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}` : part.toUpperCase()));
    return [base, region].concat(rest).join('-');
  }

  function getNavigatorLanguageCandidates() {
    const candidates = [];
    try {
      if (typeof navigator !== 'undefined') {
        if (navigator.language) candidates.push(navigator.language);
        if (Array.isArray(navigator.languages)) candidates.push(...navigator.languages);
      }
    } catch (_) {
      // ignore
    }
    candidates.push('en-US');

    const seen = new Set();
    return candidates
      .map(normalizeLocale)
      .filter((locale) => {
        if (!locale || locale === 'auto' || seen.has(locale)) return false;
        seen.add(locale);
        return true;
      });
  }

  function getTranslations() {
    if (!translationsCachePromise) {
      translationsCachePromise = fetch('i18n.json')
        .then((r) => r.json())
        .catch((e) => {
          translationsCachePromise = null;
          throw e;
        });
    }
    return translationsCachePromise;
  }

  function matchSupportedLocale(translations, candidate) {
    if (!translations || !candidate) return null;
    const keys = Object.keys(translations);
    if (!keys.length) return null;

    const normalizedCandidate = normalizeLocale(candidate);
    if (!normalizedCandidate || normalizedCandidate === 'auto') return null;

    const normalizedToKey = new Map();
    keys.forEach((key) => normalizedToKey.set(normalizeLocale(key), key));

    if (normalizedToKey.has(normalizedCandidate)) {
      return normalizedToKey.get(normalizedCandidate);
    }

    const base = normalizedCandidate.split('-')[0];
    if (!base) return null;
    const baseMatches = keys.filter((key) => normalizeLocale(key).split('-')[0] === base);
    if (!baseMatches.length) return null;
    if (baseMatches.length === 1) return baseMatches[0];
    if (base === 'en') {
      const usFallback = baseMatches.find((key) => normalizeLocale(key) === 'en-US');
      if (usFallback) return usFallback;
    }
    return baseMatches[0];
  }

  function resolveLanguageKey(translations, preferredLanguage) {
    const normalizedPreferred = normalizeLocale(preferredLanguage);
    if (normalizedPreferred && normalizedPreferred !== 'auto') {
      const preferredMatch = matchSupportedLocale(translations, normalizedPreferred);
      if (preferredMatch) return preferredMatch;
    }

    const navigatorCandidates = getNavigatorLanguageCandidates();
    for (let i = 0; i < navigatorCandidates.length; i += 1) {
      const match = matchSupportedLocale(translations, navigatorCandidates[i]);
      if (match) return match;
    }

    if (translations['en-US']) return 'en-US';
    const first = Object.keys(translations)[0];
    return first || 'en-US';
  }

  function resolveLanguage(lang) {
    return getTranslations()
      .then((translations) => resolveLanguageKey(translations, lang))
      .catch(() => 'en-US');
  }

  function applyTranslations(translations) {
    function formatString(s) {
      if (typeof s !== 'string') return s;
      try {
        return s.replace(/\{(\w+)\}/g, (m, k) => {
          try {
            if (window && window.__I18N_VARS && window.__I18N_VARS[k] !== undefined) return window.__I18N_VARS[k];
          } catch (e) {}
          return m;
        });
      } catch (e) {
        return s;
      }
    }
    // data-i18n -> textContent
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const val = get(translations, key);
      if (val !== undefined && val !== null) {
        if (el.tagName.toLowerCase() === 'title') {
          document.title = formatString(val);
        } else {
          el.textContent = formatString(val);
        }
      }
    });

    // data-i18n-placeholder -> placeholder attribute
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      const val = get(translations, key);
      if (val !== undefined && val !== null && 'placeholder' in el) el.placeholder = formatString(val);
    });

    // data-i18n-html -> innerHTML
    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      const val = get(translations, key);
      if (val !== undefined && val !== null) el.innerHTML = formatString(val);
    });

    // data-i18n-alt -> image alt
    document.querySelectorAll('[data-i18n-alt]').forEach((el) => {
      const key = el.getAttribute('data-i18n-alt');
      const val = get(translations, key);
      if (val !== undefined && val !== null && el.tagName.toLowerCase() === 'img') el.alt = formatString(val);
    });

    // data-i18n-aria -> aria-label (for accessibility)
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria');
      const val = get(translations, key);
      if (val !== undefined && val !== null) el.setAttribute('aria-label', formatString(val));
    });
  }
  //#endregion

  //#region Loading
  function loadAndApplyForLang(lang) {
    return getTranslations()
      .then((translations) => {
        const resolvedLang = resolveLanguageKey(translations, lang);
        const strings = translations[resolvedLang] || translations['en-US'] || {};
        applyTranslations(strings);
        window.__I18N_STRINGS = strings;
        window.__I18N_LANG = resolvedLang;
        return strings;
      })
      .catch((e) => {
        console.error('i18n load error', e);
        return {};
      });
  }
  //#endregion

  //#region Theme Animation
  // Smoothly apply theme with an overlay fade. Exposed so pages can use for nicer UX.
  function fadeApplyTheme(theme) {
    try {
      // create or reuse overlay
      let overlay = document.getElementById('__theme_fade_overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = '__theme_fade_overlay';
        overlay.className = 'theme-fade-overlay';
        document.body.appendChild(overlay);
      }

      // ensure repaint
      overlay.classList.add('visible');

      // wait for overlay to become visible, then switch theme, then fade out
      window.setTimeout(() => {
        try {
          document.documentElement.setAttribute('data-theme', theme);
        } catch (e) {
          document.documentElement.setAttribute('data-theme', theme);
        }

        // remove visible after short delay to reveal new theme
        window.setTimeout(() => {
          overlay.classList.remove('visible');
          // cleanup after animation
          window.setTimeout(() => {
            if (overlay && overlay.parentElement) overlay.parentElement.removeChild(overlay);
          }, 300);
        }, 160);
      }, 40);
    } catch (e) {
      try { document.documentElement.setAttribute('data-theme', theme); } catch (_) {}
    }
  }
  //#endregion

  //#region Startup
  // Auto-run: detect language from chrome.storage.local if available
  (function init() {
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['language', 'languagePreference', 'theme'], (data) => {
          const lang = (data && data.languagePreference) || (data && data.language) || 'auto';
          const theme = (data && data.theme) || 'system';
          loadAndApplyForLang(lang);
          // apply theme on init
          if (theme === 'system') {
            try {
              const mq = window.matchMedia('(prefers-color-scheme: dark)');
              const resolved = mq.matches ? 'dark' : 'light';
              document.documentElement.setAttribute('data-theme', resolved);
            } catch (e) {
              document.documentElement.setAttribute('data-theme', 'light');
            }
          } else {
            document.documentElement.setAttribute('data-theme', theme);
          }
        });
      } else {
        const lang = navigator.language || 'en-US';
        loadAndApplyForLang(lang);
        const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
        const resolved = mq && mq.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', resolved);
      }
    } catch (e) {
      const lang = navigator.language || 'en-US';
      loadAndApplyForLang(lang);
    }
  })();
  //#endregion

  //#region Storage Change Listener
  // Listen for storage changes so pages can react to language/theme updates
  try {
    if (chrome && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (changes.languagePreference) {
          loadAndApplyForLang(changes.languagePreference.newValue || 'auto');
        } else if (changes.language) {
          loadAndApplyForLang(changes.language.newValue || 'auto');
        }
        if (changes.theme) {
          const newTheme = changes.theme.newValue || 'light';
          if (newTheme === 'system') {
            try {
              const mq = window.matchMedia('(prefers-color-scheme: dark)');
              const resolved = mq.matches ? 'dark' : 'light';
              fadeApplyTheme(resolved);
            } catch (e) {
              fadeApplyTheme('light');
            }
          } else {
            fadeApplyTheme(newTheme);
          }
        }
      });
    }
  } catch (e) {
    // no-op
  }
  //#endregion
  
  //#region Runtime Message Listener
  // Also listen for runtime messages (background notifier) to support message-based updates
  try {
    if (chrome && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        try {
          if (!msg || typeof msg !== 'object') return;
          if (msg.type === 'storage-changed') {
            const { key, value } = msg;
            if (key === 'language' || key === 'languagePreference') {
              loadAndApplyForLang(value || 'auto');
            }
            if (key === 'theme') {
              if (value === 'system') {
                try {
                  const mq = window.matchMedia('(prefers-color-scheme: dark)');
                  const resolved = mq.matches ? 'dark' : 'light';
                  fadeApplyTheme(resolved);
                } catch (e) {
                  fadeApplyTheme('light');
                }
              } else {
                fadeApplyTheme(value || 'light');
              }
            }
          }
        } catch (e) {
          // ignore
        }
      });
    }
  } catch (e) {
    // no-op
  }
  //#endregion

  return { loadAndApplyForLang, applyTranslations, resolveLanguage };
})();
//#endregion

export default I18N;
