/**
 * editor/html-builders.js
 * HTML string builders (no global state).
 */
import { escapeHtml, escapeAttr } from './utils.js';
import { normalizeEditorThemeColorHex } from './normalizers.js';

/** @param {string} label @param {string} path @param {*} value @param {string} [type] @param {string} [step] */
export function fieldHtml(label, path, value, type, step) {
    return (
        '<label class="field-block"><span>' +
        escapeHtml(label) +
        '</span><input data-inspect-field="' +
        escapeAttr(path) +
        '" type="' +
        (type || 'text') +
        '"' +
        (step ? ' step="' + step + '"' : '') +
        ' value="' +
        escapeAttr(value == null ? '' : value) +
        '"></label>'
    );
}

/** @param {string} label @param {string} path @param {string} options */
export function selectHtml(label, path, options) {
    return (
        '<label class="field-block"><span>' +
        escapeHtml(label) +
        '</span><select data-inspect-field="' +
        escapeAttr(path) +
        '">' +
        options +
        '</select></label>'
    );
}

/** @param {string} label @param {string} key @param {*} val @param {*} step */
export function boardLayerFieldHtml(label, key, val, step) {
    var s = step != null ? ' step="' + step + '"' : '';
    return (
        '<label class="field-block"><span>' +
        escapeHtml(label) +
        '</span><input data-board-layer-field="' +
        escapeAttr(key) +
        '" type="number"' +
        s +
        ' value="' +
        escapeAttr(val == null ? '' : val) +
        '"></label>'
    );
}

/**
 * @param {string} kind
 * @param {string} id
 * @param {string} label
 * @param {string} className
 * @param {{ kind: string, id: string } | null} selection
 */
export function markerHtml(kind, id, label, className, selection) {
    var selected = selection && selection.kind === kind && selection.id === id;
    return (
        '<span draggable="true" class="' +
        className +
        (selected ? ' selected' : '') +
        '" data-object-kind="' +
        escapeAttr(kind) +
        '" data-object-id="' +
        escapeAttr(id) +
        '">' +
        escapeHtml(label.slice(0, 2)) +
        '</span>'
    );
}

/** @param {string} title @param {string} inner */
export function lcbSection(title, inner) {
    if (!inner) return '';
    return (
        '<div class="level-content-browser-section">' +
        '<h4>' +
        escapeHtml(title) +
        '</h4>' +
        inner +
        '</div>'
    );
}

/** @param {string} hex */
export function themeColorInput(hex) {
    return normalizeEditorThemeColorHex(hex, '#5a7d82');
}

/** @param {{col:number,row:number}[]} cells */
export function sortCells(cells) {
    return cells.slice().sort(function (a, b) {
        return Number(a.row) - Number(b.row) || Number(a.col) - Number(b.col);
    });
}

/** @param {Object} level @param {string} id */
export function findBoardImageLayerById(level, id) {
    if (!level || !level.map.boardImageLayers) return null;
    return (
        level.map.boardImageLayers.find(function (layer) {
            return layer.id === id;
        }) || null
    );
}

/** @param {number} n @param {number} lo @param {number} hi */
export function clampContentBrowserGeom(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
}
