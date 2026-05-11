import { toggleCell, uid, byId, removeCell, notAtCell, clamp } from './utils.js';
import { ensureExplorationLayout } from './layout-presets.js';

function togglePathCell(level, col, row) {
    if (!level.map.enemyPaths.length) {
        level.map.enemyPaths.push({ id: 'path-main', name: '主敌人路径', cells: [] });
    }
    toggleCell(level.map.enemyPaths[0].cells, col, row);
}

function cellKey(cell) {
    return String(cell.col) + ',' + String(cell.row);
}

function uniqueCells(cells, cols, rows) {
    var seen = {};
    var out = [];
    cells.forEach(function (cell) {
        var normalized = {
            col: clamp(Math.round(Number(cell.col) || 0), 0, cols - 1),
            row: clamp(Math.round(Number(cell.row) || 0), 0, rows - 1)
        };
        var key = cellKey(normalized);
        if (seen[key]) return;
        seen[key] = true;
        out.push(normalized);
    });
    return out;
}

function expandPathVertices(vertices, cols, rows) {
    var out = [];
    for (var i = 0; i < vertices.length - 1; i += 1) {
        var current = {
            col: clamp(Math.round(Number(vertices[i].col) || 0), 0, cols - 1),
            row: clamp(Math.round(Number(vertices[i].row) || 0), 0, rows - 1)
        };
        var end = {
            col: clamp(Math.round(Number(vertices[i + 1].col) || 0), 0, cols - 1),
            row: clamp(Math.round(Number(vertices[i + 1].row) || 0), 0, rows - 1)
        };
        out.push({ col: current.col, row: current.row });
        while (current.col !== end.col) {
            current = { col: current.col + Math.sign(end.col - current.col), row: current.row };
            out.push({ col: current.col, row: current.row });
        }
        while (current.row !== end.row) {
            current = { col: current.col, row: current.row + Math.sign(end.row - current.row) };
            out.push({ col: current.col, row: current.row });
        }
    }
    return uniqueCells(out, cols, rows);
}

function buildAutoPathForSpawn(level, spawn) {
    var grid = level.map.grid || {};
    var cols = Math.max(8, Number(grid.cols) || 28);
    var rows = Math.max(8, Number(grid.rows) || 18);
    var objective = level.map.objectivePoint || { col: cols - 2, row: Math.floor(rows / 2) };
    var mergeCol = clamp(Math.floor(cols * 0.48), 1, cols - 3);
    var mergeRow = clamp(Number(objective.row) || Math.floor(rows / 2), 0, rows - 1);
    var vertices = [
        spawn,
        { col: mergeCol, row: spawn.row },
        { col: mergeCol, row: mergeRow },
        objective
    ];
    return expandPathVertices(vertices, cols, rows);
}

function rebuildAutoDefensePaths(level) {
    if (!level || !level.map || !Array.isArray(level.map.spawnPoints)) return;
    if (!Array.isArray(level.map.enemyPaths)) level.map.enemyPaths = [];
    level.map.spawnPoints.forEach(function (spawn, index) {
        if (!spawn.pathId) spawn.pathId = 'path-' + (index + 1);
        var path = level.map.enemyPaths.find(function (item) { return item.id === spawn.pathId; });
        if (!path) {
            path = { id: spawn.pathId, name: '敌人路径 ' + (index + 1), cells: [] };
            level.map.enemyPaths.push(path);
        }
        path.cells = buildAutoPathForSpawn(level, spawn);
    });
    var roadsByKey = {};
    level.map.roads = [];
    level.map.enemyPaths.forEach(function (path) {
        (path.cells || []).forEach(function (cell) {
            var key = cellKey(cell);
            if (roadsByKey[key]) return;
            roadsByKey[key] = true;
            level.map.roads.push({ col: cell.col, row: cell.row });
        });
    });
}

