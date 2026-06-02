//#region Imports
import { CONFIG } from "./constants.js";
import * as Storage from "./utils/storage.js";
import { toast } from "./utils/toast.js";
import I18N from "./i18n.js";
//#endregion

//#region State
const PASSWORD_MIN_LENGTH = 8;
let currentPasswordError = null;
//#endregion

//#region Translation Helpers
function getNested(obj, path) {
  if (!obj || !path) return undefined;
  return path.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

function t(key, vars = {}, fallback = "") {
  try {
    const strings = window.__I18N_STRINGS || {};
    let val = getNested(strings, key);
    if (typeof val !== "string") return fallback || "";
    Object.keys(vars).forEach((k) => {
      if (vars[k] !== undefined && vars[k] !== null) {
        const re = new RegExp(`\\{\\{?${k}\\}?\\}`, 'g');
        val = val.replace(re, String(vars[k]));
      }
    });
    return val;
  } catch (_) {
    return fallback || "";
  }
}

function formatLanguageLabel(languageCode) {
  if (!languageCode || typeof languageCode !== "string") return "";
  const translated =
    t(`auth.language.languages.${languageCode}`) ||
    t(`settings.language.options.${languageCode}`);
  if (translated) return translated;

  try {
    const [baseLanguage = "", region = ""] = languageCode.split("-");
    if (!baseLanguage) return languageCode;
    const languageDisplay = new Intl.DisplayNames([baseLanguage], { type: "language" }).of(baseLanguage);
    if (!languageDisplay) return languageCode;
    return region ? `${languageDisplay} (${region.toUpperCase()})` : languageDisplay;
  } catch (_) {
    return languageCode;
  }
}

function getLanguageOptionLabel(selectEl, languageCode) {
  if (!selectEl || !languageCode) return formatLanguageLabel(languageCode);
  const matchedOption = Array.from(selectEl.options).find((option) => option.value === languageCode);
  return (matchedOption && matchedOption.textContent) || formatLanguageLabel(languageCode);
}

function setLanguageDetectedNote(noteEl, selectEl, preference, resolvedLanguage) {
  if (!noteEl) return;
  const templateKey = preference === "auto" ? "auth.language.usingSystem" : "auth.language.preferred";
  const label = getLanguageOptionLabel(selectEl, resolvedLanguage);
  noteEl.textContent = t(templateKey, { lang: label });
}
//#endregion

//#region Auth Message Handler
function handleAuthMessage(event) {
  if (event.origin !== CONFIG.BACKEND_BASE) return;
  const data = event.data;
  if (!data || data.type !== "authSuccess") return;

  const { token, email, userId, plan, planName, team, teamOwner, picture, refreshToken } = data;
  if (!token || !userId) {
    console.error("Invalid auth payload:", data);
    toast.error(t("auth.errors.invalidLoginResponse"));
    return;
  }

  (async () => {
    try {
      await Storage.set({ userId, email, token, refreshToken, plan, planName, team, teamOwner, picture });
      await Storage.remove("importedOnce");
      window.removeEventListener("message", handleAuthMessage);
      window.location.href = "popup.html";
    } catch (err) {
      console.error("Failed to persist auth state:", err);
      toast.error(t("auth.errors.saveSessionFailed"));
    }
  })();
}
//#endregion

//#region Form Controls
function showForm(id) {
  document.querySelectorAll(".form").forEach((formEl) => {
    formEl.classList.remove("active");
    formEl.setAttribute("aria-hidden", "true");
  });
  const target = document.getElementById(id);
  if (target) {
    target.classList.add("active");
    target.setAttribute("aria-hidden", "false");
  }

  document.querySelectorAll(".tab-btns button").forEach((button) => {
    button.classList.remove("active");
    button.setAttribute("aria-selected", "false");
  });
  const tab = document.getElementById(`tab-${id}`);
  if (tab) {
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
  }
}

document.querySelectorAll(".tab-btns button").forEach((button) => {
  button.addEventListener("click", () => {
    const targetForm = button.getAttribute("data-target-form") || button.id.replace("tab-", "");
    showForm(targetForm);
  });
});
document.getElementById("back-to-login")?.addEventListener("click", () => showForm("login"));
//#endregion

//#region Initialization
async function resolveAuthState() {
  try {
    await Storage.get(["userId"]);
  } catch (error) {
    console.warn("Unable to read auth state from storage.", error);
  }
}

async function initLanguageControls() {
  const languageSelect = document.getElementById("settings-language");
  const detectedNote = document.getElementById("language-detected-note");
  if (!languageSelect) return;

  const navigatorLanguage =
    navigator.language ||
    (Array.isArray(navigator.languages) && navigator.languages[0]) ||
    "en-US";
  const systemLanguage = await I18N.resolveLanguage("auto");
  let languagePreference = "auto";
  try {
    const stored = await Storage.get(["languagePreference", "language"]);
    if (stored && typeof stored.languagePreference === "string") {
      languagePreference = stored.languagePreference;
    } else if (stored && typeof stored.language === "string") {
      languagePreference = stored.language;
    }
  } catch (e) {
    console.warn("Unable to read language preference from storage.", e);
  }

  const availableValues = new Set(Array.from(languageSelect.options).map((option) => option.value));
  if (languagePreference !== "auto" && !availableValues.has(languagePreference)) {
    const customOption = document.createElement("option");
    customOption.value = languagePreference;
    customOption.textContent = formatLanguageLabel(languagePreference);
    languageSelect.appendChild(customOption);
    availableValues.add(languagePreference);
  }

  const selectedPreference = availableValues.has(languagePreference) ? languagePreference : "auto";
  languageSelect.value = selectedPreference;
  const initialLanguage = await I18N.resolveLanguage(selectedPreference === "auto" ? navigatorLanguage : selectedPreference);
  try {
    await Storage.set({
      languagePreference: selectedPreference,
      language: initialLanguage
    });
  } catch (err) {
    console.warn("Failed to persist initial language selection.", err);
  }

  try {
    await I18N.loadAndApplyForLang(initialLanguage);
  } catch (err) {
    console.error("Failed to load translations for selected language.", err);
  }
  setLanguageDetectedNote(detectedNote, languageSelect, languageSelect.value, initialLanguage);
  refreshDynamicMessages();

  languageSelect.addEventListener("change", async () => {
    const selection = languageSelect.value;
    const resolvedLanguage = await I18N.resolveLanguage(selection === "auto" ? navigatorLanguage : selection);
    const payload =
      selection === "auto"
        ? { languagePreference: "auto", language: resolvedLanguage }
        : { languagePreference: selection, language: selection };

    try {
      await Storage.set(payload);
    } catch (err) {
      console.error("Failed to persist language preference.", err);
      toast.error(t("auth.errors.saveLanguage"));
      return;
    }

    try {
      await I18N.loadAndApplyForLang(resolvedLanguage);
    } catch (err) {
      console.error("Failed to reload i18n after language change", err);
    }

    setLanguageDetectedNote(detectedNote, languageSelect, selection, resolvedLanguage);
    refreshDynamicMessages();
  });
}

function setPasswordErrorText(message) {
  const passwordErrorEl = document.getElementById("password-error");
  const passwordEl = document.getElementById("reg-password");
  const confirmPasswordEl = document.getElementById("reg-password-confirm");

  if (passwordErrorEl) {
    passwordErrorEl.textContent = message;
    passwordErrorEl.hidden = !message;
  }
  if (passwordEl) passwordEl.setAttribute("aria-invalid", message ? "true" : "false");
  if (confirmPasswordEl) confirmPasswordEl.setAttribute("aria-invalid", message ? "true" : "false");
}

function setPasswordErrorByKey(key, vars = {}) {
  currentPasswordError = key ? { key, vars } : null;
  setPasswordErrorText(key ? t(key, vars) : "");
}

function refreshDynamicMessages() {
  if (currentPasswordError && currentPasswordError.key) {
    setPasswordErrorText(t(currentPasswordError.key, currentPasswordError.vars));
  }
}

function validateRegisterPasswords(showFeedback) {
  const password = document.getElementById("reg-password")?.value || "";
  const passwordConfirm = document.getElementById("reg-password-confirm")?.value || "";
  if (!password && !passwordConfirm) {
    setPasswordErrorByKey(null);
    return true;
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    if (showFeedback || password.length > 0) {
      setPasswordErrorByKey("auth.errors.passwordMinLength", { min: PASSWORD_MIN_LENGTH });
    }
    return false;
  }

  if (password !== passwordConfirm) {
    if (showFeedback || passwordConfirm.length > 0) {
      setPasswordErrorByKey("auth.register.passwordMismatch");
    }
    return false;
  }

  setPasswordErrorByKey(null);
  return true;
}

function initRegisterValidation() {
  const passwordEl = document.getElementById("reg-password");
  const confirmPasswordEl = document.getElementById("reg-password-confirm");
  if (!passwordEl || !confirmPasswordEl) return;

  const syncState = () => validateRegisterPasswords(false);
  passwordEl.addEventListener("input", syncState);
  confirmPasswordEl.addEventListener("input", syncState);
}

async function init() {
  await resolveAuthState();
  showForm("login");
  await initLanguageControls();
  initRegisterValidation();
}

init();

window.addEventListener("message", handleAuthMessage);
//#endregion

//#region Login
document.getElementById("login")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  if (!email || !password) {
    toast.warn(t("auth.errors.fillAllFields"));
    return;
  }

  try {
    const res = await fetch(`${CONFIG.API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      console.error("Login failed:", error || res.statusText);
      toast.error(t("auth.errors.loginFailed"));
      return;
    }
    const data = await res.json();
    await Storage.set({
      userId: data.user._id,
      email: data.user.email,
      token: data.token,
      refreshToken: data.refreshToken,
      plan: data.user.plan,
      planName: data.user.planName,
      team: data.user.team,
      teamOwner: data.user.teamOwner,
      picture: data.user.picture
    });
    await Storage.remove("importedOnce");
    window.location.href = "popup.html";
  } catch (err) {
    toast.error(t("auth.errors.network"));
    console.error("Login error:", err);
  }
});
//#endregion

//#region Google Login
document.getElementById("google-login")?.addEventListener("click", () => {
  const loginWindow = window.open(
    `${CONFIG.BACKEND_BASE}/auth/firebase`,
    "_blank",
    "width=500,height=650"
  );
  if (!loginWindow) toast.error(t("auth.errors.popupBlocked"));
});
//#endregion

//#region Register
document.getElementById("register")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const passwordConfirm = document.getElementById("reg-password-confirm")?.value || "";

  if (!name || !email || !password || !passwordConfirm) {
    toast.warn(t("auth.errors.fillAllFields"));
    return;
  }

  if (!validateRegisterPasswords(true)) {
    const inlineMessage = document.getElementById("password-error")?.textContent || "";
    toast.warn(inlineMessage);
    return;
  }

  try {
    const res = await fetch(`${CONFIG.API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      console.error("Registration failed:", error || res.statusText);
      toast.error(t("auth.errors.registerFailed"));
      return;
    }
    const data = await res.json();
    await Storage.set({
      userId: data.user._id,
      email: data.user.email,
      token: data.token,
      refreshToken: data.refreshToken,
      plan: data.user.plan,
      planName: data.user.planName,
      picture: data.user.picture
    });
    await Storage.remove("importedOnce");
    window.location.href = "popup.html";
  } catch (err) {
    toast.error(t("auth.errors.network"));
    console.error("Register error:", err);
  }
});
//#endregion

//#region Forgot Password
document.getElementById("forgot")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("forgot-email").value.trim();
  if (!email) {
    toast.warn(t("auth.errors.enterEmail"));
    return;
  }
  try {
    const res = await fetch(`${CONFIG.API_BASE}/auth/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const result = await res.json().catch(() => ({}));
    if (res.ok) {
      toast.success(t("auth.forgot.success"));
      showForm("login");
    } else {
      console.error("Reset failed:", result.error || res.statusText);
      toast.error(t("auth.errors.resetFailed"));
    }
  } catch (err) {
    toast.error(t("auth.errors.network"));
    console.error("Reset error:", err);
  }
});
//#endregion
