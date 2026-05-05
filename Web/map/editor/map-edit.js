import { toggleCell, uid, byId, removeCell, notAtCell } from './utils.js';
import { ensureExplorationLayout } from './layout-presets.js';

function togglePathCell(level, col, row) {
    if (!level.map.enemyPaths.length) {
        level.map.enemyPaths.push({ id: 'path-main', name: '主敌人路径', cells: [] });
    }
    toggleCell(level.map.enemyPaths[0].cells, col, row);
}

function addSpawnPoint(env, col, row) {
    var level = env.getLevel();
    var existing = level.map.spawnPoints.find(function (point) {
        return point.col === col && point.row === row;
    });
    if (existing) {
        env.selectObject('spawn', existing.id);
        return;
    }
    var id = uid('spawn');
    level.map.spawnPoints.push({
        id: id,
        name: '敌人出口 ' + (level.map.spawnPoints.length + 1),
        col: col,
        row: row,
        pathId: 'path-main'
    });
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
    if (env.getActiveTool() === 'actor') env.placeActorFromTemplate(env.getSelectedTemplateId(), col, row);
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
    level.map.enemyPaths.forEach(function (path) {
        removeCell(path.cells, c, r);
    });
    level.map.spawnPoints = level.map.spawnPoints.filter(notAtCell(c, r));
    if (level.map.objectivePoint && Number(level.map.objectivePoint.col) === c && Number(level.map.objectivePoint.row) === r) {
        level.map.objectivePoint = null;
    }

    level.map.explorationPoints = level.map.explorationPoints.filter(notAtCell(c, r));
    level.map.actors = level.map.actors.filter(notAtCell(c, r));
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