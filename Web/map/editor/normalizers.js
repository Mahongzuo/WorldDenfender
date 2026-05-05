/**
 * editor/normalizers.js — 纯数据规整函数
 * 不依赖 DOM 与浏览器 editor 运行时状态（仅依赖 content.js 中的默认常量）。
 * 被 level-editor.js 以及未来的 storage.js 等模块 import。
 */
import { DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID } from './city-geo-configs.js';
import { uid, slugify, clamp, clone, editorVol01, inBounds } from './utils.js';
import {
    TOWER_MODEL_SPECS, DEFAULT_TOWER_GAMEPLAY_STATS, DEFAULT_ACTOR_TEMPLATES,
    GAMEPLAY_RESOURCE_CONFIG, ENGINE_VERSION,
    DEFAULT_GRID_COLS, DEFAULT_GRID_ROWS, DEFAULT_TILE_SIZE
} from './content.js';

// ---------------------------------------------------------------------------
// 区域 / 地区辅助
// ---------------------------------------------------------------------------

export function splitRegion(region) {
    var parts = String(region || '').split(/[·・\-\/]/).map(function (part) { return part.trim(); }).filter(Boolean);
    return { country: parts[0] || region || '', city: parts[1] || '' };
}

export function buildRegionLabel(location, fallback) {
    if (location.countryName && location.cityName) return location.countryName + ' · ' + location.cityName;
    return fallback || location.countryName || '未设置地区';
}

export function inferCountryCode(countryName) {
    if (countryName === '中国') return 'CN';
    if (countryName === '美国') return 'US';
    if (countryName === '日本') return 'JP';
    if (countryName === '法国') return 'FR';
    return '';
}

// ---------------------------------------------------------------------------
// 基础单元格 / 点位
// ---------------------------------------------------------------------------

export function normalizeCell(cell) {
    return { col: Number(cell.col) || 0, row: Number(cell.row) || 0 };
}

export function normalizeCells(cells) {
    return Array.isArray(cells) ? cells.map(normalizeCell) : [];
}

export function normalizePoint(point) {
    if (!point || typeof point !== 'object') return null;
    return {
        id: String(point.id || 'point'),
        name: String(point.name || point.label || '点位'),
        col: Number(point.col) || 0,
        row: Number(point.row) || 0
    };
}

export function defaultObjectivePoint(grid) {
    return { id: 'objective-main', name: '防守核心', col: Math.max(0, grid.cols - 4), row: Math.floor(grid.rows / 2) };
}

export function normalizeStatus(status, map) {
    if (status === 'designed' || status === 'needs-work' || status === 'draft') return status;
    var hasWork = map && (map.actors.length || map.roads.length || map.spawnPoints.length || map.explorationPoints.length);
    return hasWork ? 'needs-work' : 'draft';
}

// ---------------------------------------------------------------------------
// 位置 / 环境
// ---------------------------------------------------------------------------

export function normalizeLocation(source) {
    var location = source.location && typeof source.location === 'object' ? source.location : {};
    var legacyRegion = String(source.region || '');
    var parts = splitRegion(legacyRegion);
    return {
        countryCode: String(location.countryCode || inferCountryCode(parts.country) || ''),
        countryName: String(location.countryName || parts.country || legacyRegion || '未设置国家'),
        cityCode: String(location.cityCode || ''),
        cityName: String(location.cityName || parts.city || ''),
        regionLabel: String(location.regionLabel || legacyRegion || ''),
        source: String(location.source || 'legacy')
    };
}

export function normalizeEnvironment(environment) {
    var source = environment && typeof environment === 'object' ? environment : {};
    return {
        floorTextureId: String(source.floorTextureId || ''),
        sceneModelId: String(source.sceneModelId || ''),
        lightingProfile: String(source.lightingProfile || 'default-lighting'),
        entryScene: String(source.entryScene || ''),
        notes: String(source.notes || '')
    };
}

// ---------------------------------------------------------------------------
// 棋盘图片图层
// ---------------------------------------------------------------------------

export function normalizeBoardImageLayers(raw) {
    if (!Array.isArray(raw)) return [];
    var list = [];
    for (var i = 0; i < raw.length; i += 1) {
        var L = raw[i];
        if (!L || typeof L !== 'object') continue;
        var src = typeof L.src === 'string' ? L.src.trim() : '';
        if (!src) continue;
        function pPct(v, fb) {
            var x = Number(v);
            return Number.isFinite(x) ? Math.max(0, Math.min(100, x)) : fb;
        }
        function pWidth(v) {
            var x = Number(v);
            return Number.isFinite(x) ? Math.max(5, Math.min(500, x)) : 48;
        }
        function pOp(v) {
            var x = Number(v);
            return Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 1;
        }
        var ordRaw = Number(L.order);
        var ord = Number.isFinite(ordRaw) ? Math.round(ordRaw) : list.length;
        var bilEntry = {
            id: String(L.id || uid('board-img')),
            src: src,
            centerX: pPct(L.centerX, 0),
            centerY: pPct(L.centerY, 0),
            widthPct: pWidth(L.widthPct),
            opacity: pOp(L.opacity),
            order: ord
        };
        var ar = Number(L.aspect);
        if (Number.isFinite(ar) && ar > 0) bilEntry.aspect = Math.min(24, Math.max(0.04, ar));
        list.push(bilEntry);
    }
    list.sort(function (a, b) {
        return a.order - b.order;
    });
    return list;
}

// ---------------------------------------------------------------------------
// Actor / 统计 / 模板
// ---------------------------------------------------------------------------

export function normalizeStats(stats) {
    var source = stats && typeof stats === 'object' ? stats : {};
    return {
        hp: Number(source.hp) || 1,
        attack: Number(source.attack) || 0,
        range: Number(source.range) || 0,
        fireRate: Number(source.fireRate) || 0,
        cost: Number(source.cost) || 0,
        cooldown: Number(source.cooldown) || 0,
        speed: Number(source.speed) || 0,
        reward: Number(source.reward) || 0,
        targeting: String(source.targeting || 'nearest'),
        projectileModelId: String(source.projectileModelId || '')
    };
}

