/**
 * editor/layout-presets.js
 * 纯粹的关卡布局 / 骨架函数（只操作传入的 level/map/options 对象，无全局状态）。
 * 包括：内置城市布局应用、特殊 Geo 解析、关卡草稿创建、探索布局保证等。
 */

import { clone, cloneCells } from './utils.js';
import { DEFAULT_GRID_COLS, DEFAULT_GRID_ROWS, DEFAULT_TILE_SIZE } from './content.js';
import { CITY_GEO_CONFIGS } from './city-geo-configs.js';
import { normalizeLevel, createDefaultMap, normalizeGeoConfig, normalizeExplorationLayout } from './normalizers.js';

// ─── 特殊城市 Geo 解析 ────────────────────────────────────────────────────────

/**
 * 针对已知特殊关卡（如济南）返回覆盖 GeoConfig，无匹配则返回 null。
 * @param {object} level
 * @returns {object|null}
 */
export function resolveSpecialGeoForLevel(level) {
    var text = [
        level && level.id,
        level && level.name,
        level && level.location && level.location.cityCode,
        level && level.location && level.location.cityName,
        level && level.location && level.location.regionLabel
    ].filter(Boolean).join(' ').replace(/\s+/g, '');
    if (/city-cn-370100|中国·济南市|中国·济南|济南市/i.test(text)) return CITY_GEO_CONFIGS.jinanOlympic;
    if (/CN_shandong_370100|泉城浮生录|山东·济南|山东_370100/i.test(text)) return CITY_GEO_CONFIGS.jinan;
    return null;
}

/**
 * 将 geo 配置克隆并规范化。
 * @param {object|null} geo
 * @returns {object}
 */
export function cloneGeoConfig(geo) {
    return normalizeGeoConfig(clone(geo));
}

// ─── 内置布局应用 ─────────────────────────────────────────────────────────────

/**
 * 将内置塔防布局（路径、障碍、主题）覆盖写入 level.map。
 * @param {object} level
 * @param {{defense:{path,obstacles,theme},defenseName:string}} layout
 */
export function applyDefenseLayout(level, layout) {
    var path = cloneCells(layout.defense.path);
    level.map.grid = { cols: DEFAULT_GRID_COLS, rows: DEFAULT_GRID_ROWS, tileSize: DEFAULT_TILE_SIZE };
    level.map.theme = clone(layout.defense.theme);
    level.map.roads = cloneCells(layout.defense.path);
    level.map.enemyPaths = [{ id: 'path-main', name: '主敌人路径', cells: path }];
    level.map.obstacles = cloneCells(layout.defense.obstacles);
    level.map.spawnPoints = [{ id: 'spawn-main', name: '敌人入口', col: path[0].col, row: path[0].row, pathId: 'path-main' }];
    level.map.enemyExits = level.map.spawnPoints;
    level.map.objectivePoint = { id: 'objective-main', name: '防守核心', col: path[path.length - 1].col, row: path[path.length - 1].row };
    if (/未设计关卡/.test(level.name)) level.name = layout.defenseName;
}

/**
 * 将内置探索布局（路径、障碍、主题）覆盖写入 level.map.explorationLayout。
 * @param {object} level
 * @param {{explore:{path,obstacles,theme},exploreName:string}} layout
 */
export function applyExploreLayout(level, layout) {
    var path = cloneCells(layout.explore.path);
    level.map.explorationLayout = {
        grid: { cols: DEFAULT_GRID_COLS, rows: DEFAULT_GRID_ROWS, tileSize: DEFAULT_TILE_SIZE },
        theme: clone(layout.explore.theme),
        path: path,
        obstacles: cloneCells(layout.explore.obstacles),
        startPoint: { id: 'explore-start', name: '探索起点', col: path[0].col, row: path[0].row },
        exitPoint: { id: 'explore-exit', name: '探索终点', col: path[path.length - 1].col, row: path[path.length - 1].row }
    };
    if (!level.map.explorationPoints.length) {
        level.map.explorationPoints = path.map(function (cell, index) {
            return {
                id: 'explore-point-' + (index + 1),
                name: index === 0 ? '探索起点' : '探索点 ' + (index + 1),
                col: cell.col,
                row: cell.row,
                modelId: '',
                interaction: index === 0 ? 'spawn' : 'inspect',
                radius: 2
            };
        });
    }
}

// ─── 关卡骨架创建 ─────────────────────────────────────────────────────────────

/**
 * 以给定选项创建一个规范化的空白草稿关卡对象。
 * @param {{id,name,countryCode,countryName,cityCode,cityName,regionLabel,source,geo?}} options
 * @returns {object}
 */
export function createDraftLevel(options) {
    return normalizeLevel({
        id: options.id,
        folder: options.id,
        name: options.name,
        status: 'draft',
        difficulty: 3,
        description: '自动生成的空白关卡骨架。你可以在编辑器中自由设计地图、道路、敌人出口、防御塔、模型和探索点。',
        location: {
            countryCode: options.countryCode,
            countryName: options.countryName,
            cityCode: options.cityCode,
            cityName: options.cityName,
            regionLabel: options.regionLabel,
            source: options.source
        },
        environment: {},
        map: Object.assign(createDefaultMap(), options.geo ? { geo: options.geo } : {}),
        modeProfiles: {},
        rosters: {},
        props: [],
        resources: [],
        uiModules: []
    });
}

// ─── 探索布局保证 ─────────────────────────────────────────────────────────────

/**
 * 确保 map.explorationLayout 存在并字段完整（就地修改，返回 explorationLayout）。
 * @param {object} map
 * @returns {object}
 */
export function ensureExplorationLayout(map) {
    if (!map.explorationLayout) {
        map.explorationLayout = normalizeExplorationLayout(null, map);
    }
    map.explorationLayout.path = Array.isArray(map.explorationLayout.path) ? map.explorationLayout.path : [];
    map.explorationLayout.obstacles = Array.isArray(map.explorationLayout.obstacles) ? map.explorationLayout.obstacles : [];
    if (!Array.isArray(map.explorationLayout.safeZones)) map.explorationLayout.safeZones = [];
    if (!map.explorationLayout.gameplay || typeof map.explorationLayout.gameplay !== 'object') map.explorationLayout.gameplay = {};
    return map.explorationLayout;
}
