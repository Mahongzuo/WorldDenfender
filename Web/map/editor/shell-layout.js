/**
 * editor/shell-layout.js — Inspector 宽度、侧栏折叠、viewport/inspector 分割条拖拽。
 */
import { SHELL_LEFT_COLLAPSE_KEY, SHELL_RIGHT_COLLAPSE_KEY, SHELL_INSPECTOR_WIDTH_KEY } from './content.js';
import { readShellCollapsedPrefs } from './storage.js';
import { clampInspectorWidthPx, isNarrowWorkbenchLayout } from './utils.js';

/**
 * @param {{
 *   setShellLeftCollapsedPref: function(boolean):void,
 *   setShellRightCollapsedPref: function(boolean):void
 * }} env
 */
export function readShellCollapsedPrefsFromStorage(env) {
    var prefs = readShellCollapsedPrefs({ leftKey: SHELL_LEFT_COLLAPSE_KEY, rightKey: SHELL_RIGHT_COLLAPSE_KEY });
    env.setShellLeftCollapsedPref(prefs.left);
    env.setShellRightCollapsedPref(prefs.right);
}

/** @param {{ getViewportViewMode: function():string, getPreviewApi: function():any }} env */
export function bumpShellLayoutDependentUi(env) {
    window.requestAnimationFrame(function () {
        if (env.getViewportViewMode() === 'preview' && env.getPreviewApi() && typeof env.getPreviewApi().resize === 'function') {
            env.getPreviewApi().resize();
        }
    });
}

/**
 * @param {object} refs
 * @param {{ getShellRightCollapsedPref: function():boolean }} env
 */
export function applyPersistedInspectorWidth(refs, env) {
    if (!refs.engineShell || isNarrowWorkbenchLayout() || env.getShellRightCollapsedPref()) return;
    var w = 380;
    try {
        var s = window.localStorage.getItem(SHELL_INSPECTOR_WIDTH_KEY);
        if (s) {
            var n = parseInt(s, 10);
            if (Number.isFinite(n)) w = n;
        }
    } catch (_e) {}
    w = clampInspectorWidthPx(w);
    refs.engineShell.style.setProperty('--shell-inspector-w', w + 'px');
}

export function persistInspectorWidthPx(w) {
    try {
        window.localStorage.setItem(SHELL_INSPECTOR_WIDTH_KEY, String(w));
    } catch (_e) {}
}

/**
 * @param {object} refs
 * @param {{
 *   getShellRightCollapsedPref: function():boolean,
 *   setInspectorSplitPointerStartX: function(number):void,
 *   getInspectorSplitPointerStartX: function():number,
 *   setInspectorSplitStartWidthPx: function(number):void,
 *   getInspectorSplitStartWidthPx: function():number,
 * }} env
 */
export function bindViewportInspectorSplitter(refs, env) {
    var grip = refs.viewportInspectorSplitter;
    if (!grip || grip.dataset.bound === '1') return;
    grip.dataset.bound = '1';
    function shellEnvForBump() {
        return {
            getViewportViewMode: env.getViewportViewMode,
            getPreviewApi: env.getPreviewApi
        };
    }
    function onMove(ev) {
        var dx = ev.clientX - env.getInspectorSplitPointerStartX();
        var next = clampInspectorWidthPx(env.getInspectorSplitStartWidthPx() - dx);
        if (refs.engineShell) refs.engineShell.style.setProperty('--shell-inspector-w', next + 'px');
    }
    function onUp() {
        grip.classList.remove('is-dragging');
        document.body.classList.remove('editor-shell--resizing');
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        if (refs.engineShell) {
            var cur = refs.engineShell.style.getPropertyValue('--shell-inspector-w').trim();
            var m = /^(\d+)px$/.exec(cur);
            if (m) persistInspectorWidthPx(Number(m[1]));
        }
        bumpShellLayoutDependentUi(shellEnvForBump());
    }
    grip.addEventListener('pointerdown', function (ev) {
        if (!refs.engineShell || env.getShellRightCollapsedPref() || isNarrowWorkbenchLayout()) return;
        ev.preventDefault();
        try {
            grip.setPointerCapture(ev.pointerId);
        } catch (_e) {}
        env.setInspectorSplitPointerStartX(ev.clientX);
        var cur = refs.engineShell.style.getPropertyValue('--shell-inspector-w').trim();
        var m = /^(\d+)px$/.exec(cur);
        env.setInspectorSplitStartWidthPx(m ? Number(m[1]) : clampInspectorWidthPx(380));
        grip.classList.add('is-dragging');
        document.body.classList.add('editor-shell--resizing');
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    });
}

