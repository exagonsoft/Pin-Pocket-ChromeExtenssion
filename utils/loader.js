//#region DOM References
// utils/loader.js
const loader = document.getElementById("global-loader");
const loaderText = document.getElementById("loader-text");
//#endregion

//#region Public API
export function showLoader(text) {
  if (!loader) return;

  const displayText = text || window.__I18N_STRINGS?.common?.loading || "Loading\u2026";
  if (loaderText) {
    loaderText.textContent = displayText;
  }

  document.body.classList.add("loading");
  loader.classList.remove("hidden");
}

export function hideLoader() {
  if (!loader) return;

  loader.classList.add("hidden");
  document.body.classList.remove("loading");
}
//#endregion
