/**
 * editor/board-images.js
 * 棋盘配图面板、拖放导入、拖拽/缩放交互。
 * 指针状态保存在本模块闭包内，避免与 level-editor.js 顶层 var 重复。
 */
import { TOOL_LABELS } from './content.js';
import { findBoardImageLayerById } from './html-builders.js';
import { moveBoardLayerOrder } from './level-mutators.js';
import { clampBoardAspect } from './path-utils.js';
import { clamp, escapeAttr, escapeHtml, uid } from './utils.js';

var pointerDrag = null;
var resizeState = null;

function boardGridPaintMetrics(mapGrid, grid) {
    if (!mapGrid || !grid) return null;
    var rect = mapGrid.getBoundingClientRect();
    var st = getComputedStyle(mapGrid);
    var padL = parseFloat(st.paddingLeft) || 0;
    var padT = parseFloat(st.paddingTop) || 0;
    var cols = grid.cols;
    var rows = grid.rows;
    var csStr =
        mapGrid.style.getPropertyValue('--cell-size') || getComputedStyle(mapGrid).getPropertyValue('--cell-size');
    var cs = parseFloat(csStr) || 28;
    var gap = parseFloat(st.rowGap || st.columnGap || st.gap) || 1;
    var stride = cs + gap;
    var innerW = cols * stride - gap;
    var innerH = rows * stride - gap;
    return { rect: rect, padL: padL, padT: padT, cs: cs, gap: gap, stride: stride, innerW: innerW, innerH: innerH, cols: cols, rows: rows };
}

function clientPointToBoardLayerPercents(mapGrid, clientX, clientY, grid) {
    var metrics = boardGridPaintMetrics(mapGrid, grid);
    if (!metrics || metrics.innerW <= 0 || metrics.innerH <= 0) return { lx: 0, ty: 0 };
    var x = clientX - metrics.rect.left - metrics.padL;
    var y = clientY - metrics.rect.top - metrics.padT;
    return {
        lx: Math.max(0, Math.min(100, (x / metrics.innerW) * 100)),
        ty: Math.max(0, Math.min(100, (y / metrics.innerH) * 100))
    };
}

export function clearBoardImageInteractionState() {
    pointerDrag = null;
    resizeState = null;
}

export function renderBoardImagesPanel(refs, env) {
    if (!refs.boardImagesPanel) return;
    var show = env.getActiveWorkbench() === 'level' && env.getViewportViewMode() === 'board';
    refs.boardImagesPanel.classList.toggle('view-hidden', !show);
    if (!show) return;
    var level = env.getLevel();
    if (!level) {
        refs.boardImagesPanel.innerHTML =
            '<p class="board-images-panel__title">棋盘配图</p>' +
            '<div class="board-images-panel__empty">请先选择关卡。</div>';
        return;
    }
    var layers = Array.isArray(level.map.boardImageLayers) ? level.map.boardImageLayers : [];
    if (!layers.length) {
        refs.boardImagesPanel.innerHTML =
            '<p class="board-images-panel__title">棋盘配图</p>' +
            '<div class="board-images-panel__empty">拖入 PNG / JPEG / WebP 等到棋盘添加图层。</div>';
        return;
    }
    var raw = layers.slice().sort(function (a, b) {
        return (Number(a.order) || 0) - (Number(b.order) || 0);
    });
    var selectedObject = env.getSelectedObject();
    var sid = selectedObject && selectedObject.kind === 'boardImage' ? selectedObject.id : '';
    var rows = raw
        .map(function (layer, idx) {
            var selCls = layer.id === sid ? ' board-images-layer-row--selected' : '';
            var thumb =
                '<img class="board-images-layer-thumb" alt="" draggable="false" src="' +
                escapeAttr(layer.src) +
                '">';
            return (
                '<div class="board-images-layer-row' +
                selCls +
                '" data-board-panel-id="' +
                escapeAttr(layer.id) +
                '" role="group">' +
                thumb +
                '<div class="board-images-layer-meta">' +
                '<strong>图层 ' +
                escapeHtml(String(idx + 1)) +
                '</strong>' +
                '<span>order ' +
                escapeHtml(String(layer.order != null ? layer.order : idx)) +
                ' · 位置 X' +
                escapeHtml(String(layer.centerX)) +
                '% Y' +
                escapeHtml(String(layer.centerY)) +
                '% · 宽度 ' +
                escapeHtml(String(layer.widthPct)) +
                '%</span>' +
                '<div class="board-images-layer-actions">' +
                '<button type="button" class="mini-button" data-board-panel-act="bil-up" data-board-panel-id="' +
                escapeAttr(layer.id) +
                '">上移</button>' +
                '<button type="button" class="mini-button" data-board-panel-act="bil-down" data-board-panel-id="' +
                escapeAttr(layer.id) +
                '">下移</button>' +
                '<button type="button" class="mini-button" data-board-panel-act="bil-del" data-board-panel-id="' +
                escapeAttr(layer.id) +
                '">删除</button>' +
                '</div></div></div>'
            );
        })
        .join('');
    refs.boardImagesPanel.innerHTML = '<p class="board-images-panel__title">棋盘配图</p>' + rows;
}

