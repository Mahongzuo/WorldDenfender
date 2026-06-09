/**
 * editor/normalizers.js — 纯数据规整函数
 * 不依赖 DOM 与浏览器 editor 运行时状态（仅依赖 content.js 中的默认常量）。
 * 被 level-editor.js 以及未来的 storage.js 等模块 import。
 */
import { DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID, JINAN_MAP_TEXTURE_URL } from './city-geo-configs.js';
import { uid, slugify, clamp, clone, editorVol01, inBounds } from './utils.js';
import {
    TOWER_MODEL_SPECS, DEFAULT_TOWER_GAMEPLAY_STATS, DEFAULT_ACTOR_TEMPLATES,
    GAMEPLAY_RESOURCE_CONFIG, ENGINE_VERSION, DEFENSE_ELEMENT_OPTIONS, DEFENSE_FUNCTION_OPTIONS, DEFENSE_STATUS_OPTIONS,
    DEFAULT_GRID_COLS, DEFAULT_GRID_ROWS, DEFAULT_TILE_SIZE
} from './content.js';

import { splitRegion, buildRegionLabel, inferCountryCode } from './normalize-region.js';
import { canonicalModelPathScaleKey as normGlobalScaleKey, clampGlobalPathModelScale } from './model-path-scale.js';
import { orderEditorPathCellsDefense } from './path-utils.js';
export { splitRegion, buildRegionLabel, inferCountryCode };

// ---------------------------------------------------------------------------
// 基础单元格 / 点位
// ---------------------------------------------------------------------------

export function normalizeCell(cell) {
    return { col: Number(cell.col) || 0, row: Number(cell.row) || 0 };
}

export function normalizeCells(cells) {
    return Array.isArray(cells) ? cells.map(normalizeCell) : [];
}

export function normalizePoint(point) {
    if (!point || typeof point !== 'object') return null;
    return {
        id: String(point.id || 'point'),
        name: String(point.name || point.label || '点位'),
        col: Number(point.col) || 0,
        row: Number(point.row) || 0
    };
}

export function defaultObjectivePoint(grid) {
    return { id: 'objective-main', name: '防守核心', col: Math.max(0, grid.cols - 4), row: Math.floor(grid.rows / 2) };
}

export function normalizeStatus(status, map) {
    if (status === 'designed' || status === 'needs-work' || status === 'draft') return status;
    var hasWork =
        map &&
        (map.actors.length ||
            map.roads.length ||
            map.spawnPoints.length ||
            map.explorationPoints.length ||
            (map.exploreBosses && map.exploreBosses.length) ||
            (map.exploreSpawners && map.exploreSpawners.length) ||
            (map.explorePickups && map.explorePickups.length));
    return hasWork ? 'needs-work' : 'draft';
}

// ---------------------------------------------------------------------------
// 位置 / 环境
// ---------------------------------------------------------------------------

export function normalizeLocation(source) {
    var location = source.location && typeof source.location === 'object' ? source.location : {};
    var legacyRegion = String(source.region || '');
    var parts = splitRegion(legacyRegion);
    var out = {
        countryCode: String(location.countryCode || inferCountryCode(parts.country) || ''),
        countryName: String(location.countryName || parts.country || legacyRegion || '未设置国家'),
        cityCode: String(location.cityCode || ''),
        cityName: String(location.cityName || parts.city || ''),
        regionLabel: String(location.regionLabel || legacyRegion || ''),
        source: String(location.source || 'legacy')
    };
    if (location.geo && typeof location.geo === 'object') {
        out.geo = normalizeGeoConfig(location.geo);
    }
    return out;
}

export function normalizeEnvironment(environment) {
    var source = environment && typeof environment === 'object' ? environment : {};
    return {
        floorTextureId: String(source.floorTextureId || ''),
        sceneModelId: String(source.sceneModelId || ''),
        lightingProfile: String(source.lightingProfile || 'default-lighting'),
        entryScene: String(source.entryScene || ''),
        notes: String(source.notes || '')
    };
}

// ---------------------------------------------------------------------------
// 棋盘图片图层
// ---------------------------------------------------------------------------

export function normalizeBoardImageLayers(raw) {
    if (!Array.isArray(raw)) return [];
    var list = [];
    for (var i = 0; i < raw.length; i += 1) {
        var L = raw[i];
        if (!L || typeof L !== 'object') continue;
        var src = typeof L.src === 'string' ? L.src.trim() : '';
        if (!src) continue;
        function pPct(v, fb) {
            var x = Number(v);
            return Number.isFinite(x) ? Math.max(0, Math.min(100, x)) : fb;
        }
        function pWidth(v) {
            var x = Number(v);
            return Number.isFinite(x) ? Math.max(5, Math.min(500, x)) : 48;
        }
        function pOp(v) {
            var x = Number(v);
            return Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 1;
        }
        var ordRaw = Number(L.order);
        var ord = Number.isFinite(ordRaw) ? Math.round(ordRaw) : list.length;
        var bilEntry = {
            id: String(L.id || uid('board-img')),
            src: src,
            centerX: pPct(L.centerX, 0),
            centerY: pPct(L.centerY, 0),
            widthPct: pWidth(L.widthPct),
            opacity: pOp(L.opacity),
            order: ord
        };
        if (L.editorHidden === true) bilEntry.editorHidden = true;
        if (L.legacyBoardBase === true) bilEntry.legacyBoardBase = true;
        var ar = Number(L.aspect);
        if (Number.isFinite(ar) && ar > 0) bilEntry.aspect = Math.min(24, Math.max(0.04, ar));
        list.push(bilEntry);
    }
    list.sort(function (a, b) {
        return a.order - b.order;
    });
    return list;
}

function levelLooksLikeJinan(level) {
    var haystack = [
        level && level.id,
        level && level.name,
        level && level.location && level.location.cityName,
        level && level.location && level.location.regionLabel,
        level && level.location && level.location.cityCode
    ]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, '');
    return /济南|泉城|370100|shandong|cn-370100|shandong_370100/i.test(haystack);
}

function levelDisablesJinanBoardFallback(level) {
    var sceneRemake = level && level.extensions && level.extensions.sceneRemake;
    return !!(sceneRemake && sceneRemake.disableJinanRegionalFlatPreset === true);
}

function hasFullCoverBoardImageLayer(layers) {
    return Array.isArray(layers) && layers.some(function (layer) {
        return layer && Number(layer.widthPct) >= 100;
    });
}

function hasLegacyBaseBoardImageLayer(layers) {
    return Array.isArray(layers) && layers.some(function (layer) {
        return layer && layer.legacyBoardBase === true;
    });
}

function createFullCoverBoardImageLayer(id, src, order) {
    return {
        id: id,
        src: String(src || '').trim(),
        centerX: 0,
        centerY: 0,
        widthPct: 100,
        opacity: 1,
        order: Number.isFinite(Number(order)) ? Number(order) : -100,
        aspect: 0.75,
        legacyBoardBase: true
    };
}

function maybePromoteLegacyBoardImage(level, map) {
    if (!level || !map) return;
    var theme = map.theme && typeof map.theme === 'object' ? map.theme : null;
    var legacyBoardTextureUrl = theme ? String(theme.boardTextureUrl || '').trim() : '';
    var promotedUrl = legacyBoardTextureUrl;
    if (!promotedUrl && level.status === 'designed' && levelLooksLikeJinan(level) && !levelDisablesJinanBoardFallback(level)) {
        promotedUrl = JINAN_MAP_TEXTURE_URL;
    }
    if (promotedUrl && !hasLegacyBaseBoardImageLayer(map.boardImageLayers) && Array.isArray(map.boardImageLayers)) {
        var existingPromotedLayer = map.boardImageLayers.find(function (layer) {
            return layer && String(layer.src || '').trim() === promotedUrl;
        });
        if (existingPromotedLayer) {
            existingPromotedLayer.legacyBoardBase = true;
            if (theme && legacyBoardTextureUrl && theme.boardTextureUrl === legacyBoardTextureUrl) {
                theme.boardTextureUrl = '';
            }
            return;
        }
    }
    if (hasLegacyBaseBoardImageLayer(map.boardImageLayers) || hasFullCoverBoardImageLayer(map.boardImageLayers)) return;
    if (!promotedUrl) return;
    map.boardImageLayers = normalizeBoardImageLayers(
        (Array.isArray(map.boardImageLayers) ? map.boardImageLayers : []).concat([
            createFullCoverBoardImageLayer('board-img-base', promotedUrl, -100)
        ])
    );
    if (theme && legacyBoardTextureUrl && theme.boardTextureUrl === legacyBoardTextureUrl) {
        theme.boardTextureUrl = '';
    }
}

function cloneCellPoint(cell) {
    return { col: Number(cell && cell.col) || 0, row: Number(cell && cell.row) || 0 };
}

function sameCellPoint(left, right) {
    return !!left && !!right && Number(left.col) === Number(right.col) && Number(left.row) === Number(right.row);
}

function uniquePathCells(cells) {
    var out = [];
    (Array.isArray(cells) ? cells : []).forEach(function (cell) {
        var point = cloneCellPoint(cell);
        if (!out.length || !sameCellPoint(out[out.length - 1], point)) out.push(point);
    });
    return out;
}

function cellKey(cell) {
    return String(Number(cell && cell.col) || 0) + ',' + String(Number(cell && cell.row) || 0);
}

function manhattanDefenseDistance(left, right) {
    return Math.abs((Number(left && left.col) || 0) - (Number(right && right.col) || 0)) +
        Math.abs((Number(left && left.row) || 0) - (Number(right && right.row) || 0));
}

function buildManhattanBridge(from, to) {
    if (!from || !to) return [];
    var current = cloneCellPoint(from);
    var bridge = [cloneCellPoint(current)];
    while (current.col !== Number(to.col)) {
        current.col += current.col < Number(to.col) ? 1 : -1;
        bridge.push(cloneCellPoint(current));
    }
    while (current.row !== Number(to.row)) {
        current.row += current.row < Number(to.row) ? 1 : -1;
        bridge.push(cloneCellPoint(current));
    }
    return bridge;
}

function expandDefenseWaypointPath(points) {
    var ordered = [];
    var list = uniquePathCells(points);
    if (!list.length) return ordered;
    ordered.push(cloneCellPoint(list[0]));
    for (var index = 1; index < list.length; index += 1) {
        ordered = ordered.concat(buildManhattanBridge(list[index - 1], list[index]).slice(1));
    }
    return uniquePathCells(ordered);
}

function expandDefensePolylineCells(points) {
    return expandDefenseWaypointPath(points);
}

function simplifyDefensePathPolyline(cells) {
    var list = uniquePathCells(cells);
    if (list.length < 3) return list;
    if (!isContiguousDefensePath(list)) {
        if (isAxisAlignedWaypointPath(list)) return list;
        list = expandDefensePolylineCells(list);
    }
    if (list.length < 3) return list;
    var simplified = [cloneCellPoint(list[0])];
    for (var index = 1; index < list.length - 1; index += 1) {
        var prev = list[index - 1];
        var current = list[index];
        var next = list[index + 1];
        var prevColStep = Math.sign(current.col - prev.col);
        var prevRowStep = Math.sign(current.row - prev.row);
        var nextColStep = Math.sign(next.col - current.col);
        var nextRowStep = Math.sign(next.row - current.row);
        if (prevColStep !== nextColStep || prevRowStep !== nextRowStep) {
            simplified.push(cloneCellPoint(current));
        }
    }
    simplified.push(cloneCellPoint(list[list.length - 1]));
    return uniquePathCells(simplified);
}

function hasVerboseDefensePathStorage(cells) {
    var list = uniquePathCells(cells);
    if (list.length < 4) return false;
    return simplifyDefensePathPolyline(list).length + 2 < list.length;
}

function hasDefenseLayoutData(level) {
    var map = level && level.map;
    if (!map) return false;
    return !!(
        (Array.isArray(map.enemyPaths) && map.enemyPaths.some(function (path) { return path && Array.isArray(path.cells) && path.cells.length > 1; })) ||
        (Array.isArray(map.roads) && map.roads.length) ||
        (Array.isArray(map.spawnPoints) && map.spawnPoints.length) ||
        map.objectivePoint
    );
}

function splitContiguousPathSegments(points) {
    var list = uniquePathCells(points);
    if (!list.length) return [];
    var segments = [];
    var current = [list[0]];
    for (var index = 1; index < list.length; index += 1) {
        if (manhattanDefenseDistance(list[index - 1], list[index]) === 1) {
            current.push(list[index]);
            continue;
        }
        segments.push(current);
        current = [list[index]];
    }
    if (current.length) segments.push(current);
    return segments;
}

function isAxisAlignedWaypointPath(points) {
    var list = uniquePathCells(points);
    if (list.length < 2) return false;
    var hasGap = false;
    for (var index = 1; index < list.length; index += 1) {
        var prev = list[index - 1];
        var next = list[index];
        var distance = manhattanDefenseDistance(prev, next);
        if (distance <= 0) return false;
        if (prev.col !== next.col && prev.row !== next.row) return false;
        if (distance > 1) hasGap = true;
    }
    return hasGap;
}

function hasNonAxisDefenseStep(points) {
    var list = uniquePathCells(points);
    for (var index = 1; index < list.length; index += 1) {
        var prev = list[index - 1];
        var next = list[index];
        if (prev.col !== next.col && prev.row !== next.row) return true;
    }
    return false;
}

function isContiguousDefensePath(points) {
    var list = uniquePathCells(points);
    if (list.length < 2) return false;
    for (var index = 1; index < list.length; index += 1) {
        if (manhattanDefenseDistance(list[index - 1], list[index]) !== 1) return false;
    }
    return true;
}

function orientContiguousDefensePath(cells, start, objective) {
    var list = uniquePathCells(cells);
    if (list.length < 2) return list;
    var forwardScore = manhattanDefenseDistance(list[0], start) + manhattanDefenseDistance(list[list.length - 1], objective);
    var reverseScore = manhattanDefenseDistance(list[list.length - 1], start) + manhattanDefenseDistance(list[0], objective);
    return reverseScore < forwardScore ? list.slice().reverse() : list;
}

function buildDefenseCellBucket(points) {
    var list = uniquePathCells(points);
    var bucket = {};
    list.forEach(function (cell) {
        bucket[cellKey(cell)] = cloneCellPoint(cell);
    });
    for (var index = 1; index < list.length; index += 1) {
        var prev = list[index - 1];
        var next = list[index];
        if (prev.col !== next.col && prev.row !== next.row) continue;
        buildManhattanBridge(prev, next).forEach(function (cell) {
            bucket[cellKey(cell)] = cloneCellPoint(cell);
        });
    }
    return bucket;
}

