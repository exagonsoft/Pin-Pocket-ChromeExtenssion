import { createContext } from "react";
import type { getSettingsStrings, getUiStrings, ThemeMode } from "../core/i18n";

export type PreferencesContextValue = {
  theme: ThemeMode;
  languagePreference: string;
  locale: string;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setLanguagePreference: (languagePreference: string) => Promise<void>;
  settingsStrings: ReturnType<typeof getSettingsStrings>;
  uiStrings: ReturnType<typeof getUiStrings>;
};

export const PreferencesContext = createContext<PreferencesContextValue | null>(null);
