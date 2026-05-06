/**
 * editor/level-mutators.js
 * 关卡/Actor 数据变异辅助工具——纯函数，接收显式参数，无全局状态依赖。
 */
import { clone } from './utils.js';

// ─── 棋盘图片图层排序 ─────────────────────────────────────────────────────────

/**
 * 重新按整数顺序给棋盘图片图层编号（从 0 开始连续）。
 * 原地修改 level.map.boardImageLayers。
 * @param {Object} level
 */
export function renumberBoardImageOrders(level) {
    if (!level || !Array.isArray(level.map.boardImageLayers) || !level.map.boardImageLayers.length) return;
    level.map.boardImageLayers
        .slice()
        .sort(function (a, b) {
            return (Number(a.order) || 0) - (Number(b.order) || 0);
        })
        .forEach(function (L, i) {
            L.order = i;
        });
}

/**
 * 移动棋盘图片图层的显示顺序（+1 向后，-1 向前）。
 * @param {Object} level
 * @param {string} id  - 图层 ID
 * @param {number} dir - 方向（1 或 -1）
 */
export function moveBoardLayerOrder(level, id, dir) {
    if (!level || !Array.isArray(level.map.boardImageLayers) || level.map.boardImageLayers.length < 2) return;
    renumberBoardImageOrders(level);
    var sorted = level.map.boardImageLayers.slice().sort(function (a, b) {
        return (Number(a.order) || 0) - (Number(b.order) || 0);
    });
    var i = sorted.findIndex(function (L) { return L.id === id; });
    var j = i + dir;
    if (i < 0 || j < 0 || j >= sorted.length) return;
    var tmp = sorted[i].order;
    sorted[i].order = sorted[j].order;
    sorted[j].order = tmp;
}

// ─── Actor 世界坐标工具 ───────────────────────────────────────────────────────

/**
 * 确保 actor 具有有效的 worldOffsetMeters 对象（就地修改）。
 * @param {Object} actor
 */
export function ensureWorldOffset(actor) {
    if (!actor.worldOffsetMeters || typeof actor.worldOffsetMeters !== 'object') {
        actor.worldOffsetMeters = { x: 0, y: 0, z: 0 };
    }
    ['x', 'y', 'z'].forEach(function (k) {
        if (!Number.isFinite(Number(actor.worldOffsetMeters[k]))) actor.worldOffsetMeters[k] = 0;
    });
}

// ─── 城市游戏配置合并 ─────────────────────────────────────────────────────────

/**
 * 将 source 列表中的条目合并入 target（按 id 去重，缺失字段从 source 填入）。
 * @param {Array} target
 * @param {Array} source
 * @returns {number} 新增条目数量
 */
export function mergeGameplayEntryList(target, source) {
    var added = 0;
    if (!Array.isArray(target) || !Array.isArray(source)) return added;
    source.forEach(function (entry) {
        var existing = target.find(function (item) { return item.id === entry.id; });
        if (!existing) {
            target.push(clone(entry));
            added += 1;
            return;
        }
        if (!existing.summary) existing.summary = entry.summary;
        if (!existing.rarity) existing.rarity = entry.rarity;
        if (!existing.placement && entry.placement) existing.placement = entry.placement;
        if (!existing.element && entry.element) existing.element = entry.element;
        if (!existing.functionTags || !existing.functionTags.length) existing.functionTags = clone(entry.functionTags || []);
        if (!existing.effects || !existing.effects.length) existing.effects = clone(entry.effects || []);
        if (!existing.cleanseEffects || !existing.cleanseEffects.length) existing.cleanseEffects = clone(entry.cleanseEffects || []);
        var existingDur = Number(existing.effectDurationSec);
        if (!Number.isFinite(existingDur) || existingDur <= 0) {
            var entryDur = Number(entry.effectDurationSec);
            if (Number.isFinite(entryDur) && entryDur > 0) existing.effectDurationSec = entryDur;
        }
        if (!existing.tags || !existing.tags.length) existing.tags = clone(entry.tags || []);
        if (!existing.assetRefs || !Object.keys(existing.assetRefs).length) existing.assetRefs = clone(entry.assetRefs || {});
        existing.stats = Object.assign({}, entry.stats || {}, existing.stats || {});
    });
    return added;
}
