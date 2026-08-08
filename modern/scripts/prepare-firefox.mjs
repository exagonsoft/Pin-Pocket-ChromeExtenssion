import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, "dist");
const firefoxDistDir = path.join(projectRoot, "dist-firefox");
const manifestPath = path.join(firefoxDistDir, "manifest.json");
const firefoxExtensionId = process.env.FIREFOX_EXTENSION_ID || "pinpocket@pinity.uk";

await fs.rm(firefoxDistDir, { recursive: true, force: true });
await fs.cp(distDir, firefoxDistDir, { recursive: true });

const manifestRaw = await fs.readFile(manifestPath, "utf8");
const manifest = JSON.parse(manifestRaw);

manifest.permissions = (manifest.permissions || []).filter(
  (permission) => permission !== "identity",
);
manifest.browser_specific_settings = {
  gecko: {
    id: firefoxExtensionId,
    strict_min_version: "121.0",
  },
};

await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Prepared Firefox package at ${firefoxDistDir}`);