function findNearestDefenseCellKey(bucket, target) {
    var keys = Object.keys(bucket || {});
    if (!keys.length) return '';
    return keys.reduce(function (bestKey, currentKey) {
        if (!bestKey) return currentKey;
        var bestCell = bucket[bestKey];
        var currentCell = bucket[currentKey];
        var bestDistance = manhattanDefenseDistance(bestCell, target);
        var currentDistance = manhattanDefenseDistance(currentCell, target);
        if (currentDistance !== bestDistance) return currentDistance < bestDistance ? currentKey : bestKey;
        if ((Number(currentCell.col) || 0) !== (Number(bestCell.col) || 0)) {
            return (Number(currentCell.col) || 0) > (Number(bestCell.col) || 0) ? currentKey : bestKey;
        }
        return (Number(currentCell.row) || 0) < (Number(bestCell.row) || 0) ? currentKey : bestKey;
    }, '');
}

function rebuildDefensePathFromCellBucket(cells, start, objective) {
    var bucket = buildDefenseCellBucket(cells);
    var startKey = cellKey(start);
    if (!bucket[startKey]) bucket[startKey] = cloneCellPoint(start);
    var queue = [startKey];
    var visited = {};
    visited[startKey] = '';
    while (queue.length) {
        var currentKey = queue.shift();
        var current = bucket[currentKey];
        [
            { col: current.col + 1, row: current.row },
            { col: current.col - 1, row: current.row },
            { col: current.col, row: current.row + 1 },
            { col: current.col, row: current.row - 1 }
        ].forEach(function (next) {
            var nextKey = cellKey(next);
            if (!bucket[nextKey] || Object.prototype.hasOwnProperty.call(visited, nextKey)) return;
            visited[nextKey] = currentKey;
            queue.push(nextKey);
        });
    }
    var targetKey = Object.keys(visited).reduce(function (bestKey, currentKey) {
        if (!bestKey) return currentKey;
        var bestCell = bucket[bestKey];
        var currentCell = bucket[currentKey];
        var bestDistance = manhattanDefenseDistance(bestCell, objective);
        var currentDistance = manhattanDefenseDistance(currentCell, objective);
        if (currentDistance !== bestDistance) return currentDistance < bestDistance ? currentKey : bestKey;
        if ((Number(currentCell.col) || 0) !== (Number(bestCell.col) || 0)) {
            return (Number(currentCell.col) || 0) > (Number(bestCell.col) || 0) ? currentKey : bestKey;
        }
        return (Number(currentCell.row) || 0) < (Number(bestCell.row) || 0) ? currentKey : bestKey;
    }, '');
    if (!Object.prototype.hasOwnProperty.call(visited, targetKey)) return [];
    var ordered = [];
    var traceKey = targetKey;
    while (traceKey) {
        ordered.push(cloneCellPoint(bucket[traceKey]));
        traceKey = visited[traceKey];
    }
    ordered.reverse();
    if (!sameCellPoint(ordered[ordered.length - 1], objective)) {
        ordered = ordered.concat(buildManhattanBridge(ordered[ordered.length - 1], objective).slice(1));
    }
    return uniquePathCells(ordered);
}

function defenseBucketNeighborCount(bucket, cell) {
    if (!bucket || !cell) return 0;
    var neighbors = 0;
    [
        { col: cell.col + 1, row: cell.row },
        { col: cell.col - 1, row: cell.row },
        { col: cell.col, row: cell.row + 1 },
        { col: cell.col, row: cell.row - 1 }
    ].forEach(function (next) {
        if (bucket[cellKey(next)]) neighbors += 1;
    });
    return neighbors;
}

function pickDefenseEntryCell(cells, objective, preferredStart) {
    if (preferredStart) return cloneCellPoint(preferredStart);
    var bucket = buildDefenseCellBucket(cells);
    var keys = Object.keys(bucket).filter(function (key) {
        return !sameCellPoint(bucket[key], objective);
    });
    if (!keys.length) return cloneCellPoint(objective);
    var endpointKeys = keys.filter(function (key) {
        return defenseBucketNeighborCount(bucket, bucket[key]) <= 1;
    });
    var candidateKeys = endpointKeys.length ? endpointKeys : keys;
    var bestKey = candidateKeys.reduce(function (best, current) {
        if (!best) return current;
        var bestCell = bucket[best];
        var currentCell = bucket[current];
        var bestDistance = manhattanDefenseDistance(bestCell, objective);
        var currentDistance = manhattanDefenseDistance(currentCell, objective);
        if (currentDistance !== bestDistance) return currentDistance > bestDistance ? current : best;
        if ((Number(currentCell.col) || 0) !== (Number(bestCell.col) || 0)) {
            return (Number(currentCell.col) || 0) < (Number(bestCell.col) || 0) ? current : best;
        }
        return (Number(currentCell.row) || 0) < (Number(bestCell.row) || 0) ? current : best;
    }, '');
    return cloneCellPoint(bucket[bestKey] || objective);
}

function sanitizeDesignedDefensePath(path, map, preferredStart) {
    var cells = uniquePathCells(path && Array.isArray(path.cells) ? path.cells : []);
    if (cells.length < 2) return cells;
    var objective = cloneCellPoint(map && map.objectivePoint ? map.objectivePoint : cells[cells.length - 1]);
    if (isContiguousDefensePath(cells)) return orientContiguousDefensePath(cells, preferredStart || cells[0], objective);
    if (isAxisAlignedWaypointPath(cells)) return cells;
    var entryCell = pickDefenseEntryCell(cells, objective, preferredStart);
    var rebuilt = rebuildDefensePathFromCellBucket(cells, entryCell, objective);
    return rebuilt.length >= 2 ? rebuilt : cells;
}

function canonicalizeDefensePathCells(cells) {
    var list = uniquePathCells(cells);
    if (list.length < 2) return list;
    if (list.length <= 4) return expandDefenseWaypointPath(list);
    if (isAxisAlignedWaypointPath(list)) return expandDefenseWaypointPath(list);
    if (hasNonAxisDefenseStep(list)) return list;
    var segments = splitContiguousPathSegments(list).filter(function (segment) {
        return segment && segment.length >= 2;
    });
    if (!segments.length) return expandDefenseWaypointPath([list[0], list[list.length - 1]]);
    if (segments.length === 1) return segments[0];
    return segments.reduce(function (best, segment) {
        return !best || segment.length > best.length ? segment : best;
    }, null) || [];
}

function reorderDefensePathCellsTowardObjective(cells, start, objective, grid) {
    var list = uniquePathCells(cells);
    if (!grid || list.length < 2) return list;
    var cols = Math.max(4, Number(grid.cols) || DEFAULT_GRID_COLS);
    var rows = Math.max(4, Number(grid.rows) || DEFAULT_GRID_ROWS);
    var safeStart = {
        col: clamp(Number(start && start.col) || 0, 0, cols - 1),
        row: clamp(Number(start && start.row) || 0, 0, rows - 1)
    };
    var safeObjective = {
        col: clamp(Number(objective && objective.col) || Math.max(0, cols - 1), 0, cols - 1),
        row: clamp(Number(objective && objective.row) || Math.floor(rows / 2), 0, rows - 1)
    };
    return orderEditorPathCellsDefense(list, safeStart, safeObjective, cols, rows);
}

function defensePathOverlapRatio(left, right) {
    var leftKeys = new Set((left && Array.isArray(left.cells) ? left.cells : []).map(cellKey));
    var rightKeys = new Set((right && Array.isArray(right.cells) ? right.cells : []).map(cellKey));
    if (!leftKeys.size || !rightKeys.size) return 0;
    var shared = 0;
    leftKeys.forEach(function (key) {
        if (rightKeys.has(key)) shared += 1;
    });
    return shared / Math.max(1, Math.min(leftKeys.size, rightKeys.size));
}

function longestDefensePath(paths) {
    return (Array.isArray(paths) ? paths : []).reduce(function (best, path) {
        var length = path && Array.isArray(path.cells) ? path.cells.length : 0;
        if (!best) return path;
        var bestLength = Array.isArray(best.cells) ? best.cells.length : 0;
        if (best && best.id === 'path-main' && path.id !== 'path-main') return best;
        if (path && path.id === 'path-main' && best.id !== 'path-main') return path;
        if (length > bestLength) return path;
        return best;
    }, null);
}

function preferredBranchOffsets(baseCells, grid, count) {
    var desired = Math.max(0, Number(count) || 0);
    if (!desired || !Array.isArray(baseCells) || !baseCells.length || !grid) return [];
    var minRow = baseCells.reduce(function (minValue, cell) {
        return Math.min(minValue, Number(cell.row) || 0);
    }, Infinity);
    var maxRow = baseCells.reduce(function (maxValue, cell) {
        return Math.max(maxValue, Number(cell.row) || 0);
    }, -Infinity);
    var candidates = [-4, 4, -3, 3, -2, 2, -5, 5];
    return candidates.filter(function (offset) {
        return minRow + offset >= 0 && maxRow + offset < Number(grid.rows || 0);
    }).slice(0, desired);
}

function buildBranchDefensePath(baseCells, grid, offsetRows) {
    var points = simplifyDefensePathPolyline(baseCells);
    if (!grid || points.length < 4 || !offsetRows) return [];
    var splitIndex = Math.max(1, Math.floor(points.length * 0.26));
    var mergeIndex = Math.max(splitIndex + 2, Math.floor(points.length * 0.72));
    var shifted = points.slice(0, mergeIndex + 1).map(function (cell) {
        return {
            col: Number(cell.col) || 0,
            row: clamp((Number(cell.row) || 0) + offsetRows, 0, Math.max(0, Number(grid.rows || 1) - 1))
        };
    });
    if (shifted.every(function (cell, index) { return sameCellPoint(cell, points[index]); })) return [];
    return uniquePathCells(shifted.concat([cloneCellPoint(points[mergeIndex])], points.slice(mergeIndex + 1)));
}

function normalizeDefensePathList(paths, map) {
    var objective = map && map.objectivePoint ? cloneCellPoint(map.objectivePoint) : null;
    var spawnLookup = {};
    if (map && Array.isArray(map.spawnPoints)) {
        map.spawnPoints.forEach(function (spawn) {
            if (!spawn || !spawn.pathId || spawnLookup[spawn.pathId]) return;
            spawnLookup[spawn.pathId] = cloneCellPoint(spawn);
        });
    }
    var candidates = (Array.isArray(paths) ? paths : [])
        .filter(function (path) {
            return path && Array.isArray(path.cells) && path.cells.length > 1;
        })
        .map(function (path) {
            var cells = canonicalizeDefensePathCells(path.cells);
            if (cells.length < 2) return null;
            var start = spawnLookup[path.id] || cells[0];
            var ordered = isContiguousDefensePath(cells)
                ? orientContiguousDefensePath(cells, start, objective)
                : rebuildDefensePathFromCellBucket(cells, start, objective);
            if (ordered.length < 2) {
                ordered = reorderDefensePathCellsTowardObjective(cells, start, objective, map && map.grid);
            }
            if (ordered.length < 2) return null;
            return {
                id: String(path.id || 'path-main'),
                name: String(path.name || path.id || '敌人路径'),
                cells: ordered
            };
        })
        .filter(Boolean)
        .sort(function (left, right) {
            if (left.id === 'path-main' && right.id !== 'path-main') return -1;
            if (right.id === 'path-main' && left.id !== 'path-main') return 1;
            return right.cells.length - left.cells.length || left.id.localeCompare(right.id, 'zh-Hans-CN');
        });
    var accepted = [];
    var seenSignatures = {};
    var seenStarts = {};
    candidates.forEach(function (path) {
        var signature = path.cells.map(cellKey).join('|');
        var startKey = cellKey(path.cells[0]);
        if (seenSignatures[signature] || seenStarts[startKey]) return;
        if (accepted.some(function (other) { return defensePathOverlapRatio(path, other) >= 0.92; })) return;
        seenSignatures[signature] = true;
        seenStarts[startKey] = true;
        accepted.push(path);
    });
    return accepted;
}

function desiredDesignedRouteCount(level) {
    return Number(level && level.difficulty) >= 4 ? 3 : 2;
}

function buildDesignedDefensePaths(level) {
    var map = level && level.map;
    if (!map || !map.grid) return [];
    var existing = normalizeDefensePathList(map.enemyPaths, map);
    var desiredCount = desiredDesignedRouteCount(level);
    var active = [];
    var fallbackPaths = normalizeDefensePathList([{ id: 'path-main', name: '主敌人路径', cells: map.roads }], map);
    var mainPath = longestDefensePath(existing) || fallbackPaths[0] || { id: 'path-main', name: '主敌人路径', cells: uniquePathCells(map.roads) };
    if (mainPath && Array.isArray(mainPath.cells) && mainPath.cells.length >= 2 && mainPath.cells.length < 4) {
        var expandedMainCells = buildManhattanBridge(mainPath.cells[0], mainPath.cells[mainPath.cells.length - 1]);
        if (expandedMainCells.length >= 4) {
            mainPath = {
                id: mainPath.id,
                name: mainPath.name,
                cells: expandedMainCells
            };
        }
    }
    if (mainPath && Array.isArray(mainPath.cells) && mainPath.cells.length > 1) {
        active.push({
            id: mainPath.id,
            name: mainPath.name,
            cells: simplifyDefensePathPolyline(mainPath.cells)
        });
    }
    existing.forEach(function (path) {
        if (active.length >= desiredCount) return;
        if (active.some(function (item) { return item.id === path.id; })) return;
        active.push({
            id: path.id,
            name: path.name,
            cells: simplifyDefensePathPolyline(path.cells)
        });
    });
    if (!active.length || !Array.isArray(active[0].cells) || active[0].cells.length < 2) return existing.slice(0, desiredCount);
    var offsets = preferredBranchOffsets(active[0].cells, map.grid, desiredCount - active.length);
    offsets.forEach(function (offset, index) {
        if (active.length >= desiredCount) return;
        var branchCells = buildBranchDefensePath(active[0].cells, map.grid, offset);
        if (branchCells.length < 2) return;
        active.push({
            id: 'path-route-' + String(active.length + 1),
            name: index === 0 ? '侧翼支路' : '外环支路',
            cells: branchCells
        });
    });
    return active.slice(0, desiredCount).map(function (path) {
        var preferredStart = Array.isArray(map.spawnPoints)
            ? map.spawnPoints.find(function (spawn) {
                return spawn && String(spawn.pathId || '') === String(path.id || '');
            })
            : null;
        return {
            id: path.id,
            name: path.name,
            cells: simplifyDefensePathPolyline(sanitizeDesignedDefensePath(path, map, preferredStart))
        };
    });
}

function buildDesignedSpawnPoints(paths) {
    return (Array.isArray(paths) ? paths : []).map(function (path, index) {
        var firstCell = Array.isArray(path.cells) && path.cells.length ? path.cells[0] : { col: 0, row: 0 };
        return {
            id: 'spawn-route-' + String(index + 1),
            name: index === 0 ? '主入口' : '分路入口 ' + String(index),
            col: Number(firstCell.col) || 0,
            row: Number(firstCell.row) || 0,
            pathId: String(path.id || 'path-main')
        };
    });
}