export function ensureBoardImagesPanelDelegated(refs, env) {
    if (!refs.boardImagesPanel || refs.boardImagesPanel.dataset.bilDelegated === '1') return;
    refs.boardImagesPanel.dataset.bilDelegated = '1';
    refs.boardImagesPanel.addEventListener('click', function (event) {
        var level = env.getLevel();
        var btn = event.target.closest('[data-board-panel-act]');
        var row = event.target.closest('.board-images-layer-row[data-board-panel-id]');
        if (btn && level && level.map.boardImageLayers) {
            var id = btn.getAttribute('data-board-panel-id') || '';
            var act = btn.getAttribute('data-board-panel-act') || '';
            if (act === 'bil-up') {
                moveBoardLayerOrder(level, id, -1);
                env.markDirty('已调整棋盘配图顺序');
                env.renderMap();
                env.schedulePreviewRefresh();
                renderBoardImagesPanel(refs, env);
                return;
            }
            if (act === 'bil-down') {
                moveBoardLayerOrder(level, id, 1);
                env.markDirty('已调整棋盘配图顺序');
                env.renderMap();
                env.schedulePreviewRefresh();
                renderBoardImagesPanel(refs, env);
                return;
            }
            if (act === 'bil-del') {
                var selectedObject = env.getSelectedObject();
                env.setSelectedObject(
                    selectedObject && selectedObject.kind === 'boardImage' && selectedObject.id === id ? null : selectedObject
                );
                clearBoardImageInteractionState();
                level.map.boardImageLayers = level.map.boardImageLayers.filter(function (layer) {
                    return layer.id !== id;
                });
                env.markDirty('已删除棋盘配图');
                env.renderSelectionInspector();
                env.renderMap();
                env.schedulePreviewRefresh();
                renderBoardImagesPanel(refs, env);
                return;
            }
        }
        if (row && !btn && level) {
            env.setSelectedObject({ kind: 'boardImage', id: row.getAttribute('data-board-panel-id') });
            env.renderSelectionInspector();
            env.renderMap();
            renderBoardImagesPanel(refs, env);
        }
    });
}

function readSpriteAspect(layer, spriteEl) {
    var aspect = Number(layer.aspect);
    if (Number.isFinite(aspect) && aspect > 0) return clampBoardAspect(aspect);
    var imageEl = spriteEl && spriteEl.querySelector ? spriteEl.querySelector('.bil-img-wrap img, img') : null;
    if (imageEl && imageEl.naturalWidth > 0) {
        var nextAspect = imageEl.naturalHeight / imageEl.naturalWidth;
        layer.aspect = clampBoardAspect(nextAspect);
        return layer.aspect;
    }
    return clampBoardAspect(0.75);
}

function toolAllowsBoardSpriteEdit(activeTool) {
    return activeTool === 'select' || activeTool === 'boardImage';
}