function addSpawnPoint(env, col, row) {
    var level = env.getLevel();
    if (!Array.isArray(level.map.spawnPoints)) level.map.spawnPoints = [];
    var existing = level.map.spawnPoints.find(function (point) {
        return point.col === col && point.row === row;
    });
    if (existing) {
        env.selectObject('spawn', existing.id);
        return;
    }
    var id = uid('spawn');
    var enemies = env.getAvailableEnemyTypes(level);
    var enemy = enemies[level.map.spawnPoints.length % Math.max(1, enemies.length)] || { id: 'basic' };
    var pathId = 'path-' + (level.map.spawnPoints.length + 1);
    var waveNumber = level.map.spawnPoints.length + 1;
    level.map.spawnPoints.push({
        id: id,
        name: '敌人出口 ' + (level.map.spawnPoints.length + 1),
        col: col,
        row: row,
        pathId: pathId,
        enemyTypeId: enemy.id,
        waveNumber: waveNumber,
        waveNumbers: [waveNumber],
        count: 12,
        interval: 1.2
    });
    rebuildAutoDefensePaths(level);
    env.setSelectedObject({ kind: 'spawn', id: id });
}

function setObjectivePoint(env, col, row) {
    var level = env.getLevel();
    level.map.objectivePoint = {
        id: (level.map.objectivePoint && level.map.objectivePoint.id) || 'objective-main',
        name: '防守核心',
        col: col,
        row: row
    };
    rebuildAutoDefensePaths(level);
    env.setSelectedObject({ kind: 'objective', id: level.map.objectivePoint.id });
}

function setExploreStartPoint(env, col, row) {
    var level = env.getLevel();
    var layout = ensureExplorationLayout(level.map);
    layout.startPoint = {
        id: (layout.startPoint && layout.startPoint.id) || 'explore-start',
        name: '探索起点',
        col: col,
        row: row
    };
    env.setSelectedObject({ kind: 'spawn', id: layout.startPoint.id });
}

function setExploreExitPoint(env, col, row) {
    var level = env.getLevel();
    var layout = ensureExplorationLayout(level.map);
    layout.exitPoint = {
        id: (layout.exitPoint && layout.exitPoint.id) || 'explore-exit',
        name: '探索终点',
        col: col,
        row: row
    };
    env.setSelectedObject({ kind: 'objective', id: layout.exitPoint.id });
}

function addExplorePoint(env, col, row) {
    var level = env.getLevel();
    var id = uid('poi');
    level.map.explorationPoints.push({
        id: id,
        name: '探索点 ' + (level.map.explorationPoints.length + 1),
        col: col,
        row: row,
        modelId: '',
        interaction: 'inspect',
        radius: 2
    });
    env.setSelectedObject({ kind: 'explorePoint', id: id });
}

function addExploreBoss(env, col, row) {
    var level = env.getLevel();
    if (!Array.isArray(level.map.exploreBosses)) level.map.exploreBosses = [];
    var id = uid('boss');
    var bossIds = ['ai-atlas', 'ai-vulcan', 'ai-prism', 'ai-gridmind', 'ai-echo'];
    var names = ['重构者 Atlas', '熔核调度员 Vulcan', '棱镜审计官 Prism', '雷网中枢 Gridmind', '回声协议 Echo'];
    var elements = ['force', 'thermal', 'light', 'electric', 'sound'];
    var idx = level.map.exploreBosses.length % bossIds.length;
    level.map.exploreBosses.push({
        id: id,
        bossId: bossIds[idx],
        name: names[idx],
        col: col,
        row: row,
        modelId: '',
        modelPath: '',
        modelScale: 1.8,
        element: elements[idx],
        level: 1,
        triggerRadius: 9,
        respawn: false,
        overrideStats: { maxHp: 0, attack: 0, defense: 0, speed: 0, rewardMoney: 0, rewardXp: 0 }
    });
    env.setSelectedObject({ kind: 'exploreBoss', id: id });
}

function addExploreSpawner(env, col, row) {
    var level = env.getLevel();
    if (!Array.isArray(level.map.exploreSpawners)) level.map.exploreSpawners = [];
    var id = uid('spawner');
    level.map.exploreSpawners.push({
        id: id,
        name: 'AI 刷怪点 ' + (level.map.exploreSpawners.length + 1),
        col: col,
        row: row,
        enemyTypeId: 'ai-drone',
        element: 'electric',
        modelId: '',
        modelPath: '',
        modelScale: 1,
        maxConcurrent: 3,
        spawnIntervalSec: 6,
        spawnCount: 1,
        triggerRadius: 12,
        activeRadius: 18,
        totalLimit: 0,
        disableWhenBossDefeated: false,
        rewards: [{ money: 12, xp: 10, itemName: '', itemIcon: 'AI', quantity: 1 }]
    });
    env.setSelectedObject({ kind: 'exploreSpawner', id: id });
}

