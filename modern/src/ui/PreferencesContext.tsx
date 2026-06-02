import { useCallback, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import {
  applyDocumentPreferences,
  getSettingsStrings,
  getUiStrings,
  resolveLocale,
  resolveTheme,
  type ThemeMode,
} from "../core/i18n";
import { storage } from "../core/storage";
import { PreferencesContext, type PreferencesContextValue } from "./preferences-context";

export function PreferencesProvider({ children }: PropsWithChildren) {
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [languagePreference, setLanguagePreferenceState] = useState("auto");

  useEffect(() => {
    void applyDocumentPreferences();
    storage
      .getLocal<{ theme?: ThemeMode; languagePreference?: string; language?: string }>([
        "theme",
        "languagePreference",
        "language",
      ])
      .then((data) => {
        setThemeState(data.theme || "system");
        setLanguagePreferenceState(data.languagePreference || data.language || "auto");
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      areaName,
    ) => {
      if (areaName !== "local") return;
      if (changes.theme) {
        setThemeState((changes.theme.newValue as ThemeMode) || "system");
      }
      if (changes.languagePreference || changes.language) {
        const next =
          (changes.languagePreference?.newValue as string | undefined) ||
          (changes.language?.newValue as string | undefined) ||
          "auto";
        setLanguagePreferenceState(next);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolveTheme(theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = resolveLocale(languagePreference);
  }, [languagePreference]);

  const setTheme = useCallback(async (nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
    await storage.setLocal({ theme: nextTheme });
  }, []);

  const setLanguagePreference = useCallback(async (nextLanguagePreference: string) => {
    const resolvedLanguage = resolveLocale(nextLanguagePreference);
    setLanguagePreferenceState(nextLanguagePreference);
    await storage.setLocal({
      languagePreference: nextLanguagePreference,
      language: resolvedLanguage,
    });
  }, []);

  const locale = resolveLocale(languagePreference);
  const value = useMemo<PreferencesContextValue>(
    () => ({
      theme,
      languagePreference,
      locale,
      setTheme,
      setLanguagePreference,
      settingsStrings: getSettingsStrings(locale),
      uiStrings: getUiStrings(locale),
    }),
    [theme, languagePreference, locale, setTheme, setLanguagePreference],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}