export function normalizeActorTemplate(template) {
    var source = template && typeof template === 'object' ? template : {};
    var ms = Number(source.templateModelScale);
    return {
        id: String(source.id || uid('template')),
        name: String(source.name || 'Actor 模板'),
        category: String(source.category || 'model'),
        modelId: String(source.modelId || ''),
        modelPath: String(source.modelPath || ''),
        icon: String(source.icon || (source.name || 'A').charAt(0)).slice(0, 2),
        templateModelScale:
            Number.isFinite(ms) && ms > 0 ? Math.min(Math.max(ms, 0.1), 8) : 1,
        stats: normalizeStats(source.stats)
    };
}

export function normalizeActors(actors, seed) {
    var list = Array.isArray(actors) ? actors : [];
    if (!list.length && Array.isArray(seed.props)) {
        list = seed.props.map(function (prop, index) {
            return {
                id: prop.id || 'actor-' + (index + 1),
                templateId: 'explore-item',
                name: prop.label || '模型 Actor',
                category: 'model',
                icon: 'M',
                modelId: prop.assetId || '',
                col: 6 + index,
                row: 6,
                rotation: 0,
                scale: 1,
                team: 'neutral',
                stats: { hp: 1, attack: 0, range: 1, fireRate: 0, cost: 0, cooldown: 0 }
            };
        });
    }
    return list.map(function (actor, index) {
        var source = actor && typeof actor === 'object' ? actor : {};
        var wx = source.worldOffsetMeters && typeof source.worldOffsetMeters === 'object' ? source.worldOffsetMeters : {};
        return {
            id: String(source.id || 'actor-' + (index + 1)),
            templateId: String(source.templateId || ''),
            name: String(source.name || source.label || 'Actor ' + (index + 1)),
            category: String(source.category || 'model'),
            icon: String(source.icon || (source.name || 'A').charAt(0)).slice(0, 2),
            modelId: String(source.modelId || source.assetId || ''),
            col: clamp(Number(source.col) || 0, 0, 79),
            row: clamp(Number(source.row) || 0, 0, 79),
            rotation: Number.isFinite(Number(source.rotation)) ? Number(source.rotation) : 0,
            scale: Number.isFinite(Number(source.scale)) && Number(source.scale) > 0 ? Number(source.scale) : 1,
            worldOffsetMeters: {
                x: Number(wx.x) || 0,
                y: Number(wx.y) || 0,
                z: Number(wx.z) || 0
            },
            modelPath: String(source.modelPath || ''),
            team: String(source.team || 'neutral'),
            stats: normalizeStats(source.stats)
        };
    });
}

// ---------------------------------------------------------------------------
// 敌人 / 波次 / 模式配置
// ---------------------------------------------------------------------------

export function normalizeEnemyTypes(enemyTypes, seed) {
    var list = Array.isArray(enemyTypes) ? enemyTypes : [];
    if (!list.length && seed.rosters && Array.isArray(seed.rosters.enemyTypes)) {
        list = seed.rosters.enemyTypes.map(function (id) {
            return { id: id, name: id, hp: 100, speed: 1, reward: 20, modelId: '' };
        });
    }
    if (!list.length) {
        list = [{ id: 'enemy-drone', name: '侦察无人机', hp: 80, speed: 1.25, reward: 20, modelId: '' }];
    }
    return list.map(function (enemy) {
        var esc = Number(enemy.modelScale);
        return {
            id: String(enemy.id || slugify(enemy.name) || uid('enemy')),
            name: String(enemy.name || enemy.id || '敌人'),
            modelId: String(enemy.modelId || ''),
            modelPath: String(enemy.modelPath || ''),
            modelScale: Number.isFinite(esc) && esc > 0 ? Math.min(Math.max(esc, 0.1), 8) : 1,
            hp: Number(enemy.hp) || 100,
            speed: Number(enemy.speed) || 1,
            reward: Number(enemy.reward) || 20
        };
    });
}

export function normalizeWaveRules(waveRules, seed) {
    var list = Array.isArray(waveRules) ? waveRules : [];
    var legacyWaves = seed.modeProfiles && seed.modeProfiles.towerDefense && seed.modeProfiles.towerDefense.waves;
    if (!list.length && Array.isArray(legacyWaves)) {
        list = legacyWaves.map(function (wave) {
            return {
                id: uid('wave'),
                waveNumber: wave.waveNumber,
                enemyTypeId: Array.isArray(wave.enemyPool) ? wave.enemyPool[0] : '',
                count: wave.count,
                interval: 1,
                spawnPointId: '',
                pathId: 'path-main',
                reward: wave.reward
            };
        });
    }
    return list.map(function (wave, index) {
        var ovs = Number(wave.overrideModelScale);
        return {
            id: String(wave.id || 'wave-' + (index + 1)),
            waveNumber: Math.max(1, Number(wave.waveNumber) || index + 1),
            enemyTypeId: String(wave.enemyTypeId || ''),
            count: Math.max(1, Number(wave.count) || 10),
            interval: Math.max(0.1, Number(wave.interval) || 1),
            spawnPointId: String(wave.spawnPointId || ''),
            pathId: String(wave.pathId || 'path-main'),
            reward: Math.max(0, Number(wave.reward) || 50),
            overrideModelPath: String(wave.overrideModelPath || ''),
            overrideModelScale:
                Number.isFinite(ovs) && ovs > 0 ? Math.min(Math.max(ovs, 0.1), 8) : 1
        };
    });
}

export function normalizeModeProfiles(modeProfiles) {
    var source = modeProfiles && typeof modeProfiles === 'object' ? modeProfiles : {};
    return {
        towerDefense: source.towerDefense && typeof source.towerDefense === 'object' ? source.towerDefense : { enabled: true },
        exploration: source.exploration && typeof source.exploration === 'object' ? source.exploration : { enabled: true }
    };
}

// ---------------------------------------------------------------------------
// 出生点 / 探索点
// ---------------------------------------------------------------------------

export function normalizeSpawnPoints(points, legacyTd) {
    var list = Array.isArray(points) ? points : [];
    if (!list.length && Array.isArray(legacyTd.spawnRoutes)) {
        list = legacyTd.spawnRoutes.map(function (route, index) {
            return { id: route.id || 'spawn-' + (index + 1), name: route.label || route.entry || '敌人出口 ' + (index + 1), col: 0, row: 2 + index * 3, pathId: 'path-main' };
        });
    }
    return list.map(function (point, index) {
        return {
            id: String(point.id || 'spawn-' + (index + 1)),
            name: String(point.name || point.label || '敌人出口 ' + (index + 1)),
            col: clamp(Number(point.col) || 0, 0, 79),
            row: clamp(Number(point.row) || (2 + index * 3), 0, 79),
            pathId: String(point.pathId || 'path-main')
        };
    });
}

