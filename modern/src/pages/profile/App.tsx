import { useEffect, useMemo, useState } from "react";
import { authFetch, authJson, authPost } from "../../core/api";
import { requireSession } from "../../core/session";
import { getPreferredLanguage } from "../../core/i18n";
import type { BillingStateResponse, Plan } from "../../core/types";
import { PageHeader } from "../../ui/PageHeader";
import { Nav } from "../../ui/Nav";
import { usePreferences } from "../../ui/usePreferences";
import { useNotice } from "../../ui/useNotice";

export default function ProfileApp() {
  const [userId, setUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [profileHandle, setProfileHandle] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [allowInvites, setAllowInvites] = useState(true);
  const [autoRenew, setAutoRenew] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [billing, setBilling] = useState<BillingStateResponse["billing"]>({});
  const { notice, show } = useNotice();
  const { uiStrings } = usePreferences();

  const selectedPlan = useMemo(() => plans.find((p) => p._id === selectedPlanId) || null, [plans, selectedPlanId]);
  const selectedPriceId = useMemo(() => {
    if (!selectedPlan) return "";
    return billingPeriod === "yearly" ? selectedPlan.yearlyPriceId || "" : selectedPlan.monthlyPriceId || "";
  }, [selectedPlan, billingPeriod]);

  const syncData = async (id: string) => {
    const [profile, allPlans] = await Promise.all([
      authJson<BillingStateResponse>(`/subscription/${id}`),
      authJson<Plan[]>("/plans"),
    ]);
    setPlans(Array.isArray(allPlans) ? allPlans : []);
    setDisplayName(profile.profile?.displayName || "");
    setProfileHandle(profile.profile?.profileHandle || "");
    setStatusMessage(profile.profile?.statusMessage || "");
    setAllowInvites(Boolean(profile.profile?.allowInvites));
    setAutoRenew(Boolean(profile.profile?.autoRenew));
    setBilling(profile.billing || {});
    if (profile.billing?.currentPlanId) {
      setSelectedPlanId(profile.billing.currentPlanId);
    }
    if (profile.billing?.billingPeriod === "yearly") {
      setBillingPeriod("yearly");
    }
  };

  useEffect(() => {
    requireSession()
      .then(async (session) => {
        const id = session.userId || "";
        setUserId(id);
        await syncData(id);
      })
      .catch(() => undefined);
  }, []);

  const saveProfile = async () => {
    if (!userId) return;
    const res = await authFetch(`/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ displayName, profileHandle, statusMessage, allowInvites, autoRenew }),
    });
    if (!res.ok) return show("Failed to save profile", "error");
    show("Profile saved", "success");
  };

  const startCheckout = async () => {
    if (!selectedPlanId || !selectedPriceId || !userId) {
      return show("Select a payable plan first", "warn");
    }
    const locale = await getPreferredLanguage();
    const payload = await authPost<{ url?: string }>("/subscription/session", {
      userId,
      planId: selectedPlanId,
      billingPeriod,
      billingPriceId: selectedPriceId,
      source: "extension",
      theme: "dark",
      locale,
    });
    if (!payload.url) return show("Checkout unavailable", "error");
    chrome.tabs.create({ url: payload.url });
  };

  const openPortal = async (action: "overview" | "cancel") => {
    const payload = await authPost<{ url?: string }>("/subscription/portal", { action });
    if (!payload.url) return show("Billing portal unavailable", "error");
    chrome.tabs.create({ url: payload.url });
  };

  const cancelDirect = async () => {
    const res = await authFetch("/subscription/cancel", {
      method: "POST",
      body: JSON.stringify({ effectiveFrom: "next_billing_period" }),
    });
    if (!res.ok) return show("Cancel request failed", "error");
    await syncData(userId);
    show("Cancellation scheduled", "success");
  };

  return (
    <div className="app stack">
      <PageHeader
        eyebrow={uiStrings.profileEyebrow}
        title={uiStrings.profileTitle}
        subtitle={uiStrings.profileSubtitle}
      />
      <Nav current="profile" />
      {notice && <div className={`notice ${notice.tone} fade-up`}>{notice.text}</div>}

      <div className="card stack fade-up">
        <strong>Preferences</strong>
        <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" />
        <input className="input" value={profileHandle} onChange={(e) => setProfileHandle(e.target.value)} placeholder="Handle" />
        <input className="input" value={statusMessage} onChange={(e) => setStatusMessage(e.target.value)} placeholder="Status message" />
        <label className="row between">
          <span>Allow team invites</span>
          <input type="checkbox" checked={allowInvites} onChange={(e) => setAllowInvites(e.target.checked)} />
        </label>
        <label className="row between">
          <span>Auto renew</span>
          <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} />
        </label>
        <button className="btn btn-primary" onClick={() => void saveProfile()}>Save preferences</button>
      </div>

      <div className="card stack fade-up">
        <strong>Subscription</strong>
        <div className="meta-grid">
          <div className="meta-line"><span>Status</span><span>{billing?.subscriptionStatus || "inactive"}</span></div>
          <div className="meta-line"><span>Current plan</span><span>{billing?.currentPlanName || "None"}</span></div>
        </div>

        <div className="pill-nav">
          <button className="btn" onClick={() => setBillingPeriod("monthly")} disabled={billingPeriod === "monthly"}>Monthly</button>
          <button className="btn" onClick={() => setBillingPeriod("yearly")} disabled={billingPeriod === "yearly"}>Yearly</button>
          <button className="btn" onClick={() => void syncData(userId)}>Refresh</button>
        </div>
        <select value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)}>
          <option value="">Select plan</option>
          {plans.map((plan) => (
            <option value={plan._id} key={plan._id}>
              {plan.name} ({billingPeriod === "yearly" ? `$${plan.yearlyPrice || 0}/yr` : `$${plan.monthlyPrice || 0}/mo`})
            </option>
          ))}
        </select>
        <div className="actions actions--split">
          <button className="btn btn-primary" onClick={() => void startCheckout()}>Subscribe / Upgrade</button>
          <button className="btn" onClick={() => void openPortal("overview")}>Billing portal</button>
          <button className="btn btn-danger" onClick={() => void openPortal("cancel")}>Cancel via portal</button>
        </div>
        <button className="btn btn-danger" onClick={() => void cancelDirect()}>Direct cancel fallback</button>
      </div>
    </div>
  );
}
