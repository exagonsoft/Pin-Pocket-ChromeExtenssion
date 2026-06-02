// utils/toast.module.js

//#region Constants
const DEFAULT_DURATION = 2800;
//#endregion

//#region DOM Helpers
function getRoot() {
  let root = document.getElementById("toast-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "toast-root";
    root.className = "toast-root";
    document.body.appendChild(root);
  }
  return root;
}
//#endregion

//#region Toast API
export function toast(message, type = "info", duration = DEFAULT_DURATION) {
  const root = getRoot();

  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;

  root.appendChild(el);

  setTimeout(() => {
    el.style.animation = "toast-out 180ms ease forwards";
    setTimeout(() => el.remove(), 180);
  }, duration);
}

/* Sugar helpers */
toast.success = (msg, d) => toast(msg, "success", d);
toast.error = (msg, d) => toast(msg, "error", d);
toast.info = (msg, d) => toast(msg, "info", d);
toast.warn = (msg, d) => toast(msg, "warn", d);
//#endregion