function applyBoardImageResizePointerMove(event, env) {
    var resize = resizeState;
    if (!resize) return;
    var level = env.getLevel();
    var layer = findBoardImageLayerById(level, resize.id);
    if (!layer || !level || !level.map.grid) return;
    var innerW = resize.innerW;
    var innerH = resize.innerH;
    var dx = event.clientX - resize.startX;
    var dy = event.clientY - resize.startY;
    var aspect = resize.aspect > 0 ? resize.aspect : 0.75;
    var startLayer = resize.startLayer;
    var left = ((Number(startLayer.centerX) || 0) / 100) * innerW;
    var top = ((Number(startLayer.centerY) || 0) / 100) * innerH;
    var widthPx = ((Number(startLayer.widthPct) || 40) / 100) * innerW;
    var heightPx = widthPx * aspect;
    var minWidthPx = (5 / 100) * innerW;
    var maxWidthPx = (500 / 100) * innerW;
    var handle = resize.handle;

    if (handle === 'e') {
        var nextWidthE = clamp(widthPx + dx, minWidthPx, maxWidthPx);
        layer.centerX = Number(startLayer.centerX) || 0;
        layer.centerY = Number(startLayer.centerY) || 0;
        layer.widthPct = (nextWidthE / innerW) * 100;
    } else if (handle === 'w') {
        var right = left + widthPx;
        var nextLeft = left + dx;
        var nextWidthW = clamp(right - nextLeft, minWidthPx, maxWidthPx);
        nextLeft = right - nextWidthW;
        layer.centerX = clamp((nextLeft / innerW) * 100, 0, 100);
        layer.centerY = Number(startLayer.centerY) || 0;
        layer.widthPct = (nextWidthW / innerW) * 100;
    } else if (handle === 's') {
        var nextBottom = top + heightPx + dy;
        var nextHeightS = Math.max(minWidthPx * aspect, nextBottom - top);
        var nextWidthS = clamp(nextHeightS / aspect, minWidthPx, maxWidthPx);
        layer.centerX = Number(startLayer.centerX) || 0;
        layer.centerY = Number(startLayer.centerY) || 0;
        layer.widthPct = (nextWidthS / innerW) * 100;
    } else if (handle === 'n') {
        var bottom = top + heightPx;
        var nextTop = top + dy;
        var nextHeightN = Math.max(minWidthPx * aspect, bottom - nextTop);
        var nextWidthN = clamp(nextHeightN / aspect, minWidthPx, maxWidthPx);
        nextHeightN = nextWidthN * aspect;
        nextTop = bottom - nextHeightN;
        layer.centerX = Number(startLayer.centerX) || 0;
        layer.centerY = clamp((nextTop / innerH) * 100, 0, 100);
        layer.widthPct = (nextWidthN / innerW) * 100;
    } else if (handle === 'se') {
        var scaleSe = Math.min((widthPx + dx) / widthPx, (heightPx + dy) / heightPx);
        scaleSe = Math.max(minWidthPx / widthPx, Math.min(maxWidthPx / widthPx, scaleSe));
        layer.centerX = Number(startLayer.centerX) || 0;
        layer.centerY = Number(startLayer.centerY) || 0;
        layer.widthPct = startLayer.widthPct * scaleSe;
    } else if (handle === 'nw') {
        var scaleNw = Math.min((left + widthPx - (left + dx)) / widthPx, (top + heightPx - (top + dy)) / heightPx);
        scaleNw = Math.max(minWidthPx / widthPx, Math.min(maxWidthPx / widthPx, scaleNw));
        var nextLeftNw = left + widthPx - widthPx * scaleNw;
        var nextTopNw = top + heightPx - heightPx * scaleNw;
        layer.centerX = clamp((nextLeftNw / innerW) * 100, 0, 100);
        layer.centerY = clamp((nextTopNw / innerH) * 100, 0, 100);
        layer.widthPct = startLayer.widthPct * scaleNw;
    } else if (handle === 'ne') {
        var fixedBottom = top + heightPx;
        var scaleNe = Math.min((widthPx + dx) / widthPx, (fixedBottom - (top + dy)) / heightPx);
        scaleNe = Math.max(minWidthPx / widthPx, Math.min(maxWidthPx / widthPx, scaleNe));
        var nextTopNe = fixedBottom - heightPx * scaleNe;
        layer.centerX = Number(startLayer.centerX) || 0;
        layer.centerY = clamp((nextTopNe / innerH) * 100, 0, 100);
        layer.widthPct = startLayer.widthPct * scaleNe;
    } else if (handle === 'sw') {
        var fixedRight = left + widthPx;
        var scaleSw = Math.min((fixedRight - (left + dx)) / widthPx, (top + heightPx + dy - top) / heightPx);
        scaleSw = Math.max(minWidthPx / widthPx, Math.min(maxWidthPx / widthPx, scaleSw));
        var nextLeftSw = fixedRight - widthPx * scaleSw;
        layer.centerX = clamp((nextLeftSw / innerW) * 100, 0, 100);
        layer.centerY = Number(startLayer.centerY) || 0;
        layer.widthPct = startLayer.widthPct * scaleSw;
    }
}

