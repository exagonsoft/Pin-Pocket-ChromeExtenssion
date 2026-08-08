# PinitY — Firefox Extension

Save and manage pinned pages directly from Firefox, powered by the [Pinity](https://pinity.uk) platform.

## Features

- Pin the current tab from the popup
- Import pinned tabs in bulk
- Browse and filter saved pins
- Team support (Pro/Team plan)
- Multi-language UI
- Light/dark theme

## Compatibility

- **Firefox Desktop:** full support, including Google sign-in and context-menu saving.
- **Firefox for Android:** compatible with the popup UI, email/password login, tab import, and manual pinning from the popup.
- **Not available on Android:** Google OAuth button and right-click context menu saving are hidden because those APIs are not supported reliably on Firefox Android.

## Development Setup

### Prerequisites

- Firefox Desktop for full extension testing
- Firefox for Android for mobile testing
- The [pinity-server](../pinity-server) backend running locally or accessible through a dev tunnel

### Loading the extension in Firefox Desktop

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `manifest.json` from this directory (`Pin-Pocket-FirefoxExtension/`)

### Installing on Firefox for Android

1. Build or load the extension in Firefox Desktop first
2. Use Firefox’s add-on syncing/dev-install flow for Android, or install the signed package when available
3. Open the extension from the Firefox toolbar menu on Android

Firefox Android support is more limited than desktop, so test the popup flow carefully.

## Connecting to a local backend

Edit `constants.js` and update `API_BASE` / `BACKEND_BASE` for your local or tunnel URL:

```js
const isDev = !("update_url" in browser.runtime.getManifest());

export const CONFIG = {
  API_BASE: isDev
    ? "https://<your-dev-tunnel>.devtunnels.ms/api"
    : "https://pinity.uk/api",
  BACKEND_BASE: isDev
    ? "https://<your-dev-tunnel>.devtunnels.ms"
    : "https://pinity.uk",
};
```

> **Note:** The dev tunnel URL changes each session. Do not commit active tunnel URLs.

## Project Structure

```
├── background.js        # Service worker — auth, context menu, storage relay
├── popup.html/js        # Main popup UI — pin list, import, logout
├── auth.html/js         # Login, register, forgot password
├── profile.html/js      # User profile and billing
├── settings.html/js     # Language, theme, storage settings
├── manageTeam.html/js   # Team management (Pro/Team plan)
├── reset.html/js        # Password reset
├── i18n.js              # Internationalization loader
├── i18n.json            # Translation strings
├── constants.js         # API URLs (dev vs production)
├── styles.css           # Global styles
└── utils/
    ├── api.js           # Authenticated fetch with in-memory token cache
    ├── auth.js          # Auth helpers (requireAuth, logout)
    ├── loader.js        # Global loader overlay
    ├── nav.js           # Shared navigation helpers
    ├── storage.js       # browser.storage.local wrappers
    └── toast.js         # Toast notification system
```

## Architecture Notes

- **Auth tokens** are stored in `browser.storage.local` (not sync) to avoid cross-device leakage.
- **Google sign-in** uses `browser.identity` when available; on Firefox Android the extension falls back to email/password login.
- **Context menus** are desktop-only; Android users save pins from the popup UI instead.
- **i18n** auto-detects language from `browser.storage.local` and `navigator.language`. Call `I18N.loadAndApplyForLang(lang)` to switch language at runtime.
- **Token caching**: `utils/api.js` caches the JWT in memory after the first read and clears it on 401 responses.
- **Background service worker** (`background.js`) has no DOM access, so use `console.warn/error` there instead of toasts.

## Building / Packaging

There is no build step. The extension is loaded directly as source files.

To create a distributable zip:

```bash
zip -r pinity-firefox-extension.zip . --exclude "*.git*" --exclude "node_modules/*" --exclude "*.zip"
```

> Zip files are excluded from source control via `.gitignore`.
