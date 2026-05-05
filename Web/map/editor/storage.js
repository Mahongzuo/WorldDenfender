/**
 * editor/storage.js — localStorage persistence and export helpers.
 * All functions receive state explicitly rather than using a global reference.
 */
import { LOCAL_BACKUP_KEY, LEGACY_BACKUP_KEY } from './content.js';

/**
 * Returns a copy of `src` safe for JSON serialisation (removes ephemeral fields).
 */
export function sanitizeStateForSave(src) {
    var o = JSON.parse(JSON.stringify(src));
    delete o.gameModelsCatalog;
    return o;
}

/**
 * Write `state` to localStorage as a backup.
 */
export function persistLocalBackup(state) {
    try {
        localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(state));
    } catch (_e) {}
}

/**
 * Read the most recent backup from localStorage (tries current key then legacy).
 * @returns {object|null}
 */
export function readLocalBackup() {
    try {
        return JSON.parse(
            localStorage.getItem(LOCAL_BACKUP_KEY) ||
            localStorage.getItem(LEGACY_BACKUP_KEY) ||
            'null'
        );
    } catch (_e) {
        return null;
    }
}

/**
 * Trigger a browser download of `state` as a JSON file.
 * @param {object} state
 * @param {function(string, string):void} setStatus
 */
export function exportState(state, setStatus) {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'earth-guardian-level-engine-export.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    if (setStatus) setStatus('\u5df2\u5bfc\u51fa\u5f53\u524d\u7f16\u8f91\u914d\u7f6e', 'success');
}

/**
 * Read shell panel collapse preferences from localStorage.
 */
export function readShellCollapsedPrefs(keys) {
    try {
        return {
            left: window.localStorage.getItem(keys.leftKey) === '1',
            right: window.localStorage.getItem(keys.rightKey) === '1'
        };
    } catch (_e) {
        return { left: false, right: false };
    }
}

/**
 * Persist shell panel collapse preferences to localStorage.
 */
export function persistShellCollapsedPrefs(keys, leftCollapsed, rightCollapsed) {
    try {
        window.localStorage.setItem(keys.leftKey, leftCollapsed ? '1' : '0');
        window.localStorage.setItem(keys.rightKey, rightCollapsed ? '1' : '0');
    } catch (_e) { /* ignore */ }
}
