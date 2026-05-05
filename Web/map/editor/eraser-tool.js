/**
 * 地图橡皮擦：半径持久化、笔刷预览、批量擦除格子。
 * 刷半径与预览指针保存在本模块闭包内，避免与 level-editor 顶层 var 重复。
 */
import { ERASER_RADIUS_STORAGE_KEY, ERASER_RADIUS_MAX } from './content.js';
import { cellsInEraserBrush } from './path-utils.js';
import { clamp } from './utils.js';

var brushRadius = 0;
/** @type {{ clientX: number, clientY: number }|null} */
var previewLastPointer = null;

export function readPersistedEraserBrushRadius() {
    try {
        var n = Number(window.localStorage.getItem(ERASER_RADIUS_STORAGE_KEY));
        brushRadius = clamp(Number.isFinite(n) ? Math.floor(n) : 0, 0, ERASER_RADIUS_MAX);
    } catch (ignore) {
        brushRadius = 0;
    }
}

function persistEraserBrushRadius() {
    try {
        window.localStorage.setItem(ERASER_RADIUS_STORAGE_KEY, String(brushRadius));
    } catch (ignore) { /* ignore */ }
}

export function syncEraserBrushUi(refs) {
    if (refs.eraserRadiusSlider) refs.eraserRadiusSlider.value = String(brushRadius);
    if (refs.eraserRadiusNumber) refs.eraserRadiusNumber.value = String(brushRadius);
}

/**
 * @param {object} refs
 * @param {() => void} [onAfterRadiusChange] 例如刷新笔刷高亮
 */
export function bindEraserToolControls(refs, onAfterRadiusChange) {
    readPersistedEraserBrushRadius();
    syncEraserBrushUi(refs);
    if (!refs.eraserRadiusSlider || !refs.eraserRadiusNumber || refs.eraserRadiusSlider.dataset.bound === '1') return;
    refs.eraserRadiusSlider.dataset.bound = '1';
    function bump() {
        persistEraserBrushRadius();
        if (onAfterRadiusChange) onAfterRadiusChange();
    }
    refs.eraserRadiusSlider.addEventListener('input', function () {
        brushRadius = clamp(parseInt(refs.eraserRadiusSlider.value, 10) || 0, 0, ERASER_RADIUS_MAX);
        refs.eraserRadiusNumber.value = String(brushRadius);
        bump();
    });
    refs.eraserRadiusNumber.addEventListener('change', function () {
        brushRadius = clamp(Math.floor(Number(refs.eraserRadiusNumber.value) || 0), 0, ERASER_RADIUS_MAX);
        refs.eraserRadiusSlider.value = String(brushRadius);
        refs.eraserRadiusNumber.value = String(brushRadius);
        bump();
    });
    refs.eraserRadiusNumber.addEventListener('input', function () {
        brushRadius = clamp(Math.floor(Number(refs.eraserRadiusNumber.value) || 0), 0, ERASER_RADIUS_MAX);
        refs.eraserRadiusSlider.value = String(brushRadius);
        bump();
    });
}

export function updateEraserToolPanelVisibility(refs, activeWorkbench, activeTool) {
    if (!refs.eraserToolPanel) return;
    var show = activeWorkbench === 'level' && activeTool === 'erase';
    refs.eraserToolPanel.classList.toggle('view-hidden', !show);
    if (!show) {
        previewLastPointer = null;
        clearEraserBrushPreview(refs);
    }
}

export function clearEraserBrushPreview(refs) {
    if (!refs.mapGrid) return;
    refs.mapGrid.querySelectorAll('.map-cell--eraser-preview').forEach(function (el) {
        el.classList.remove('map-cell--eraser-preview');
    });
}

/**
 * @param {object} env
 * @param {() => object|null} env.getLevel
 * @param {string} env.activeWorkbench
 * @param {string} env.activeTool
 * @param {function(number, number, object): HTMLElement|null} env.mapGridPickCellFromClientPoint
 */
export function updateEraserBrushPreview(refs, clientX, clientY, env) {
    if (!refs.mapGrid) return;
    var level = env.getLevel();
    if (!level || !level.map || !level.map.grid) {
        clearEraserBrushPreview(refs);
        return;
    }
    if (env.activeWorkbench !== 'level' || env.activeTool !== 'erase') {
        clearEraserBrushPreview(refs);
        return;
    }
    var g = level.map.grid;
    var pick = env.mapGridPickCellFromClientPoint(clientX, clientY, g);
    clearEraserBrushPreview(refs);
    if (!pick) return;
    var centerCol = Number(pick.getAttribute('data-col'));
    var centerRow = Number(pick.getAttribute('data-row'));
    if (!Number.isFinite(centerCol) || !Number.isFinite(centerRow)) return;
    var cells = cellsInEraserBrush(centerCol, centerRow, brushRadius, g.cols, g.rows);
    for (var i = 0; i < cells.length; i += 1) {
        var sel =
            '.map-grid-cells--floor .map-cell[data-col="' +
            String(cells[i].col) +
            '"][data-row="' +
            String(cells[i].row) +
            '"]';
        var el = refs.mapGrid.querySelector(sel);
        if (el) el.classList.add('map-cell--eraser-preview');
    }
}

export function recordEraserPreviewPointer(clientX, clientY) {
    previewLastPointer = { clientX: clientX, clientY: clientY };
}

export function clearEraserPreviewPointer() {
    previewLastPointer = null;
}

export function refreshEraserPreviewIfActive(refs, env) {
    if (!previewLastPointer) return;
    updateEraserBrushPreview(refs, previewLastPointer.clientX, previewLastPointer.clientY, env);
}

export function applyEraserBrush(centerCol, centerRow, getLevel, eraseCellAt) {
    var level = getLevel();
    if (!level || !level.map || !level.map.grid) return;
    var g = level.map.grid;
    var cells = cellsInEraserBrush(centerCol, centerRow, brushRadius, g.cols, g.rows);
    for (var i = 0; i < cells.length; i += 1) {
        eraseCellAt(cells[i].col, cells[i].row);
    }
}

/** 重绘地图 DOM 后调用：丢弃指针并清预览 class */
export function resetEraserPreviewAfterMapRebuild(refs) {
    previewLastPointer = null;
    clearEraserBrushPreview(refs);
}
