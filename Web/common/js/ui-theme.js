/**
 * 全局界面浅色 / 深色（与塔防页 src/main.ts 共用 localStorage 键）
 */
(function () {
  var KEY = "earthguardian-ui-theme";

  function getMode() {
    try {
      return localStorage.getItem(KEY) === "light" ? "light" : "dark";
    } catch (e) {
      return "dark";
    }
  }

  function apply(mode) {
    if (mode === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  function setMode(mode) {
    try {
      if (mode === "light") {
        localStorage.setItem(KEY, "light");
      } else {
        localStorage.removeItem(KEY);
      }
    } catch (e) {}
    apply(mode);
    updateToggleButton();
  }

  function toggleMode() {
    setMode(getMode() === "dark" ? "light" : "dark");
  }

  function updateToggleButton() {
    var btn = document.getElementById("earthguardian-theme-toggle");
    if (!btn) return;
    var dark = getMode() === "dark";
    btn.textContent = dark ? "浅色模式" : "深色模式";
    btn.title = dark ? "切换为浅色界面" : "切换为深色界面";
  }

  function injectToggle() {
    if (document.getElementById("earthguardian-theme-toggle")) {
      updateToggleButton();
      return;
    }
    var btn = document.createElement("button");
    btn.id = "earthguardian-theme-toggle";
    btn.type = "button";
    btn.className = "ui-theme-toggle";
    btn.addEventListener("click", toggleMode);
    document.body.appendChild(btn);
    updateToggleButton();
  }

  apply(getMode());

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectToggle);
  } else {
    injectToggle();
  }

  window.addEventListener("storage", function (e) {
    if (e.key === KEY) {
      apply(getMode());
      updateToggleButton();
    }
  });

  window.EarthGuardianUiTheme = {
    key: KEY,
    getMode: getMode,
    setMode: setMode,
    toggle: toggleMode,
    apply: apply,
  };
})();
