export const UI_THEME_STORAGE_KEY = "earthguardian-ui-theme";

export type UiColorMode = "light" | "dark";

export function getUiColorMode(): UiColorMode {
  try {
    return localStorage.getItem(UI_THEME_STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyUiColorMode(mode: UiColorMode): void {
  if (mode === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export function setUiColorMode(mode: UiColorMode): void {
  try {
    if (mode === "light") {
      localStorage.setItem(UI_THEME_STORAGE_KEY, "light");
    } else {
      localStorage.removeItem(UI_THEME_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
  applyUiColorMode(mode);
}

export function toggleUiColorMode(): UiColorMode {
  const next: UiColorMode = getUiColorMode() === "dark" ? "light" : "dark";
  setUiColorMode(next);
  return next;
}
