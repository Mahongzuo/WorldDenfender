export const UI_THEME_STORAGE_KEY = "earthguardian-ui-theme";
export function getUiColorMode() {
    try {
        return localStorage.getItem(UI_THEME_STORAGE_KEY) === "light" ? "light" : "dark";
    }
    catch {
        return "dark";
    }
}
export function applyUiColorMode(mode) {
    if (mode === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
    }
    else {
        document.documentElement.removeAttribute("data-theme");
    }
}
export function setUiColorMode(mode) {
    try {
        if (mode === "light") {
            localStorage.setItem(UI_THEME_STORAGE_KEY, "light");
        }
        else {
            localStorage.removeItem(UI_THEME_STORAGE_KEY);
        }
    }
    catch {
        /* ignore */
    }
    applyUiColorMode(mode);
}
export function toggleUiColorMode() {
    const next = getUiColorMode() === "dark" ? "light" : "dark";
    setUiColorMode(next);
    return next;
}
