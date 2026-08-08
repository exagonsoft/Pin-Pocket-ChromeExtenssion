//#region Imports
import { setUpNav, loadUserData } from "./utils/nav.js";
import I18N from "./i18n.js";
import { toast } from "./utils/toast.js";
import { authFetch } from "./utils/api.js";
import { CONFIG } from "./constants.js";
//#endregion

//#region DOM References
const saveBtn = document.getElementById("settings-save");
const displayNameEl = document.getElementById("profile-display-name");
const handleEl = document.getElementById("profile-handle");
const statusEl = document.getElementById("profile-status");
const invitesEl = document.getElementById("profile-invites");
const autoRenewEl = document.getElementById("auto-renew");

const subscribeBtn = document.getElementById("subscribe-btn");
const modifyPlanBtn = document.getElementById("modify-plan-btn");
const cancelBtn = document.getElementById("cancel-btn");

const currentPlanBadgeEl = document.getElementById("current-plan-badge");
const statusValueEl = document.getElementById("subscription-status");
const billingCycleValueEl = document.getElementById(
  "subscription-billing-cycle",
);
const nextBillingValueEl = document.getElementById("subscription-next-billing");
const billingNoteEl = document.getElementById("billing-note");
const actionNoteEl = document.getElementById("plan-action-note");
const planGridEl = document.getElementById("profile-plan-grid");
const planLoadingEl = document.getElementById("profile-plan-loading");
const billingPeriodInputs = Array.from(
  document.querySelectorAll('input[name="checkout-billing-period"]'),
);

const modal = document.getElementById("confirm-modal");
const modalTitle = document.getElementById("confirm-title");
const modalMessage = document.getElementById("confirm-message");
const modalOk = document.getElementById("confirm-ok");
const modalCancel = document.getElementById("confirm-cancel");
//#endregion

//#region State
const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "paused",
]);

const state = {
  userId: null,
  plans: [],
  selectedPlanId: "",
  currentPlanId: "",
  currentPlanName: "",
  assignedPlanId: "",
  assignedPlanName: "",
  currentPlanSlug: "",
  selectedBillingPeriod: "monthly",
  hasSubscription: false,
  canManageBilling: false,
  subscriptionStatus: "inactive",
  billingPeriod: "",
  nextBillingDate: null,
  paypalPayerId: "",
  paypalSubscriptionId: "",
  userLoadedFromBackend: false,
  plansLoadedFromBackend: false,
};
//#endregion

//#region Translation Helpers
function getNested(obj, path) {
  if (!obj || !path) return undefined;
  return path
    .split(".")
    .reduce(
      (acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined),
      obj,
    );
}

function t(key, vars = {}, fallback = "") {
  try {
    const strings = window.__I18N_STRINGS || {};
    let value = getNested(strings, key);
    if (typeof value !== "string") return fallback;
    Object.keys(vars).forEach((name) => {
      const token = new RegExp(`\\{\\{?${name}\\}?\\}`, "g");
      value = value.replace(token, String(vars[name]));
    });
    return value;
  } catch (_) {
    return fallback;
  }
}
//#endregion

//#region Storage Helpers
function getSyncStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (data) => resolve(data || {}));
  });
}

function setSyncStorage(values) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve();
    });
  });
}
//#endregion

//#region Billing And Plan Helpers
function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizePlanSlug(planName) {
  return normalizeSlug(planName || "") || "unknown";
}

function normalizeBillingPeriod(value) {
  return String(value || "")
    .trim()
    .toLowerCase() === "yearly"
    ? "yearly"
    : "monthly";
}

function hasActiveSubscription() {
  return ACTIVE_SUBSCRIPTION_STATUSES.has(state.subscriptionStatus);
}

function canOpenBillingPortal() {
  return Boolean(
    state.canManageBilling &&
    state.paypalPayerId &&
    state.paypalSubscriptionId &&
    state.hasSubscription,
  );
}

function canDirectCancel() {
  return Boolean(
    state.paypalSubscriptionId &&
    state.hasSubscription &&
    hasActiveSubscription(),
  );
}

function canDirectPlanChange() {
  return Boolean(
    state.paypalSubscriptionId &&
    state.hasSubscription &&
    hasActiveSubscription(),
  );
}

function isFreePlan(plan) {
  if (!plan || typeof plan !== "object") return false;
  const monthly = Number(plan.monthlyPrice || 0);
  const yearly = Number(plan.yearlyPrice || 0);
  const slug = normalizeSlug(plan.name || "");
  return (
    (monthly <= 0 && yearly <= 0) ||
    /(^|-)starter(-|$)|(^|-)free(-|$)|(^|-)basic(-|$)/.test(slug)
  );
}

function isPaidPlan(plan) {
  return Boolean(plan) && !isFreePlan(plan);
}

function getPlanPriceForBillingPeriod(plan, billingPeriod) {
  if (!plan || typeof plan !== "object") return 0;
  const normalized = normalizeBillingPeriod(billingPeriod);
  const monthly = Number(plan.monthlyPrice || 0);
  const yearly = Number(plan.yearlyPrice || 0);
  return normalized === "yearly" ? yearly : monthly;
}

function getBillingPriceIdForPlan(plan, billingPeriod) {
  if (!plan || typeof plan !== "object") return "";
  const normalized = normalizeBillingPeriod(billingPeriod);
  return String(
    normalized === "yearly" ? plan.externalProductIdV2 : plan.externalProductId,
  ).trim();
}

