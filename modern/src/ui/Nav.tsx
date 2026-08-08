import { usePreferences } from "./usePreferences";

export function Nav({ current }: { current: "pins" | "profile" | "settings" }) {
  const { uiStrings } = usePreferences();

  return (
    <div className="pill-nav fade-up" role="tablist" aria-label="Navigation">
      <button className="btn" aria-current={current === "pins" ? "page" : undefined} onClick={() => (window.location.href = "popup.html")} disabled={current === "pins"}>
        {uiStrings.navPins}
      </button>
      <button className="btn" aria-current={current === "profile" ? "page" : undefined} onClick={() => (window.location.href = "profile.html")} disabled={current === "profile"}>
        {uiStrings.navProfile}
      </button>
      <button className="btn" aria-current={current === "settings" ? "page" : undefined} onClick={() => (window.location.href = "settings.html")} disabled={current === "settings"}>
        {uiStrings.navSettings}
      </button>
    </div>
  );
}
