import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import { defineConfig } from "vite";
import manifest from "./manifest.config";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    rollupOptions: {
      input: {
        popup: "popup.html",
        auth: "auth.html",
        profile: "profile.html",
        settings: "settings.html",
        manageTeam: "manageTeam.html",
        reset: "reset.html",
      },
    },
  },
});
