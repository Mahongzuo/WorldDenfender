/**
 * editor/id-utils.js
 * ID 唯一化、关卡查找等纯辅助函数（接收显式集合参数，不依赖全局 state）。
 */

import { slugify } from './utils.js';

// ─── 关卡 ID ──────────────────────────────────────────────────────────────────

/**
 * 从 levels 列表中挑选一个有效的关卡 ID：
 * 若 preferredId 存在于列表则返回它，否则返回第一个。
 * @param {object[]} levels
 * @param {string} preferredId
 * @returns {string}
 */
export function pickLevelId(levels, preferredId) {
    if (!levels || !levels.length) return '';
    return levels.some(function (level) { return level.id === preferredId; }) ? preferredId : levels[0].id;
}

/**
 * 在 levels 列表中生成不重复的关卡 ID（seed 不可用时用 'level' 作为 base）。
 * @param {object[]} levels
 * @param {string} seed
 * @returns {string}
 */
export function uniqueLevelId(levels, seed) {
    var base = slugify(seed) || 'level';
    var candidate = base;
    var index = 2;
    while (levels && levels.some(function (level) { return level.id === candidate; })) {
        candidate = base + '-' + index;
        index += 1;
    }
    return candidate;
}

/**
 * 在 actorTemplates 列表中生成不重复的模板 ID。
 * @param {object[]} templates
 * @param {string} seed
 * @returns {string}
 */
export function uniqueTemplateId(templates, seed) {
    var base = slugify(seed) || 'actor-template';
    var candidate = base;
    var index = 2;
    while (templates.some(function (template) { return template.id === candidate; })) {
        candidate = base + '-' + index;
        index += 1;
    }
    return candidate;
}

/**
 * 通过 ID 在 levels 列表中查找关卡，未找到返回 null。
 * @param {object[]} levels
 * @param {string} levelId
 * @returns {object|null}
 */
export function findLevelById(levels, levelId) {
    if (!levels || !levelId) return null;
    return levels.find(function (l) { return l.id === levelId; }) || null;
}

// ─── 玩法条目 ID ──────────────────────────────────────────────────────────────

/**
 * 在已有玩法条目列表中生成不重复的条目 ID。
 * @param {{id:string}[]} list
 * @param {string} baseId
 * @returns {string}
 */
export function uniqueGameplayEntryId(list, baseId) {
    var candidate = baseId;
    var serial = 1;
    while (list.some(function (item) { return item.id === candidate; })) {
        candidate = baseId + '-' + String(serial);
        serial += 1;
    }
    return candidate;
}
