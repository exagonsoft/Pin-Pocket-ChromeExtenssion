//#region Navigation
// Shared navigation helpers: exports `setUpNav` and `loadUserData`.
export function setUpNav() {
  try {
    const navMenuPins = document.getElementById("nav-menu-pins");
    const navMenuProfile = document.getElementById("nav-menu-profile");
    const navMenuSettings = document.getElementById("nav-menu-settings");

    function makeNavClickable(el, href) {
      if (!el) return;
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      el.addEventListener("click", () => { window.location.href = href; });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          window.location.href = href;
        }
      });
    }

    makeNavClickable(navMenuPins, "popup.html");
    makeNavClickable(navMenuProfile, "profile.html");
    makeNavClickable(navMenuSettings, "settings.html");
  } catch (e) {
    console.warn('setUpNav failed', e);
  }
}
//#endregion

//#region User Icon
export function loadUserData(picture, userName) {
  try {
    const userIcon = document.getElementById("user-icon");
    if (!userIcon) return;
    userIcon.innerHTML = "";
    const image = document.createElement("img");
    if (picture) image.src = picture;
    image.alt = userName ? `${userName}'s avatar` : "User avatar";
    userIcon.appendChild(image);
    userIcon.setAttribute("role", "button");
    userIcon.setAttribute("tabindex", "0");
    userIcon.addEventListener("click", () => { window.location.href = "profile.html"; });
    userIcon.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        window.location.href = "profile.html";
      }
    });
  } catch (e) {
    console.warn('loadUserData failed', e);
  }
}
//#endregion
