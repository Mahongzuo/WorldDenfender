import { clamp, escapeAttr, escapeHtml, updatePath } from './utils.js';
import { LCB_CELL_KIND_LABEL } from './content.js';
import { fieldHtml, selectHtml, boardLayerFieldHtml, findBoardImageLayerById } from './html-builders.js';
import { ensureWorldOffset } from './level-mutators.js';

function setEmptyState(refs, text) {
    if (!refs.selectionInspector) return;
    refs.selectionInspector.className = 'selection-inspector empty-state';
    refs.selectionInspector.innerHTML = text;
}

function buildInspectorForm(env, kind, item) {
    var modelOptions = ['<option value="">未绑定模型</option>']
        .concat(
            env.getBrowsableModelAssets().map(function (asset) {
                return (
                    '<option value="' +
                    escapeAttr(asset.id) +
                    '"' +
                    (asset.id === item.modelId ? ' selected' : '') +
                    '>' +
                    escapeHtml(asset.name) +
                    '</option>'
                );
            })
        )
        .join('');
    var base = [
        '<div class="form-grid two">',
        fieldHtml('名称', 'name', item.name || ''),
        fieldHtml('列', 'col', item.col, 'number'),
        fieldHtml('行', 'row', item.row, 'number')
    ];
    if (kind === 'actor') {
        ensureWorldOffset(item);
        base.push(fieldHtml('旋转', 'rotation', item.rotation, 'number'));
        base.push(fieldHtml('缩放', 'scale', item.scale, 'number', '0.1'));
        base.push(fieldHtml('偏移 X(米)', 'worldOffsetMeters.x', item.worldOffsetMeters.x, 'number', '0.05'));
        base.push(fieldHtml('偏移 Y(米)', 'worldOffsetMeters.y', item.worldOffsetMeters.y, 'number', '0.05'));
        base.push(fieldHtml('偏移 Z(米)', 'worldOffsetMeters.z', item.worldOffsetMeters.z, 'number', '0.05'));
        base.push(fieldHtml('阵营', 'team', item.team || 'player'));
        base.push(selectHtml('模型', 'modelId', modelOptions));
        base.push(fieldHtml('生命', 'stats.hp', item.stats.hp, 'number'));
        base.push(fieldHtml('攻击', 'stats.attack', item.stats.attack, 'number'));
        base.push(fieldHtml('射程', 'stats.range', item.stats.range, 'number', '0.1'));
        base.push(fieldHtml('射速', 'stats.fireRate', item.stats.fireRate, 'number', '0.1'));
        base.push(fieldHtml('费用', 'stats.cost', item.stats.cost, 'number'));
        base.push(fieldHtml('冷却', 'stats.cooldown', item.stats.cooldown || 0, 'number', '0.1'));
    }
    if (kind === 'spawn') {
        base.push(fieldHtml('路径 ID', 'pathId', item.pathId || 'path-main'));
    }
    if (kind === 'explorePoint') {
        base.push(selectHtml('模型', 'modelId', modelOptions));
        base.push(fieldHtml('交互类型', 'interaction', item.interaction || 'inspect'));
        base.push(fieldHtml('半径', 'radius', item.radius || 2, 'number', '0.1'));
    }
    base.push('</div>');
    return base.join('');
}

function syncBoardLayerFieldFromInspector(refs, env, input) {
    var level = env.getLevel();
    var selectedObject = env.getSelectedObject();
    if (!level || !selectedObject || selectedObject.kind !== 'boardImage') return;
    var layer = findBoardImageLayerById(level, selectedObject.id);
    if (!layer) return;
    var key = input.getAttribute('data-board-layer-field');
    if (!key) return;
    var raw = input.value === '' || input.value === '-' || input.value === '.' ? NaN : Number(input.value);
    if (!Number.isFinite(raw)) return;
    if (key === 'centerX' || key === 'centerY') layer[key] = clamp(raw, 0, 100);
    else if (key === 'widthPct') layer.widthPct = clamp(raw, 5, 500);
    else if (key === 'opacity') layer.opacity = clamp(raw, 0, 1);
    else if (key === 'order') layer.order = Math.round(raw);
    env.markDirty('已更新棋盘配图');
    env.renderMap();
    env.renderBoardImagesPanel(refs, env.boardImagesEnv());
    env.schedulePreviewRefresh();
}

