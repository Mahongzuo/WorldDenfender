/**
 * 关卡编辑器 UI 会话持久化：刷新后恢复当前关卡与筛选/工作台状态。
 */
export var EDITOR_SESSION_STORAGE_KEY = 'earth-guardian.levelEditorSession';

/**
 * @returns {{ levelId?: string, activeStatusFilter?: string, activeWorkbench?: string, activeEditorMode?: string, viewportViewMode?: string }|null}
 */
export function readEditorSession() {
    try {
        var raw = window.localStorage.getItem(EDITOR_SESSION_STORAGE_KEY);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_err) {
        return null;
    }
}

/**
 * @param {object} patch
 */
export function persistEditorSession(patch) {
    if (!patch || typeof patch !== 'object') return;
    try {
        var prev = readEditorSession() || {};
        window.localStorage.setItem(
            EDITOR_SESSION_STORAGE_KEY,
            JSON.stringify(Object.assign({}, prev, patch))
        );
    } catch (_err) {}
}

export function syncLevelIdInUrl(levelId) {
    if (!levelId) return;
    try {
        var url = new URL(window.location.href);
        if (url.searchParams.get('levelId') === levelId) return;
        url.searchParams.set('levelId', levelId);
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch (_err) {}
}

/**
 * 将已恢复的会话状态同步到筛选 chip、模式 tab、视口 tab 等 DOM。
 * @param {object} refs
 * @param {{ activeStatusFilter?: string, activeWorkbench?: string, activeEditorMode?: string, viewportViewMode?: string }} session
 */
export function applyEditorSessionUi(refs, session) {
    if (!session) return;
    if (refs.statusFilters && session.activeStatusFilter) {
        refs.statusFilters.querySelectorAll('[data-status-filter]').forEach(function (item) {
            item.classList.toggle('active', item.getAttribute('data-status-filter') === session.activeStatusFilter);
        });
    }
    if (refs.workbenchTabs && session.activeWorkbench) {
        refs.workbenchTabs.querySelectorAll('[data-workbench]').forEach(function (item) {
            item.classList.toggle('active', item.getAttribute('data-workbench') === session.activeWorkbench);
        });
    }
    if (refs.editorModeTabs && session.activeEditorMode) {
        refs.editorModeTabs.querySelectorAll('[data-editor-mode]').forEach(function (item) {
            item.classList.toggle('active', item.getAttribute('data-editor-mode') === session.activeEditorMode);
        });
    }
    if (refs.viewportViewTabs && session.viewportViewMode) {
        refs.viewportViewTabs.querySelectorAll('[data-view-mode]').forEach(function (item) {
            var on = item.getAttribute('data-view-mode') === session.viewportViewMode;
            item.classList.toggle('active', on);
            item.setAttribute('aria-selected', on ? 'true' : 'false');
        });
    }
}