function hasPaidPriceForBillingPeriod(plan, billingPeriod) {
  return getPlanPriceForBillingPeriod(plan, billingPeriod) > 0;
}

function findPlanById(planId) {
  if (!planId) return null;
  return (
    state.plans.find((plan) => String(plan._id) === String(planId)) || null
  );
}

function findPlanByName(planName) {
  if (!planName) return null;
  const target = String(planName).trim().toLowerCase();
  return (
    state.plans.find(
      (plan) =>
        String(plan.name || "")
          .trim()
          .toLowerCase() === target,
    ) ||
    state.plans.find(
      (plan) => normalizeSlug(plan.name) === normalizeSlug(planName),
    ) ||
    null
  );
}

function getCurrentPlan() {
  return (
    findPlanById(state.currentPlanId) || findPlanByName(state.currentPlanName)
  );
}

function getSelectedPlan() {
  return findPlanById(state.selectedPlanId) || null;
}

function getDefaultPaidPlan() {
  const paidPlans = state.plans.filter(isPaidPlan);
  if (!paidPlans.length) return null;

  const ordered = [...paidPlans].sort((a, b) => {
    const aPrice = Number(a.monthlyPrice || a.yearlyPrice || 0);
    const bPrice = Number(b.monthlyPrice || b.yearlyPrice || 0);
    return aPrice - bPrice;
  });

  return ordered[0];
}

function isBillingDataReady() {
  return state.userLoadedFromBackend && state.plansLoadedFromBackend;
}

function formatDate(dateValue) {
  if (!dateValue) return t("profile.summary.noDate");
  try {
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return t("profile.summary.noDate");
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(parsed);
  } catch (_) {
    return t("profile.summary.noDate");
  }
}

function formatCurrency(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numeric % 1 === 0 ? 0 : 2,
  }).format(numeric);
}

function resolvePlanLabel(plan) {
  if (!plan) return t("profile.summary.planUnknown");
  const slug = normalizeSlug(plan.name);
  const key = `profile.plan.labels.${slug}`;
  const translated = t(key, {}, "");
  if (translated) return translated;
  return t("profile.plan.labels.dynamic", { name: plan.name || "" });
}

function resolvePlanMeta(plan) {
  if (!plan) return t("profile.plan.meta.default");
  const slug = normalizeSlug(plan.name);
  const key = `profile.plan.meta.${slug}`;
  const translated = t(key, {}, "");
  if (translated) return translated;

  const featureCount = Array.isArray(plan.features) ? plan.features.length : 0;
  return t("profile.plan.meta.features", { count: featureCount });
}

function resolveFeatureLabel(feature) {
  const raw = String(feature || "").trim();
  const slug = normalizeSlug(raw);
  const translated = t(`profile.features.${slug}`, {}, "");
  if (translated) return translated;
  if (raw) return t("profile.features.fallback", { feature: raw });
  return t("profile.features.unknown");
}

function formatPlanPrice(plan, billingPeriod = state.selectedBillingPeriod) {
  if (!plan) return t("profile.plan.price.custom");

  const monthly = Number(plan.monthlyPrice || 0);
  const yearly = Number(plan.yearlyPrice || 0);
  const normalizedBillingPeriod = normalizeBillingPeriod(billingPeriod);

  if (monthly <= 0 && yearly <= 0) return t("profile.plan.price.free");

  if (normalizedBillingPeriod === "yearly" && yearly > 0) {
    return t("profile.plan.price.yearly", { amount: formatCurrency(yearly) });
  }

  if (normalizedBillingPeriod === "monthly" && monthly > 0) {
    return t("profile.plan.price.monthly", { amount: formatCurrency(monthly) });
  }

  if (monthly > 0)
    return t("profile.plan.price.monthly", { amount: formatCurrency(monthly) });
  if (yearly > 0)
    return t("profile.plan.price.yearly", { amount: formatCurrency(yearly) });

  return t("profile.plan.price.custom");
}

function getCurrentPlanLabel() {
  if (!state.hasSubscription) return t("profile.summary.planUnknown");

  const currentPlan = getCurrentPlan();
  if (currentPlan) return resolvePlanLabel(currentPlan);
  if (state.currentPlanName)
    return t("profile.plan.labels.dynamic", { name: state.currentPlanName });
  return t("profile.summary.planUnknown");
}

function getStatusLabel(status) {
  return t(
    `profile.status.${status || "unknown"}`,
    {},
    t("profile.status.unknown"),
  );
}

function getBillingCycleLabel(billingPeriod) {
  const cycle = (billingPeriod || "").toLowerCase();
  if (cycle === "monthly" || cycle === "yearly")
    return t(`profile.billingCycle.${cycle}`);
  return t("profile.billingCycle.unknown");
}
//#endregion

//#region UI State Helpers
function setActionNote(key, tone = "info", vars = {}) {
  if (!actionNoteEl) return;
  const msg = key ? t(key, vars) : "";
  actionNoteEl.textContent = msg;
  actionNoteEl.hidden = !msg;
  actionNoteEl.dataset.tone = tone;
}

function setButtonState(button, enabled) {
  if (!button) return;
  button.disabled = !enabled;
  button.setAttribute("aria-disabled", enabled ? "false" : "true");
}

