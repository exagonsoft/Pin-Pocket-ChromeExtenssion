import { useEffect, useState } from "react";
import { requireSession } from "../../core/session";
import { storage } from "../../core/storage";
import { PageHeader } from "../../ui/PageHeader";
import { Nav } from "../../ui/Nav";
import { usePreferences } from "../../ui/usePreferences";
import { useNotice } from "../../ui/useNotice";
import type { ThemeMode } from "../../core/i18n";

export default function SettingsApp() {
  const [useSync, setUseSync] = useState(false);
  const [useEncryption, setUseEncryption] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const { theme, setTheme, languagePreference, setLanguagePreference, settingsStrings } =
    usePreferences();
  const { notice, show } = useNotice();

  useEffect(() => {
    requireSession()
      .then(async () => {
        const sync = await storage.getSync<{ useSync?: boolean; useEncryption?: boolean }>([
          "useSync",
          "useEncryption",
        ]);
        const local = await storage.getLocal<{
          compactMode?: boolean;
          theme?: ThemeMode;
          languagePreference?: string;
        }>(["compactMode", "theme", "languagePreference"]);
        setUseSync(Boolean(sync.useSync));
        setUseEncryption(Boolean(sync.useEncryption));
        setCompactMode(Boolean(local.compactMode));
      })
      .catch(() => undefined);
  }, []);

  const save = async () => {
    await storage.setSync({ useSync, useEncryption });
    await storage.setLocal({
      compactMode,
    });
    show("Settings saved", "success");
  };

  const resetAll = async () => {
    await storage.clearSync();
    await storage.setLocal({ pinnedPages: [] });
    show("Settings reset", "success");
  };

  return (
    <div className="app stack">
      <PageHeader
        eyebrow="Preferences"
        title={settingsStrings.title}
        subtitle={settingsStrings.subtitle}
      />
      <Nav current="settings" />
      {notice && <div className={`notice ${notice.tone} fade-up`}>{notice.text}</div>}

      <div className="card stack fade-up">
        <label className="row between">
          <span>{settingsStrings.useSync}</span>
          <input type="checkbox" checked={useSync} onChange={(e) => setUseSync(e.target.checked)} />
        </label>
        <label className="row between">
          <span>{settingsStrings.useEncryption}</span>
          <input type="checkbox" checked={useEncryption} onChange={(e) => setUseEncryption(e.target.checked)} />
        </label>
        <label className="row between">
          <span>{settingsStrings.compactMode}</span>
          <input type="checkbox" checked={compactMode} onChange={(e) => setCompactMode(e.target.checked)} />
        </label>
      </div>

      <div className="card stack fade-up">
        <strong>{settingsStrings.theme}</strong>
        <select value={theme} onChange={(e) => void setTheme(e.target.value as ThemeMode)}>
          <option value="system">{settingsStrings.system}</option>
          <option value="light">{settingsStrings.light}</option>
          <option value="dark">{settingsStrings.dark}</option>
        </select>
      </div>

      <div className="card stack fade-up">
        <strong>{settingsStrings.language}</strong>
        <select value={languagePreference} onChange={(e) => void setLanguagePreference(e.target.value)}>
          <option value="auto">Auto</option>
          <option value="en-US">English (US)</option>
          <option value="en-GB">English (UK)</option>
          <option value="es-ES">Spanish (ES)</option>
          <option value="es-MX">Spanish (MX)</option>
          <option value="fr-FR">French (FR)</option>
          <option value="pt-BR">Portuguese (BR)</option>
          <option value="de-DE">German (DE)</option>
          <option value="ja-JP">Japanese (JP)</option>
        </select>
      </div>

      <div className="actions actions--split">
        <button className="btn btn-primary" onClick={() => void save()}>{settingsStrings.save}</button>
        <button className="btn btn-danger" onClick={() => void resetAll()}>{settingsStrings.reset}</button>
      </div>
    </div>
  );
}