/**
 * @param {object} refs
 * @param {{
 *   getShellLeftCollapsedPref: function():boolean,
 *   getShellRightCollapsedPref: function():boolean,
 *   getViewportViewMode: function():string,
 *   getPreviewApi: function():any
 * }} env
 */
export function applyShellPanelCollapseUi(refs, env) {
    if (!refs.engineShell || !refs.regionPanel || !refs.inspectorPanel) return;
    var narrow = isNarrowWorkbenchLayout();
    var bumpEnv = {
        getViewportViewMode: env.getViewportViewMode,
        getPreviewApi: env.getPreviewApi
    };
    var shellLeftCollapsedPref = env.getShellLeftCollapsedPref();
    var shellRightCollapsedPref = env.getShellRightCollapsedPref();
    if (narrow) {
        refs.engineShell.classList.remove('shell-left-collapsed', 'shell-right-collapsed');
        refs.regionPanel.classList.remove('shell-panel-collapsed');
        refs.inspectorPanel.classList.remove('shell-panel-collapsed');
        if (refs.railExpandRegionPanel) refs.railExpandRegionPanel.hidden = true;
        if (refs.railExpandInspectorPanel) refs.railExpandInspectorPanel.hidden = true;
        if (refs.regionPanelBody) refs.regionPanelBody.removeAttribute('aria-hidden');
        if (refs.inspectorPanelBody) refs.inspectorPanelBody.removeAttribute('aria-hidden');
        if (refs.viewportInspectorSplitter) {
            refs.viewportInspectorSplitter.hidden = true;
        }
        bumpShellLayoutDependentUi(bumpEnv);
        return;
    }
    refs.engineShell.classList.toggle('shell-left-collapsed', shellLeftCollapsedPref);
    refs.engineShell.classList.toggle('shell-right-collapsed', shellRightCollapsedPref);
    refs.regionPanel.classList.toggle('shell-panel-collapsed', shellLeftCollapsedPref);
    refs.inspectorPanel.classList.toggle('shell-panel-collapsed', shellRightCollapsedPref);
    if (refs.railExpandRegionPanel) {
        refs.railExpandRegionPanel.hidden = !shellLeftCollapsedPref;
        refs.railExpandRegionPanel.setAttribute('aria-expanded', shellLeftCollapsedPref ? 'false' : 'true');
    }
    if (refs.railExpandInspectorPanel) {
        refs.railExpandInspectorPanel.hidden = !shellRightCollapsedPref;
        refs.railExpandInspectorPanel.setAttribute('aria-expanded', shellRightCollapsedPref ? 'false' : 'true');
    }
    if (refs.regionPanelBody) refs.regionPanelBody.setAttribute('aria-hidden', shellLeftCollapsedPref ? 'true' : 'false');
    if (refs.inspectorPanelBody) refs.inspectorPanelBody.setAttribute('aria-hidden', shellRightCollapsedPref ? 'true' : 'false');
    if (refs.collapseRegionPanel) refs.collapseRegionPanel.setAttribute('aria-expanded', shellLeftCollapsedPref ? 'false' : 'true');
    if (refs.collapseInspectorPanel) refs.collapseInspectorPanel.setAttribute('aria-expanded', shellRightCollapsedPref ? 'false' : 'true');
    if (refs.viewportInspectorSplitter) {
        refs.viewportInspectorSplitter.hidden = shellRightCollapsedPref;
    }
    if (!shellRightCollapsedPref) {
        applyPersistedInspectorWidth(refs, env);
    }
    bumpShellLayoutDependentUi(bumpEnv);
}