function setButtonVisibility(button, visible) {
  if (!button) return;
  button.hidden = !visible;
}

function setPlanStateNote(key, tone = "info") {
  if (!planLoadingEl) return;
  const message = key ? t(key) : "";
  planLoadingEl.textContent = message;
  planLoadingEl.hidden = !message;
  planLoadingEl.dataset.tone = tone;
}

function syncBillingPeriodInputs() {
  const selectedBillingPeriod = normalizeBillingPeriod(
    state.selectedBillingPeriod,
  );
  billingPeriodInputs.forEach((input) => {
    input.checked = input.value === selectedBillingPeriod;
  });
}

function applyCurrentPlanHighlight() {
  if (!planGridEl) return;
  const currentPlan = getCurrentPlan();

  planGridEl.querySelectorAll(".plan-card[data-plan-id]").forEach((card) => {
    const planId = card.getAttribute("data-plan-id");
    const isCurrent = currentPlan && String(currentPlan._id) === String(planId);
    const isSelected =
      state.selectedPlanId && String(state.selectedPlanId) === String(planId);

    card.classList.toggle("is-current", Boolean(isCurrent));
    card.classList.toggle("is-selected", Boolean(isSelected));
    card.setAttribute("data-current", isCurrent ? "true" : "false");

    const badge = card.querySelector(".plan-current-badge");
    if (badge) badge.hidden = !isCurrent;

    const radio = card.querySelector('input[name="plan"]');
    if (radio) radio.checked = Boolean(isSelected);
  });
}

function updateSummaryUI() {
  const currentPlan = getCurrentPlan();
  const hasRealSubscription = Boolean(
    state.hasSubscription && hasActiveSubscription(),
  );
  const currentIsUnknownPaid = Boolean(state.hasSubscription && !currentPlan);

  if (currentPlanBadgeEl) {
    currentPlanBadgeEl.textContent = getCurrentPlanLabel();
    currentPlanBadgeEl.dataset.plan = state.hasSubscription
      ? state.currentPlanSlug ||
        normalizeSlug(state.currentPlanName) ||
        "unknown"
      : "unknown";
  }

  if (statusValueEl)
    statusValueEl.textContent = getStatusLabel(state.subscriptionStatus);
  if (billingCycleValueEl)
    billingCycleValueEl.textContent = getBillingCycleLabel(state.billingPeriod);
  if (nextBillingValueEl)
    nextBillingValueEl.textContent = formatDate(state.nextBillingDate);

  if (billingNoteEl) {
    let noteKey = "profile.summary.notes.free";

    if (!isBillingDataReady()) {
      noteKey = "profile.summary.notes.loading";
    } else if (
      !state.hasSubscription &&
      state.subscriptionStatus === "canceled"
    ) {
      noteKey = "profile.summary.notes.canceled";
    } else if (currentIsUnknownPaid) {
      noteKey = canOpenBillingPortal()
        ? "profile.summary.notes.customPortal"
        : "profile.summary.notes.customLimited";
    } else if (state.hasSubscription && !hasRealSubscription) {
      noteKey = "profile.summary.notes.inactivePro";
    } else if (hasRealSubscription) {
      noteKey = canOpenBillingPortal()
        ? "profile.summary.notes.activePortal"
        : "profile.summary.notes.activeNoPortal";
    }

    billingNoteEl.textContent = t(noteKey);
  }
}

function updateActionButtons() {
  const selectedPlan = getSelectedPlan();

  const hasRealActiveSubscription = Boolean(
    state.hasSubscription && hasActiveSubscription(),
  );
  const hasPortal = canOpenBillingPortal();
  const selectedBillingPeriod = normalizeBillingPeriod(
    state.selectedBillingPeriod,
  );
  const selectedIsPayable = selectedPlan ? isPaidPlan(selectedPlan) : false;
  const selectedHasPriceForPeriod =
    selectedPlan && selectedIsPayable
      ? hasPaidPriceForBillingPeriod(selectedPlan, selectedBillingPeriod)
      : false;

  const showCancel = hasRealActiveSubscription;
  const showSubscribe = !hasRealActiveSubscription;
  const showModifyPlan = hasRealActiveSubscription;

  setButtonVisibility(cancelBtn, showCancel);
  setButtonVisibility(subscribeBtn, showSubscribe);
  setButtonVisibility(modifyPlanBtn, showModifyPlan);

  if (!isBillingDataReady()) {
    setButtonState(subscribeBtn, false);
    setButtonState(modifyPlanBtn, false);
    setButtonState(cancelBtn, false);
    setActionNote("profile.hints.loadingData", "info");
    return;
  }

  const canSubscribe = showSubscribe && selectedHasPriceForPeriod;
  const canModifyPlan = showModifyPlan;
  const canCancel =
    showCancel && hasRealActiveSubscription && (hasPortal || canDirectCancel());

  setButtonState(subscribeBtn, canSubscribe);
  setButtonState(modifyPlanBtn, canModifyPlan);
  setButtonState(cancelBtn, canCancel);

  if (!hasRealActiveSubscription) {
    if (!selectedIsPayable) {
      setActionNote("profile.hints.selectPaidPlan", "warn");
      return;
    }

    if (!selectedHasPriceForPeriod) {
      setActionNote("profile.hints.selectedBillingPeriodUnavailable", "warn", {
        period: getBillingCycleLabel(selectedBillingPeriod),
      });
      return;
    }

    setActionNote("profile.hints.starter", "info");
    return;
  }

  if (hasPortal) {
    setActionNote("profile.hints.portal", "info");
    return;
  }

  if (canDirectCancel()) {
    setActionNote("profile.hints.cancelOnly", "warn");
    return;
  }

  setActionNote("profile.hints.portalUnavailable", "warn");
}