export function normalizeExplorePoints(points, legacyExplore) {
    var list = Array.isArray(points) ? points : Array.isArray(legacyExplore.points) ? legacyExplore.points : [];
    return list.map(function (point, index) {
        return {
            id: String(point.id || 'poi-' + (index + 1)),
            name: String(point.name || point.label || '探索点 ' + (index + 1)),
            col: clamp(Number(point.col) || (4 + index * 2), 0, 79),
            row: clamp(Number(point.row) || 4, 0, 79),
            modelId: String(point.modelId || ''),
            interaction: String(point.interaction || point.kind || 'inspect'),
            radius: Math.max(0, Number(point.radius || 2))
        };
    });
}

// ---------------------------------------------------------------------------
// 探索玩法数值规整
// ---------------------------------------------------------------------------

export var EXPLORE_GAMEPLAY_STORE_KEYS = [
    'moveSpeedWalk',
    'moveSpeedRun',
    'attackCooldownSec',
    'skillECooldownSec',
    'skillRCooldownSec',
    'moneyDropRespawnIntervalSec',
    'exploreEnemySpawnIntervalSec',
    'enemyMaxConcurrent',
    'enemyBaseHp',
    'enemyHpPerLevel',
    'enemyBaseSpeed',
    'enemySpeedPerLevel',
    'enemyBaseDamage',
    'enemyDamagePerLevel',
    'enemyAggroRange',
    'enemyAttackCooldown'
];

export function normalizeExploreGameplayNormalized(raw) {
    var src = raw && typeof raw === 'object' ? raw : {};
    var out = {};
    EXPLORE_GAMEPLAY_STORE_KEYS.forEach(function (key) {
        var v = Number(src[key]);
        if (!Number.isFinite(v)) return;
        out[key] = key === 'enemyMaxConcurrent' ? Math.round(v) : v;
    });
    return out;
}

// ---------------------------------------------------------------------------
// 地理 / Cesium
// ---------------------------------------------------------------------------

export function normalizeGeoConfig(geo) {
    var source = geo && typeof geo === 'object' ? geo : {};
    var center = source.center && typeof source.center === 'object' ? source.center : {};
    return {
        enabled: !!source.enabled,
        provider: String(source.provider || 'cesium-ion'),
        assetId: String(source.assetId || DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID),
        center: {
            lat: Number(center.lat) || 0,
            lon: Number(center.lon) || 0,
            heightMeters: Number(center.heightMeters) || 0
        },
        extentMeters: Number(source.extentMeters) || 1000,
        rotationDeg: Number(source.rotationDeg) || 0,
        yOffsetMeters: Number(source.yOffsetMeters) || 0,
        boardHeightMeters: Number(source.boardHeightMeters) || 32,
        scale: Number(source.scale) || 1
    };
}

export function makeGeoConfig(lat, lon, extentMeters) {
    return normalizeGeoConfig({
        enabled: true,
        provider: 'cesium-ion',
        assetId: DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID,
        center: { lat: lat, lon: lon, heightMeters: 0 },
        extentMeters: extentMeters,
        rotationDeg: 0,
        yOffsetMeters: 0,
        boardHeightMeters: 32,
        scale: 1
    });
}

export function visitCoordinatePairs(value, visitor) {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
        visitor(Number(value[0]), Number(value[1]));
        return;
    }
    value.forEach(function (item) { visitCoordinatePairs(item, visitor); });
}

export function geometryCenter(coordinates) {
    var bounds = { minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity };
    visitCoordinatePairs(coordinates, function (lon, lat) {
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
        bounds.minLon = Math.min(bounds.minLon, lon);
        bounds.maxLon = Math.max(bounds.maxLon, lon);
        bounds.minLat = Math.min(bounds.minLat, lat);
        bounds.maxLat = Math.max(bounds.maxLat, lat);
    });
    if (!Number.isFinite(bounds.minLon) || !Number.isFinite(bounds.minLat)) return null;
    return {
        lon: (bounds.minLon + bounds.maxLon) / 2,
        lat: (bounds.minLat + bounds.maxLat) / 2
    };
}

export async function fetchCountryCapitalCoords() {
    try {
        var response = await fetch('https://restcountries.com/v3.1/all?fields=cca3,capitalInfo', { cache: 'force-cache' });
        if (!response.ok) return {};
        var rows = await response.json();
        return (Array.isArray(rows) ? rows : []).reduce(function (acc, row) {
            var code = String(row.cca3 || '').toUpperCase();
            var latlng = row.capitalInfo && row.capitalInfo.latlng;
            if (code && Array.isArray(latlng) && latlng.length >= 2) {
                acc[code] = { lat: Number(latlng[0]), lon: Number(latlng[1]) };
            }
            return acc;
        }, {});
    } catch (error) {
        return {};
    }
}

export function countryGeoFromFeature(feature, code, remoteCapitals) {
    var EG = typeof EarthGuardianCountryGeo !== 'undefined' ? EarthGuardianCountryGeo : null;
    var k = String(code || '').toUpperCase();
    var remote = remoteCapitals && remoteCapitals[k];
    var resolved = EG ? EG.resolveCenterForEditor(k, remote) : null;
    if (resolved && Number.isFinite(resolved.lat) && Number.isFinite(resolved.lon)) {
        return makeGeoConfig(resolved.lat, resolved.lon, 2200);
    }
    var center = geometryCenter(feature && feature.geometry && feature.geometry.coordinates);
    return center ? makeGeoConfig(center.lat, center.lon, 3200) : null;
}

