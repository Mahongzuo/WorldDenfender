/**
 * editor/path-utils.js
 * 防御塔格路径 / 橡皮刷格 的纯计算工具函数（无 DOM / 无全局状态依赖）。
 * 与 src/main.ts 中的 expandPath / orderEditorPathCells / uniqueCells 保持一致。
 */

import { clamp } from './utils.js';
import { DEFAULT_GRID_COLS, DEFAULT_GRID_ROWS, ERASER_RADIUS_MAX } from './content.js';

// ─── 橡皮刷 ─────────────────────────────────────────────────────────────────

/**
 * 返回以 (centerCol, centerRow) 为中心、半径为 radius 的所有格子坐标（矩形范围）。
 * @param {number} centerCol
 * @param {number} centerRow
 * @param {number} radius
 * @param {number} cols  地图列数
 * @param {number} rows  地图行数
 * @returns {{col:number,row:number}[]}
 */
export function cellsInEraserBrush(centerCol, centerRow, radius, cols, rows) {
    var r = clamp(Math.floor(Number(radius) || 0), 0, ERASER_RADIUS_MAX);
    var out = [];
    var c0 = Number(centerCol);
    var r0 = Number(centerRow);
    for (var dr = -r; dr <= r; dr += 1) {
        for (var dc = -r; dc <= r; dc += 1) {
            var c = c0 + dc;
            var rw = r0 + dr;
            if (c >= 0 && c < cols && rw >= 0 && rw < rows) out.push({ col: c, row: rw });
        }
    }
    return out;
}

// ─── 棋盘图层 ────────────────────────────────────────────────────────────────

/**
 * 限制棋盘图片宽高比在 [0.04, 24] 之间（无效时返回 0.75）。
 * @param {*} v
 * @returns {number}
 */
export function clampBoardAspect(v) {
    var x = Number(v);
    if (!Number.isFinite(x) || x <= 0) return 0.75;
    return Math.min(24, Math.max(0.04, x));
}

// ─── 防御路径工具 ─────────────────────────────────────────────────────────────

/**
 * 与 src/main.ts expandPath 一致：曼哈顿连接折线路径为多格带子。
 * @param {{col:number,row:number}[]} points
 * @returns {Set<string>}
 */
export function expandPathWaypointPolyline(points) {
    /** @type {Set<string>} */
    var bucket = new Set();
    if (!points || points.length < 2) {
        points = points || [];
        for (var k = 0; k < points.length; k += 1)
            bucket.add(String(points[k].col) + ',' + String(points[k].row));
        return bucket;
    }
    for (var idx = 0; idx < points.length - 1; idx += 1) {
        var start = points[idx];
        var endPt = points[idx + 1];
        var cx = Number(start.col) || 0;
        var cy = Number(start.row) || 0;
        bucket.add(String(cx) + ',' + String(cy));

        while (cx !== Number(endPt.col)) {
            cx += Math.sign(Number(endPt.col) - cx);
            bucket.add(String(cx) + ',' + String(cy));
        }
        while (cy !== Number(endPt.row)) {
            cy += Math.sign(Number(endPt.row) - cy);
            bucket.add(String(cx) + ',' + String(cy));
        }
    }
    return bucket;
}

/**
 * 对齐 src/main.ts `uniqueCells`：去重并将每格坐标夹到合法范围。
 * @param {{col:number,row:number}[]} cells
 * @param {number} cols
 * @param {number} rows
 * @returns {{col:number,row:number}[]}
 */
export function uniqueDefenseCells(cells, cols, rows) {
    var seen = {};
    /** @type {Array<{col:number,row:number}>} */
    var result = [];
    for (var i = 0; i < cells.length; i += 1) {
        var cell = cells[i];
        var normalized = {
            col: clamp(Math.round(Number(cell.col) || 0), 0, cols - 1),
            row: clamp(Math.round(Number(cell.row) || 0), 0, rows - 1)
        };
        var key = normalized.col + ',' + normalized.row;
        if (seen[key]) continue;
        seen[key] = true;
        result.push(normalized);
    }
    return result;
}

/**
 * 两格之间的曼哈顿距离。
 * @param {{col:number,row:number}} a
 * @param {{col:number,row:number}} b
 */
