/**
 * editor/display-utils.js
 * Pure display helpers (no DOM / no global state).
 */

import { slugify } from './utils.js';

/**
 * @param {string} status
 * @returns {string}
 */
export function statusLabel(status) {
    if (status === 'designed') return '\u5df2\u8bbe\u8ba1';
    if (status === 'needs-work') return '\u9700\u5b8c\u5584';
    return '\u672a\u8bbe\u8ba1';
}

/**
 * @param {string} category
 * @returns {string}
 */
export function actorCategoryLabel(category) {
    if (category === 'tower') return '\u9632\u5fa1\u5854';
    if (category === 'enemy') return '\u654c\u4eba';
    if (category === 'objective') return '\u9632\u5b88\u6838\u5fc3';
    if (category === 'npc') return 'NPC';
    return '\u6a21\u578b';
}

/**
 * @param {{hp?:number,attack?:number,range?:number}} stats
 * @returns {string}
 */
export function summaryStats(stats) {
    return (
        'HP ' +
        (stats.hp || 0) +
        ' / \u653b\u51fb ' +
        (stats.attack || 0) +
        ' / \u5c04\u7a0b ' +
        (stats.range || 0)
    );
}

/**
 * @param {string} placement
 * @returns {string}
 */
export function gameplayPlacementLabel(placement) {
    return placement === 'road'
        ? '\u9053\u8def\u4e0a'
        : placement === 'roadside'
          ? '\u9053\u8def\u4e24\u4fa7'
          : '\u90e8\u7f72\u4f4d\u7f6e\u672a\u8bbe\u7f6e';
}

/**
 * @param {string|null|undefined} url
 * @returns {string}
 */
export function modelBindShortLabel(url) {
    if (!url) return '\u672a\u914d\u7f6e';
    var s = String(url);
    var tail = s.split(/[/\\?#]/).filter(Boolean).pop() || s;
    tail = tail.replace(/\+/g, ' ');
    if (tail.length > 36) tail = tail.slice(0, 34) + '\u2026';
    return tail;
}

/**
 * @param {*} value
 * @returns {boolean}
 */
export function isImageAssetPath(value) {
    return /\.(png|jpg|jpeg|webp|gif)$/i.test(String(value || ''));
}

/**
 * @param {*} value
 * @returns {boolean}
 */
export function isModelAssetPath(value) {
    return /\.(glb|gltf|obj|fbx|dae|stl)$/i.test(String(value || ''));
}

/**
 * @param {object[]} levels
 * @returns {Record<string, object[]>}
 */
export function groupLevels(levels) {
    return levels.reduce(function (groups, level) {
        var key = level.location.countryName || '\u672a\u8bbe\u7f6e\u56fd\u5bb6';
        if (level.location.cityName) key = key + ' / \u57ce\u5e02';
        if (!groups[key]) groups[key] = [];
        groups[key].push(level);
        return groups;
    }, {});
}

/**
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
export function compareRegionKeys(left, right) {
    var cn = '\u4e2d\u56fd / \u57ce\u5e02';
    if (left === cn) return -1;
    if (right === cn) return 1;
    return left.localeCompare(right, 'zh-Hans-CN');
}

/**
 * @param {object} map
 * @returns {boolean}
 */
export function hasDefenseLayout(map) {
    return !!(map.roads.length || map.obstacles.length || map.enemyPaths.some(function (path) { return path.cells.length; }));
}

/**
 * @param {object} map
 * @returns {boolean}
 */
export function hasExploreLayout(map) {
    return !!(map.explorationLayout && (map.explorationLayout.path.length || map.explorationLayout.obstacles.length));
}

/**
 * @param {object|null} item
 * @returns {{name:string,longitude:string,latitude:string,type:string,importance:number}|null}
 */
export function normalizePlaceSearchResult(item) {
    var lon = Number(item && item.lon);
    var lat = Number(item && item.lat);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
    return {
        name: String(item.display_name || item.name || '\u672a\u547d\u540d\u4f4d\u7f6e'),
        longitude: lon.toFixed(6),
        latitude: lat.toFixed(6),
        type: String(item.type || item.category || ''),
        importance: Number(item.importance) || 0
    };
}

/**
 * @param {{id:string}[]} items
 * @param {string} seed
 * @param {function(string):string} [slugifyFn]
 * @returns {string}
 */
export function uniqueCatalogId(items, seed, slugifyFn) {
    var base = (slugifyFn ? slugifyFn(seed) : seed) || 'asset';
    var candidate = base;
    var index = 2;
    while (items.some(function (item) { return item.id === candidate; })) {
        candidate = base + '-' + index;
        index += 1;
    }
    return candidate;
}

/**
 * @param {object|null} level
 * @returns {boolean}
 */
export function isJinanLevel(level) {
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
    return /\u6d4e\u5357|\u6cc9\u57ce|370100|shandong|cn-370100|shandong_370100/i.test(haystack);
}

/**
 * @param {object|null} level
 * @returns {{cityCode:string,cityName:string}|null}
 */
export function levelVideoCityContext(level) {
    if (!level) return null;
    var loc = level.location || {};
    var code = String(level.cityCode || loc.cityCode || '').trim();
    var name = String(level.cityName || level.countryName || loc.cityName || level.name || '').trim();
    if (!code && name) code = slugify(name) || slugify(String(level.id || '')) || 'CUSTOM';
    if (!code && !name) return null;
    return { cityCode: code || 'CUSTOM', cityName: name || 'Level' };
}

/**
 * Normalize place/city label for fuzzy match (whitespace, middle dot, trailing \u5e02).
 * @param {string} value
 * @returns {string}
 */
export function normalizeCityIdentity(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[\s\u00b7]/g, '')
        .replace(/\u5e02$/g, '');
}

/**
 * @param {Object|null} config
 * @param {string} currentTab
 * @returns {string}
 */
export function pickPreferredGameplayTab(config, currentTab) {
    if (!config) return currentTab;
    if (Array.isArray(config[currentTab])) return currentTab;
    return (
        ['cards', 'towers', 'characters', 'skills', 'enemies'].find(function (tab) {
            return Array.isArray(config[tab]) && config[tab].length;
        }) || currentTab
    );
}