export function geoFromLonLatArray(center, extentMeters) {
    if (!Array.isArray(center) || center.length < 2) return null;
    var lon = Number(center[0]);
    var lat = Number(center[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return makeGeoConfig(lat, lon, extentMeters || 1600);
}

// ---------------------------------------------------------------------------
// 棋盘主题色彩
// ---------------------------------------------------------------------------

export function normalizeEditorThemeColorHex(raw, fallbackHex) {
    var fb =
        typeof fallbackHex === 'string' && /^#[0-9a-fA-F]{6}$/.test(fallbackHex)
            ? ('#' + fallbackHex.slice(1).toLowerCase())
            : '#5a7d82';
    if (raw === null || raw === undefined || raw === '') return fb;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return '#' + ((Math.floor(raw) >>> 0) & 0xffffff).toString(16).padStart(6, '0');
    }
    var s = String(raw).trim();
    if (/^#[0-9a-fA-F]{6}$/i.test(s)) return ('#' + s.slice(1).toLowerCase());
    if (/^#[0-9a-fA-F]{3}$/i.test(s)) {
        return ('#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toLowerCase();
    }
    if (/^0x[0-9a-fA-F]{1,8}$/i.test(s)) {
        var px = Number.parseInt(s.slice(2), 16);
        if (Number.isFinite(px)) return '#' + ((px >>> 0) & 0xffffff).toString(16).padStart(6, '0');
    }
    var decDig = /^[0-9]+$/.test(s) ? Number(s) : NaN;
    if (Number.isFinite(decDig) && decDig >= 0 && decDig <= 0xffffff) {
        return '#' + ((Math.floor(decDig) >>> 0) & 0xffffff).toString(16).padStart(6, '0');
    }
    return fb;
}

export function normalizeTheme(theme) {
    var source = theme && typeof theme === 'object' ? theme : {};
    function clamp01(val, def) {
        var n = Number(val);
        if (!Number.isFinite(n)) return def;
        return Math.max(0, Math.min(1, n));
    }
    var ground = normalizeEditorThemeColorHex(source.ground, '#5a7d82');
    var groundAlt = normalizeEditorThemeColorHex(
        source.groundAlt != null ? source.groundAlt : source.ground,
        '#4f7178'
    );
    var pathCol = normalizeEditorThemeColorHex(
        source.path != null ? source.path : source.road,
        '#6f9288'
    );
    return {
        ground: ground,
        groundAlt: groundAlt,
        road: normalizeEditorThemeColorHex(
            source.road != null ? source.road : source.path != null ? source.path : pathCol,
            pathCol
        ),
        path: pathCol,
        obstacle: normalizeEditorThemeColorHex(source.obstacle, '#5d6870'),
        accent: normalizeEditorThemeColorHex(source.accent, '#8fb8ae'),
        fog: normalizeEditorThemeColorHex(
            source.fog != null ? source.fog : source.groundAlt != null ? source.groundAlt : source.ground,
            '#445c60'
        ),
        boardTextureUrl: String(source.boardTextureUrl || '').trim(),
        geoTileOpacity: clamp01(source.geoTileOpacity, 0.48),
        geoPathOpacity: clamp01(source.geoPathOpacity, 0.92),
        boardBaseOpacity: clamp01(source.boardBaseOpacity, 0.42),
        gridLineOpacity: clamp01(source.gridLineOpacity, 0.42),
        rimOpacity: clamp01(source.rimOpacity, 0.32),
        pathGlowOpacity: clamp01(source.pathGlowOpacity, 0.46),
        pathDetailOpacity: clamp01(source.pathDetailOpacity, 0.82),
        hoverCellOpacity: clamp01(source.hoverCellOpacity, 0.42),
        hoverColorOk: normalizeEditorThemeColorHex(source.hoverColorOk, '#6a988c'),
        hoverColorBad: normalizeEditorThemeColorHex(source.hoverColorBad, '#d87880')
    };
}

// ---------------------------------------------------------------------------
// 敌人路径
// ---------------------------------------------------------------------------

export function normalizeEnemyPaths(paths, fallbackRoads) {
    var roadsCopy = fallbackRoads && fallbackRoads.length ? normalizeCells(fallbackRoads) : [];
    var list = Array.isArray(paths) && paths.length ? paths : [];
    var mapped =
        list.length === 0 && roadsCopy.length
            ? [{ id: 'path-main', name: '主敌人路径', cells: roadsCopy.map(function (c) { return normalizeCell(c); }) }]
            : list.map(function (path, index) {
                  return {
                      id: String(path.id || 'path-' + (index + 1)),
                      name: String(path.name || path.label || '敌人路径 ' + (index + 1)),
                      cells: normalizeCells(path.cells || path.path || [])
                  };
              });
    if (
        mapped[0] &&
        (!mapped[0].cells || !mapped[0].cells.length) &&
        roadsCopy.length
    ) {
        mapped[0].cells = roadsCopy.slice();
    }
    return mapped.length
        ? mapped
        : [{ id: 'path-main', name: '主敌人路径', cells: [] }];
}

// ---------------------------------------------------------------------------
// 目录 / 资产 目录项规整
// ---------------------------------------------------------------------------

export function normalizeCatalog(catalog) {
    var source = catalog && typeof catalog === 'object' ? catalog : {};
    var normalized = {};
    [
        'gameTypes',
        'phaseTypes',
        'resourceTypes',
        'floorTextures',
        'modelAssets',
        'explorationModes',
        'towerTypes',
        'enemyTypes',
        'creatureTypes',
        'uiModules'
    ].forEach(function (key) {
        normalized[key] = Array.isArray(source[key]) ? source[key].map(normalizeCatalogItem) : [];
    });
    return normalized;
}

export function normalizeCatalogItem(item) {
    var next = item && typeof item === 'object' ? item : {};
    return {
        id: String(next.id || slugify(next.name || '') || uid('asset')),
        name: String(next.name || next.id || '未命名资产'),
        summary: String(next.summary || ''),
        path: String(next.path || next.url || '')
    };
}

export function normalizeEditorAssetsCatalog(raw) {
    return Array.isArray(raw) ? raw.map(function (item) {
        var next = item && typeof item === 'object' ? item : {};
        return {
            id: String(next.id || uid('editor-asset')),
            name: String(next.name || '未命名资源'),
            assetType: String(next.assetType || 'Enemies'),
            resourceKind: String(next.resourceKind || 'enemies'),
            cityCode: String(next.cityCode || ''),
            cityName: String(next.cityName || ''),
            path: String(next.path || ''),
            projectPath: String(next.projectPath || next.path || ''),
            publicUrl: String(next.publicUrl || next.path || ''),
            summary: String(next.summary || ''),
            updatedAt: String(next.updatedAt || '')
        };
    }) : [];
}


export function normalizeExplorationLayout(layout, fallbackMap) {
    var source = layout && typeof layout === 'object' ? layout : {};
    var grid = source.grid && typeof source.grid === 'object' ? source.grid : fallbackMap.grid;
    var normalized = {
        grid: {
            cols: clamp(Number(grid.cols) || fallbackMap.grid.cols || DEFAULT_GRID_COLS, 8, 80),
            rows: clamp(Number(grid.rows) || fallbackMap.grid.rows || DEFAULT_GRID_ROWS, 8, 80),
            tileSize: clamp(Number(grid.tileSize) || fallbackMap.grid.tileSize || DEFAULT_TILE_SIZE, 1, 10)
        },
        theme: normalizeTheme(source.theme || fallbackMap.theme),
        path: normalizeCells(source.path || []),
        obstacles: normalizeCells(source.obstacles || []),
        safeZones: normalizeCells(source.safeZones || []),
        startPoint: normalizePoint(source.startPoint) || { id: 'explore-start', name: '探索起点', col: 0, row: Math.floor((fallbackMap.grid.rows || DEFAULT_GRID_ROWS) / 2) },
        exitPoint: normalizePoint(source.exitPoint) || { id: 'explore-exit', name: '探索终点', col: Math.max(0, (fallbackMap.grid.cols || DEFAULT_GRID_COLS) - 4), row: Math.floor((fallbackMap.grid.rows || DEFAULT_GRID_ROWS) / 2) },
        gameplay: normalizeExploreGameplayNormalized(source.gameplay || {})
    };
    return normalized;
}


// ---------------------------------------------------------------------------
// 音频规整函数

export function defaultGlobalAudio() {
    return {
        menuBgmUrl: '',
        towerBuildSfxUrl: '',
        towerAttackDefaultSfxUrl: '',
        defenseEnemyDeathSfxUrl: '',
        exploreBasicAttackSfxUrl: '',
        exploreEnemyDeathSfxUrl: '',
        explorePlayerHitSfxUrl: '',
        towerAttackSfxByBuildId: {}
    };
}

export function normalizeGlobalAudio(raw) {
    var d = defaultGlobalAudio();
    var src = raw && typeof raw === 'object' ? raw : {};
    d.menuBgmUrl = String(src.menuBgmUrl || '').trim();
    d.towerBuildSfxUrl = String(src.towerBuildSfxUrl || '').trim();
    d.towerAttackDefaultSfxUrl = String(src.towerAttackDefaultSfxUrl || '').trim();
    d.defenseEnemyDeathSfxUrl = String(src.defenseEnemyDeathSfxUrl || '').trim();
    d.exploreBasicAttackSfxUrl = String(src.exploreBasicAttackSfxUrl || '').trim();
    d.exploreEnemyDeathSfxUrl = String(src.exploreEnemyDeathSfxUrl || '').trim();
    d.explorePlayerHitSfxUrl = String(src.explorePlayerHitSfxUrl || '').trim();
    var mv = editorVol01(src.menuBgmVolume);
    var bv = editorVol01(src.towerBuildSfxVolume);
    var av = editorVol01(src.towerAttackSfxVolume);
    var dv = editorVol01(src.defenseEnemyDeathSfxVolume);
    var eav = editorVol01(src.exploreBasicAttackSfxVolume);
    var edv = editorVol01(src.exploreEnemyDeathSfxVolume);
    var phv = editorVol01(src.explorePlayerHitSfxVolume);
    if (mv !== undefined) d.menuBgmVolume = mv;
    if (bv !== undefined) d.towerBuildSfxVolume = bv;
    if (av !== undefined) d.towerAttackSfxVolume = av;
    if (dv !== undefined) d.defenseEnemyDeathSfxVolume = dv;
    if (eav !== undefined) d.exploreBasicAttackSfxVolume = eav;
    if (edv !== undefined) d.exploreEnemyDeathSfxVolume = edv;
    if (phv !== undefined) d.explorePlayerHitSfxVolume = phv;
    d.towerAttackSfxByBuildId = {};
    if (src.towerAttackSfxByBuildId && typeof src.towerAttackSfxByBuildId === 'object') {
        TOWER_MODEL_SPECS.forEach(function (spec) {
            var u = String(src.towerAttackSfxByBuildId[spec.id] || '').trim();
            if (u) d.towerAttackSfxByBuildId[spec.id] = u;
        });
    }
    return d;
}

export function normalizeLevelAudioSource(raw) {
    var out = { defenseBgmUrl: '', exploreBgmUrl: '', towerAttackSfxByBuildId: {} };
    var src = raw && typeof raw === 'object' ? raw : {};
    out.defenseBgmUrl = String(src.defenseBgmUrl || '').trim();
    out.exploreBgmUrl = String(src.exploreBgmUrl || '').trim();
    var dBv = editorVol01(src.defenseBgmVolume);
    var eBv = editorVol01(src.exploreBgmVolume);
    var tV = editorVol01(src.towerAttackSfxVolume);
    if (dBv !== undefined) out.defenseBgmVolume = dBv;
    if (eBv !== undefined) out.exploreBgmVolume = eBv;
    if (tV !== undefined) out.towerAttackSfxVolume = tV;
    if (src.towerAttackSfxByBuildId && typeof src.towerAttackSfxByBuildId === 'object') {
        TOWER_MODEL_SPECS.forEach(function (spec) {
            var u = String(src.towerAttackSfxByBuildId[spec.id] || '').trim();
            if (u) out.towerAttackSfxByBuildId[spec.id] = u;
        });
    }
    return out;
}

export function defaultGlobalScreenUi() {
    return {
        startScreenBackgroundUrl: '',
        levelSelectBackgroundUrl: '',
        levelSelectBackgroundColor: '#0d1418',
        levelSelectAccentColor: '#8fb8ae'
    };
}

export function normalizeGlobalScreenUi(raw) {
    var d = defaultGlobalScreenUi();
    var src = raw && typeof raw === 'object' ? raw : {};
    d.startScreenBackgroundUrl = String(src.startScreenBackgroundUrl || '').trim();
    d.levelSelectBackgroundUrl = String(src.levelSelectBackgroundUrl || '').trim();
    var bgc = String(src.levelSelectBackgroundColor || '').trim();
    var acc = String(src.levelSelectAccentColor || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(bgc)) d.levelSelectBackgroundColor = bgc;
    if (/^#[0-9a-fA-F]{6}$/.test(acc)) d.levelSelectAccentColor = acc;
    return d;
}

export function defaultGameAssetConfig() {
    return {
        customModelUrls: {},
        customDropModelUrl: '',
        customPlayerModelUrl: '',
        customAnimationUrls: { idle: '', walk: '', run: '' },
        modelScales: { moneyDrop: 1, player: 1, machine: 1, cannon: 1, frost: 1, mine: 1, beacon: 1, stellar: 1, qinqiong: 1, liqingzhao: 1, bianque: 1 },
        playerExploreTransform: {
            offsetMeters: { x: 0, y: 0, z: 0 },
            rotationDeg: { x: 0, y: 0, z: 0 }
        },
        globalAudio: defaultGlobalAudio(),
        globalScreenUi: defaultGlobalScreenUi()
    };
}

export function normalizeGameAssetConfig(raw) {
    var d = defaultGameAssetConfig();
    var src = raw && typeof raw === 'object' ? raw : {};
    d.customModelUrls = src.customModelUrls && typeof src.customModelUrls === 'object' ? Object.assign({}, src.customModelUrls) : {};
    d.customDropModelUrl = String(src.customDropModelUrl || '');
    d.customPlayerModelUrl = String(src.customPlayerModelUrl || '');
    d.customAnimationUrls = Object.assign({}, d.customAnimationUrls, src.customAnimationUrls && typeof src.customAnimationUrls === 'object' ? src.customAnimationUrls : {});
    d.modelScales = Object.assign({}, d.modelScales, src.modelScales && typeof src.modelScales === 'object' ? src.modelScales : {});
    var defPt = defaultGameAssetConfig().playerExploreTransform;
    d.playerExploreTransform = {
        offsetMeters: Object.assign(
            {},
            defPt.offsetMeters,
            src.playerExploreTransform && src.playerExploreTransform.offsetMeters && typeof src.playerExploreTransform.offsetMeters === 'object'
                ? src.playerExploreTransform.offsetMeters
                : {}
        ),
        rotationDeg: Object.assign(
            {},
            defPt.rotationDeg,
            src.playerExploreTransform && src.playerExploreTransform.rotationDeg && typeof src.playerExploreTransform.rotationDeg === 'object'
                ? src.playerExploreTransform.rotationDeg
                : {}
        )
    };
    d.globalAudio = normalizeGlobalAudio(src.globalAudio);
    d.globalScreenUi = normalizeGlobalScreenUi(src.globalScreenUi);
    return d;
}

// ---------------------------------------------------------------------------
// 城市玩法配置规整

export function mergeDistinctStrings() {
    var bucket = [];
    for (var i = 0; i < arguments.length; i += 1) {
        var value = arguments[i];
        if (Array.isArray(value)) {
            value.forEach(function (item) {
                if (item && bucket.indexOf(String(item)) === -1) bucket.push(String(item));
            });
        } else if (value && bucket.indexOf(String(value)) === -1) {
            bucket.push(String(value));
        }
    }
    return bucket;
}

export function normalizeGameplayPlacement(value) {
    var placement = String(value || 'roadside').trim();
    return placement === 'road' || placement === 'on-road' || placement === 'path' ? 'road' : 'roadside';
}

var DEFAULT_RUNTIME_ENEMY_ARCHETYPE_META = {
    basic: {
        name: '标准敌人 (basic)',
        summary: '运行时塔防默认兵种；未换模时为球体占位。血量/速度/奖励会随波次上升。'
    },
    scout: {
        name: '高速侵察 (scout)',
        summary: '低血量、移速约×1.8；与默认 GLB monsterB.glb 对应（见 enemy-default-models）。'
    },
    hacker: {
        name: '干扰型 (hacker)',
        summary: '中等血量、奖励加成；中高波次随机出现。'
    },
    tank: {
        name: '重装单位 (tank)',
        summary: '高血量、慢移速、大体型；适合作为高威胁目标。'
    },
    swarm: {
        name: '集群强化 (swarm)',
        summary: '血量与奖励都较高，高波次低概率刷新。'
    }
};

function wave1EnemyArchetypeStats(archId) {
    var wave = 1;
    var hp = 78 + wave * 22;
    var speed = 2.0 + wave * 0.06;
    var reward = 12 + wave * 2;
    switch (archId) {
        case 'scout': hp *= 0.4; speed *= 1.8; break;
        case 'hacker': hp *= 1.2; reward *= 1.5; break;
        case 'tank': hp *= 3.5; speed *= 0.5; reward *= 2; break;
        case 'swarm': hp *= 1.5; reward *= 1.8; break;
        default: break;
    }
    return {
        hp: Math.max(1, Math.round(hp)),
        speed: Math.round(speed * 100) / 100,
        reward: Math.round(reward),
        attack: 0
    };
}

function buildDefaultEnemyEntries(config) {
    var cityName = config && config.cityName ? config.cityName : '';
    var cityCode = config && config.cityCode ? config.cityCode : '';
    var seen = Object.create(null);
    var list = [];
    ['basic', 'scout', 'hacker', 'tank', 'swarm'].forEach(function (archId) {
        var meta = DEFAULT_RUNTIME_ENEMY_ARCHETYPE_META[archId] || { name: archId, summary: '' };
        var st = wave1EnemyArchetypeStats(archId);
        seen[archId] = true;
        list.push({
            id: archId,
            name: meta.name,
            summary: meta.summary,
            tags: mergeDistinctStrings(cityName || '通用', 'enemy', 'runtime', archId),
            rarity: 'common',
            placement: '',
            stats: { hp: st.hp, attack: st.attack, speed: st.speed, reward: st.reward },
            assetRefs: {},
            cityCode: cityCode,
            cityName: cityName,
            updatedAt: ''
        });
    });
    DEFAULT_ACTOR_TEMPLATES.filter(function (tpl) {
        return tpl && tpl.category === 'enemy';
    }).forEach(function (tpl) {
        var id = String(tpl.id || uid('enemy'));
        if (seen[id]) return;
        seen[id] = true;
        var st = tpl.stats || {};
        list.push({
            id: id,
            name: String(tpl.name || tpl.id || '敌人'),
            summary: '来自 Actor 模板 / 关卡 JSON 的经典 ID，可与波次 enemyTypeId 共用；与上方 runtime 兵种可并存。',
            tags: mergeDistinctStrings(cityName || '通用', 'enemy', 'legacy'),
            rarity: 'common',
            placement: '',
            stats: {
                hp: Number(st.hp) || 100,
                attack: Number(st.attack) || 0,
                speed: Number(st.speed) > 0 ? Number(st.speed) : 1,
                reward: Number(st.reward) || 20
            },
            assetRefs: {},
            cityCode: cityCode,
            cityName: cityName,
            updatedAt: ''
        });
    });
    return list;
}

function buildDefaultTowerEntries(config) {
    var cityName = config && config.cityName ? config.cityName : '';
    var cityCode = config && config.cityCode ? config.cityCode : '';
    return TOWER_MODEL_SPECS.map(function (spec) {
        return {
            id: spec.id,
            name: spec.name,
            summary: '当前关卡可用防御塔，可在这里覆盖费用、射程、攻速和伤害。',
            tags: [cityName || '通用', spec.key].filter(Boolean),
            rarity: spec.id === 'stellar' || spec.id === 'qinqiong' || spec.id === 'liqingzhao' || spec.id === 'bianque' ? 'S' : 'common',
            placement: spec.id === 'mine' || spec.id === 'qinqiong' ? 'road' : 'roadside',
            stats: Object.assign({}, DEFAULT_TOWER_GAMEPLAY_STATS[spec.id] || {}),
            assetRefs: {},
            cityCode: cityCode,
            cityName: cityName,
            updatedAt: ''
        };
    });
}

function buildDefaultCardEntries(config) {
    var source = [].concat(config.characters || []).concat(config.skills || []);
    return source.map(function (entry) {
        var stats = entry.stats || {};
        return {
            id: (entry.id || uid('card')) + '-card',
            name: entry.name + ' 卡',
            summary: entry.summary || '由角色/技能条目生成的关卡卡片。',
            tags: mergeDistinctStrings(entry.tags || [], 'card'),
            rarity: entry.rarity || 'common',
            placement: entry.placement || '',
            stats: {
                cost: Number(stats.cost) || 0,
                weight: entry.rarity === 'S' ? 1 : 5,
                cooldown: Number(stats.cooldown) || 0,
                unlockWave: 1,
                maxCopies: 1
            },
            assetRefs: Object.assign({}, entry.assetRefs || {}),
            cityCode: entry.cityCode || config.cityCode || '',
            cityName: entry.cityName || config.cityName || '',
            updatedAt: ''
        };
    });
}

export function normalizeGameplayEntries(raw, kind) {
    return Array.isArray(raw) ? raw.map(function (item) {
        var next = item && typeof item === 'object' ? item : {};
        return {
            id: String(next.id || uid(kind)),
            name: String(next.name || GAMEPLAY_RESOURCE_CONFIG[kind].label + '条目'),
            summary: String(next.summary || ''),
            tags: Array.isArray(next.tags) ? next.tags.map(String) : [],
            rarity: String(next.rarity || 'common'),
            placement: kind === 'characters' ? normalizeGameplayPlacement(next.placement || next.deployPlacement || next.placementType) : '',
            stats: next.stats && typeof next.stats === 'object' ? next.stats : {},
            assetRefs: next.assetRefs && typeof next.assetRefs === 'object' ? next.assetRefs : {},
            cityCode: String(next.cityCode || ''),
            cityName: String(next.cityName || ''),
            updatedAt: String(next.updatedAt || '')
        };
    }) : [];
}

export function normalizeCityGameplayConfigs(raw) {
    var source = raw && typeof raw === 'object' ? raw : {};
    var normalized = {};
    Object.keys(source).forEach(function (key) {
        var item = source[key] && typeof source[key] === 'object' ? source[key] : {};
        normalized[key] = {
            cityCode: String(item.cityCode || key),
            cityName: String(item.cityName || ''),
            aliases: Array.isArray(item.aliases) ? item.aliases.map(String) : [],
            enemies: normalizeGameplayEntries(item.enemies, 'enemies'),
            characters: normalizeGameplayEntries(item.characters, 'characters'),
            skills: normalizeGameplayEntries(item.skills, 'skills'),
            towers: normalizeGameplayEntries(item.towers, 'towers'),
            cards: normalizeGameplayEntries(item.cards, 'cards'),
            updatedAt: String(item.updatedAt || '')
        };
        if (!normalized[key].towers.length) {
            normalized[key].towers = buildDefaultTowerEntries(normalized[key]);
        }
        if (!normalized[key].cards.length) {
            normalized[key].cards = buildDefaultCardEntries(normalized[key]);
        }
        if (!normalized[key].enemies.length) {
            normalized[key].enemies = buildDefaultEnemyEntries(normalized[key]);
        }
    });
    return normalized;
}

// ---------------------------------------------------------------------------
// 地图 / 关卡规整

export function createDefaultMap() {
    return {
        grid: { cols: DEFAULT_GRID_COLS, rows: DEFAULT_GRID_ROWS, tileSize: DEFAULT_TILE_SIZE },
        theme: {
            ground: '#5a7d82',
            groundAlt: '#4f7178',
            road: '#6f9288',
            obstacle: '#5d6870',
            accent: '#8fb8ae',
            fog: '#445c60'
        },
        terrain: [],
        roads: [],
        enemyPaths: [{ id: 'path-main', name: '主敌人路径', cells: [] }],
        obstacles: [],
        buildSlots: [],
        spawnPoints: [],
        enemyExits: [],
        objectivePoint: { id: 'objective-main', name: '防守核心', col: 24, row: 9 },
        explorationPoints: [],
        explorationLayout: {
            grid: { cols: DEFAULT_GRID_COLS, rows: DEFAULT_GRID_ROWS, tileSize: DEFAULT_TILE_SIZE },
            theme: {
                ground: '#5a7d82',
                groundAlt: '#4f7178',
                road: '#6f9288',
                obstacle: '#5d6870',
                accent: '#8fb8ae',
                fog: '#445c60'
            },
            path: [],
            obstacles: [],
            startPoint: { id: 'explore-start', name: '探索起点', col: 0, row: 9 },
            exitPoint: { id: 'explore-exit', name: '探索终点', col: 24, row: 9 }
        },
        geo: { enabled: false, provider: 'cesium-ion', assetId: DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID, center: { lat: 0, lon: 0, heightMeters: 0 }, extentMeters: 1000, rotationDeg: 0, yOffsetMeters: 0, boardHeightMeters: 32 },
        actors: [],
        boardImageLayers: []
    };
}

export function trimMapToBounds(map) {
    var cols = map.grid.cols;
    var rows = map.grid.rows;
    map.roads = map.roads.filter(inBounds(cols, rows));
    map.obstacles = map.obstacles.filter(inBounds(cols, rows));
    map.buildSlots = map.buildSlots.filter(inBounds(cols, rows));
    map.enemyPaths.forEach(function (path) { path.cells = path.cells.filter(inBounds(cols, rows)); });
    map.spawnPoints = map.spawnPoints.filter(inBounds(cols, rows));
    map.explorationPoints = map.explorationPoints.filter(inBounds(cols, rows));
    map.actors = map.actors.filter(inBounds(cols, rows));
    if (map.objectivePoint && !inBounds(cols, rows)(map.objectivePoint)) {
        map.objectivePoint = defaultObjectivePoint(map.grid);
    }
    if (map.explorationLayout) {
        map.explorationLayout.path = map.explorationLayout.path.filter(inBounds(cols, rows));
        map.explorationLayout.obstacles = map.explorationLayout.obstacles.filter(inBounds(cols, rows));
        if (Array.isArray(map.explorationLayout.safeZones)) {
            map.explorationLayout.safeZones = map.explorationLayout.safeZones.filter(inBounds(cols, rows));
        }
        if (map.explorationLayout.startPoint && !inBounds(cols, rows)(map.explorationLayout.startPoint)) {
            map.explorationLayout.startPoint = { id: 'explore-start', name: '探索起点', col: 0, row: Math.floor(rows / 2) };
        }
        if (map.explorationLayout.exitPoint && !inBounds(cols, rows)(map.explorationLayout.exitPoint)) {
            map.explorationLayout.exitPoint = { id: 'explore-exit', name: '探索终点', col: Math.max(0, cols - 4), row: Math.floor(rows / 2) };
        }
    }
    map.enemyExits = map.spawnPoints;
}

export function normalizeMap(map, seed) {
    var source = map && typeof map === 'object' ? map : {};
    var legacyTd = seed.modeProfiles && seed.modeProfiles.towerDefense || {};
    var legacyExplore = seed.modeProfiles && seed.modeProfiles.exploration || {};
    var normalized = createDefaultMap();
    if (source.grid) {
        normalized.grid.cols = clamp(Number(source.grid.cols) || DEFAULT_GRID_COLS, 8, 80);
        normalized.grid.rows = clamp(Number(source.grid.rows) || DEFAULT_GRID_ROWS, 8, 80);
        normalized.grid.tileSize = clamp(Number(source.grid.tileSize) || DEFAULT_TILE_SIZE, 1, 10);
    }
    normalized.geo = normalizeGeoConfig(source.geo);
    normalized.theme = normalizeTheme(source.theme);
    normalized.terrain = Array.isArray(source.terrain) ? source.terrain.map(normalizeCell) : [];
    normalized.roads = normalizeCells(source.roads || source.path || []);
    normalized.obstacles = normalizeCells(source.obstacles || []);
    normalized.buildSlots = normalizeCells(source.buildSlots || []);
    normalized.enemyPaths = normalizeEnemyPaths(source.enemyPaths, normalized.roads);
    normalized.spawnPoints = normalizeSpawnPoints(source.spawnPoints || source.enemyExits || [], legacyTd);
    normalized.enemyExits = normalized.spawnPoints;
    normalized.objectivePoint = normalizePoint(source.objectivePoint) || defaultObjectivePoint(normalized.grid, legacyTd);
    normalized.explorationPoints = normalizeExplorePoints(source.explorationPoints, legacyExplore);
    normalized.explorationLayout = normalizeExplorationLayout(source.explorationLayout, normalized);
    normalized.actors = normalizeActors(source.actors, seed);
    normalized.boardImageLayers = normalizeBoardImageLayers(source.boardImageLayers);
    normalized.levelAudio = normalizeLevelAudioSource(source.levelAudio);
    trimMapToBounds(normalized);
    return normalized;
}

export function normalizeLevel(level) {
    var source = level && typeof level === 'object' ? level : {};
    var location = normalizeLocation(source);
    var map = normalizeMap(source.map, source);
    var normalized = {
        id: String(source.id || source.code || uid('level')),
        folder: String(source.folder || source.id || source.code || 'custom-level'),
        name: String(source.name || '未命名关卡'),
        status: normalizeStatus(source.status, map),
        difficulty: clamp(Number(source.difficulty) || 3, 1, 5),
        description: String(source.description || source.desc || ''),
        location: location,
        environment: normalizeEnvironment(source.environment),
        map: map,
        actorTemplates: Array.isArray(source.actorTemplates) ? source.actorTemplates.map(normalizeActorTemplate) : undefined,
        enemyTypes: normalizeEnemyTypes(source.enemyTypes, source),
        waveRules: normalizeWaveRules(source.waveRules, source),
        modeProfiles: normalizeModeProfiles(source.modeProfiles),
        rosters: source.rosters && typeof source.rosters === 'object' ? source.rosters : {},
        props: Array.isArray(source.props) ? source.props : [],
        resources: Array.isArray(source.resources) ? source.resources : [],
        uiModules: Array.isArray(source.uiModules) ? source.uiModules : [],
        extensions: source.extensions && typeof source.extensions === 'object' ? source.extensions : {}
    };
    normalized.location.regionLabel = normalized.location.regionLabel || buildRegionLabel(normalized.location, source.region);
    return normalized;
}

/** Sort levels array inside a state-like object (in-place). Requires explicit target. */
export function sortLevels(targetState) {
    if (!targetState || !Array.isArray(targetState.levels)) return;
    targetState.levels.sort(function (left, right) {
        var a = (left.location.countryName + left.location.cityName + left.name).toLowerCase();
        var b = (right.location.countryName + right.location.cityName + right.name).toLowerCase();
        return a.localeCompare(b, 'zh-Hans-CN');
    });
}

export function normalizeState(raw) {
    var next = raw && typeof raw === 'object' ? raw : {};
    next.version = ENGINE_VERSION;
    next.savedAt = String(next.savedAt || '');
    next.catalog = normalizeCatalog(next.catalog);
    next.editorAssetsCatalog = normalizeEditorAssetsCatalog(next.editorAssetsCatalog);
    next.cityGameplayConfigs = normalizeCityGameplayConfigs(next.cityGameplayConfigs);
    next.gameAssetConfig = normalizeGameAssetConfig(next.gameAssetConfig);
    next.actorTemplates = Array.isArray(next.actorTemplates) && next.actorTemplates.length
        ? next.actorTemplates.map(normalizeActorTemplate)
        : clone(DEFAULT_ACTOR_TEMPLATES);
    next.levels = Array.isArray(next.levels) ? next.levels.map(normalizeLevel) : [];
    sortLevels(next);
    return next;
}