function addExplorePickup(env, col, row, type) {
    var level = env.getLevel();
    if (!Array.isArray(level.map.explorePickups)) level.map.explorePickups = [];
    var id = uid('pickup');
    var isItem = type === 'item';
    level.map.explorePickups.push({
        id: id,
        type: isItem ? 'item' : 'money',
        name: isItem ? 'AI 记忆碎片' : '城市算力资金',
        col: col,
        row: row,
        moneyAmount: isItem ? 0 : 50,
        itemId: '',
        itemName: isItem ? 'AI 记忆碎片' : '',
        itemType: 'material',
        itemIcon: isItem ? 'AI' : '$',
        quantity: 1,
        modelId: '',
        modelPath: '',
        modelScale: 1,
        collectRadius: 1.25
    });
    env.setSelectedObject({ kind: 'explorePickup', id: id });
}

export function handleCellAction(env, col, row) {
    var level = env.getLevel();
    if (!level) return;
    if (env.getActiveTool() === 'boardImage') return;
    if (env.getActiveTool() === 'select') {
        env.setSelectedObject(null);
        env.renderSelectionInspector();
        env.renderMap();
        return;
    }
    if (env.getActiveEditorMode() === 'explore') {
        var exploreLayout = ensureExplorationLayout(level.map);
        if (env.getActiveTool() === 'road' || env.getActiveTool() === 'path') toggleCell(exploreLayout.path, col, row);
        if (env.getActiveTool() === 'obstacle') toggleCell(exploreLayout.obstacles, col, row);
        if (env.getActiveTool() === 'spawn') setExploreStartPoint(env, col, row);
        if (env.getActiveTool() === 'objective') setExploreExitPoint(env, col, row);
        if (env.getActiveTool() === 'buildSlot') addExplorePoint(env, col, row);
        if (env.getActiveTool() === 'exploreBoss') addExploreBoss(env, col, row);
        if (env.getActiveTool() === 'exploreSpawner') addExploreSpawner(env, col, row);
        if (env.getActiveTool() === 'exploreMoney') addExplorePickup(env, col, row, 'money');
        if (env.getActiveTool() === 'exploreItem') addExplorePickup(env, col, row, 'item');
        if (env.getActiveTool() === 'safeZone') {
            if (!Array.isArray(exploreLayout.safeZones)) exploreLayout.safeZones = [];
            toggleCell(exploreLayout.safeZones, col, row);
        }
    } else {
        if (env.getActiveTool() === 'road') toggleCell(level.map.roads, col, row);
        if (env.getActiveTool() === 'obstacle') toggleCell(level.map.obstacles, col, row);
        if (env.getActiveTool() === 'path') togglePathCell(level, col, row);
        if (env.getActiveTool() === 'buildSlot') toggleCell(level.map.buildSlots, col, row);
        if (env.getActiveTool() === 'spawn') addSpawnPoint(env, col, row);
        if (env.getActiveTool() === 'objective') setObjectivePoint(env, col, row);
    }
    if (env.getActiveTool() === 'explorePoint') addExplorePoint(env, col, row);
    if (env.getActiveTool() === 'actor') env.placeActorFromCatalogModel(env.getSelectedActorPlacementModelId(), col, row);
    if (env.getActiveTool() === 'erase') env.applyEraserBrush(col, row);
    level.status = level.status === 'draft' ? 'needs-work' : level.status;
    env.markDirty('已更新地图');
    env.renderAll();
    env.schedulePreviewRefresh();
}

export function moveActor(env, actorId, col, row) {
    var level = env.getLevel();
    var actor = level.map.actors.find(function (item) {
        return item.id === actorId;
    });
    if (!actor) return;
    actor.col = col;
    actor.row = row;
    env.setSelectedObject({ kind: 'actor', id: actor.id });
    env.markDirty('已移动 Actor');
    env.renderAll();
}

