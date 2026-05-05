// scripts/extend-normalizers.mjs
// Fixes encoding corruption in normalizers.js and appends all new normalizer functions.
import { readFileSync, writeFileSync } from 'fs';

const NORMALIZERS_PATH = 'Web/map/editor/normalizers.js';

let content = readFileSync(NORMALIZERS_PATH, 'utf8');

// Fix corrupted Chinese strings in normalizeExplorationLayout
content = content.replace(/name: '[^']*\u9e3a[^']*', col: 0/g, "name: '\u63a2\u7d22\u8d77\u70b9', col: 0");
content = content.replace(/name: '[^']*\u9e3a[^']*', col: Math/g, "name: '\u63a2\u7d22\u7ec8\u70b9', col: Math");

// Append new normalizer sections
const additions = `

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
        name: '\u6807\u51c6\u654c\u4eba (basic)',
        summary: '\u8fd0\u884c\u65f6\u5854\u9632\u9ed8\u8ba4\u5175\u79cd\uff1b\u672a\u6362\u6a21\u65f6\u4e3a\u7403\u4f53\u5360\u4f4d\u3002\u8840\u91cf/\u901f\u5ea6/\u5956\u52b1\u4f1a\u968f\u6ce2\u6b21\u4e0a\u5347\u3002'
    },
    scout: {
        name: '\u9ad8\u901f\u4fb5\u5bdf (scout)',
        summary: '\u4f4e\u8840\u91cf\u3001\u79fb\u901f\u7ea6\xd71.8\uff1b\u4e0e\u9ed8\u8ba4 GLB monsterB.glb \u5bf9\u5e94\uff08\u89c1 enemy-default-models\uff09\u3002'
    },
    hacker: {
        name: '\u5e72\u6270\u578b (hacker)',
        summary: '\u4e2d\u7b49\u8840\u91cf\u3001\u5956\u52b1\u52a0\u6210\uff1b\u4e2d\u9ad8\u6ce2\u6b21\u968f\u673a\u51fa\u73b0\u3002'
    },
    tank: {
        name: '\u91cd\u88c5\u5355\u4f4d (tank)',
        summary: '\u9ad8\u8840\u91cf\u3001\u6162\u79fb\u901f\u3001\u5927\u4f53\u578b\uff1b\u9002\u5408\u4f5c\u4e3a\u9ad8\u5a01\u80c1\u76ee\u6807\u3002'
    },
    swarm: {
        name: '\u96c6\u7fa4\u5f3a\u5316 (swarm)',
        summary: '\u8840\u91cf\u4e0e\u5956\u52b1\u90fd\u8f83\u9ad8\uff0c\u9ad8\u6ce2\u6b21\u4f4e\u6982\u7387\u5237\u65b0\u3002'
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
            tags: mergeDistinctStrings(cityName || '\u901a\u7528', 'enemy', 'runtime', archId),
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
            name: String(tpl.name || tpl.id || '\u654c\u4eba'),
            summary: '\u6765\u81ea Actor \u6a21\u677f / \u5173\u5361 JSON \u7684\u7ecf\u5178 ID\uff0c\u53ef\u4e0e\u6ce2\u6b21 enemyTypeId \u5171\u7528\uff1b\u4e0e\u4e0a\u65b9 runtime \u5175\u79cd\u53ef\u5e76\u5b58\u3002',
            tags: mergeDistinctStrings(cityName || '\u901a\u7528', 'enemy', 'legacy'),
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
            summary: '\u5f53\u524d\u5173\u5361\u53ef\u7528\u9632\u5fa1\u5854\uff0c\u53ef\u5728\u8fd9\u91cc\u8986\u76d6\u8d39\u7528\u3001\u5c04\u7a0b\u3001\u653b\u901f\u548c\u4f24\u5bb3\u3002',
            tags: [cityName || '\u901a\u7528', spec.key].filter(Boolean),
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
            name: entry.name + ' \u5361',
            summary: entry.summary || '\u7531\u89d2\u8272/\u6280\u80fd\u6761\u76ee\u751f\u6210\u7684\u5173\u5361\u5361\u7247\u3002',
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
            name: String(next.name || GAMEPLAY_RESOURCE_CONFIG[kind].label + '\u6761\u76ee'),
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
        enemyPaths: [{ id: 'path-main', name: '\u4e3b\u654c\u4eba\u8def\u5f84', cells: [] }],
        obstacles: [],
        buildSlots: [],
        spawnPoints: [],
        enemyExits: [],
        objectivePoint: { id: 'objective-main', name: '\u9632\u5b88\u6838\u5fc3', col: 24, row: 9 },
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
            startPoint: { id: 'explore-start', name: '\u63a2\u7d22\u8d77\u70b9', col: 0, row: 9 },
            exitPoint: { id: 'explore-exit', name: '\u63a2\u7d22\u7ec8\u70b9', col: 24, row: 9 }
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
            map.explorationLayout.startPoint = { id: 'explore-start', name: '\u63a2\u7d22\u8d77\u70b9', col: 0, row: Math.floor(rows / 2) };
        }
        if (map.explorationLayout.exitPoint && !inBounds(cols, rows)(map.explorationLayout.exitPoint)) {
            map.explorationLayout.exitPoint = { id: 'explore-exit', name: '\u63a2\u7d22\u7ec8\u70b9', col: Math.max(0, cols - 4), row: Math.floor(rows / 2) };
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
        name: String(source.name || '\u672a\u547d\u540d\u5173\u5361'),
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
`;

content = content + additions;

writeFileSync(NORMALIZERS_PATH, content, 'utf8');
console.log('normalizers.js updated. New line count:', content.split('\n').length);
