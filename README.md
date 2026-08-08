# PinitY — Chrome Extension

Save and manage pinned pages directly from your browser, powered by the [Pinity](https://pinity.uk) platform.

## Features

- Pin the current tab with one click
- Import all browser-pinned tabs in bulk
- Filter and browse saved pins
- Team support (Pro/Team plan)
- Multi-language UI
- Light/dark theme

## Development Setup

### Prerequisites

- Google Chrome (or Chromium-based browser)
- The [pinity-server](../pinity-server) backend running locally or accessible via a dev tunnel

### Loading the extension in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this directory (`Pin-Pocket-ChromeExtenssion/`)

The extension icon will appear in your toolbar.

### Connecting to a local backend

Edit `constants.js` and update `API_BASE` / `BACKEND_BASE` for your local or tunnel URL:

```js
const isDev = !("update_url" in chrome.runtime.getManifest());

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
├── background.js        # Service worker — context menu, storage change relay
├── popup.html/js        # Main popup UI — pin list, import, logout
├── auth.html/js         # Login, register, forgot password
├── profile.html/js      # User profile
├── settings.html/js     # Language, theme settings
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
    ├── storage.js       # chrome.storage.local wrappers
    └── toast.js         # Toast notification system
```

## Architecture Notes

- **Auth tokens** are stored in `chrome.storage.local` (not `sync`) to prevent sensitive data syncing across devices.
- **i18n** auto-detects language from `chrome.storage.local` and the browser's `navigator.language`. Call `I18N.loadAndApplyForLang(lang)` to switch language at runtime.
- **Token caching**: `utils/api.js` caches the JWT in memory after the first read. The cache is invalidated automatically on 401 responses.
- **Background service worker** (`background.js`) has no DOM access — `toast` is unavailable there; use `console.warn/error` instead.

## Building / Packaging

There is no build step. The extension is loaded directly as source files.

To create a distributable zip for the Chrome Web Store:

```bash
zip -r pinity-extension.zip . --exclude "*.git*" --exclude "node_modules/*" --exclude "*.zip"
```

> Zip files are excluded from source control via `.gitignore`.
