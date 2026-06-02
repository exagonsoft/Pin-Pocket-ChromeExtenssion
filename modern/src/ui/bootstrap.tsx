import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { PreferencesProvider } from "./PreferencesContext";

export function mount(elementId: string, App: React.ComponentType) {
  const el = document.getElementById(elementId);
  if (!el) throw new Error("Missing root element");

  createRoot(el).render(
    <StrictMode>
      <PreferencesProvider>
        <App />
      </PreferencesProvider>
    </StrictMode>,
  );
}
