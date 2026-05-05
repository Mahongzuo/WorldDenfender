/**
 * editor/utils.js
 * 纯工具函数 — 无副作用，无 DOM 操作，无状态依赖。
 */

export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

export function normalizeChineseCityName(value) {
    return String(value || '')
        .replace(/^中国[·\s-]*/, '')
        .replace(/ · .+$/, '')
        .replace(/[市区县盟州地区特别行政\s]/g, '')
        .trim();
}

export function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function escapeAttr(value) {
    return escapeHtml(value);
}

export function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

export function slugify(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/['']/g, '')
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 70);
}

export function updatePath(target, path, value) {
    if (!target) return;
    var parts = path.split('.');
    var cursor = target;
    for (var i = 0; i < parts.length - 1; i += 1) {
        if (!cursor[parts[i]] || typeof cursor[parts[i]] !== 'object') cursor[parts[i]] = {};
        cursor = cursor[parts[i]];
    }
    cursor[parts[parts.length - 1]] = value;
}

export function cellsRect(col, row, width, height) {
    var cells = [];
    for (var y = row; y < row + height; y += 1) {
        for (var x = col; x < col + width; x += 1) {
            cells.push({ col: x, row: y });
        }
    }
    return cells;
}

export function toggleCell(cells, col, row) {
    var c = Number(col);
    var r = Number(row);
    var index = cells.findIndex(function (cell) {
        return Number(cell.col) === c && Number(cell.row) === r;
    });
    if (index >= 0) cells.splice(index, 1);
    else cells.push({ col: c, row: r });
}

export function removeCell(cells, col, row) {
    var c = Number(col);
    var r = Number(row);
    var index = cells.findIndex(function (cell) {
        return Number(cell.col) === c && Number(cell.row) === r;
    });
    if (index >= 0) cells.splice(index, 1);
}

export function hasCell(cells, col, row) {
    if (!Array.isArray(cells)) return false;
    var c = Number(col);
    var r = Number(row);
    return cells.some(function (cell) {
        return Number(cell.col) === c && Number(cell.row) === r;
    });
}

export function cloneCells(cells) {
    return (cells || []).map(function (cell) {
        return { col: cell.col, row: cell.row };
    });
}

export function atCell(col, row) {
    var c = Number(col);
    var r = Number(row);
    return function (item) {
        return Number(item.col) === c && Number(item.row) === r;
    };
}

export function notAtCell(col, row) {
    var c = Number(col);
    var r = Number(row);
    return function (item) {
        return Number(item.col) !== c || Number(item.row) !== r;
    };
}

export function inBounds(cols, rows) {
    return function (item) {
        var c = Number(item.col);
        var r = Number(item.row);
        return c >= 0 && c < cols && r >= 0 && r < rows;
    };
}

export function byId(id) {
    return function (item) { return item && item.id === id; };
}