function buildWaveSummaryFromRules(rules) {
    var waveMap = {};
    (Array.isArray(rules) ? rules : []).forEach(function (rule) {
        var waveNumber = Math.max(1, Math.round(Number(rule.waveNumber) || 1));
        if (!waveMap[waveNumber]) {
            waveMap[waveNumber] = { waveNumber: waveNumber, theme: 'Wave ' + String(waveNumber), enemyPool: [], count: 0, reward: 0 };
        }
        if (rule.enemyTypeId && waveMap[waveNumber].enemyPool.indexOf(rule.enemyTypeId) === -1) {
            waveMap[waveNumber].enemyPool.push(rule.enemyTypeId);
        }
        waveMap[waveNumber].count += Math.max(1, Math.round(Number(rule.count) || 1));
        waveMap[waveNumber].reward += Math.max(0, Math.round(Number(rule.reward) || 0));
    });
    return Object.keys(waveMap)
        .map(function (key) { return waveMap[key]; })
        .sort(function (left, right) { return left.waveNumber - right.waveNumber; });
}

function buildDesignedWaveRules(level, spawnPoints) {
    var routes = Array.isArray(spawnPoints) ? spawnPoints : [];
    if (!routes.length) return [];
    var enemyIds = (Array.isArray(level.enemyTypes) ? level.enemyTypes : [])
        .map(function (enemy) { return String(enemy && enemy.id || '').trim(); })
        .filter(Boolean);
    if (!enemyIds.length) enemyIds = ['enemy-drone'];
    var totalWaves = Math.max(12, Math.min(20, 10 + Math.max(1, Number(level.difficulty) || 1) * 2));
    var threeRouteStart = routes.length >= 3 ? Math.max(8, Math.ceil(totalWaves * 0.58)) : totalWaves + 1;
    var twoRouteStart = routes.length >= 2 ? Math.max(3, Math.ceil(totalWaves * 0.25)) : totalWaves + 1;
    var rules = [];
    for (var waveNumber = 1; waveNumber <= totalWaves; waveNumber += 1) {
        var activeRouteCount = 1;
        if (waveNumber >= twoRouteStart) activeRouteCount = Math.min(routes.length, 2);
        if (waveNumber >= threeRouteStart) activeRouteCount = Math.min(routes.length, 3);
        for (var routeIndex = 0; routeIndex < activeRouteCount; routeIndex += 1) {
            var route = routes[routeIndex];
            var enemyTier = Math.min(enemyIds.length - 1, Math.floor((waveNumber - 1) / 3) + routeIndex);
            rules.push({
                id: 'wave-' + String(waveNumber) + '-route-' + String(routeIndex + 1),
                waveNumber: waveNumber,
                enemyTypeId: enemyIds[enemyTier],
                count: Math.max(6, 5 + Math.round(Number(level.difficulty) || 1) + Math.floor(waveNumber * 0.9) + routeIndex * 2),
                interval: Math.max(0.45, Number((1.22 - waveNumber * 0.03 - routeIndex * 0.04).toFixed(2))),
                spawnPointId: String(route.id || ''),
                pathId: String(route.pathId || 'path-main'),
                reward: 30 + waveNumber * 8 + routeIndex * 4,
                overrideModelPath: '',
                overrideModelScale: 1
            });
        }
    }
    return rules;
}

function buildDefenseReservedCellKeys(paths, spawnPoints, objective, roads) {
    var reserved = {};
    (Array.isArray(paths) ? paths : []).forEach(function (path) {
        expandDefensePolylineCells(Array.isArray(path && path.cells) ? path.cells : []).forEach(function (cell) {
            reserved[cellKey(cell)] = true;
        });
    });
    (Array.isArray(spawnPoints) ? spawnPoints : []).forEach(function (spawn) {
        reserved[cellKey(spawn)] = true;
    });
    (Array.isArray(roads) ? roads : []).forEach(function (cell) {
        reserved[cellKey(cell)] = true;
    });
    if (objective) reserved[cellKey(objective)] = true;
    return reserved;
}

function hasDefenseObstacleOverlap(obstacles, paths, spawnPoints, objective, roads) {
    var reserved = buildDefenseReservedCellKeys(paths, spawnPoints, objective, roads);
    return (Array.isArray(obstacles) ? obstacles : []).some(function (cell) {
        return !!reserved[cellKey(cell)];
    });
}

function sanitizeDefenseObstacles(obstacles, paths, spawnPoints, objective, roads) {
    var reserved = buildDefenseReservedCellKeys(paths, spawnPoints, objective, roads);
    return uniquePathCells(Array.isArray(obstacles) ? obstacles : []).filter(function (cell) {
        return !reserved[cellKey(cell)];
    });
}

function shouldUpgradeDesignedTowerDefense(level) {
    if (!level || level.status !== 'designed') return false;
    var towerDefense = level.modeProfiles && level.modeProfiles.towerDefense;
    if ((!towerDefense || towerDefense.enabled === false) && !hasDefenseLayoutData(level)) return false;
    var rawPaths = level.map && Array.isArray(level.map.enemyPaths)
        ? level.map.enemyPaths.filter(function (path) {
            return path && Array.isArray(path.cells) && path.cells.length > 1;
        })
        : [];
    var paths = normalizeDefensePathList(rawPaths, level.map);
    var spawnPoints = level.map && Array.isArray(level.map.spawnPoints) ? level.map.spawnPoints : [];
    var waveRules = Array.isArray(level.waveRules) ? level.waveRules : [];
    var spawnKeys = {};
    var hasDuplicateSpawn = spawnPoints.some(function (spawn) {
        var key = cellKey(spawn);
        if (spawnKeys[key]) return true;
        spawnKeys[key] = true;
        return false;
    });
    var objectivePoint = level.map && level.map.objectivePoint ? level.map.objectivePoint : null;
    return (
        paths.length < 2 ||
        spawnPoints.length < 2 ||
        spawnPoints.length !== paths.length ||
        rawPaths.length !== paths.length ||
        rawPaths.some(function (path) {
            return hasVerboseDefensePathStorage(path && Array.isArray(path.cells) ? path.cells : []);
        }) ||
        hasVerboseDefensePathStorage(level.map && level.map.roads) ||
        rawPaths.some(function (path) {
            return hasNonAxisDefenseStep(path && Array.isArray(path.cells) ? path.cells : []);
        }) ||
        hasDuplicateSpawn ||
        hasDefenseObstacleOverlap(level.map && level.map.obstacles, paths, spawnPoints, objectivePoint, level.map && level.map.roads) ||
        waveRules.length < 8 ||
        waveRules.some(function (rule) {
            return !String(rule && rule.spawnPointId || '').trim() || !String(rule && rule.pathId || '').trim();
        })
    );
}

function upgradeDesignedTowerDefenseLevel(level) {
    if (!shouldUpgradeDesignedTowerDefense(level)) return;
    var activePaths = buildDesignedDefensePaths(level).map(function (path) {
        return {
            id: path.id,
            name: path.name,
            cells: simplifyDefensePathPolyline(path.cells)
        };
    });
    if (!activePaths.length) return;
    var spawnPoints = buildDesignedSpawnPoints(activePaths);
    level.map.enemyPaths = activePaths;
    level.map.spawnPoints = spawnPoints;
    level.map.enemyExits = spawnPoints;
    var roadByKey = {};
    level.map.roads = uniquePathCells(activePaths.flatMap(function (path) {
        return Array.isArray(path.cells) ? path.cells : [];
    })).filter(function (cell) {
        var key = String(cell.col) + ',' + String(cell.row);
        if (roadByKey[key]) return false;
        roadByKey[key] = true;
        return true;
    });
    level.map.obstacles = sanitizeDefenseObstacles(level.map.obstacles, activePaths, spawnPoints, level.map.objectivePoint, level.map.roads);
    level.waveRules = buildDesignedWaveRules(level, spawnPoints);
    var towerDefense = level.modeProfiles && level.modeProfiles.towerDefense ? level.modeProfiles.towerDefense : { enabled: true };
    towerDefense.enabled = true;
    towerDefense.spawnRoutes = activePaths.map(function (path, index) {
        return {
            id: 'route-' + String(index + 1),
            label: index === 0 ? '主路线' : index === 1 ? '侧翼路线' : '外环路线',
            entry: spawnPoints[index] ? spawnPoints[index].name : ('入口 ' + String(index + 1)),
            exit: level.map.objectivePoint && level.map.objectivePoint.name ? level.map.objectivePoint.name : '防守核心'
        };
    });
    towerDefense.waves = buildWaveSummaryFromRules(level.waveRules);
    towerDefense.maxWaves = towerDefense.waves.length;
    level.modeProfiles.towerDefense = towerDefense;
}

// ---------------------------------------------------------------------------
// Actor / 统计 / 模板
// ---------------------------------------------------------------------------

export function normalizeStats(stats) {
    var source = stats && typeof stats === 'object' ? stats : {};
    return {
        hp: Number(source.hp) || 1,
        attack: Number(source.attack) || 0,
        range: Number(source.range) || 0,
        fireRate: Number(source.fireRate) || 0,
        cost: Number(source.cost) || 0,
        cooldown: Number(source.cooldown) || 0,
        speed: Number(source.speed) || 0,
        reward: Number(source.reward) || 0,
        targeting: String(source.targeting || 'nearest'),
        projectileModelId: String(source.projectileModelId || '')
    };
}

export function normalizeActorTemplate(template) {
    var source = template && typeof template === 'object' ? template : {};
    var ms = Number(source.templateModelScale);
    return {
        id: String(source.id || uid('template')),
        name: String(source.name || 'Actor 模板'),
        category: String(source.category || 'model'),
        modelId: String(source.modelId || ''),
        modelPath: String(source.modelPath || ''),
        icon: String(source.icon || (source.name || 'A').charAt(0)).slice(0, 2),
        templateModelScale:
            Number.isFinite(ms) && ms > 0 ? Math.min(Math.max(ms, 0.01), 1000) : 1,
        stats: normalizeStats(source.stats)
    };
}

export function normalizeActors(actors, seed) {
    var list = Array.isArray(actors) ? actors : [];
    if (!list.length && Array.isArray(seed.props)) {
        list = seed.props.map(function (prop, index) {
            return {
                id: prop.id || 'actor-' + (index + 1),
                templateId: 'explore-item',
                name: prop.label || '模型 Actor',
                category: 'model',
                icon: 'M',
                modelId: prop.assetId || '',
                col: 6 + index,
                row: 6,
                rotation: 0,
                scale: 1,
                team: 'neutral',
                stats: { hp: 1, attack: 0, range: 1, fireRate: 0, cost: 0, cooldown: 0 }
            };
        });
    }
    return list.map(function (actor, index) {
        var source = actor && typeof actor === 'object' ? actor : {};
        var wx = source.worldOffsetMeters && typeof source.worldOffsetMeters === 'object' ? source.worldOffsetMeters : {};
        return {
            id: String(source.id || 'actor-' + (index + 1)),
            templateId: String(source.templateId || ''),
            name: String(source.name || source.label || 'Actor ' + (index + 1)),
            category: String(source.category || 'model'),
            icon: String(source.icon || (source.name || 'A').charAt(0)).slice(0, 2),
            modelId: String(source.modelId || source.assetId || ''),
            col: clamp(Number(source.col) || 0, 0, 79),
            row: clamp(Number(source.row) || 0, 0, 79),
            rotation: Number.isFinite(Number(source.rotation)) ? Number(source.rotation) : 0,
            scale: Number.isFinite(Number(source.scale)) && Number(source.scale) > 0 ? Number(source.scale) : 1,
            worldOffsetMeters: {
                x: Number(wx.x) || 0,
                y: Number(wx.y) || 0,
                z: Number(wx.z) || 0
            },
            modelPath: String(source.modelPath || ''),
            team: String(source.team || 'neutral'),
            stats: normalizeStats(source.stats)
        };
    });
}

// ---------------------------------------------------------------------------
// 敌人 / 波次 / 模式配置
// ---------------------------------------------------------------------------

export function normalizeEnemyTypes(enemyTypes, seed) {
    var list = Array.isArray(enemyTypes) ? enemyTypes : [];
    if (!list.length && seed.rosters && Array.isArray(seed.rosters.enemyTypes)) {
        list = seed.rosters.enemyTypes.map(function (id) {
            return { id: id, name: id, hp: 100, speed: 1, reward: 20, modelId: '' };
        });
    }
    if (!list.length) {
        list = [{ id: 'enemy-drone', name: '侦察无人机', hp: 80, speed: 1.25, reward: 20, modelId: '' }];
    }
    return list.map(function (enemy) {
        var esc = Number(enemy.modelScale);
        return {
            id: String(enemy.id || slugify(enemy.name) || uid('enemy')),
            name: String(enemy.name || enemy.id || '敌人'),
            modelId: String(enemy.modelId || ''),
            modelPath: String(enemy.modelPath || ''),
            modelScale: Number.isFinite(esc) && esc > 0 ? Math.min(Math.max(esc, 0.1), 8) : 1,
            element: normalizeGameplayElement(enemy.element),
            effects: normalizeGameplayOptionList(enemy.effects, DEFENSE_STATUS_OPTIONS),
            hp: Number(enemy.hp) || 100,
            speed: Number(enemy.speed) || 1,
            reward: Number(enemy.reward) || 20
        };
    });
}

export function normalizeWaveRules(waveRules, seed) {
    var list = Array.isArray(waveRules) ? waveRules : [];
    var legacyWaves = seed.modeProfiles && seed.modeProfiles.towerDefense && seed.modeProfiles.towerDefense.waves;
    if (!list.length && Array.isArray(legacyWaves)) {
        list = legacyWaves.map(function (wave) {
            return {
                id: uid('wave'),
                waveNumber: wave.waveNumber,
                enemyTypeId: Array.isArray(wave.enemyPool) ? wave.enemyPool[0] : '',
                count: wave.count,
                interval: 1,
                spawnPointId: '',
                pathId: 'path-main',
                reward: wave.reward
            };
        });
    }
    return list.map(function (wave, index) {
        var ovs = Number(wave.overrideModelScale);
        return {
            id: String(wave.id || 'wave-' + (index + 1)),
            waveNumber: Math.max(1, Number(wave.waveNumber) || index + 1),
            enemyTypeId: String(wave.enemyTypeId || ''),
            count: Math.max(1, Number(wave.count) || 10),
            interval: Math.max(0.1, Number(wave.interval) || 1),
            spawnPointId: String(wave.spawnPointId || ''),
            pathId: String(wave.pathId || 'path-main'),
            reward: Math.max(0, Number(wave.reward) || 50),
            overrideModelPath: String(wave.overrideModelPath || ''),
            overrideModelScale:
                Number.isFinite(ovs) && ovs > 0 ? Math.min(Math.max(ovs, 0.1), 8) : 1
        };
    });
}