export function bindBoardImageGlobalHandlers(refs, env) {
    if (!refs.mapStage) return;
    if (refs.mapStage.dataset.boardImgGlobalHandlers === '1') return;
    refs.mapStage.dataset.boardImgGlobalHandlers = '1';
    refs.mapStage.addEventListener(
        'pointerdown',
        function (event) {
            if (
                env.getActiveWorkbench() !== 'level' ||
                env.getViewportViewMode() !== 'board' ||
                !toolAllowsBoardSpriteEdit(env.getActiveTool())
            )
                return;
            var spriteEl = event.target.closest('.map-board-image-sprite');
            if (!spriteEl) return;
            var layerId = spriteEl.getAttribute('data-board-image-id') || '';
            if (!layerId) return;
            var level = env.getLevel();
            var layer = findBoardImageLayerById(level, layerId);
            if (!layer) return;
            var handleEl = event.target.closest('[data-board-resize]');
            if (handleEl && spriteEl.contains(handleEl)) {
                event.preventDefault();
                event.stopPropagation();
                var aspect = readSpriteAspect(layer, spriteEl);
                var metrics = boardGridPaintMetrics(refs.mapGrid, level.map.grid);
                if (!metrics || metrics.innerW <= 2 || metrics.innerH <= 2) return;
                resizeState = {
                    pointerId: event.pointerId,
                    handle: handleEl.getAttribute('data-board-resize') || 'se',
                    id: layerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    startLayer: {
                        centerX: Number(layer.centerX) || 0,
                        centerY: Number(layer.centerY) || 0,
                        widthPct: Number(layer.widthPct) || 40
                    },
                    aspect: aspect,
                    innerW: metrics.innerW,
                    innerH: metrics.innerH
                };
                pointerDrag = null;
                if (handleEl.setPointerCapture) handleEl.setPointerCapture(event.pointerId);
                renderBoardImagesPanel(refs, env);
                return;
            }
            if (spriteEl.setPointerCapture) spriteEl.setPointerCapture(event.pointerId);
            env.setSelectedObject({ kind: 'boardImage', id: layerId });
            resizeState = null;
            pointerDrag = {
                pointerId: event.pointerId,
                id: layerId,
                startX: event.clientX,
                startY: event.clientY,
                startLeft: Number(layer.centerX) || 0,
                startTop: Number(layer.centerY) || 0
            };
            event.preventDefault();
            env.renderSelectionInspector();
            env.renderMap();
            renderBoardImagesPanel(refs, env);
        },
        true
    );
    document.addEventListener(
        'pointermove',
        function (event) {
            if (resizeState && event.pointerId === resizeState.pointerId) {
                applyBoardImageResizePointerMove(event, env);
                env.markDirty('已缩放棋盘配图');
                env.renderMap();
                env.schedulePreviewRefresh();
                return;
            }
            if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
            var level = env.getLevel();
            if (!level || !level.map.grid) return;
            var layer = findBoardImageLayerById(level, pointerDrag.id);
            if (!layer) return;
            var metrics = boardGridPaintMetrics(refs.mapGrid, level.map.grid);
            if (!metrics || metrics.innerW <= 2 || metrics.innerH <= 2) return;
            var dxPct = ((event.clientX - pointerDrag.startX) / metrics.innerW) * 100;
            var dyPct = ((event.clientY - pointerDrag.startY) / metrics.innerH) * 100;
            layer.centerX = Math.max(0, Math.min(100, pointerDrag.startLeft + dxPct));
            layer.centerY = Math.max(0, Math.min(100, pointerDrag.startTop + dyPct));
            env.markDirty('已移动棋盘配图');
            env.renderMap();
            env.schedulePreviewRefresh();
        },
        true
    );
    document.addEventListener(
        'pointerup',
        function (event) {
            if (pointerDrag && event.pointerId === pointerDrag.pointerId) {
                pointerDrag = null;
                renderBoardImagesPanel(refs, env);
            }
            if (resizeState && event.pointerId === resizeState.pointerId) {
                resizeState = null;
                renderBoardImagesPanel(refs, env);
            }
        },
        true
    );
    document.addEventListener('pointercancel', clearBoardImageInteractionState);
    refs.mapStage.addEventListener(
        'wheel',
        function (event) {
            if (
                env.getActiveWorkbench() !== 'level' ||
                env.getViewportViewMode() !== 'board' ||
                !toolAllowsBoardSpriteEdit(env.getActiveTool())
            )
                return;
            var spriteEl = event.target.closest('.map-board-image-sprite');
            if (!spriteEl) return;
            event.preventDefault();
            var layerId = spriteEl.getAttribute('data-board-image-id') || '';
            if (!layerId) return;
            var level = env.getLevel();
            var layer = findBoardImageLayerById(level, layerId);
            if (!layer) return;
            readSpriteAspect(layer, spriteEl);
            var widthPct = Number(layer.widthPct) || 40;
            widthPct *= event.deltaY < 0 ? 1.075 : 0.935;
            widthPct = clamp(widthPct, 5, 500);
            layer.widthPct = widthPct;
            env.markDirty('已缩放棋盘配图');
            env.renderMap();
            env.schedulePreviewRefresh();
            renderBoardImagesPanel(refs, env);
        },
        { passive: false }
    );
}