export function moveMarker(env, kind, id, col, row) {
    var level = env.getLevel();
    var item = null;
    var layout = ensureExplorationLayout(level.map);
    if (kind === 'spawn') item = env.getActiveEditorMode() === 'explore' ? layout.startPoint : level.map.spawnPoints.find(byId(id));
    if (kind === 'explorePoint') item = level.map.explorationPoints.find(byId(id));
    if (kind === 'exploreBoss') item = Array.isArray(level.map.exploreBosses) ? level.map.exploreBosses.find(byId(id)) : null;
    if (kind === 'exploreSpawner') item = Array.isArray(level.map.exploreSpawners) ? level.map.exploreSpawners.find(byId(id)) : null;
    if (kind === 'explorePickup') item = Array.isArray(level.map.explorePickups) ? level.map.explorePickups.find(byId(id)) : null;
    if (kind === 'objective') {
        item = env.getActiveEditorMode() === 'explore'
            ? layout.exitPoint
            : level.map.objectivePoint && level.map.objectivePoint.id === id
                ? level.map.objectivePoint
                : null;
    }
    if (!item) return;
    item.col = col;
    item.row = row;
    if (env.getActiveEditorMode() !== 'explore' && (kind === 'spawn' || kind === 'objective')) {
        rebuildAutoDefensePaths(level);
    }
    env.setSelectedObject({ kind: kind, id: id });
    env.markDirty('已移动地图标记');
    env.renderAll();
}

export function eraseCellAt(env, col, row) {
    var level = env.getLevel();
    if (!level) return;
    var layout = ensureExplorationLayout(level.map);
    var c = Number(col);
    var r = Number(row);
    removeCell(layout.path, c, r);
    removeCell(layout.obstacles, c, r);
    if (Array.isArray(layout.safeZones)) removeCell(layout.safeZones, c, r);
    if (layout.startPoint && Number(layout.startPoint.col) === c && Number(layout.startPoint.row) === r) layout.startPoint = null;
    if (layout.exitPoint && Number(layout.exitPoint.col) === c && Number(layout.exitPoint.row) === r) layout.exitPoint = null;

    removeCell(level.map.roads, c, r);
    removeCell(level.map.obstacles, c, r);
    removeCell(level.map.buildSlots, c, r);
    if (!Array.isArray(level.map.enemyPaths)) level.map.enemyPaths = [];
    level.map.enemyPaths.forEach(function (path) {
        removeCell(path.cells, c, r);
    });
    level.map.spawnPoints = level.map.spawnPoints.filter(notAtCell(c, r));
    if (level.map.objectivePoint && Number(level.map.objectivePoint.col) === c && Number(level.map.objectivePoint.row) === r) {
        level.map.objectivePoint = null;
    }

    level.map.explorationPoints = level.map.explorationPoints.filter(notAtCell(c, r));
    level.map.actors = level.map.actors.filter(notAtCell(c, r));
    if (Array.isArray(level.map.exploreBosses)) level.map.exploreBosses = level.map.exploreBosses.filter(notAtCell(c, r));
    if (Array.isArray(level.map.exploreSpawners)) level.map.exploreSpawners = level.map.exploreSpawners.filter(notAtCell(c, r));
    if (Array.isArray(level.map.explorePickups)) level.map.explorePickups = level.map.explorePickups.filter(notAtCell(c, r));
    if (Array.isArray(level.map.terrain)) removeCell(level.map.terrain, c, r);
}

export function selectGridCellObject(env, kind, col, row) {
    env.setSelectedObject({ kind: kind, col: col, row: row });
    env.renderSelectionInspector();
    env.renderMap();
    if (env.isPreviewViewport() && env.previewApiHasSelection()) {
        env.setPreviewSelectedActor(null);
    }
    env.renderPreviewSceneOutline();
}

export function mapGridPickCellFromClientPoint(refs, clientX, clientY, grid) {
    if (!refs.mapGrid || !grid) return null;
    var el = refs.mapGrid;
    var rect = el.getBoundingClientRect();
    var style = getComputedStyle(el);
    var padL = parseFloat(style.paddingLeft) || 0;
    var padT = parseFloat(style.paddingTop) || 0;
    var cols = grid.cols;
    var rows = grid.rows;
    var cellSizeStr = el.style.getPropertyValue('--cell-size') || getComputedStyle(el).getPropertyValue('--cell-size');
    var cellSize = parseFloat(cellSizeStr) || 28;
    var gap = parseFloat(style.rowGap || style.columnGap || style.gap) || 1;
    var stride = cellSize + gap;
    var x = clientX - rect.left - padL;
    var y = clientY - rect.top - padT;
    var col = Math.floor(x / stride);
    var row = Math.floor(y / stride);
    var ox = x - col * stride;
    var oy = y - row * stride;
    if (ox > cellSize || oy > cellSize) return null;
    if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
    var wrap = document.createElement('div');
    wrap.setAttribute('data-col', String(col));
    wrap.setAttribute('data-row', String(row));
    return wrap;
}