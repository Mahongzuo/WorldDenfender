import { clamp, escapeAttr, escapeHtml, updatePath } from './utils.js';
import { DEFENSE_ELEMENT_OPTIONS, LCB_CELL_KIND_LABEL } from './content.js';
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
    var elementOptions = DEFENSE_ELEMENT_OPTIONS.map(function (opt) {
        return (
            '<option value="' +
            escapeAttr(opt.id) +
            '"' +
            (opt.id === item.element ? ' selected' : '') +
            '>' +
            escapeHtml(opt.label || opt.id) +
            '</option>'
        );
    }).join('');
    var bossOptions = [
        ['ai-atlas', '重构者 Atlas'],
        ['ai-vulcan', '熔核调度员 Vulcan'],
        ['ai-prism', '棱镜审计官 Prism'],
        ['ai-gridmind', '雷网中枢 Gridmind'],
        ['ai-echo', '回声协议 Echo']
    ].map(function (opt) {
        return '<option value="' + escapeAttr(opt[0]) + '"' + (opt[0] === item.bossId ? ' selected' : '') + '>' + escapeHtml(opt[1]) + '</option>';
    }).join('');
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
    if (kind === 'exploreBoss') {
        if (!item.overrideStats || typeof item.overrideStats !== 'object') item.overrideStats = {};
        base.push(selectHtml('Boss 模板', 'bossId', bossOptions));
        base.push(selectHtml('属性', 'element', elementOptions));
        base.push(selectHtml('模型', 'modelId', modelOptions));
        base.push(fieldHtml('模型路径', 'modelPath', item.modelPath || ''));
        base.push(fieldHtml('模型缩放', 'modelScale', item.modelScale || 1.8, 'number', '0.1'));
        base.push(fieldHtml('等级', 'level', item.level || 1, 'number'));
        base.push(fieldHtml('触发半径', 'triggerRadius', item.triggerRadius || 9, 'number', '0.1'));
        base.push(fieldHtml('覆盖生命(0=默认)', 'overrideStats.maxHp', item.overrideStats.maxHp || 0, 'number'));
        base.push(fieldHtml('覆盖攻击(0=默认)', 'overrideStats.attack', item.overrideStats.attack || 0, 'number'));
        base.push(fieldHtml('覆盖速度(0=默认)', 'overrideStats.speed', item.overrideStats.speed || 0, 'number', '0.1'));
        base.push(fieldHtml('奖励金钱(0=默认)', 'overrideStats.rewardMoney', item.overrideStats.rewardMoney || 0, 'number'));
        base.push(fieldHtml('奖励 XP(0=默认)', 'overrideStats.rewardXp', item.overrideStats.rewardXp || 0, 'number'));
    }
    if (kind === 'exploreSpawner') {
        base.push(fieldHtml('敌人模板 ID', 'enemyTypeId', item.enemyTypeId || 'ai-drone'));
        base.push(selectHtml('属性', 'element', elementOptions));
        base.push(selectHtml('模型', 'modelId', modelOptions));
        base.push(fieldHtml('模型路径', 'modelPath', item.modelPath || ''));
        base.push(fieldHtml('模型缩放', 'modelScale', item.modelScale || 1, 'number', '0.1'));
        base.push(fieldHtml('最大同时存在', 'maxConcurrent', item.maxConcurrent || 3, 'number'));
        base.push(fieldHtml('生成间隔(秒)', 'spawnIntervalSec', item.spawnIntervalSec || 6, 'number', '0.1'));
        base.push(fieldHtml('每次生成数量', 'spawnCount', item.spawnCount || 1, 'number'));
        base.push(fieldHtml('触发半径', 'triggerRadius', item.triggerRadius || 12, 'number', '0.1'));
        base.push(fieldHtml('活动半径', 'activeRadius', item.activeRadius || 18, 'number', '0.1'));
        base.push(fieldHtml('总生成上限(0=无限)', 'totalLimit', item.totalLimit || 0, 'number'));
    }
    if (kind === 'explorePickup') {
        var typeOptions =
            '<option value="money"' + (item.type === 'money' ? ' selected' : '') + '>金币</option>' +
            '<option value="item"' + (item.type === 'item' ? ' selected' : '') + '>道具</option>';
        var itemTypeOptions =
            '<option value="material"' + (item.itemType !== 'consumable' ? ' selected' : '') + '>材料</option>' +
            '<option value="consumable"' + (item.itemType === 'consumable' ? ' selected' : '') + '>消耗品</option>';
        base.push(selectHtml('奖励类型', 'type', typeOptions));
        base.push(fieldHtml('金币金额', 'moneyAmount', item.moneyAmount || 0, 'number'));
        base.push(fieldHtml('道具 ID', 'itemId', item.itemId || ''));
        base.push(fieldHtml('道具名称', 'itemName', item.itemName || 'AI 记忆碎片'));
        base.push(selectHtml('道具类型', 'itemType', itemTypeOptions));
        base.push(fieldHtml('图标', 'itemIcon', item.itemIcon || 'AI'));
        base.push(fieldHtml('数量', 'quantity', item.quantity || 1, 'number'));
        base.push(selectHtml('模型', 'modelId', modelOptions));
        base.push(fieldHtml('模型路径', 'modelPath', item.modelPath || ''));
        base.push(fieldHtml('模型缩放', 'modelScale', item.modelScale || 1, 'number', '0.1'));
        base.push(fieldHtml('拾取半径', 'collectRadius', item.collectRadius || 1.25, 'number', '0.1'));
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
    if (path === 'modelId') {
        var asset = env.getBrowsableModelAssets().find(function (item) {
            return item.id === String(next || '');
        });
        target.item.modelPath = asset ? asset.path || asset.publicUrl || '' : '';
    }
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
            '<p class="section-hint">数据写入 <code>map.boardImageLayers</code>。Delete 移除该配图层。宽度设为 <strong>≥100%</strong> 时配图在预览与<strong>游戏中</strong>会<strong>铺满整盘格子并拉伸</strong>以适应棋盘比例（原为保持比例则另一边可能留白）。滚轮缩放或填入宽度即可触发。</p>' +
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