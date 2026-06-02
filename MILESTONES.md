# 🚀 Pinity Extension – Development Milestones

This file outlines the core development milestones for the Pinity Chrome Extension project. Each section contains the goal, required files or changes, and a progress checklist.

---

## ✅ MVP – Core Extension Features

**Goal**: Allow users to pin the current tab to the cloud with team support.

### Files:
- `popup.html`
- `popup.js`
- `auth.html` / `auth.js`
- `background.js`
- `manifest.json`

### Tasks:
- [x] Display user session or login prompt
- [x] Capture current tab title + URL
- [x] Submit pin to API
- [x] Save using `userId` and `teamId`
- [x] Display success/failure feedback

---

## 📁 Team Support

**Goal**: Enable team context switching and pin sharing by team.

### Files:
- `manageTeam.html`
- `manageTeam.js`

### Tasks:
- [x] Show dropdown or list of available teams
- [x] Persist selected team in localStorage
- [x] Use selected `teamId` in pin creation
- [ ] Display error if team cannot be loaded
- [ ] Add option to refresh team list

---

## 🏷️ Tags & Categorization

**Goal**: Allow users to tag their pins for easier filtering.

### Files:
- `popup.html`
- `popup.js`

### Tasks:
- [x] Input field for tags (comma-separated or multi-select)
- [x] Include `tags` array in POST request
- [ ] Validate tag length & format
- [ ] Optional: show tag suggestions (future AI/ML feature)

---

## 🧑‍💼 Authentication Flow

**Goal**: Store session or token securely and manage user state.

### Files:
- `auth.html`
- `auth.js`
- `constants.js`

### Tasks:
- [x] Input form for API key or credentials
- [x] Store token or `userId` locally
- [x] Auto-redirect if token is valid
- [ ] Optional logout button or session reset
- [ ] Validate token before pinning

---

## ⚙️ Settings & Preferences (Optional)

**Goal**: Provide user control over app behavior (theme, language, etc.).

### Files:
- `options.html` *(currently placeholder)*

### Tasks:
- [ ] Theme toggle (light/dark)
- [ ] Language selector (English, Spanish, etc.)
- [ ] Save preferences in `chrome.storage.local`
- [ ] Apply styles dynamically

---

## 🌙 Dark Mode (Visual Polish)

**Goal**: Add modern dark UI support for all views.

### Tasks:
- [ ] Define dark mode styles for all HTML views
- [ ] Add toggle in popup or options
- [ ] Store user preference
- [ ] Dynamically apply class or styles

---

## 🧪 Error Handling & Feedback

**Goal**: Improve UX by showing meaningful success or error messages.

### Tasks:
- [ ] Toast or inline error messages on failed requests
- [ ] Loader/spinner during pinning
- [ ] Retry suggestion on failure
- [ ] Success confirmation (e.g. green check)

---

## 🧠 Future: Smart Tagging / AI

**Goal**: Enhance pinning with AI suggestions or summaries (optional).

### Tasks:
- [ ] Analyze page content using background script
- [ ] Suggest tags or categories using OpenAI or rules
- [ ] Add "suggest tags" button in popup

---

## 📦 Deployment & Distribution

### Tasks:
- [ ] Finalize `manifest.json` permissions
- [ ] Verify all views are mobile-friendly
- [ ] Publish to Chrome Web Store
- [ ] Add README with installation instructions

---

## ✅ Suggested File Structure

