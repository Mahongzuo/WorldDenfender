import { JINAN_MAP_TEXTURE_URL } from './city-geo-configs.js';
import { clamp, escapeAttr, hasCell, atCell } from './utils.js';
import { markerHtml } from './html-builders.js';
import { getDefenseEditorPathKeys } from './path-utils.js';
import { ensureExplorationLayout } from './layout-presets.js';
import { isJinanLevel } from './display-utils.js';

function boardSpriteLayersHtml(env, level) {
    var raw = Array.isArray(level.map.boardImageLayers) ? level.map.boardImageLayers : [];
    if (!raw.length) return '';
    var selectedObject = env.getSelectedObject();
    var list = raw
        .slice()
        .sort(function (a, b) {
            return (Number(a.order) || 0) - (Number(b.order) || 0);
        });
    return list
        .map(function (layer) {
            var stretchFill = Number(layer.widthPct) >= 100;
            var selected =
                selectedObject &&
                selectedObject.kind === 'boardImage' &&
                selectedObject.id === layer.id
                    ? ' map-board-image-sprite--selected'
                    : '';
            var stretchCls = stretchFill ? ' map-board-image-sprite--stretch-fill' : '';
            var opacity = Number(layer.opacity);
            if (!Number.isFinite(opacity)) opacity = 1;
            opacity = clamp(opacity, 0, 1);
            var zIndex = Math.round(20 + Number(layer.order || 0));
            var style = stretchFill
                ? 'left:0;top:0;width:100%;height:100%;opacity:' +
                  escapeAttr(String(opacity)) +
                  ';z-index:' +
                  escapeAttr(String(zIndex))
                : 'left:' +
                  escapeAttr(String(layer.centerX)) +
                  '%;top:' +
                  escapeAttr(String(layer.centerY)) +
                  '%;width:' +
                  escapeAttr(String(layer.widthPct)) +
                  '%;opacity:' +
                  escapeAttr(String(opacity)) +
                  ';z-index:' +
                  escapeAttr(String(zIndex));
            var handlesHtml = selected
                ? '<div class="bil-handles" aria-hidden="true">' +
                  ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se']
                      .map(function (handleKey) {
                          return (
                              '<button type="button" class="bil-handle bil-handle--' +
                              handleKey +
                              '" data-board-resize="' +
                              handleKey +
                              '" tabindex="-1" aria-label="缩放 ' +
                              handleKey +
                              '"></button>'
                          );
                      })
                      .join('') +
                  '</div>'
                : '';
            return (
                '<div class="map-board-image-sprite' +
                selected +
                stretchCls +
                '" draggable="false" tabindex="-1" data-board-image-id="' +
                escapeAttr(layer.id) +
                '" style="' +
                style +
                '">' +
                handlesHtml +
                '<div class="bil-img-wrap"><img alt="" draggable="false" loading="lazy" src="' +
                escapeAttr(layer.src) +
                '"></div></div>'
            );
        })
        .join('');
}

function boardCellMatchesSelection(env, level, col, row) {
    var selectedObject = env.getSelectedObject();
    if (!selectedObject) return false;
    var kind = selectedObject.kind;
    if (kind === 'obstacleCell' || kind === 'pathCell' || kind === 'buildSlotCell' || kind === 'safeZoneCell') {
        return Number(selectedObject.col) === col && Number(selectedObject.row) === row;
    }
    var selected = env.findSelectedObject(level);
    if (selected && selected.item != null && Number(selected.item.col) === col && Number(selected.item.row) === row) return true;
    return false;
}

function buildPlateCellClasses(env, level, col, row) {
    var classes = ['map-cell'];
    var exploreLayout = ensureExplorationLayout(level.map);
    if (env.getActiveEditorMode() === 'explore') {
        if (hasCell(exploreLayout.obstacles, col, row)) classes.push('obstacle');
        if (Array.isArray(exploreLayout.safeZones) && hasCell(exploreLayout.safeZones, col, row)) classes.push('safe-zone');
    } else {
        if (hasCell(level.map.obstacles, col, row)) classes.push('obstacle');
        if (hasCell(level.map.buildSlots, col, row)) classes.push('build-slot');
    }
    if (boardCellMatchesSelection(env, level, col, row)) classes.push('map-cell--lcb-selected');
    return classes;
}

function buildCellMarkersFragments(env, level, col, row) {
    var exploreLayout = ensureExplorationLayout(level.map);
    var markers = [];
    var selectedObject = env.getSelectedObject();
    if (env.getActiveEditorMode() === 'explore') {
        if (exploreLayout.startPoint && exploreLayout.startPoint.col === col && exploreLayout.startPoint.row === row) {
            markers.push(markerHtml('spawn', exploreLayout.startPoint.id, 'S', 'cell-marker spawn', selectedObject));
        }
        if (exploreLayout.exitPoint && exploreLayout.exitPoint.col === col && exploreLayout.exitPoint.row === row) {
            markers.push(markerHtml('objective', exploreLayout.exitPoint.id, 'E', 'cell-marker objective', selectedObject));
        }
    } else {
        level.map.spawnPoints.filter(atCell(col, row)).forEach(function (point) {
            markers.push(markerHtml('spawn', point.id, 'S', 'cell-marker spawn', selectedObject));
        });
        if (level.map.objectivePoint && level.map.objectivePoint.col === col && level.map.objectivePoint.row === row) {
            markers.push(markerHtml('objective', level.map.objectivePoint.id, 'O', 'cell-marker objective', selectedObject));
        }
    }
    level.map.explorationPoints.filter(atCell(col, row)).forEach(function (point) {
        markers.push(markerHtml('explorePoint', point.id, 'P', 'cell-marker explore', selectedObject));
    });
    (level.map.exploreBosses || []).filter(atCell(col, row)).forEach(function (boss) {
        markers.push(markerHtml('exploreBoss', boss.id, 'AI', 'cell-marker objective', selectedObject));
    });
    (level.map.exploreSpawners || []).filter(atCell(col, row)).forEach(function (spawner) {
        markers.push(markerHtml('exploreSpawner', spawner.id, 'SP', 'cell-marker spawn', selectedObject));
    });
    (level.map.explorePickups || []).filter(atCell(col, row)).forEach(function (pickup) {
        markers.push(markerHtml('explorePickup', pickup.id, pickup.type === 'item' ? 'I' : '$', 'cell-marker explore', selectedObject));
    });
    level.map.actors.filter(atCell(col, row)).forEach(function (actor) {
        markers.push(markerHtml('actor', actor.id, actor.icon || actor.name.charAt(0), 'actor-marker ' + actor.category, selectedObject));
    });
    return markers;
}