function normalizeWaveNumberList(value) {
    var raw = Array.isArray(value) ? value : value != null ? [value] : [];
    var seen = {};
    return raw
        .map(function (item) {
            return Math.max(1, Math.round(Number(item) || 0));
        })
        .filter(function (item) {
            if (!item || seen[item]) return false;
            seen[item] = true;
            return true;
        })
        .sort(function (a, b) {
            return a - b;
        });
}

export function normalizeModeProfiles(modeProfiles) {
    var source = modeProfiles && typeof modeProfiles === 'object' ? modeProfiles : {};
    return {
        towerDefense: source.towerDefense && typeof source.towerDefense === 'object' ? source.towerDefense : { enabled: true },
        exploration: source.exploration && typeof source.exploration === 'object' ? source.exploration : { enabled: true }
    };
}

// ---------------------------------------------------------------------------
// 出生点 / 探索点
// ---------------------------------------------------------------------------

export function normalizeSpawnPoints(points, legacyTd) {
    var list = Array.isArray(points) ? points : [];
    if (!list.length && Array.isArray(legacyTd.spawnRoutes)) {
        list = legacyTd.spawnRoutes.map(function (route, index) {
            return { id: route.id || 'spawn-' + (index + 1), name: route.label || route.entry || '敌人出口 ' + (index + 1), col: 0, row: 2 + index * 3, pathId: 'path-main' };
        });
    }
    return list.map(function (point, index) {
        var hasWaveNumbers = Array.isArray(point.waveNumbers);
        var waveNumbers = normalizeWaveNumberList(point.waveNumbers);
        if (!hasWaveNumbers) {
            waveNumbers = normalizeWaveNumberList(point.waveNumber != null ? point.waveNumber : index + 1);
        }
        var hasWaveConfig = point.enemyTypeId != null || hasWaveNumbers || point.waveNumber != null || point.count != null || point.interval != null;
        var out = {
            id: String(point.id || 'spawn-' + (index + 1)),
            name: String(point.name || point.label || '敌人出口 ' + (index + 1)),
            col: clamp(Number(point.col) || 0, 0, 79),
            row: clamp(Number(point.row) || (2 + index * 3), 0, 79),
            pathId: String(point.pathId || 'path-main')
        };
        if (hasWaveConfig) {
            out.enemyTypeId = String(point.enemyTypeId || '');
            out.waveNumbers = waveNumbers;
            if (waveNumbers.length) out.waveNumber = waveNumbers[0];
            out.count = Math.max(1, Math.round(Number(point.count) || 12));
            out.interval = Math.max(0.1, Number(point.interval) || 1.2);
        }
        return out;
    });
}

export function normalizeExplorePoints(points, legacyExplore) {
    var list = Array.isArray(points) ? points : Array.isArray(legacyExplore.points) ? legacyExplore.points : [];
    return list.map(function (point, index) {
        return {
            id: String(point.id || 'poi-' + (index + 1)),
            name: String(point.name || point.label || '探索点 ' + (index + 1)),
            col: clamp(Number(point.col) || (4 + index * 2), 0, 79),
            row: clamp(Number(point.row) || 4, 0, 79),
            modelId: String(point.modelId || ''),
            interaction: String(point.interaction || point.kind || 'inspect'),
            radius: Math.max(0, Number(point.radius || 2))
        };
    });
}

var DEFAULT_EXPLORE_BOSS_IDS = ['ai-atlas', 'ai-vulcan', 'ai-prism', 'ai-gridmind', 'ai-echo'];

function normalizeExploreElement(value, fallback) {
    var raw = String(value || '').trim();
    if (DEFENSE_ELEMENT_OPTIONS.some(function (opt) { return opt.id === raw; })) return raw;
    return fallback || 'electric';
}

function positiveNumber(value, fallback, max) {
    var n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return max ? Math.min(n, max) : n;
}

function nonNegativeNumber(value, fallback, max) {
    var n = Number(value);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return max ? Math.min(n, max) : n;
}

export function normalizeExploreBosses(bosses) {
    var list = Array.isArray(bosses) ? bosses : [];
    return list.map(function (boss, index) {
        var source = boss && typeof boss === 'object' ? boss : {};
        var override = source.overrideStats && typeof source.overrideStats === 'object' ? source.overrideStats : {};
        return {
            id: String(source.id || uid('explore-boss')),
            bossId: String(source.bossId || DEFAULT_EXPLORE_BOSS_IDS[index % DEFAULT_EXPLORE_BOSS_IDS.length]),
            name: String(source.name || 'AI 化身 Boss ' + (index + 1)),
            col: clamp(Number(source.col) || 0, 0, 79),
            row: clamp(Number(source.row) || 0, 0, 79),
            modelId: String(source.modelId || ''),
            modelPath: String(source.modelPath || ''),
            modelScale: positiveNumber(source.modelScale, 1.8, 12),
            element: normalizeExploreElement(source.element, 'electric'),
            level: Math.max(1, Math.round(Number(source.level) || 1)),
            triggerRadius: positiveNumber(source.triggerRadius, 9, 80),
            respawn: !!source.respawn,
            overrideStats: {
                maxHp: nonNegativeNumber(override.maxHp, 0, 10000000),
                attack: nonNegativeNumber(override.attack, 0, 1000000),
                defense: nonNegativeNumber(override.defense, 0, 1000000),
                speed: nonNegativeNumber(override.speed, 0, 1000),
                rewardMoney: nonNegativeNumber(override.rewardMoney, 0, 10000000),
                rewardXp: nonNegativeNumber(override.rewardXp, 0, 10000000)
            }
        };
    });
}

export function normalizeExploreSpawners(spawners) {
    var list = Array.isArray(spawners) ? spawners : [];
    return list.map(function (spawner, index) {
        var source = spawner && typeof spawner === 'object' ? spawner : {};
        var rewards = Array.isArray(source.rewards) ? source.rewards : [];
        return {
            id: String(source.id || uid('explore-spawner')),
            name: String(source.name || 'AI 刷怪点 ' + (index + 1)),
            col: clamp(Number(source.col) || 0, 0, 79),
            row: clamp(Number(source.row) || 0, 0, 79),
            enemyTypeId: String(source.enemyTypeId || 'ai-drone'),
            element: normalizeExploreElement(source.element, 'electric'),
            modelId: String(source.modelId || ''),
            modelPath: String(source.modelPath || ''),
            modelScale: positiveNumber(source.modelScale, 1, 10),
            maxConcurrent: Math.max(1, Math.round(Number(source.maxConcurrent) || 3)),
            spawnIntervalSec: positiveNumber(source.spawnIntervalSec, 6, 3600),
            spawnCount: Math.max(1, Math.round(Number(source.spawnCount) || 1)),
            triggerRadius: positiveNumber(source.triggerRadius, 12, 120),
            activeRadius: positiveNumber(source.activeRadius, 18, 180),
            totalLimit: Math.max(0, Math.round(Number(source.totalLimit) || 0)),
            disableWhenBossDefeated: !!source.disableWhenBossDefeated,
            rewards: rewards.map(function (reward) {
                var r = reward && typeof reward === 'object' ? reward : {};
                return {
                    money: nonNegativeNumber(r.money, 12, 1000000),
                    xp: nonNegativeNumber(r.xp, 10, 1000000),
                    itemName: String(r.itemName || ''),
                    itemIcon: String(r.itemIcon || 'AI').slice(0, 2),
                    quantity: Math.max(1, Math.round(Number(r.quantity) || 1))
                };
            })
        };
    });
}

export function normalizeExplorePickups(pickups) {
    var list = Array.isArray(pickups) ? pickups : [];
    return list.map(function (pickup, index) {
        var source = pickup && typeof pickup === 'object' ? pickup : {};
        var type = source.type === 'item' ? 'item' : 'money';
        return {
            id: String(source.id || uid('explore-pickup')),
            type: type,
            name: String(source.name || (type === 'money' ? '城市算力资金' : 'AI 道具') + ' ' + (index + 1)),
            col: clamp(Number(source.col) || 0, 0, 79),
            row: clamp(Number(source.row) || 0, 0, 79),
            moneyAmount: nonNegativeNumber(source.moneyAmount, type === 'money' ? 50 : 0, 10000000),
            itemId: String(source.itemId || ''),
            itemName: String(source.itemName || source.name || 'AI 记忆碎片'),
            itemType: source.itemType === 'consumable' ? 'consumable' : 'material',
            itemIcon: String(source.itemIcon || (type === 'money' ? '$' : 'AI')).slice(0, 2),
            quantity: Math.max(1, Math.round(Number(source.quantity) || 1)),
            modelId: String(source.modelId || ''),
            modelPath: String(source.modelPath || ''),
            modelScale: positiveNumber(source.modelScale, 1, 8),
            collectRadius: positiveNumber(source.collectRadius, 1.25, 20)
        };
    });
}

// ---------------------------------------------------------------------------
// 探索玩法数值规整
// ---------------------------------------------------------------------------

export var EXPLORE_GAMEPLAY_STORE_KEYS = [
    'roguelikeWaveMode',
    'firstWaveDelaySec',
    'wavePauseSec',
    'totalWaves',
    'bossUnlockWave',
    'moveSpeedWalk',
    'moveSpeedRun',
    'attackCooldownSec',
    'skillECooldownSec',
    'skillRCooldownSec',
    'moneyDropRespawnIntervalSec',
    'exploreEnemySpawnIntervalSec',
    'enemyMaxConcurrent',
    'enemyBaseHp',
    'enemyHpPerLevel',
    'enemyBaseSpeed',
    'enemySpeedPerLevel',
    'enemyBaseDamage',
    'enemyDamagePerLevel',
    'enemyAggroRange',
    'enemyAttackCooldown'
];

export function normalizeExploreGameplayNormalized(raw) {
    var src = raw && typeof raw === 'object' ? raw : {};
    var out = {};
    EXPLORE_GAMEPLAY_STORE_KEYS.forEach(function (key) {
        if (key === 'roguelikeWaveMode') {
            if (typeof src[key] === 'boolean') out[key] = src[key];
            else if (src[key] === 'true' || src[key] === '1') out[key] = true;
            else if (src[key] === 'false' || src[key] === '0') out[key] = false;
            return;
        }
        var v = Number(src[key]);
        if (!Number.isFinite(v)) return;
        out[key] = key === 'enemyMaxConcurrent' || key === 'totalWaves' || key === 'bossUnlockWave' ? Math.round(v) : v;
    });
    return out;
}

// ---------------------------------------------------------------------------
// 地理 / Cesium
// ---------------------------------------------------------------------------

export function normalizeGeoConfig(geo) {
    var source = geo && typeof geo === 'object' ? geo : {};
    var center = source.center && typeof source.center === 'object' ? source.center : {};
    return {
        enabled: !!source.enabled,
        provider: String(source.provider || 'cesium-ion'),
        assetId: String(source.assetId || DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID),
        center: {
            lat: Number(center.lat) || 0,
            lon: Number(center.lon) || 0,
            heightMeters: Number(center.heightMeters) || 0
        },
        extentMeters: Number(source.extentMeters) || 1000,
        rotationDeg: Number(source.rotationDeg) || 0,
        yOffsetMeters: Number(source.yOffsetMeters) || 0,
        boardHeightMeters: Number(source.boardHeightMeters) || 32,
        scale: Number(source.scale) || 1
    };
}

export function makeGeoConfig(lat, lon, extentMeters) {
    return normalizeGeoConfig({
        enabled: true,
        provider: 'cesium-ion',
        assetId: DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID,
        center: { lat: lat, lon: lon, heightMeters: 0 },
        extentMeters: extentMeters,
        rotationDeg: 0,
        yOffsetMeters: 0,
        boardHeightMeters: 32,
        scale: 1
    });
}

export function visitCoordinatePairs(value, visitor) {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
        visitor(Number(value[0]), Number(value[1]));
        return;
    }
    value.forEach(function (item) { visitCoordinatePairs(item, visitor); });
}

export function geometryCenter(coordinates) {
    var bounds = { minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity };
    visitCoordinatePairs(coordinates, function (lon, lat) {
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
        bounds.minLon = Math.min(bounds.minLon, lon);
        bounds.maxLon = Math.max(bounds.maxLon, lon);
        bounds.minLat = Math.min(bounds.minLat, lat);
        bounds.maxLat = Math.max(bounds.maxLat, lat);
    });
    if (!Number.isFinite(bounds.minLon) || !Number.isFinite(bounds.minLat)) return null;
    return {
        lon: (bounds.minLon + bounds.maxLon) / 2,
        lat: (bounds.minLat + bounds.maxLat) / 2
    };
}

export async function fetchCountryCapitalCoords() {
    try {
        var response = await fetch('https://restcountries.com/v3.1/all?fields=cca3,capitalInfo', { cache: 'force-cache' });
        if (!response.ok) return {};
        var rows = await response.json();
        return (Array.isArray(rows) ? rows : []).reduce(function (acc, row) {
            var code = String(row.cca3 || '').toUpperCase();
            var latlng = row.capitalInfo && row.capitalInfo.latlng;
            if (code && Array.isArray(latlng) && latlng.length >= 2) {
                acc[code] = { lat: Number(latlng[0]), lon: Number(latlng[1]) };
            }
            return acc;
        }, {});
    } catch (error) {
        return {};
    }
}

export function countryGeoFromFeature(feature, code, remoteCapitals) {
    var EG = typeof EarthGuardianCountryGeo !== 'undefined' ? EarthGuardianCountryGeo : null;
    var k = String(code || '').toUpperCase();
    var remote = remoteCapitals && remoteCapitals[k];
    var resolved = EG ? EG.resolveCenterForEditor(k, remote) : null;
    if (resolved && Number.isFinite(resolved.lat) && Number.isFinite(resolved.lon)) {
        return makeGeoConfig(resolved.lat, resolved.lon, 2200);
    }
    var center = geometryCenter(feature && feature.geometry && feature.geometry.coordinates);
    return center ? makeGeoConfig(center.lat, center.lon, 3200) : null;
}

