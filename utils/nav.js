//#region Navigation
// Shared navigation helpers: exports `setUpNav` and `loadUserData`.
export function setUpNav() {
  try {
    const navMenuPins = document.getElementById("nav-menu-pins");
    const navMenuProfile = document.getElementById("nav-menu-profile");
    const navMenuSettings = document.getElementById("nav-menu-settings");

    navMenuPins?.addEventListener("click", () => {
      window.location.href = "popup.html";
    });

    navMenuProfile?.addEventListener("click", () => {
      window.location.href = "profile.html";
    });

    navMenuSettings?.addEventListener("click", () => {
      window.location.href = "settings.html";
    });
  } catch (e) {
    // Defensive: if DOM not ready or elements missing, fail silently.
    console.warn('setUpNav failed', e);
  }
}
//#endregion

//#region User Icon
export function loadUserData(picture) {
  try {
    const userIcon = document.getElementById("user-icon");
    if (!userIcon) return;
    // Clear existing and append image if provided
    userIcon.innerHTML = "";
    const image = document.createElement("img");
    if (picture) image.src = picture;
    image.alt = "User avatar";
    userIcon.appendChild(image);
    userIcon?.addEventListener("click", () => {
      window.location.href = "profile.html";
    });
  } catch (e) {
    console.warn('loadUserData failed', e);
  }
}
//#endregion
