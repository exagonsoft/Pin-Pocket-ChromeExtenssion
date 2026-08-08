# PinPocket Modern Extension (React + TypeScript + Vite)

This folder contains the modernized browser extension implementation using:

- React + TypeScript
- Vite
- `@crxjs/vite-plugin` (Manifest V3 packaging)

## Pages

- `popup.html` — personal pin list, pin current tab, import pinned tabs
- `auth.html` — login/register/forgot
- `profile.html` — profile preferences + subscription actions
- `settings.html` — theme/language/preferences
- `manageTeam.html` — owner-only team management (members, invites, team settings)
- `reset.html` — password reset confirmation

## Scripts

- `npm run dev`
- `npm run build`
- `npm run build:firefox`
- `npm run package:firefox`
- `npm run typecheck`
- `npm run lint`

Load `dist/` in `chrome://extensions` (Developer mode → Load unpacked).

## Firefox build

Use:

- `npm run build:firefox` to produce `dist-firefox/`
- `npm run package:firefox` to generate `pinpocket-firefox-v2.0.0.zip`

Optional:

- Set `FIREFOX_EXTENSION_ID` before running the Firefox build to control AMO extension ID.