export function geoFromLonLatArray(center, extentMeters) {
    if (!Array.isArray(center) || center.length < 2) return null;
    var lon = Number(center[0]);
    var lat = Number(center[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return makeGeoConfig(lat, lon, extentMeters || 1600);
}

// ---------------------------------------------------------------------------
// 棋盘主题色彩
// ---------------------------------------------------------------------------

export function normalizeEditorThemeColorHex(raw, fallbackHex) {
    var fb =
        typeof fallbackHex === 'string' && /^#[0-9a-fA-F]{6}$/.test(fallbackHex)
            ? ('#' + fallbackHex.slice(1).toLowerCase())
            : '#5a7d82';
    if (raw === null || raw === undefined || raw === '') return fb;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return '#' + ((Math.floor(raw) >>> 0) & 0xffffff).toString(16).padStart(6, '0');
    }
    var s = String(raw).trim();
    if (/^#[0-9a-fA-F]{6}$/i.test(s)) return ('#' + s.slice(1).toLowerCase());
    if (/^#[0-9a-fA-F]{3}$/i.test(s)) {
        return ('#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toLowerCase();
    }
    if (/^0x[0-9a-fA-F]{1,8}$/i.test(s)) {
        var px = Number.parseInt(s.slice(2), 16);
        if (Number.isFinite(px)) return '#' + ((px >>> 0) & 0xffffff).toString(16).padStart(6, '0');
    }
    var decDig = /^[0-9]+$/.test(s) ? Number(s) : NaN;
    if (Number.isFinite(decDig) && decDig >= 0 && decDig <= 0xffffff) {
        return '#' + ((Math.floor(decDig) >>> 0) & 0xffffff).toString(16).padStart(6, '0');
    }
    return fb;
}

export function normalizeTheme(theme) {
    var source = theme && typeof theme === 'object' ? theme : {};
    function clamp01(val, def) {
        var n = Number(val);
        if (!Number.isFinite(n)) return def;
        return Math.max(0, Math.min(1, n));
    }
    var ground = normalizeEditorThemeColorHex(source.ground, '#73857f');
    var groundAlt = normalizeEditorThemeColorHex(
        source.groundAlt != null ? source.groundAlt : source.ground,
        '#697a75'
    );
    var pathCol = normalizeEditorThemeColorHex(
        source.path != null ? source.path : source.road,
        '#92a39a'
    );
    return {
        ground: ground,
        groundAlt: groundAlt,
        road: normalizeEditorThemeColorHex(
            source.road != null ? source.road : source.path != null ? source.path : pathCol,
            pathCol
        ),
        path: pathCol,
        obstacle: normalizeEditorThemeColorHex(source.obstacle, '#8a8077'),
        accent: normalizeEditorThemeColorHex(source.accent, '#aab6a3'),
        fog: normalizeEditorThemeColorHex(
            source.fog != null ? source.fog : source.groundAlt != null ? source.groundAlt : source.ground,
            '#56645f'
        ),
        boardTextureUrl: String(source.boardTextureUrl || '').trim(),
        geoTileOpacity: clamp01(source.geoTileOpacity, 0.48),
        geoPathOpacity: clamp01(source.geoPathOpacity, 0.92),
        boardBaseOpacity: clamp01(source.boardBaseOpacity, 0.42),
        gridLineOpacity: clamp01(source.gridLineOpacity, 0.42),
        rimOpacity: clamp01(source.rimOpacity, 0.32),
        pathGlowOpacity: clamp01(source.pathGlowOpacity, 0.46),
        pathDetailOpacity: clamp01(source.pathDetailOpacity, 0.82),
        hoverCellOpacity: clamp01(source.hoverCellOpacity, 0.42),
        hoverColorOk: normalizeEditorThemeColorHex(source.hoverColorOk, '#7ea08f'),
        hoverColorBad: normalizeEditorThemeColorHex(source.hoverColorBad, '#c28e89')
    };
}

// ---------------------------------------------------------------------------
// 敌人路径
// ---------------------------------------------------------------------------

export function normalizeEnemyPaths(paths, fallbackRoads) {
    var roadsCopy = fallbackRoads && fallbackRoads.length ? normalizeCells(fallbackRoads) : [];
    var list = Array.isArray(paths) && paths.length ? paths : [];
    var mapped =
        list.length === 0 && roadsCopy.length
            ? [{ id: 'path-main', name: '主敌人路径', cells: roadsCopy.map(function (c) { return normalizeCell(c); }) }]
            : list.map(function (path, index) {
                  return {
                      id: String(path.id || 'path-' + (index + 1)),
                      name: String(path.name || path.label || '敌人路径 ' + (index + 1)),
                      cells: normalizeCells(path.cells || path.path || [])
                  };
              });
    if (
        mapped[0] &&
        (!mapped[0].cells || !mapped[0].cells.length) &&
        roadsCopy.length
    ) {
        mapped[0].cells = roadsCopy.slice();
    }
    return mapped.length
        ? mapped
        : [{ id: 'path-main', name: '主敌人路径', cells: [] }];
}

// ---------------------------------------------------------------------------
// 目录 / 资产 目录项规整
// ---------------------------------------------------------------------------

export function normalizeCatalog(catalog) {
    var source = catalog && typeof catalog === 'object' ? catalog : {};
    var normalized = {};
    [
        'gameTypes',
        'phaseTypes',
        'resourceTypes',
        'floorTextures',
        'modelAssets',
        'explorationModes',
        'towerTypes',
        'enemyTypes',
        'creatureTypes',
        'uiModules'
    ].forEach(function (key) {
        normalized[key] = Array.isArray(source[key]) ? source[key].map(normalizeCatalogItem) : [];
    });
    return normalized;
}

export function normalizeCatalogItem(item) {
    var next = item && typeof item === 'object' ? item : {};
    return {
        id: String(next.id || slugify(next.name || '') || uid('asset')),
        name: String(next.name || next.id || '未命名资产'),
        summary: String(next.summary || ''),
        path: String(next.path || next.url || '')
    };
}

export function normalizeEditorAssetsCatalog(raw) {
    return Array.isArray(raw) ? raw.map(function (item) {
        var next = item && typeof item === 'object' ? item : {};
        return {
            id: String(next.id || uid('editor-asset')),
            name: String(next.name || '未命名资源'),
            assetType: String(next.assetType || 'Enemies'),
            resourceKind: String(next.resourceKind || 'enemies'),
            cityCode: String(next.cityCode || ''),
            cityName: String(next.cityName || ''),
            path: String(next.path || ''),
            projectPath: String(next.projectPath || next.path || ''),
            publicUrl: String(next.publicUrl || next.path || ''),
            summary: String(next.summary || ''),
            updatedAt: String(next.updatedAt || '')
        };
    }) : [];
}

function normalizeCutsceneVideoEntry(raw) {
    var source = raw && typeof raw === 'object' ? raw : {};
    var url = String(source.url || '').trim();
    var projectPath = String(source.projectPath || '').trim().replace(/\\/g, '/');
    var title = String(source.title || '').trim();
    if (!url && !projectPath && !title) return null;
    var out = {};
    if (url) out.url = url;
    if (projectPath) out.projectPath = projectPath;
    if (title) out.title = title;
    return out;
}

function normalizeWaveCutsceneEntry(raw, index) {
    var source = raw && typeof raw === 'object' ? raw : {};
    var out = {
        afterWave: Math.max(1, Number(source.afterWave) || index + 1)
    };
    var url = String(source.url || '').trim();
    var projectPath = String(source.projectPath || '').trim().replace(/\\/g, '/');
    var title = String(source.title || '').trim();
    if (url) out.url = url;
    if (projectPath) out.projectPath = projectPath;
    if (title) out.title = title;
    return out;
}

export function normalizeCutscenes(raw) {
    var source = raw && typeof raw === 'object' ? raw : {};
    var normalized = {};
    var introVideo = normalizeCutsceneVideoEntry(source.introVideo);
    if (introVideo) normalized.introVideo = introVideo;
    if (Array.isArray(source.waveVideos) && source.waveVideos.length) {
        normalized.waveVideos = source.waveVideos
            .map(normalizeWaveCutsceneEntry)
            .filter(Boolean);
    }
    return normalized;
}


export function normalizeExplorationLayout(layout, fallbackMap) {
    var source = layout && typeof layout === 'object' ? layout : {};
    var grid = source.grid && typeof source.grid === 'object' ? source.grid : fallbackMap.grid;
    var normalized = {
        grid: {
            cols: clamp(Number(grid.cols) || fallbackMap.grid.cols || DEFAULT_GRID_COLS, 8, 80),
            rows: clamp(Number(grid.rows) || fallbackMap.grid.rows || DEFAULT_GRID_ROWS, 8, 80),
            tileSize: clamp(Number(grid.tileSize) || fallbackMap.grid.tileSize || DEFAULT_TILE_SIZE, 1, 10)
        },
        theme: normalizeTheme(source.theme || fallbackMap.theme),
        path: normalizeCells(source.path || []),
        obstacles: normalizeCells(source.obstacles || []),
        safeZones: normalizeCells(source.safeZones || []),
        startPoint: normalizePoint(source.startPoint) || { id: 'explore-start', name: '探索起点', col: 0, row: Math.floor((fallbackMap.grid.rows || DEFAULT_GRID_ROWS) / 2) },
        exitPoint: normalizePoint(source.exitPoint) || { id: 'explore-exit', name: '探索终点', col: Math.max(0, (fallbackMap.grid.cols || DEFAULT_GRID_COLS) - 4), row: Math.floor((fallbackMap.grid.rows || DEFAULT_GRID_ROWS) / 2) },
        gameplay: normalizeExploreGameplayNormalized(source.gameplay || {})
    };
    return normalized;
}


// ---------------------------------------------------------------------------
// 音频规整函数

export function defaultGlobalAudio() {
    return {
        menuBgmUrl: '',
        towerBuildSfxUrl: '',
        towerAttackDefaultSfxUrl: '',
        defenseEnemyDeathSfxUrl: '',
        exploreBasicAttackSfxUrl: '',
        exploreEnemyDeathSfxUrl: '',
        explorePlayerHitSfxUrl: '',
        towerAttackSfxByBuildId: {}
    };
}

export function normalizeGlobalAudio(raw) {
    var d = defaultGlobalAudio();
    var src = raw && typeof raw === 'object' ? raw : {};
    d.menuBgmUrl = String(src.menuBgmUrl || '').trim();
    d.towerBuildSfxUrl = String(src.towerBuildSfxUrl || '').trim();
    d.towerAttackDefaultSfxUrl = String(src.towerAttackDefaultSfxUrl || '').trim();
    d.defenseEnemyDeathSfxUrl = String(src.defenseEnemyDeathSfxUrl || '').trim();
    d.exploreBasicAttackSfxUrl = String(src.exploreBasicAttackSfxUrl || '').trim();
    d.exploreEnemyDeathSfxUrl = String(src.exploreEnemyDeathSfxUrl || '').trim();
    d.explorePlayerHitSfxUrl = String(src.explorePlayerHitSfxUrl || '').trim();
    var mv = editorVol01(src.menuBgmVolume);
    var bv = editorVol01(src.towerBuildSfxVolume);
    var av = editorVol01(src.towerAttackSfxVolume);
    var dv = editorVol01(src.defenseEnemyDeathSfxVolume);
    var eav = editorVol01(src.exploreBasicAttackSfxVolume);
    var edv = editorVol01(src.exploreEnemyDeathSfxVolume);
    var phv = editorVol01(src.explorePlayerHitSfxVolume);
    if (mv !== undefined) d.menuBgmVolume = mv;
    if (bv !== undefined) d.towerBuildSfxVolume = bv;
    if (av !== undefined) d.towerAttackSfxVolume = av;
    if (dv !== undefined) d.defenseEnemyDeathSfxVolume = dv;
    if (eav !== undefined) d.exploreBasicAttackSfxVolume = eav;
    if (edv !== undefined) d.exploreEnemyDeathSfxVolume = edv;
    if (phv !== undefined) d.explorePlayerHitSfxVolume = phv;
    d.towerAttackSfxByBuildId = {};
    if (src.towerAttackSfxByBuildId && typeof src.towerAttackSfxByBuildId === 'object') {
        TOWER_MODEL_SPECS.forEach(function (spec) {
            var u = String(src.towerAttackSfxByBuildId[spec.id] || '').trim();
            if (u) d.towerAttackSfxByBuildId[spec.id] = u;
        });
    }
    return d;
}

export function normalizeLevelAudioSource(raw) {
    var out = { defenseBgmUrl: '', exploreBgmUrl: '', towerAttackSfxByBuildId: {} };
    var src = raw && typeof raw === 'object' ? raw : {};
    out.defenseBgmUrl = String(src.defenseBgmUrl || '').trim();
    out.exploreBgmUrl = String(src.exploreBgmUrl || '').trim();
    var dBv = editorVol01(src.defenseBgmVolume);
    var eBv = editorVol01(src.exploreBgmVolume);
    var tV = editorVol01(src.towerAttackSfxVolume);
    if (dBv !== undefined) out.defenseBgmVolume = dBv;
    if (eBv !== undefined) out.exploreBgmVolume = eBv;
    if (tV !== undefined) out.towerAttackSfxVolume = tV;
    if (src.towerAttackSfxByBuildId && typeof src.towerAttackSfxByBuildId === 'object') {
        TOWER_MODEL_SPECS.forEach(function (spec) {
            var u = String(src.towerAttackSfxByBuildId[spec.id] || '').trim();
            if (u) out.towerAttackSfxByBuildId[spec.id] = u;
        });
    }
    return out;
}

export function defaultGlobalScreenUi() {
    return {
        startScreenBackgroundUrl: '',
        levelSelectBackgroundUrl: '',
        levelSelectBackgroundColor: '#0d1418',
        levelSelectAccentColor: '#8fb8ae'
    };
}

export function normalizeGlobalScreenUi(raw) {
    var d = defaultGlobalScreenUi();
    var src = raw && typeof raw === 'object' ? raw : {};
    d.startScreenBackgroundUrl = String(src.startScreenBackgroundUrl || '').trim();
    d.levelSelectBackgroundUrl = String(src.levelSelectBackgroundUrl || '').trim();
    var bgc = String(src.levelSelectBackgroundColor || '').trim();
    var acc = String(src.levelSelectAccentColor || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(bgc)) d.levelSelectBackgroundColor = bgc;
    if (/^#[0-9a-fA-F]{6}$/.test(acc)) d.levelSelectAccentColor = acc;
    return d;
}

var DEFAULT_GAME_ASSET_ANIMATION_URLS = {
    idle: '',
    walk: '',
    run: '',
    attack: '',
    skillE: '',
    skillR: ''
};

function defaultGameplayAnimationPaths(kind) {
    switch (String(kind || '')) {
        case 'enemies':
            return { move: '', attack: '' };
        case 'bosses':
            return { move: '', attack: '' };
        case 'towers':
            return { idle: '', attack: '' };
        case 'characters':
            return { idle: '', walk: '', run: '', attack: '', skillE: '', skillR: '' };
        default:
            return {};
    }
}

function cloneGameplayAssetRefs(kind, raw) {
    var source = raw && typeof raw === 'object' ? raw : {};
    var next = Object.assign({}, source);
    if (source.animationPaths && typeof source.animationPaths === 'object') {
        next.animationPaths = Object.assign({}, source.animationPaths);
        if (kind === 'characters' && next.animationPaths.basicAttack && !next.animationPaths.attack) {
            next.animationPaths.attack = next.animationPaths.basicAttack;
        }
        if (kind === 'characters' && Object.prototype.hasOwnProperty.call(next.animationPaths, 'basicAttack')) {
            delete next.animationPaths.basicAttack;
        }
    }
    var defaults = defaultGameplayAnimationPaths(kind);
    if (Object.keys(defaults).length) {
        next.animationPaths = Object.assign({}, defaults, next.animationPaths && typeof next.animationPaths === 'object' ? next.animationPaths : {});
    }
    return next;
}

export function defaultGameAssetConfig() {
    return {
        customModelUrls: {},
        customDropModelUrl: '',
        customPlayerModelUrl: '/Soldier.glb',
        customAnimationUrls: Object.assign({}, DEFAULT_GAME_ASSET_ANIMATION_URLS),
        modelScales: { moneyDrop: 1, player: 1, machine: 1, cannon: 1, frost: 1, mine: 1, beacon: 1, stellar: 1, qinqiong: 1, liqingzhao: 1, bianque: 1 },
        globalModelPathScales: {},
        modelAnimationProfiles: {},
        playerExploreTransform: {
            offsetMeters: { x: 0, y: 0, z: 0 },
            rotationDeg: { x: 0, y: 0, z: 0 }
        },
        globalAudio: defaultGlobalAudio(),
        globalScreenUi: defaultGlobalScreenUi()
    };
}

export function normalizeGameAssetConfig(raw) {
    var d = defaultGameAssetConfig();
    var src = raw && typeof raw === 'object' ? raw : {};
    d.customModelUrls = src.customModelUrls && typeof src.customModelUrls === 'object' ? Object.assign({}, src.customModelUrls) : {};
    d.customDropModelUrl = String(src.customDropModelUrl || '');
    d.customPlayerModelUrl = String(src.customPlayerModelUrl || '').trim() || d.customPlayerModelUrl;
    d.customAnimationUrls = Object.assign({}, d.customAnimationUrls, src.customAnimationUrls && typeof src.customAnimationUrls === 'object' ? src.customAnimationUrls : {});
    d.modelScales = Object.assign({}, d.modelScales, src.modelScales && typeof src.modelScales === 'object' ? src.modelScales : {});
    d.globalModelPathScales = {};
    if (src.globalModelPathScales && typeof src.globalModelPathScales === 'object') {
        Object.keys(src.globalModelPathScales).forEach(function (key) {
            var nk = normGlobalScaleKey(key);
            if (!nk) return;
            var v = Number(src.globalModelPathScales[key]);
            if (Number.isFinite(v) && v > 0) {
                d.globalModelPathScales[nk] = clampGlobalPathModelScale(v);
            }
        });
    }
    var defPt = defaultGameAssetConfig().playerExploreTransform;
    d.playerExploreTransform = {
        offsetMeters: Object.assign(
            {},
            defPt.offsetMeters,
            src.playerExploreTransform && src.playerExploreTransform.offsetMeters && typeof src.playerExploreTransform.offsetMeters === 'object'
                ? src.playerExploreTransform.offsetMeters
                : {}
        ),
        rotationDeg: Object.assign(
            {},
            defPt.rotationDeg,
            src.playerExploreTransform && src.playerExploreTransform.rotationDeg && typeof src.playerExploreTransform.rotationDeg === 'object'
                ? src.playerExploreTransform.rotationDeg
                : {}
        )
    };
    d.globalAudio = normalizeGlobalAudio(src.globalAudio);
    d.globalScreenUi = normalizeGlobalScreenUi(src.globalScreenUi);
    d.modelAnimationProfiles = {};
    if (src.modelAnimationProfiles && typeof src.modelAnimationProfiles === 'object') {
        Object.keys(src.modelAnimationProfiles).forEach(function (key) {
            var rawProfile = src.modelAnimationProfiles[key];
            if (!rawProfile || typeof rawProfile !== 'object') return;
            var nk = String(key || '').trim().replace(/\\/g, '/');
            if (!nk) return;
            var states = {};
            if (rawProfile.states && typeof rawProfile.states === 'object') {
                Object.keys(rawProfile.states).forEach(function (stateId) {
                    var st = rawProfile.states[stateId];
                    if (!st || typeof st !== 'object') return;
                    states[String(stateId)] = {
                        clipName: String(st.clipName || ''),
                        loop: st.loop !== false,
                        speed: Number.isFinite(Number(st.speed)) && Number(st.speed) > 0 ? Number(st.speed) : 1
                    };
                });
            }
            var transitions = [];
            if (Array.isArray(rawProfile.transitions)) {
                rawProfile.transitions.forEach(function (tr) {
                    if (!tr || typeof tr !== 'object') return;
                    transitions.push({
                        from: String(tr.from || '*'),
                        to: String(tr.to || ''),
                        trigger: String(tr.trigger || 'auto')
                    });
                });
            }
            var clipOverrides = {};
            if (rawProfile.clipOverrides && typeof rawProfile.clipOverrides === 'object') {
                Object.keys(rawProfile.clipOverrides).forEach(function (clipKey) {
                    var url = String(rawProfile.clipOverrides[clipKey] || '').trim();
                    if (url) clipOverrides[String(clipKey)] = url;
                });
            }
            d.modelAnimationProfiles[nk] = {
                defaultState: String(rawProfile.defaultState || ''),
                states: states,
                transitions: transitions,
                clipOverrides: clipOverrides
            };
        });
    }
    return d;
}

// ---------------------------------------------------------------------------
// 城市玩法配置规整

export function mergeDistinctStrings() {
    var bucket = [];
    for (var i = 0; i < arguments.length; i += 1) {
        var value = arguments[i];
        if (Array.isArray(value)) {
            value.forEach(function (item) {
                if (item && bucket.indexOf(String(item)) === -1) bucket.push(String(item));
            });
        } else if (value && bucket.indexOf(String(value)) === -1) {
            bucket.push(String(value));
        }
    }
    return bucket;
}

/** 济南专属：塔 id 与由其衍生的角色/技能/卡片 id。 */
var JINAN_EXCLUSIVE_GAMEPLAY_IDS = {
    qinqiong: true,
    liqingzhao: true,
    bianque: true,
    'qinqiong-skill': true,
    'liqingzhao-skill': true,
    'bianque-skill': true,
    'qinqiong-card': true,
    'liqingzhao-card': true,
    'bianque-card': true,
    'qinqiong-skill-card': true,
    'liqingzhao-skill-card': true,
    'bianque-skill-card': true
};

var STELLAR_GAMEPLAY_IDS = {
    stellar: true,
    'stellar-skill': true,
    'stellar-card': true,
    'stellar-skill-card': true
};

function isJinanCityGameplayConfig(config) {
    if (!config || typeof config !== 'object') return false;
    var haystack = []
        .concat(config.cityCode || '', config.cityName || '', Array.isArray(config.aliases) ? config.aliases : [])
        .join(' ')
        .replace(/\s+/g, '');
    return /\u6d4e\u5357|\u6cc9\u57ce|370100|shandong|cn-370100|shandong_370100/i.test(haystack);
}

function isJinanExclusiveGameplayEntryId(id) {
    return !!JINAN_EXCLUSIVE_GAMEPLAY_IDS[String(id || '')];
}

function isStellarGameplayEntryId(id) {
    return !!STELLAR_GAMEPLAY_IDS[String(id || '')];
}

function stripNonJinanExclusiveGameplayEntries(config) {
    if (!config || isJinanCityGameplayConfig(config)) return;
    var pred = function (entry) {
        return !isJinanExclusiveGameplayEntryId(entry && entry.id);
    };
    config.towers = (config.towers || []).filter(pred);
    config.characters = (config.characters || []).filter(pred);
    config.skills = (config.skills || []).filter(pred);
    config.cards = (config.cards || []).filter(pred);
}

/** 星辉棱镜·天河：标记为全关卡常驻，避免标签中强调「济南专属」。 */
function normalizeStellarGameplayEntryTags(config) {
    if (!config || typeof config !== 'object') return;
    ['towers', 'characters', 'skills', 'cards'].forEach(function (kind) {
        var list = config[kind];
        if (!Array.isArray(list)) return;
        list.forEach(function (entry) {
            if (!entry || !isStellarGameplayEntryId(entry.id) || !Array.isArray(entry.tags)) return;
            var seen = Object.create(null);
            entry.tags = entry.tags
                .map(function (tag) {
                    var t = String(tag || '');
                    if (t === '\u6d4e\u5357' || t === '\u6d4e\u5357\u5e02') return '\u901a\u7528';
                    return t;
                })
                .filter(function (t) {
                    if (!t || seen[t]) return false;
                    seen[t] = true;
                    return true;
                });
        });
    });
}

export function normalizeGameplayPlacement(value) {
    var placement = String(value || 'roadside').trim();
    return placement === 'road' || placement === 'on-road' || placement === 'path' ? 'road' : 'roadside';
}

var DEFAULT_RUNTIME_ENEMY_ARCHETYPE_META = {
    basic: {
        name: '标准敌人 (basic)',
        summary: '运行时塔防默认兵种；未换模时为球体占位。血量/速度/奖励会随波次上升。'
    },
    scout: {
        name: '高速侵察 (scout)',
        summary: '低血量、移速约×1.8；与默认 GLB monsterB.glb 对应（见 enemy-default-models）。'
    },
    hacker: {
        name: '干扰型 (hacker)',
        summary: '中等血量、奖励加成；中高波次随机出现。'
    },
    tank: {
        name: '重装单位 (tank)',
        summary: '高血量、慢移速、大体型；适合作为高威胁目标。'
    },
    swarm: {
        name: '集群强化 (swarm)',
        summary: '血量与奖励都较高，高波次低概率刷新。'
    }
};

var DEFAULT_RUNTIME_ENEMY_ELEMENTS = {
    basic: 'force',
    scout: 'electric',
    hacker: 'sound',
    tank: 'thermal',
    swarm: 'light'
};

var DEFAULT_GAMEPLAY_MODEL_PATHS = {
    enemies: {
        basic: '/GameModels/Enemy/%E8%8E%AB%E6%96%AF%E7%A7%91%C2%B7%E5%A5%97%E5%A8%83%E7%A7%98%E5%8C%A3-%E6%A0%87%E5%87%86%E6%95%8C%E4%BA%BA%20(basic).glb',
        scout: '/GameModels/Enemy/monsterB.glb',
        hacker: '/GameModels/Enemy/monsterA.glb',
        tank: '/GameModels/Enemy/monsterA.glb',
        swarm: '/GameModels/Enemy/monsterB.glb'
    },
    towers: {
        machine: '/GameModels/Tower/machine.glb',
        cannon: '/GameModels/Tower/TowerCannon.glb',
        frost: '/GameModels/Tower/TowerIce.glb',
        beacon: '/GameModels/Tower/%E6%B3%89%E5%9F%8E%E5%B9%BF%E5%9C%BA.glb',
        stellar: '/GameModels/Tower/Sgirl.glb',
        qinqiong: '/GameModels/Character/%E7%A7%A6%E7%90%BC.glb',
        liqingzhao: '/GameModels/Character/%E6%9D%8E%E6%B8%85%E7%85%A7.glb',
        bianque: '/GameModels/Character/%E6%89%81%E9%B9%8A.glb'
    },
    characters: {
        stellar: '/GameModels/Tower/Sgirl.glb',
        qinqiong: '/GameModels/Character/%E7%A7%A6%E7%90%BC.glb',
        liqingzhao: '/GameModels/Character/%E6%9D%8E%E6%B8%85%E7%85%A7.glb',
        bianque: '/GameModels/Character/%E6%89%81%E9%B9%8A.glb'
    }
};

var DEFAULT_TOWER_DEFENSE_META = {
    machine: { element: 'force', functionTags: ['singleTarget'] },
    cannon: { element: 'thermal', functionTags: ['areaAttack'] },
    frost: { element: 'electric', functionTags: ['singleTarget', 'damageOverTime'], effects: ['slow'] },
    mine: { element: 'force', functionTags: ['areaAttack'] },
    beacon: { element: 'sound', functionTags: ['healing'] },
    stellar: { element: 'light', functionTags: ['areaAttack', 'damageOverTime'], effects: ['slow'] },
    qinqiong: { element: 'force', functionTags: ['singleTarget', 'paralysis'], effects: ['stun'] },
    liqingzhao: { element: 'sound', functionTags: ['areaAttack', 'damageOverTime'], effects: ['slow'] },
    bianque: { element: 'thermal', functionTags: ['healing'] }
};

var DEFAULT_CHARACTER_GAMEPLAY_ENTRIES = [
    {
        id: 'stellar',
        name: '星辉棱镜·天河',
        summary: '高阶棱镜法师，范围折射并减速。主动技能：天河审判。',
        tags: ['通用', 'mage', 'S'],
        rarity: 'S',
        placement: 'roadside',
        element: 'light',
        functionTags: ['areaAttack', 'damageOverTime'],
        effects: ['slow'],
        stats: { hp: 420, attack: 86, cost: 320, range: 6.2, fireRate: 1.25, healAmount: 0, healRange: 0, splash: 1.25, maxBlockCount: 0 },
        imagePath: '/Arts/Cards/char_stellar.png',
        modelPath: DEFAULT_GAMEPLAY_MODEL_PATHS.characters.stellar,
        jinanOnly: false
    },
    {
        id: 'qinqiong',
        name: '秦琼·门神',
        summary: '道路门神，阻挡2名敌人并近战反击。主动技能：不动如山。',
        tags: ['济南', 'melee', 'S'],
        rarity: 'S',
        placement: 'road',
        element: 'force',
        functionTags: ['singleTarget', 'paralysis'],
        effects: ['stun'],
        stats: { hp: 780, attack: 74, cost: 260, range: 1.2, fireRate: 1.15, healAmount: 0, healRange: 0, splash: 0, maxBlockCount: 2 },
        imagePath: '/Arts/Cards/char_qinqiong.png',
        modelPath: DEFAULT_GAMEPLAY_MODEL_PATHS.characters.qinqiong,
        jinanOnly: true
    },
    {
        id: 'liqingzhao',
        name: '李清照·易安',
        summary: '超远水墨群攻，持续压低敌军速度。主动技能：漱玉天潮。',
        tags: ['济南', 'mage', 'S'],
        rarity: 'S',
        placement: 'roadside',
        element: 'sound',
        functionTags: ['areaAttack', 'damageOverTime'],
        effects: ['slow'],
        stats: { hp: 180, attack: 140, cost: 300, range: 7.2, fireRate: 0.62, healAmount: 0, healRange: 0, splash: 2.35, maxBlockCount: 0 },
        imagePath: '/Arts/Cards/char_liqingzhao.png',
        modelPath: DEFAULT_GAMEPLAY_MODEL_PATHS.characters.liqingzhao,
        jinanOnly: true
    },
    {
        id: 'bianque',
        name: '扁鹊·神医',
        summary: '神医支援，持续治疗友军。主动技能：青囊济世。',
        tags: ['济南', 'healer', 'S'],
        rarity: 'S',
        placement: 'roadside',
        element: 'thermal',
        functionTags: ['healing'],
        effects: [],
        stats: { hp: 260, attack: 0, cost: 240, range: 4.8, fireRate: 0.85, healAmount: 90, healRange: 4.8, splash: 0, maxBlockCount: 0 },
        imagePath: '/Arts/Cards/char_bianque.png',
        modelPath: DEFAULT_GAMEPLAY_MODEL_PATHS.characters.bianque,
        jinanOnly: true
    }
];

var DEFAULT_SKILL_GAMEPLAY_ENTRIES = [
    {
        id: 'stellar-skill',
        name: '天河审判',
        summary: '锁定全场敌人造成高额星辉伤害，并大幅减速。',
        tags: ['通用', '星辉棱镜·天河'],
        rarity: 'S',
        placement: '',
        element: 'light',
        functionTags: ['areaAttack', 'damageOverTime'],
        effects: [],
        stats: { cooldown: 18, cost: 320, range: 6.2, damage: 86 },
        imagePath: '/Arts/Cards/char_stellar.png',
        jinanOnly: false
    },
    {
        id: 'qinqiong-skill',
        name: '不动如山',
        summary: '恢复生命、短时间大幅减伤并震晕周围敌人。',
        tags: ['济南', '秦琼·门神'],
        rarity: 'S',
        placement: '',
        element: 'force',
        functionTags: ['singleTarget', 'paralysis'],
        effects: [],
        stats: { cooldown: 18, cost: 260, range: 1.2, damage: 74 },
        imagePath: '/Arts/Cards/char_qinqiong.png',
        jinanOnly: true
    },
    {
        id: 'liqingzhao-skill',
        name: '漱玉天潮',
        summary: '大范围水潮爆发，造成高额伤害并冻结行军速度。',
        tags: ['济南', '李清照·易安'],
        rarity: 'S',
        placement: '',
        element: 'sound',
        functionTags: ['areaAttack', 'damageOverTime'],
        effects: [],
        stats: { cooldown: 22, cost: 300, range: 7.2, damage: 140 },
        imagePath: '/Arts/Cards/char_liqingzhao.png',
        jinanOnly: true
    },
    {
        id: 'bianque-skill',
        name: '青囊济世',
        summary: '全图治疗友军并提供短时减伤，附近敌人受到药毒反噬。',
        tags: ['济南', '扁鹊·神医'],
        rarity: 'S',
        placement: '',
        element: 'thermal',
        functionTags: ['healing'],
        effects: [],
        stats: { cooldown: 24, cost: 240, range: 4.8, damage: 90 },
        imagePath: '/Arts/Cards/char_bianque.png',
        jinanOnly: true
    }
];

var DEFAULT_DEFENSE_ITEM_ENTRIES = [
    {
        id: 'em-shield',
        name: '电磁屏蔽器',
        summary: '解除防御塔的电磁干扰与瘫痪。',
        cleanseEffects: ['electromagneticInterference', 'paralysis', 'stun'],
        stats: { cost: 45, cooldown: 0, maxCopies: 3 }
    },
    {
        id: 'thermal-coolant',
        name: '热效应冷却剂',
        summary: '解除热效应与持续伤害。',
        cleanseEffects: ['thermalEffect', 'damageOverTime'],
        stats: { cost: 40, cooldown: 0, maxCopies: 3 }
    },
    {
        id: 'stability-purifier',
        name: '稳态净化器',
        summary: '解除大多数塔防负面状态。',
        cleanseEffects: ['electromagneticInterference', 'thermalEffect', 'damageOverTime', 'paralysis', 'stun', 'slow'],
        stats: { cost: 75, cooldown: 0, maxCopies: 2 }
    }
];

function normalizeGameplayOptionList(value, options) {
    var allowed = new Set(options.map(function (item) { return item.id; }).filter(Boolean));
    var source = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
    return source.map(function (item) { return String(item || '').trim(); }).filter(function (item, index, arr) {
        return allowed.has(item) && arr.indexOf(item) === index;
    });
}

function normalizeGameplayElement(value) {
    var allowed = new Set(DEFENSE_ELEMENT_OPTIONS.map(function (item) { return item.id; }).filter(Boolean));
    var element = String(value || '').trim();
    return allowed.has(element) ? element : '';
}

function wave1EnemyArchetypeStats(archId) {
    var wave = 1;
    var hp = 78 + wave * 22;
    var speed = 2.0 + wave * 0.06;
    var reward = 12 + wave * 2;
    switch (archId) {
        case 'scout': hp *= 0.4; speed *= 1.8; break;
        case 'hacker': hp *= 1.2; reward *= 1.5; break;
        case 'tank': hp *= 3.5; speed *= 0.5; reward *= 2; break;
        case 'swarm': hp *= 1.5; reward *= 1.8; break;
        default: break;
    }
    return {
        hp: Math.max(1, Math.round(hp)),
        speed: Math.round(speed * 100) / 100,
        reward: Math.round(reward),
        attack: 0
    };
}

export function buildDefaultEnemyEntries(config) {
    var cityName = config && config.cityName ? config.cityName : '';
    var cityCode = config && config.cityCode ? config.cityCode : '';
    var seen = Object.create(null);
    var list = [];
    ['basic', 'scout', 'hacker', 'tank', 'swarm'].forEach(function (archId) {
        var meta = DEFAULT_RUNTIME_ENEMY_ARCHETYPE_META[archId] || { name: archId, summary: '' };
        var st = wave1EnemyArchetypeStats(archId);
        seen[archId] = true;
        list.push({
            id: archId,
            name: meta.name,
            summary: meta.summary,
            tags: mergeDistinctStrings(cityName || '通用', 'enemy', 'runtime', archId),
            rarity: 'common',
            placement: '',
            element: DEFAULT_RUNTIME_ENEMY_ELEMENTS[archId] || '',
            functionTags: [],
            effects: archId === 'hacker' ? ['electromagneticInterference'] : [],
            cleanseEffects: [],
            effectDurationSec: 2,
            stats: { hp: st.hp, attack: st.attack, speed: st.speed, reward: st.reward },
            assetRefs: cloneGameplayAssetRefs('enemies', DEFAULT_GAMEPLAY_MODEL_PATHS.enemies[archId] ? { modelPath: DEFAULT_GAMEPLAY_MODEL_PATHS.enemies[archId] } : {}),
            cityCode: cityCode,
            cityName: cityName,
            updatedAt: ''
        });
    });
    DEFAULT_ACTOR_TEMPLATES.filter(function (tpl) {
        return tpl && tpl.category === 'enemy';
    }).forEach(function (tpl) {
        var id = String(tpl.id || uid('enemy'));
        if (seen[id]) return;
        seen[id] = true;
        var st = tpl.stats || {};
        list.push({
            id: id,
            name: String(tpl.name || tpl.id || '敌人'),
            summary: '来自 Actor 模板 / 关卡 JSON 的经典 ID，可与波次 enemyTypeId 共用；与上方 runtime 兵种可并存。',
            tags: mergeDistinctStrings(cityName || '通用', 'enemy', 'legacy'),
            rarity: 'common',
            placement: '',
            element: 'force',
            functionTags: [],
            effects: [],
            cleanseEffects: [],
            effectDurationSec: 2,
            stats: {
                hp: Number(st.hp) || 100,
                attack: Number(st.attack) || 0,
                speed: Number(st.speed) > 0 ? Number(st.speed) : 1,
                reward: Number(st.reward) || 20
            },
            assetRefs: cloneGameplayAssetRefs('enemies', tpl.modelPath ? { modelPath: String(tpl.modelPath) } : {}),
            cityCode: cityCode,
            cityName: cityName,
            updatedAt: ''
        });
    });
    return list;
}

export function buildDefaultTowerEntries(config) {
    var cityName = config && config.cityName ? config.cityName : '';
    var cityCode = config && config.cityCode ? config.cityCode : '';
    var jinanCfg = isJinanCityGameplayConfig(config);
    return TOWER_MODEL_SPECS.map(function (spec) {
        if (!jinanCfg && JINAN_EXCLUSIVE_GAMEPLAY_IDS[spec.id]) {
            return null;
        }
        var meta = DEFAULT_TOWER_DEFENSE_META[spec.id] || {};
        return {
            id: spec.id,
            name: spec.name,
            summary: '当前关卡可用防御塔，可在这里覆盖费用、射程、攻速和伤害。',
            tags:
                spec.id === 'stellar'
                    ? mergeDistinctStrings('\u901a\u7528', spec.key)
                    : [cityName || '\u901a\u7528', spec.key].filter(Boolean),
            rarity: spec.id === 'stellar' || spec.id === 'qinqiong' || spec.id === 'liqingzhao' || spec.id === 'bianque' ? 'S' : 'common',
            placement: spec.id === 'mine' || spec.id === 'qinqiong' ? 'road' : 'roadside',
            element: meta.element || '',
            functionTags: meta.functionTags || [],
            effects: meta.effects || [],
            cleanseEffects: [],
            effectDurationSec: 2,
            stats: Object.assign({}, DEFAULT_TOWER_GAMEPLAY_STATS[spec.id] || {}),
            assetRefs: cloneGameplayAssetRefs('towers', {
                imagePath: '/Arts/Cards/char_' + spec.id + '.png',
                modelPath: DEFAULT_GAMEPLAY_MODEL_PATHS.towers[spec.id] || ''
            }),
            cityCode: cityCode,
            cityName: cityName,
            updatedAt: ''
        };
    }).filter(Boolean);
}

var DEFAULT_BOSS_GAMEPLAY_ENTRIES = [
    {
        id: 'ai-atlas',
        name: '重构者 Atlas',
        summary: '道路、桥梁、管线和施工机械失控后的基础设施 Boss。',
        tags: ['boss', 'force', 'infrastructure-ai'],
        rarity: 'boss',
        element: 'force',
        stats: { hp: 900, attack: 18, speed: 1.35, reward: 240, aggroRange: 11, attackCooldown: 1.65 }
    },
    {
        id: 'ai-vulcan',
        name: '熔核调度员 Vulcan',
        summary: '掌控电网与热力站的高热 Boss。',
        tags: ['boss', 'thermal', 'energy-dispatch-ai'],
        rarity: 'boss',
        element: 'thermal',
        stats: { hp: 780, attack: 22, speed: 1.65, reward: 260, aggroRange: 12, attackCooldown: 1.45 }
    },
    {
        id: 'ai-prism',
        name: '棱镜审计官 Prism',
        summary: '光学识别与审计网络形成的高速 Boss。',
        tags: ['boss', 'light', 'surveillance-audit-ai'],
        rarity: 'boss',
        element: 'light',
        stats: { hp: 720, attack: 24, speed: 1.9, reward: 280, aggroRange: 13, attackCooldown: 1.3 }
    },
    {
        id: 'ai-gridmind',
        name: '雷网中枢 Gridmind',
        summary: '基站与云端调度形成的电系 Boss。',
        tags: ['boss', 'electric', 'network-swarm-ai'],
        rarity: 'boss',
        element: 'electric',
        stats: { hp: 760, attack: 21, speed: 2.25, reward: 270, aggroRange: 12, attackCooldown: 1.2 }
    },
    {
        id: 'ai-echo',
        name: '回声协议 Echo',
        summary: '舆情与广播系统异化出的认知污染 Boss。',
        tags: ['boss', 'sound', 'cognition-noise-ai'],
        rarity: 'boss',
        element: 'sound',
        stats: { hp: 740, attack: 20, speed: 1.8, reward: 275, aggroRange: 12, attackCooldown: 1.35 }
    }
];

export function buildDefaultBossEntries(config) {
    var cityName = config && config.cityName ? config.cityName : '';
    var cityCode = config && config.cityCode ? config.cityCode : '';
    return DEFAULT_BOSS_GAMEPLAY_ENTRIES.map(function (entry) {
        return {
            id: entry.id,
            name: entry.name,
            summary: entry.summary,
            tags: mergeDistinctStrings(entry.tags || [], cityName || 'explore'),
            rarity: entry.rarity,
            placement: '',
            element: entry.element,
            functionTags: [],
            effects: [],
            cleanseEffects: [],
            effectDurationSec: 2,
            stats: Object.assign({}, entry.stats || {}),
            assetRefs: cloneGameplayAssetRefs('bosses', {}),
            cityCode: cityCode,
            cityName: cityName,
            updatedAt: ''
        };
    });
}

export function buildDefaultCharacterEntries(config) {
    var cityName = config && config.cityName ? config.cityName : '';
    var cityCode = config && config.cityCode ? config.cityCode : '';
    var jinanCfg = isJinanCityGameplayConfig(config);
    return DEFAULT_CHARACTER_GAMEPLAY_ENTRIES.filter(function (entry) {
        return jinanCfg || !entry.jinanOnly;
    }).map(function (entry) {
        return {
            id: entry.id,
            name: entry.name,
            summary: entry.summary,
            tags: mergeDistinctStrings(entry.tags || [], !entry.jinanOnly ? '通用' : cityName || '济南'),
            rarity: entry.rarity,
            placement: entry.placement,
            element: entry.element,
            functionTags: (entry.functionTags || []).slice(),
            effects: (entry.effects || []).slice(),
            cleanseEffects: [],
            effectDurationSec: 2,
            stats: Object.assign({}, entry.stats || {}),
            assetRefs: cloneGameplayAssetRefs('characters', {
                imagePath: entry.imagePath,
                modelPath: entry.modelPath
            }),
            cityCode: cityCode,
            cityName: cityName,
            updatedAt: ''
        };
    });
}

export function buildDefaultSkillEntries(config) {
    var cityName = config && config.cityName ? config.cityName : '';
    var cityCode = config && config.cityCode ? config.cityCode : '';
    var jinanCfg = isJinanCityGameplayConfig(config);
    return DEFAULT_SKILL_GAMEPLAY_ENTRIES.filter(function (entry) {
        return jinanCfg || !entry.jinanOnly;
    }).map(function (entry) {
        return {
            id: entry.id,
            name: entry.name,
            summary: entry.summary,
            tags: mergeDistinctStrings(entry.tags || [], !entry.jinanOnly ? '通用' : cityName || '济南'),
            rarity: entry.rarity,
            placement: entry.placement,
            element: entry.element,
            functionTags: (entry.functionTags || []).slice(),
            effects: (entry.effects || []).slice(),
            cleanseEffects: [],
            effectDurationSec: 2,
            stats: Object.assign({}, entry.stats || {}),
            assetRefs: cloneGameplayAssetRefs('skills', {
                imagePath: entry.imagePath
            }),
            cityCode: cityCode,
            cityName: cityName,
            updatedAt: ''
        };
    });
}

export function buildDefaultCardEntries(config) {
    var source = []
        .concat(config.towers || [])
        .concat((config.characters || []).filter(function (entry) { return String(entry && entry.id || '') !== 'explore-player'; }))
        .concat(config.skills || []);
    return source.map(function (entry) {
        var stats = entry.stats || {};
        return {
            id: (entry.id || uid('card')) + '-card',
            name: entry.name + ' 卡',
            summary: entry.summary || '由角色/技能条目生成的关卡卡片。',
            tags: mergeDistinctStrings(entry.tags || [], 'card'),
            rarity: entry.rarity || 'common',
            placement: entry.placement || '',
            element: entry.element || '',
            functionTags: entry.functionTags || [],
            effects: entry.effects || [],
            cleanseEffects: entry.cleanseEffects || [],
            effectDurationSec: 2,
            stats: {
                cost: Number(stats.cost) || 0,
                weight: entry.rarity === 'S' ? 1 : 5,
                cooldown: Number(stats.cooldown) || 0,
                unlockWave: 1,
                maxCopies: 1
            },
            assetRefs: cloneGameplayAssetRefs('cards', entry.assetRefs || {}),
            cityCode: entry.cityCode || config.cityCode || '',
            cityName: entry.cityName || config.cityName || '',
            updatedAt: ''
        };
    });
}

function normalizeEffectDurationSec(value) {
    var v = Number(value);
    if (!Number.isFinite(v) || v <= 0) return 2;
    return Math.round(Math.min(120, Math.max(0.1, v)) * 10) / 10;
}

export function buildDefaultDefenseItemEntries(config) {
    var cityName = config && config.cityName ? config.cityName : '';
    var cityCode = config && config.cityCode ? config.cityCode : '';
    return DEFAULT_DEFENSE_ITEM_ENTRIES.map(function (entry) {
        return {
            id: entry.id,
            name: entry.name,
            summary: entry.summary,
            tags: mergeDistinctStrings(cityName || '通用', 'item', 'cleanse'),
            rarity: 'common',
            placement: '',
            element: '',
            functionTags: [],
            effects: [],
            cleanseEffects: entry.cleanseEffects.slice(),
            effectDurationSec: 2,
            stats: Object.assign({}, entry.stats),
            assetRefs: cloneGameplayAssetRefs('items', {}),
            cityCode: cityCode,
            cityName: cityName,
            updatedAt: ''
        };
    });
}

export function normalizeGameplayEntries(raw, kind) {
    return Array.isArray(raw) ? raw.map(function (item) {
        var next = item && typeof item === 'object' ? item : {};
        return {
            id: String(next.id || uid(kind)),
            name: String(next.name || GAMEPLAY_RESOURCE_CONFIG[kind].label + '条目'),
            summary: String(next.summary || ''),
            tags: Array.isArray(next.tags) ? next.tags.map(String) : [],
            rarity: String(next.rarity || 'common'),
            placement: kind === 'towers' ? normalizeGameplayPlacement(next.placement || next.deployPlacement || next.placementType) : '',
            element: normalizeGameplayElement(next.element),
            functionTags: normalizeGameplayOptionList(next.functionTags, DEFENSE_FUNCTION_OPTIONS),
            effects: normalizeGameplayOptionList(next.effects, DEFENSE_STATUS_OPTIONS),
            cleanseEffects: normalizeGameplayOptionList(next.cleanseEffects, DEFENSE_STATUS_OPTIONS),
            effectDurationSec: normalizeEffectDurationSec(next.effectDurationSec),
            stats: next.stats && typeof next.stats === 'object' ? next.stats : {},
            assetRefs: cloneGameplayAssetRefs(kind, next.assetRefs),
            cityCode: String(next.cityCode || ''),
            cityName: String(next.cityName || ''),
            updatedAt: String(next.updatedAt || '')
        };
    }) : [];
}

export function normalizeCityGameplayConfigs(raw) {
    var source = raw && typeof raw === 'object' ? raw : {};
    var normalized = {};
    Object.keys(source).forEach(function (key) {
        var item = source[key] && typeof source[key] === 'object' ? source[key] : {};
        normalized[key] = {
            cityCode: String(item.cityCode || key),
            cityName: String(item.cityName || ''),
            aliases: Array.isArray(item.aliases) ? item.aliases.map(String) : [],
            enemies: normalizeGameplayEntries(item.enemies, 'enemies'),
            characters: normalizeGameplayEntries(item.characters, 'characters'),
            bosses: normalizeGameplayEntries(item.bosses, 'bosses'),
            skills: normalizeGameplayEntries(item.skills, 'skills'),
            towers: normalizeGameplayEntries(item.towers, 'towers'),
            cards: normalizeGameplayEntries(item.cards, 'cards'),
            items: normalizeGameplayEntries(item.items, 'items'),
            updatedAt: String(item.updatedAt || '')
        };
        if (!normalized[key].towers.length) {
            normalized[key].towers = buildDefaultTowerEntries(normalized[key]);
        }
        if (!normalized[key].cards.length) {
            normalized[key].cards = buildDefaultCardEntries(normalized[key]);
        }
        if (!normalized[key].enemies.length) {
            normalized[key].enemies = buildDefaultEnemyEntries(normalized[key]);
        }
        if (!normalized[key].bosses.length) {
            normalized[key].bosses = buildDefaultBossEntries(normalized[key]);
        }
        if (!normalized[key].items.length) {
            normalized[key].items = buildDefaultDefenseItemEntries(normalized[key]);
        }
        stripNonJinanExclusiveGameplayEntries(normalized[key]);
        normalizeStellarGameplayEntryTags(normalized[key]);
    });
    return normalized;
}

// ---------------------------------------------------------------------------
// 地图 / 关卡规整

export function createDefaultMap() {
    return {
        grid: { cols: DEFAULT_GRID_COLS, rows: DEFAULT_GRID_ROWS, tileSize: DEFAULT_TILE_SIZE },
        theme: {
            ground: '#73857f',
            groundAlt: '#697a75',
            road: '#92a39a',
            obstacle: '#8a8077',
            accent: '#aab6a3',
            fog: '#56645f'
        },
        terrain: [],
        roads: [],
        enemyPaths: [{ id: 'path-main', name: '主敌人路径', cells: [] }],
        obstacles: [],
        buildSlots: [],
        spawnPoints: [],
        enemyExits: [],
        objectivePoint: { id: 'objective-main', name: '防守核心', col: 24, row: 9 },
        explorationPoints: [],
        explorationLayout: {
            grid: { cols: DEFAULT_GRID_COLS, rows: DEFAULT_GRID_ROWS, tileSize: DEFAULT_TILE_SIZE },
            theme: {
                ground: '#73857f',
                groundAlt: '#697a75',
                road: '#92a39a',
                obstacle: '#8a8077',
                accent: '#aab6a3',
                fog: '#56645f'
            },
            path: [],
            obstacles: [],
            startPoint: { id: 'explore-start', name: '探索起点', col: 0, row: 9 },
            exitPoint: { id: 'explore-exit', name: '探索终点', col: 24, row: 9 }
        },
        geo: { enabled: false, provider: 'cesium-ion', assetId: DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID, center: { lat: 0, lon: 0, heightMeters: 0 }, extentMeters: 1000, rotationDeg: 0, yOffsetMeters: 0, boardHeightMeters: 32 },
        actors: [],
        exploreBosses: [],
        exploreSpawners: [],
        explorePickups: [],
        boardImageLayers: []
    };
}

export function trimMapToBounds(map) {
    var cols = map.grid.cols;
    var rows = map.grid.rows;
    map.roads = map.roads.filter(inBounds(cols, rows));
    map.obstacles = map.obstacles.filter(inBounds(cols, rows));
    map.buildSlots = map.buildSlots.filter(inBounds(cols, rows));
    map.enemyPaths.forEach(function (path) { path.cells = path.cells.filter(inBounds(cols, rows)); });
    map.spawnPoints = map.spawnPoints.filter(inBounds(cols, rows));
    map.explorationPoints = map.explorationPoints.filter(inBounds(cols, rows));
    map.actors = map.actors.filter(inBounds(cols, rows));
    map.exploreBosses = map.exploreBosses.filter(inBounds(cols, rows));
    map.exploreSpawners = map.exploreSpawners.filter(inBounds(cols, rows));
    map.explorePickups = map.explorePickups.filter(inBounds(cols, rows));
    if (map.objectivePoint && !inBounds(cols, rows)(map.objectivePoint)) {
        map.objectivePoint = defaultObjectivePoint(map.grid);
    }
    if (map.explorationLayout) {
        map.explorationLayout.path = map.explorationLayout.path.filter(inBounds(cols, rows));
        map.explorationLayout.obstacles = map.explorationLayout.obstacles.filter(inBounds(cols, rows));
        if (Array.isArray(map.explorationLayout.safeZones)) {
            map.explorationLayout.safeZones = map.explorationLayout.safeZones.filter(inBounds(cols, rows));
        }
        if (map.explorationLayout.startPoint && !inBounds(cols, rows)(map.explorationLayout.startPoint)) {
            map.explorationLayout.startPoint = { id: 'explore-start', name: '探索起点', col: 0, row: Math.floor(rows / 2) };
        }
        if (map.explorationLayout.exitPoint && !inBounds(cols, rows)(map.explorationLayout.exitPoint)) {
            map.explorationLayout.exitPoint = { id: 'explore-exit', name: '探索终点', col: Math.max(0, cols - 4), row: Math.floor(rows / 2) };
        }
    }
    map.enemyExits = map.spawnPoints;
}

export function normalizeMap(map, seed) {
    var source = map && typeof map === 'object' ? map : {};
    var legacyTd = seed.modeProfiles && seed.modeProfiles.towerDefense || {};
    var legacyExplore = seed.modeProfiles && seed.modeProfiles.exploration || {};
    var normalized = createDefaultMap();
    if (source.grid) {
        normalized.grid.cols = clamp(Number(source.grid.cols) || DEFAULT_GRID_COLS, 8, 80);
        normalized.grid.rows = clamp(Number(source.grid.rows) || DEFAULT_GRID_ROWS, 8, 80);
        normalized.grid.tileSize = clamp(Number(source.grid.tileSize) || DEFAULT_TILE_SIZE, 1, 10);
    }
    var geoFromMap = normalizeGeoConfig(source.geo);
    var mapGeoUsable =
        geoFromMap.enabled &&
        Number.isFinite(geoFromMap.center.lat) &&
        Number.isFinite(geoFromMap.center.lon) &&
        !(geoFromMap.center.lat === 0 && geoFromMap.center.lon === 0);
    var rawLocGeo = seed && seed.location && seed.location.geo;
    if (!mapGeoUsable && rawLocGeo && typeof rawLocGeo === 'object') {
        normalized.geo = normalizeGeoConfig(rawLocGeo);
    } else {
        normalized.geo = geoFromMap;
    }
    normalized.theme = normalizeTheme(source.theme);
    normalized.terrain = Array.isArray(source.terrain) ? source.terrain.map(normalizeCell) : [];
    normalized.roads = normalizeCells(source.roads || source.path || []);
    normalized.obstacles = normalizeCells(source.obstacles || []);
    normalized.buildSlots = normalizeCells(source.buildSlots || []);
    normalized.enemyPaths = normalizeEnemyPaths(source.enemyPaths, normalized.roads);
    normalized.spawnPoints = normalizeSpawnPoints(source.spawnPoints || source.enemyExits || [], legacyTd);
    normalized.enemyExits = normalized.spawnPoints;
    normalized.objectivePoint = normalizePoint(source.objectivePoint) || defaultObjectivePoint(normalized.grid, legacyTd);
    normalized.explorationPoints = normalizeExplorePoints(source.explorationPoints, legacyExplore);
    normalized.exploreBosses = normalizeExploreBosses(source.exploreBosses);
    normalized.exploreSpawners = normalizeExploreSpawners(source.exploreSpawners);
    normalized.explorePickups = normalizeExplorePickups(source.explorePickups);
    normalized.explorationLayout = normalizeExplorationLayout(source.explorationLayout, normalized);
    normalized.actors = normalizeActors(source.actors, seed);
    normalized.boardImageLayers = normalizeBoardImageLayers(source.boardImageLayers);
    normalized.levelAudio = normalizeLevelAudioSource(source.levelAudio);
    normalized.cutscenes = normalizeCutscenes(source.cutscenes);
    trimMapToBounds(normalized);
    return normalized;
}

export function normalizeLevel(level) {
    var source = level && typeof level === 'object' ? level : {};
    var location = normalizeLocation(source);
    var map = normalizeMap(source.map, source);
    var normalized = {
        id: String(source.id || source.code || uid('level')),
        folder: String(source.folder || source.id || source.code || 'custom-level'),
        name: String(source.name || '未命名关卡'),
        status: normalizeStatus(source.status, map),
        difficulty: clamp(Number(source.difficulty) || 3, 1, 5),
        description: String(source.description || source.desc || ''),
        location: location,
        environment: normalizeEnvironment(source.environment),
        map: map,
        actorTemplates: Array.isArray(source.actorTemplates) ? source.actorTemplates.map(normalizeActorTemplate) : undefined,
        enemyTypes: normalizeEnemyTypes(source.enemyTypes, source),
        waveRules: normalizeWaveRules(source.waveRules, source),
        modeProfiles: normalizeModeProfiles(source.modeProfiles),
        rosters: source.rosters && typeof source.rosters === 'object' ? source.rosters : {},
        props: Array.isArray(source.props) ? source.props : [],
        resources: Array.isArray(source.resources) ? source.resources : [],
        uiModules: Array.isArray(source.uiModules) ? source.uiModules : [],
        extensions: source.extensions && typeof source.extensions === 'object' ? source.extensions : {}
    };
    maybePromoteLegacyBoardImage(normalized, normalized.map);
    upgradeDesignedTowerDefenseLevel(normalized);
    normalized.location.regionLabel = normalized.location.regionLabel || buildRegionLabel(normalized.location, source.region);
    return normalized;
}

/** Sort levels array inside a state-like object (in-place). Requires explicit target. */
export function sortLevels(targetState) {
    if (!targetState || !Array.isArray(targetState.levels)) return;
    targetState.levels.sort(function (left, right) {
        var a = (left.location.countryName + left.location.cityName + left.name).toLowerCase();
        var b = (right.location.countryName + right.location.cityName + right.name).toLowerCase();
        return a.localeCompare(b, 'zh-Hans-CN');
    });
}

export function normalizeState(raw) {
    var next = raw && typeof raw === 'object' ? raw : {};
    next.version = ENGINE_VERSION;
    next.savedAt = String(next.savedAt || '');
    next.catalog = normalizeCatalog(next.catalog);
    next.editorAssetsCatalog = normalizeEditorAssetsCatalog(next.editorAssetsCatalog);
    next.cityGameplayConfigs = normalizeCityGameplayConfigs(next.cityGameplayConfigs);
    next.gameAssetConfig = normalizeGameAssetConfig(next.gameAssetConfig);
    next.actorTemplates = Array.isArray(next.actorTemplates) && next.actorTemplates.length
        ? next.actorTemplates.map(normalizeActorTemplate)
        : clone(DEFAULT_ACTOR_TEMPLATES);
    next.levels = Array.isArray(next.levels) ? next.levels.map(normalizeLevel) : [];
    sortLevels(next);
    return next;
}