function renderPlateCell(env, level, col, row) {
    var classes = buildPlateCellClasses(env, level, col, row);
    return '<div class="' + classes.join(' ') + '" data-col="' + col + '" data-row="' + row + '"></div>';
}

function renderPathOverlayCell(env, level, col, row, defensePathKeys) {
    var exploreLayout = ensureExplorationLayout(level.map);
    var isPath = false;
    if (env.getActiveEditorMode() === 'explore') {
        if (hasCell(exploreLayout.path, col, row)) isPath = true;
    } else if (!hasCell(level.map.obstacles, col, row) && defensePathKeys && defensePathKeys.has(String(col) + ',' + String(row))) {
        isPath = true;
    }
    var classes = ['map-cell', 'map-cell--path-overlay'];
    if (isPath) classes.push('path');
    return '<div class="' + classes.join(' ') + '" data-col="' + col + '" data-row="' + row + '"></div>';
}

function renderMarkersOverlayCell(env, level, col, row) {
    var markers = buildCellMarkersFragments(env, level, col, row);
    return '<div class="map-cell map-cell--markers-overlay" data-col="' + col + '" data-row="' + row + '">' + markers.join('') + '</div>';
}

function bindMarkerDrag(refs) {
    if (!refs.mapGrid) return;
    var bucket = refs.mapGrid.querySelector('.map-grid-cells--markers');
    var root = bucket || refs.mapGrid;
    root.querySelectorAll('[data-object-kind]').forEach(function (marker) {
        marker.addEventListener('dragstart', function (event) {
            event.dataTransfer.setData('application/json', JSON.stringify({
                kind: marker.dataset.objectKind === 'actor' ? 'actor' : 'marker',
                markerKind: marker.dataset.objectKind,
                id: marker.dataset.objectId
            }));
        });
    });
}

export function renderMap(refs, env) {
    var level = env.getLevel();
    if (!level) {
        refs.mapGrid.innerHTML = '';
        refs.mapGrid.classList.remove('map-grid--jinan-texture');
        env.resetEraserPreviewAfterMapRebuild(refs);
        return;
    }
    var grid = level.map.grid;
    var cellSize = clamp(Math.floor(720 / Math.max(grid.cols, grid.rows)), 16, 34);
    refs.mapGrid.style.setProperty('--cell-size', cellSize + 'px');
    refs.mapGrid.style.setProperty('--grid-texture-width', (grid.cols * cellSize + Math.max(0, grid.cols - 1)) + 'px');
    refs.mapGrid.style.setProperty('--grid-texture-height', (grid.rows * cellSize + Math.max(0, grid.rows - 1)) + 'px');
    refs.mapGrid.style.setProperty('--jinan-map-texture', 'url("' + JINAN_MAP_TEXTURE_URL + '")');
    refs.mapGrid.style.gridTemplateColumns = '';
    refs.mapGrid.style.gridTemplateRows = '';
    refs.mapGrid.classList.toggle('map-grid--jinan-texture', isJinanLevel(level));

    var floorHtml = [];
    var pathOverlayHtml = [];
    var markersHtml = [];
    var defensePathKeys = env.getActiveEditorMode() === 'defense' ? getDefenseEditorPathKeys(level) : null;
    for (var row = 0; row < grid.rows; row += 1) {
        for (var col = 0; col < grid.cols; col += 1) {
            floorHtml.push(renderPlateCell(env, level, col, row));
            pathOverlayHtml.push(renderPathOverlayCell(env, level, col, row, defensePathKeys));
            markersHtml.push(renderMarkersOverlayCell(env, level, col, row));
        }
    }
    refs.mapGrid.innerHTML =
        '<div class="map-grid-stack">' +
        '<div class="map-grid-cells map-grid-cells--floor">' +
        floorHtml.join('') +
        '</div>' +
        '<div class="map-board-overlays-mount" aria-hidden="true">' +
        boardSpriteLayersHtml(env, level) +
        '</div>' +
        '<div class="map-grid-cells map-grid-cells--path-overlay">' +
        pathOverlayHtml.join('') +
        '</div>' +
        '<div class="map-grid-cells map-grid-cells--markers">' +
        markersHtml.join('') +
        '</div>' +
        '</div>';
    refs.mapGrid
        .querySelectorAll('.map-grid-cells--floor, .map-grid-cells--path-overlay, .map-grid-cells--markers')
        .forEach(function (bucket) {
            bucket.style.display = 'grid';
            bucket.style.gap = '1px';
            bucket.style.gridTemplateColumns = 'repeat(' + grid.cols + ', var(--cell-size))';
            bucket.style.gridTemplateRows = 'repeat(' + grid.rows + ', var(--cell-size))';
        });
    bindMarkerDrag(refs);
    env.refreshEraserPreviewIfActive(refs);
}