function collectDroppedImageFiles(event) {
    var files = event.dataTransfer && event.dataTransfer.files;
    if (!files || !files.length) return [];
    var images = [];
    for (var i = 0; i < files.length; i += 1) {
        var file = files[i];
        if (!file) continue;
        if (/^image\//i.test(String(file.type || '')) || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(String(file.name || ''))) {
            images.push(file);
        }
    }
    return images;
}

export function tryConsumeBoardImageFileDrop(event, refs, env) {
    var images = collectDroppedImageFiles(event);
    if (!images.length) return false;
    var level = env.getLevel();
    if (!level || !level.map.grid) return true;
    if (!Array.isArray(level.map.boardImageLayers)) level.map.boardImageLayers = [];
    var base = clientPointToBoardLayerPercents(refs.mapGrid, event.clientX, event.clientY, level.map.grid);
    var maxOrd =
        level.map.boardImageLayers.length === 0
            ? -1
            : Math.max.apply(
                  null,
                  level.map.boardImageLayers.map(function (layer) {
                      return Number(layer.order) || 0;
                  })
              );
    var index = 0;
    function ingestNext() {
        if (index >= images.length) {
            env.markDirty('已导入棋盘配图');
            env.activateBoardImageTool();
            env.renderAll();
            env.schedulePreviewRefresh();
            return;
        }
        var offset = index;
        var reader = new FileReader();
        reader.onload = function () {
            var url = typeof reader.result === 'string' ? reader.result : '';
            if (!url) {
                index += 1;
                ingestNext();
                return;
            }
            var image = new Image();
            image.onload = function () {
                var id = uid('board-img');
                var aspect =
                    image.naturalWidth > 0
                        ? clampBoardAspect(image.naturalHeight / image.naturalWidth)
                        : clampBoardAspect(0.75);
                level.map.boardImageLayers.push({
                    id: id,
                    src: url,
                    centerX: clamp(base.lx + (offset % 3) * 3, 0, 100),
                    centerY: clamp(base.ty + Math.floor(offset / 3) * 3, 0, 100),
                    widthPct: 46,
                    opacity: 1,
                    order: maxOrd + 1 + offset,
                    aspect: aspect
                });
                env.setSelectedObject({ kind: 'boardImage', id: id });
                index += 1;
                ingestNext();
            };
            image.onerror = function () {
                index += 1;
                ingestNext();
            };
            image.src = url;
        };
        reader.readAsDataURL(images[offset]);
    }
    ingestNext();
    return true;
}