function updateSelectedField(env, input) {
    var target = env.findSelectedObject(env.getLevel());
    if (!target) return;
    var path = input.getAttribute('data-inspect-field');
    var next =
        input.type === 'number'
            ? input.value === '' || input.value === '-' || input.value === '.' || input.value === '-.'
                ? NaN
                : Number(input.value)
            : input.value;
    if (input.type === 'number' && !Number.isFinite(next)) return;
    updatePath(target.item, path, next);
    if (path === 'col' || path === 'row') {
        target.item[path] = Math.max(0, Math.floor(Number(next) || 0));
        env.renderMap();
    }
    env.markDirty('已更新对象属性');
    env.renderOverview();
    env.schedulePreviewRefresh();
}

export function renderSelectionInspector(refs, env) {
    if (!refs.selectionInspector) return;
    var level = env.getLevel();
    var selectedObject = env.getSelectedObject();
    if (selectedObject && LCB_CELL_KIND_LABEL[selectedObject.kind]) {
        refs.selectionInspector.className = 'selection-inspector';
        var label = LCB_CELL_KIND_LABEL[selectedObject.kind] || selectedObject.kind;
        refs.selectionInspector.innerHTML =
            '<p class="section-hint">已选「' +
            escapeHtml(label) +
            '」棋盘格 (' +
            selectedObject.col +
            ',' +
            selectedObject.row +
            '）。按 Delete 键从关卡移除。</p>';
        return;
    }
    if (selectedObject && selectedObject.kind === 'boardImage') {
        var layer = level && findBoardImageLayerById(level, selectedObject.id);
        if (!layer) {
            env.setSelectedObject(null);
            setEmptyState(refs, '未选择对象。');
            return;
        }
        refs.selectionInspector.className = 'selection-inspector';
        refs.selectionInspector.innerHTML =
            '<p class="section-hint">数据写入 <code>map.boardImageLayers</code>。Delete 移除该配图层。</p>' +
            '<div class="form-grid two">' +
            boardLayerFieldHtml('左上角 X%', 'centerX', layer.centerX, 0.5) +
            boardLayerFieldHtml('左上角 Y%', 'centerY', layer.centerY, 0.5) +
            boardLayerFieldHtml('宽度 %（相对棋盘格宽）', 'widthPct', layer.widthPct, 1) +
            boardLayerFieldHtml('不透明度 0–1', 'opacity', layer.opacity == null ? 1 : layer.opacity, 0.02) +
            boardLayerFieldHtml('层级顺序 order', 'order', layer.order, 1) +
            '</div>';
        refs.selectionInspector.querySelectorAll('[data-board-layer-field]').forEach(function (input) {
            input.addEventListener('input', function () {
                syncBoardLayerFieldFromInspector(refs, env, input);
            });
            input.addEventListener('change', function () {
                syncBoardLayerFieldFromInspector(refs, env, input);
            });
        });
        return;
    }
    var target = env.findSelectedObject(level);
    if (!target) {
        setEmptyState(refs, '未选择对象。');
        return;
    }
    refs.selectionInspector.className = 'selection-inspector';
    refs.selectionInspector.innerHTML = buildInspectorForm(env, target.kind, target.item);
    refs.selectionInspector.querySelectorAll('[data-inspect-field]').forEach(function (input) {
        input.addEventListener('input', function () {
            updateSelectedField(env, input);
        });
        input.addEventListener('change', function () {
            updateSelectedField(env, input);
        });
    });
}