function renderBillingState() {
  syncBillingPeriodInputs();
  applyCurrentPlanHighlight();
  updateSummaryUI();
  updateActionButtons();
}

function getLocalStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (data) => resolve(data || {}));
  });
}

function resolveStoredTheme(theme) {
  const savedTheme = String(theme || "system").toLowerCase();

  if (savedTheme === "dark" || savedTheme === "light") {
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

async function resolveCheckoutPreferences() {
  const stored = await getLocalStorage([
    "theme",
    "language",
    "languagePreference",
  ]);

  const locale =
    (typeof stored.language === "string" && stored.language.trim()) ||
    (typeof stored.languagePreference === "string" &&
    stored.languagePreference.trim() &&
    stored.languagePreference !== "auto"
      ? stored.languagePreference
      : "") ||
    navigator.language ||
    "en-US";

  const theme = resolveStoredTheme(stored.theme);

  return { locale, theme };
}
//#endregion

//#region Data Application
function applyProfileFields(data) {
  if (!data || typeof data !== "object") return;

  if (displayNameEl && data.displayName !== undefined)
    displayNameEl.value = data.displayName || "";
  if (handleEl && data.profileHandle !== undefined)
    handleEl.value = data.profileHandle || "";
  if (statusEl && data.statusMessage !== undefined)
    statusEl.value = data.statusMessage || "";
  if (invitesEl && data.allowInvites !== undefined)
    invitesEl.checked = Boolean(data.allowInvites);
  if (autoRenewEl && data.autoRenew !== undefined)
    autoRenewEl.checked = Boolean(data.autoRenew);
}

function resetBillingState() {
  state.currentPlanId = "";
  state.currentPlanName = "";
  state.assignedPlanId = "";
  state.assignedPlanName = "";
  state.currentPlanSlug = "unknown";
  state.hasSubscription = false;
  state.canManageBilling = false;
  state.subscriptionStatus = "inactive";
  state.billingPeriod = "";
  state.nextBillingDate = null;
  state.paypalPayerId = "";
  state.paypalSubscriptionId = "";
}

function applyBillingState(billing) {
  if (!billing || typeof billing !== "object") {
    resetBillingState();
    return;
  }

  state.hasSubscription = Boolean(billing.hasSubscription);
  state.subscriptionStatus =
    typeof billing.subscriptionStatus === "string" &&
    billing.subscriptionStatus.trim()
      ? billing.subscriptionStatus.trim().toLowerCase()
      : "inactive";

  state.currentPlanId =
    typeof billing.currentPlanId === "string" ? billing.currentPlanId : "";
  state.currentPlanName =
    typeof billing.currentPlanName === "string" ? billing.currentPlanName : "";
  state.assignedPlanId =
    typeof billing.assignedPlanId === "string" ? billing.assignedPlanId : "";
  state.assignedPlanName =
    typeof billing.assignedPlanName === "string"
      ? billing.assignedPlanName
      : "";
  state.currentPlanSlug = normalizePlanSlug(
    state.currentPlanName || state.assignedPlanName,
  );

  const incomingBillingPeriod =
    typeof billing.billingPeriod === "string" ? billing.billingPeriod : "";
  state.billingPeriod =
    incomingBillingPeriod === "monthly" || incomingBillingPeriod === "yearly"
      ? incomingBillingPeriod
      : "";
  state.nextBillingDate = billing.nextBillingDate || null;
  state.paypalPayerId =
    typeof billing.paypalPayerId === "string"
      ? billing.paypalPayerId
      : "";
  state.paypalSubscriptionId =
    typeof billing.paypalSubscriptionId === "string"
      ? billing.paypalSubscriptionId
      : "";
  state.canManageBilling = Boolean(billing.canManageBilling);

  if (state.hasSubscription && state.billingPeriod) {
    state.selectedBillingPeriod = normalizeBillingPeriod(state.billingPeriod);
  }

  if (!state.selectedPlanId) {
    if (state.currentPlanId) {
      state.selectedPlanId = String(state.currentPlanId);
    } else if (state.assignedPlanId) {
      state.selectedPlanId = String(state.assignedPlanId);
    }
  }
}

function buildStoragePayload(source = {}) {
  return {
    displayName: displayNameEl ? displayNameEl.value : source.displayName || "",
    profileHandle: handleEl ? handleEl.value : source.profileHandle || "",
    statusMessage: statusEl ? statusEl.value : source.statusMessage || "",
    allowInvites: invitesEl ? invitesEl.checked : Boolean(source.allowInvites),
    autoRenew: autoRenewEl ? autoRenewEl.checked : Boolean(source.autoRenew),
    plan: state.currentPlanId || source.plan || "",
    planName: state.currentPlanName || source.planName || "",
    assignedPlanId: state.assignedPlanId || source.assignedPlanId || "",
    assignedPlanName: state.assignedPlanName || source.assignedPlanName || "",
    hasSubscription:
      state.hasSubscription !== undefined
        ? state.hasSubscription
        : Boolean(source.hasSubscription),
    canManageBilling:
      state.canManageBilling !== undefined
        ? state.canManageBilling
        : Boolean(source.canManageBilling),
    subscriptionStatus:
      state.subscriptionStatus || source.subscriptionStatus || "inactive",
    billingPeriod: state.billingPeriod || source.billingPeriod || "",
    selectedBillingPeriod:
      state.selectedBillingPeriod || source.selectedBillingPeriod || "monthly",
    nextBillingDate: state.nextBillingDate || source.nextBillingDate || null,
    paypalPayerId: state.paypalPayerId || source.paypalPayerId || "",
    paypalSubscriptionId:
      state.paypalSubscriptionId || source.paypalSubscriptionId || "",
  };
}
//#endregion

//#region Feedback And External Navigation
function showToast(method, key, vars = {}) {
  const message = t(key, vars);
  if (!message) return;
  if (toast && typeof toast[method] === "function") {
    toast[method](message);
  }
}

function logBillingApiFailure(scope, payload) {
  try {
    console.error(`[profile.billing.${scope}] ${JSON.stringify(payload)}`);
  } catch (_) {
    console.error(`[profile.billing.${scope}]`, payload);
  }
}

function openExternalUrl(url) {
  if (!url) return;
  if (chrome && chrome.tabs && chrome.tabs.create) {
    chrome.tabs.create({ url });
    return;
  }
  window.open(url, "_blank");
}

function resolveCheckoutTarget(body) {
  const directUrl = typeof body?.url === "string" ? body.url.trim() : "";
  if (!directUrl) return "";

  try {
    const parsed = new URL(directUrl);

    const isAllowedOrigin =
      parsed.origin === CONFIG.BACKEND_BASE ||
      parsed.origin === CONFIG.APP_BASE;

    const isDummyCheckoutPage = /\/billing\/extension-checkout\/?$/.test(
      parsed.pathname,
    );

    if (!isAllowedOrigin || !isDummyCheckoutPage) {
      return "";
    }

    return parsed.toString();
  } catch (_) {
    return "";
  }
}
//#endregion

//#region Plan Rendering
function renderPlans() {
  if (!planGridEl) return;

  planGridEl.textContent = "";

  if (!state.plansLoadedFromBackend) {
    setPlanStateNote("profile.planState.loading", "info");
    return;
  }

  if (!state.plans.length) {
    setPlanStateNote("profile.planState.empty", "warn");
    return;
  }

  setPlanStateNote(null);

  const currentPlan = getCurrentPlan();
  if (!state.selectedPlanId) {
    state.selectedPlanId = currentPlan?._id
      ? String(currentPlan._id)
      : getDefaultPaidPlan()?._id
        ? String(getDefaultPaidPlan()._id)
        : String(state.plans[0]._id);
  }

  state.plans.forEach((plan) => {
    const card = document.createElement("label");
    card.className = "plan-card";
    card.dataset.planId = String(plan._id);

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "plan";
    radio.value = String(plan._id);
    radio.checked = state.selectedPlanId === String(plan._id);

    radio.addEventListener("change", () => {
      state.selectedPlanId = String(plan._id);
      renderBillingState();
    });

    const badge = document.createElement("span");
    badge.className = "plan-current-badge";
    badge.textContent = t("profile.summary.currentBadge");
    badge.hidden = plan._id !== currentPlan?._id;

    const name = document.createElement("span");
    name.className = "plan-name";
    name.textContent = resolvePlanLabel(plan);

    const price = document.createElement("span");
    price.className = "plan-price";
    price.textContent = formatPlanPrice(plan, state.selectedBillingPeriod);

    const meta = document.createElement("span");
    meta.className = "plan-meta";
    meta.textContent = resolvePlanMeta(plan);

    const list = document.createElement("ul");
    const features = Array.isArray(plan.features)
      ? plan.features.slice(0, 5)
      : [];

    if (!features.length) {
      const item = document.createElement("li");
      item.textContent = t("profile.features.unknown");
      list.appendChild(item);
    } else {
      features.forEach((feature) => {
        const item = document.createElement("li");
        item.textContent = resolveFeatureLabel(feature);
        list.appendChild(item);
      });
    }

    card.appendChild(radio);
    card.appendChild(badge);
    card.appendChild(name);
    card.appendChild(price);
    card.appendChild(meta);
    card.appendChild(list);

    planGridEl.appendChild(card);
  });

  applyCurrentPlanHighlight();
}

async function loadPlansFromServer() {
  try {
    const response = await authFetch(`${CONFIG.API_BASE}/plans`);
    if (!response.ok) throw new Error("plans_request_failed");

    const plans = await response.json();
    const normalized = Array.isArray(plans)
      ? plans.filter((plan) => plan && plan._id)
      : [];

    state.plans = normalized;
    state.plansLoadedFromBackend = true;

    if (!state.selectedPlanId) {
      const currentPlan = getCurrentPlan();
      if (currentPlan?._id) {
        state.selectedPlanId = String(currentPlan._id);
      } else {
        const fallbackPaid = getDefaultPaidPlan();
        state.selectedPlanId = fallbackPaid?._id
          ? String(fallbackPaid._id)
          : "";
      }
    }

    renderPlans();
    renderBillingState();
  } catch (error) {
    console.error("Unable to load plans from server", error);
    state.plansLoadedFromBackend = false;
    state.plans = [];
    setPlanStateNote("profile.planState.unavailable", "warn");
    setActionNote("profile.hints.serverUnavailable", "warn");
    renderBillingState();
  }
}
//#endregion

//#region Profile And Subscription API
async function syncProfileFromServer() {
  if (!state.userId) return;

  try {
    const response = await authFetch(
      `${CONFIG.API_BASE}/subscription/${state.userId}`,
    );
    if (!response.ok) throw new Error("subscription_state_failed");

    const serverState = await response.json();

    state.userLoadedFromBackend = true;

    applyProfileFields(serverState.profile || {});
    if (serverState.profile?.picture) {
      loadUserData(serverState.profile.picture);
    }
    applyBillingState(serverState.billing || {});

    const payload = buildStoragePayload({
      displayName: serverState.profile?.displayName || "",
      profileHandle: serverState.profile?.profileHandle || "",
      statusMessage: serverState.profile?.statusMessage || "",
      allowInvites: serverState.profile?.allowInvites,
      autoRenew: serverState.profile?.autoRenew,
      picture: serverState.profile?.picture || "",
      plan: serverState.billing?.currentPlanId || "",
      planName: serverState.billing?.currentPlanName || "",
      assignedPlanId: serverState.billing?.assignedPlanId || "",
      assignedPlanName: serverState.billing?.assignedPlanName || "",
      hasSubscription: Boolean(serverState.billing?.hasSubscription),
      canManageBilling: Boolean(serverState.billing?.canManageBilling),
      subscriptionStatus: serverState.billing?.subscriptionStatus || "inactive",
      billingPeriod: serverState.billing?.billingPeriod || "",
      selectedBillingPeriod: state.selectedBillingPeriod || "monthly",
      nextBillingDate: serverState.billing?.nextBillingDate || null,
      paypalPayerId: serverState.billing?.paypalPayerId || "",
      paypalSubscriptionId: serverState.billing?.paypalSubscriptionId || "",
    });
    await setSyncStorage(payload);

    renderPlans();
    renderBillingState();
  } catch (error) {
    console.error("Unable to sync profile from server", error);
    state.userLoadedFromBackend = false;
    resetBillingState();
    setActionNote("profile.hints.serverUnavailable", "warn");
    renderBillingState();
  }
}

async function updateServerProfile(payload) {
  if (!state.userId) {
    try {
      await setSyncStorage(payload);
      showToast("success", "profile.feedback.savedLocal");
    } catch (error) {
      console.error("Local profile save failed", error);
      showToast("error", "profile.feedback.failedLocal");
    }
    return;
  }

  try {
    const response = await authFetch(
      `${CONFIG.API_BASE}/users/${state.userId}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) throw new Error("server_update_failed");

    const updated = await response.json();
    applyProfileFields(updated);

    const storagePayload = buildStoragePayload(updated);

    try {
      await setSyncStorage(storagePayload);
      showToast("success", "profile.feedback.saved");
    } catch (storageError) {
      console.error(
        "Saved on server but failed local persistence",
        storageError,
      );
      showToast("warn", "profile.feedback.savedServerLocalFailed");
    }

    renderPlans();
    await syncProfileFromServer();
  } catch (error) {
    console.error("Profile server update failed", error);
    try {
      await setSyncStorage(payload);
      showToast("warn", "profile.feedback.savedLocalFallback");
    } catch (storageError) {
      console.error("Profile local fallback failed", storageError);
      showToast("error", "profile.feedback.failedServer");
    }
  }
}

function saveProfile() {
  const payload = {
    displayName: displayNameEl ? displayNameEl.value : "",
    profileHandle: handleEl ? handleEl.value : "",
    statusMessage: statusEl ? statusEl.value : "",
    allowInvites: invitesEl ? invitesEl.checked : false,
  };

  updateServerProfile(payload);
}

async function openBillingPortal(action = "overview", payload = {}) {
  try {
    const response = await authFetch(`${CONFIG.API_BASE}/subscription/portal`, {
      method: "POST",
      body: JSON.stringify({ action, ...payload }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      logBillingApiFailure("portal", {
        action,
        status: response.status,
        code: body?.code || "unknown",
        error: body?.error || "",
      });
      if (body?.code === "billing_config_invalid") {
        showToast("error", "profile.feedback.billingUnavailable");
        return;
      }
      if (body?.code === "subscription_not_active") {
        showToast("warn", "profile.feedback.actionUnavailable");
        return;
      }
      if (body?.code === "missing_paypal_plan_id") {
        showToast("error", "profile.feedback.planUnavailable");
        return;
      }
      throw new Error(body.error || "portal_unavailable");
    }

    if (action === "upgrade" || action === "downgrade") {
      showToast("success", "profile.feedback.saved");
      await syncProfileFromServer();
      return;
    }

    if (!body.url) {
      throw new Error("portal_unavailable");
    }

    openExternalUrl(body.url);
    showToast("success", "profile.feedback.portalOpened");
  } catch (error) {
    console.error("Unable to open billing portal", error);
    showToast("error", "profile.feedback.portalUnavailable");
  }
}

async function createSubscriptionSession(plan) {
  if (!plan || !plan._id) {
    showToast("warn", "profile.feedback.actionUnavailable");
    return;
  }

  const selectedBillingPeriod = normalizeBillingPeriod(
    state.selectedBillingPeriod,
  );
  const billingPriceId = getBillingPriceIdForPlan(plan, selectedBillingPeriod);

  if (!billingPriceId) {
    showToast("error", "profile.feedback.planUnavailable");
    return;
  }

  try {
    const { locale, theme } = await resolveCheckoutPreferences();

    const response = await authFetch(
      `${CONFIG.API_BASE}/subscription/session`,
      {
        method: "POST",
        body: JSON.stringify({
          planId: String(plan._id),
          userId: String(state.userId),
          billingPeriod: selectedBillingPeriod,
          billingPriceId,
          source: "extension",
          locale,
          theme,
        }),
      },
    );

    const body = await response.json().catch(() => ({}));
    const checkoutTarget = resolveCheckoutTarget(body);

    if (!response.ok || !checkoutTarget) {
      logBillingApiFailure("checkout", {
        planId: String(plan._id),
        userId: String(state.userId),
        billingPriceId,
        billingPeriod: selectedBillingPeriod,
        locale,
        theme,
        status: response.status,
        code: body?.code || "unknown",
        error: body?.error || "",
      });

      if (body.code === "use_portal") {
        await openBillingPortal("overview");
        return;
      }

      if (
        body.code === "plan_not_found" ||
        body.code === "missing_price_id" ||
        body.code === "checkout_price_failed"
      ) {
        showToast("error", "profile.feedback.planUnavailable");
        return;
      }

      if (
        body.code === "billing_config_invalid" ||
        body.code === "checkout_customer_failed" ||
        body.code === "invalid_checkout_session"
      ) {
        showToast("error", "profile.feedback.billingUnavailable");
        return;
      }

      throw new Error(body.error || "checkout_unavailable");
    }

    state.selectedBillingPeriod = normalizeBillingPeriod(
      body?.billingPeriod || selectedBillingPeriod,
    );

    setSyncStorage({
      selectedBillingPeriod: state.selectedBillingPeriod,
    }).catch(() => {});

    renderPlans();
    renderBillingState();

    openExternalUrl(checkoutTarget);
    showToast("success", "profile.feedback.checkoutOpened");
  } catch (error) {
    console.error("Unable to start checkout", error);
    showToast("error", "profile.feedback.checkoutUnavailable");
  }
}
async function cancelSubscriptionDirectly() {
  try {
    const response = await authFetch(`${CONFIG.API_BASE}/subscription/cancel`, {
      method: "POST",
      body: JSON.stringify({ effectiveFrom: "next_billing_period" }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      logBillingApiFailure("cancel", {
        status: response.status,
        code: body?.code || "unknown",
        error: body?.error || "",
      });
      if (body?.code === "billing_config_invalid") {
        showToast("error", "profile.feedback.billingUnavailable");
        return;
      }
      if (body?.code === "subscription_not_active") {
        showToast("warn", "profile.feedback.actionUnavailable");
        return;
      }
      throw new Error(body.error || "cancel_failed");
    }

    showToast("success", "profile.feedback.cancelScheduled");
    await syncProfileFromServer();
  } catch (error) {
    console.error("Unable to schedule cancellation", error);
    showToast("error", "profile.feedback.cancelFailed");
  }
}
//#endregion

//#region Modal
function showConfirm(titleKey, messageKey, vars = {}) {
  return new Promise((resolve) => {
    if (!modal || !modalTitle || !modalMessage || !modalOk || !modalCancel) {
      resolve(false);
      return;
    }

    modalTitle.textContent = t(titleKey, vars, t("profile.confirm.title"));
    modalMessage.textContent = t(
      messageKey,
      vars,
      t("profile.confirm.message"),
    );
    modal.setAttribute("aria-hidden", "false");

    const onOk = () => {
      cleanup();
      resolve(true);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const onEsc = (event) => {
      if (event.key !== "Escape") return;
      cleanup();
      resolve(false);
    };

    const onBackdrop = (event) => {
      if (!event.target.classList.contains("modal-backdrop")) return;
      cleanup();
      resolve(false);
    };

    const cleanup = () => {
      modal.setAttribute("aria-hidden", "true");
      modalOk.removeEventListener("click", onOk);
      modalCancel.removeEventListener("click", onCancel);
      document.removeEventListener("keydown", onEsc);
      modal.removeEventListener("click", onBackdrop);
    };

    modalOk.addEventListener("click", onOk);
    modalCancel.addEventListener("click", onCancel);
    document.addEventListener("keydown", onEsc);
    modal.addEventListener("click", onBackdrop);
  });
}
//#endregion

//#region Event Wiring
function wireActions() {
  if (saveBtn) {
    saveBtn.addEventListener("click", (event) => {
      event.preventDefault();
      saveProfile();
    });
  }

  if (subscribeBtn) {
    subscribeBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      if (subscribeBtn.disabled) {
        showToast("warn", "profile.feedback.actionUnavailable");
        return;
      }

      const selectedPlan = getSelectedPlan();
      if (!selectedPlan || !isPaidPlan(selectedPlan)) {
        showToast("warn", "profile.feedback.actionUnavailable");
        return;
      }

      const ok = await showConfirm(
        "profile.confirm.subscribe.title",
        "profile.confirm.subscribe.message",
        {
          plan: resolvePlanLabel(selectedPlan),
        },
      );
      if (!ok) return;

      await createSubscriptionSession(selectedPlan);
    });
  }

  if (modifyPlanBtn) {
    modifyPlanBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      if (modifyPlanBtn.disabled) {
        showToast("warn", "profile.feedback.actionUnavailable");
        return;
      }

      const selectedPlan =
        getSelectedPlan() || getCurrentPlan() || getDefaultPaidPlan();
      if (!selectedPlan) {
        showToast("warn", "profile.feedback.actionUnavailable");
        return;
      }

      const ok = await showConfirm(
        "profile.confirm.portal.title",
        "profile.confirm.portal.message",
      );
      if (!ok) return;

      const selectedBillingPeriod = normalizeBillingPeriod(
        state.selectedBillingPeriod,
      );
      const selectedBillingPriceId = getBillingPriceIdForPlan(
        selectedPlan,
        selectedBillingPeriod,
      );

      if (!selectedBillingPriceId) {
        showToast("error", "profile.feedback.planUnavailable");
        return;
      }

      const currentPlan = getCurrentPlan();
      const currentPlanId = currentPlan?._id ? String(currentPlan._id) : "";
      const selectedPlanId = selectedPlan?._id ? String(selectedPlan._id) : "";
      const samePlan = Boolean(currentPlanId && selectedPlanId && currentPlanId === selectedPlanId);
      const currentBillingPeriod = normalizeBillingPeriod(state.billingPeriod);
      const sameBillingPeriod = selectedBillingPeriod === currentBillingPeriod;

      // Active subscribers should revise existing PayPal subscription rather than creating a new one.
      if (canOpenBillingPortal() || canDirectPlanChange()) {
        if (!samePlan || !sameBillingPeriod) {
          const currentPrice = getPlanPriceForBillingPeriod(
            currentPlan,
            selectedBillingPeriod,
          );
          const selectedPrice = getPlanPriceForBillingPeriod(
            selectedPlan,
            selectedBillingPeriod,
          );
          const action = selectedPrice < currentPrice ? "downgrade" : "upgrade";
          await openBillingPortal(action, {
            billingPriceId: selectedBillingPriceId,
            billingPeriod: selectedBillingPeriod,
            planId: selectedPlanId,
          });
          return;
        }

        await openBillingPortal("overview");
        return;
      }

      // Fallback: start a new checkout session (e.g. no active billing subscription)
      await createSubscriptionSession(selectedPlan);
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      if (cancelBtn.disabled) {
        showToast("warn", "profile.feedback.actionUnavailable");
        return;
      }

      const ok = await showConfirm(
        "profile.confirm.cancel.title",
        "profile.confirm.cancel.message",
      );
      if (!ok) return;

      if (canOpenBillingPortal()) {
        await openBillingPortal("cancel");
        return;
      }

      if (canDirectCancel()) {
        await cancelSubscriptionDirectly();
        return;
      }

      showToast("error", "profile.feedback.portalUnavailable");
    });
  }

  billingPeriodInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      state.selectedBillingPeriod = normalizeBillingPeriod(input.value);
      renderPlans();
      renderBillingState();
    });
  });
}
//#endregion

//#region Bootstrap
async function loadProfile() {
  const stored = await getSyncStorage([
    "userId",
    "picture",
    "displayName",
    "profileHandle",
    "statusMessage",
    "allowInvites",
    "autoRenew",
    "plan",
    "planName",
    "assignedPlanId",
    "assignedPlanName",
    "hasSubscription",
    "canManageBilling",
    "subscriptionStatus",
    "billingPeriod",
    "selectedBillingPeriod",
    "nextBillingDate",
    "paypalPayerId",
    "paypalSubscriptionId",
  ]);

  if (!stored || !stored.userId) {
    window.location.href = "auth.html";
    return;
  }

  state.userId = stored.userId;

  setUpNav();
  loadUserData(stored.picture);

  applyProfileFields(stored);
  resetBillingState();
  state.userLoadedFromBackend = false;
  state.selectedBillingPeriod = normalizeBillingPeriod(
    (typeof stored.selectedBillingPeriod === "string" &&
      stored.selectedBillingPeriod) ||
      (typeof stored.billingPeriod === "string" && stored.billingPeriod) ||
      "monthly",
  );
  state.selectedPlanId =
    (typeof stored.assignedPlanId === "string" && stored.assignedPlanId) ||
    (typeof stored.plan === "string" && stored.plan) ||
    "";
  renderBillingState();
  setPlanStateNote("profile.planState.loading", "info");

  await Promise.all([syncProfileFromServer(), loadPlansFromServer()]);
}

chrome.storage.local.get(["language", "languagePreference"], (result) => {
  const pref = result?.languagePreference;
  const lang = (pref && pref !== "auto") ? pref : (result?.language || "auto");
  I18N.loadAndApplyForLang(lang)
    .then(() => {
      window.__I18N_VARS = Object.assign(window.__I18N_VARS || {}, {
        lang: navigator.language || "en-US",
      });
      wireActions();
      loadProfile();
    })
    .catch((error) => {
      console.error("Failed loading profile i18n", error);
      wireActions();
      loadProfile();
    });
});
//#endregion