export function manhattanDefense(a, b) {
    return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

/**
 * 两格是否相同位置。
 * @param {{col:number,row:number}} a
 * @param {{col:number,row:number}|null|undefined} b
 */
export function sameDefenseCell(a, b) {
    return !!b && a.col === b.col && a.row === b.row;
}

/**
 * 对齐 src/main.ts `orderEditorPathCells`：从出生点贪心串联路格直到终点。
 * @param {{col:number,row:number}[]} cells
 * @param {{col:number,row:number}} start
 * @param {{col:number,row:number}} end
 * @param {number} cols
 * @param {number} rows
 * @returns {{col:number,row:number}[]}
 */
export function orderEditorPathCellsDefense(cells, start, end, cols, rows) {
    var remaining = uniqueDefenseCells(cells, cols, rows).slice();
    /** @type {Array<{col:number,row:number}>} */
    var ordered = [];
    var current = start;
    if (!remaining.some(function (cell) { return sameDefenseCell(cell, start); }))
        ordered.push({ col: start.col, row: start.row });
    while (remaining.length > 0) {
        var nextIndex = remaining.findIndex(function (cell) {
            return manhattanDefense(cell, current) === 1;
        });
        if (nextIndex < 0) {
            nextIndex = remaining.reduce(function (bestIndex, cell, index) {
                return manhattanDefense(cell, current) <
                    manhattanDefense(remaining[bestIndex], current)
                    ? index
                    : bestIndex;
            }, 0);
        }
        var next = remaining.splice(nextIndex, 1)[0];
        ordered.push(next);
        current = next;
    }
    if (!ordered.some(function (cell) { return sameDefenseCell(cell, end); })) ordered.push({ col: end.col, row: end.row });
    return uniqueDefenseCells(ordered, cols, rows);
}

/**
 * 将一个格子坐标夹到合法范围（四舍五入）。
 * @param {{col:number,row:number}} cell
 * @param {number} cols
 * @param {number} rows
 * @returns {{col:number,row:number}}
 */
export function projectGridCellDefense(cell, cols, rows) {
    return {
        col: clamp(Math.round(Number(cell.col) || 0), 0, cols - 1),
        row: clamp(Math.round(Number(cell.row) || 0), 0, rows - 1)
    };
}

/**
 * 对齐 editorLevelToRuntimeMap：取首条非空 enemyPaths.cells，否则取 roads。
 * @param {object} map
 * @returns {{col:number,row:number}[]}
 */
export function defensePathSourceCells(map) {
    if (map.enemyPaths) {
        for (var pi = 0; pi < map.enemyPaths.length; pi += 1) {
            var p = map.enemyPaths[pi];
            if (p && p.cells && p.cells.length) return p.cells.slice();
        }
    }
    return map.roads && map.roads.length ? map.roads.slice() : [];
}

/**
 * 对齐 buildFallbackPath + uniqueCells：拐角折线顶点列表。
 * @param {{col:number,row:number}} spawn
 * @param {{col:number,row:number}} objective
 * @param {number} cols
 * @param {number} rows
 * @returns {{col:number,row:number}[]}
 */
export function buildDefenseFallbackVertexList(spawn, objective, cols, rows) {
    var midA = {
        col: clamp(Math.floor((spawn.col + objective.col) / 2), 0, cols - 1),
        row: spawn.row
    };
    var midB = { col: midA.col, row: objective.row };
    return uniqueDefenseCells([spawn, midA, midB, objective], cols, rows);
}

/**
 * 塔防棋盘行军带：与 editorLevelToRuntimeMap → expandPath 完全一致。
 * 路格排序 + Manhattan 铺开，返回 Set<"col,row">。
 * @param {object} level
 * @returns {Set<string>}
 */
export function getDefenseEditorPathKeys(level) {
    var map = level.map;
    if (!map || !map.grid)
        /** @type {Set<string>} */ return new Set();
    var cols = clamp(Math.floor(Number(map.grid.cols) || DEFAULT_GRID_COLS), 4, 80);
    var rows = clamp(Math.floor(Number(map.grid.rows) || DEFAULT_GRID_ROWS), 4, 80);

    var objectiveDefault = { col: cols - 1, row: Math.floor(rows / 2) };
    var objective = map.objectivePoint
        ? projectGridCellDefense(map.objectivePoint, cols, rows)
        : objectiveDefault;
    var spawn = Array.isArray(map.spawnPoints) && map.spawnPoints[0]
        ? projectGridCellDefense(map.spawnPoints[0], cols, rows)
        : { col: 0, row: objective.row };

    var raw = defensePathSourceCells(map);
    var projected = uniqueDefenseCells(
        raw.map(function (c) {
            return projectGridCellDefense(c, cols, rows);
        }),
        cols,
        rows
    );

    var orderedPath = orderEditorPathCellsDefense(projected, spawn, objective, cols, rows);
    var fallbackPath = buildDefenseFallbackVertexList(spawn, objective, cols, rows);
    /** 与 main：`path = projectedPath.length >= 2 ? projectedPath : fallbackPath` */
    var pathVerts = orderedPath.length >= 2 ? orderedPath : fallbackPath;
    return expandPathWaypointPolyline(pathVerts);
}
