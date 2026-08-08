import type { ManifestV3Export } from "@crxjs/vite-plugin";

const isDev = process.env.NODE_ENV !== "production";

const manifest: ManifestV3Export = {
  manifest_version: 3,
  name: "PinPocket — Smart Tab Manager",
  version: "2.0.0",
  description:
    "Save and organize browser tabs as pins with personal and team workspaces.",
  action: {
    default_popup: "popup.html",
    default_title: "PinPocket",
    default_icon: {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png",
    },
  },
  icons: {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png",
  },
  permissions: ["tabs", "storage", "contextMenus", "identity", "activeTab"],
  host_permissions: isDev
    ? ["https://pinity.uk/*", "https://*.brs.devtunnels.ms/*"]
    : ["https://pinity.uk/*"],
  background: {
    service_worker: "src/background.ts",
    type: "module",
  },
  web_accessible_resources: [
    {
      resources: ["icons/*"],
      matches: ["<all_urls>"],
    },
  ],
};

export default manifest;
