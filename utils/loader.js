//#region DOM References
// utils/loader.js
const loader = document.getElementById("global-loader");
const loaderText = document.getElementById("loader-text");
//#endregion

//#region Public API
export function showLoader(text = "Loading…") {
  if (!loader) return;

  if (loaderText) {
    loaderText.textContent = text;
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
