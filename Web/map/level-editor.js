(function () {
    'use strict';

    var API_URL = '/api/level-editor-config';
    var LOCAL_BACKUP_KEY = 'earth-guardian.level-engine.backup.v2';
    var LEGACY_BACKUP_KEY = 'earth-guardian.level-editor.backup.v1';
    var ENGINE_VERSION = 2;
    var DEFAULT_GRID_COLS = 28;
    var DEFAULT_GRID_ROWS = 18;
    var DEFAULT_TILE_SIZE = 2;
    var JINAN_MAP_TEXTURE_URL = '/Arts/Maps/jinan_full_map.png';
    var DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID = '2275207';
    var CITY_GEO_CONFIGS = {
        beijing: {
            enabled: true,
            provider: 'cesium-ion',
            assetId: DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID,
            center: { lat: 39.9163447, lon: 116.3971555, heightMeters: 45 },
            extentMeters: 1400,
            rotationDeg: 0,
            boardHeightMeters: 32
        },
        shanghai: {
            enabled: true,
            provider: 'cesium-ion',
            assetId: DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID,
            center: { lat: 31.2401, lon: 121.4908, heightMeters: 8 },
            extentMeters: 1400,
            rotationDeg: 0,
            boardHeightMeters: 32
        },
        guangzhou: {
            enabled: true,
            provider: 'cesium-ion',
            assetId: DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID,
            center: { lat: 23.1064, lon: 113.3245, heightMeters: 12 },
            extentMeters: 1400,
            rotationDeg: 0,
            boardHeightMeters: 34
        },
        shenzhen: {
            enabled: true,
            provider: 'cesium-ion',
            assetId: DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID,
            center: { lat: 22.5409, lon: 113.9507, heightMeters: 20 },
            extentMeters: 1400,
            rotationDeg: 0,
            boardHeightMeters: 34
        },
        jinan: {
            enabled: true,
            provider: 'cesium-ion',
            assetId: DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID,
            center: { lat: 36.6616, lon: 117.0204, heightMeters: 32 },
            extentMeters: 1200,
            rotationDeg: 0,
            boardHeightMeters: 62
        },
        jinanOlympic: {
            enabled: true,
            provider: 'cesium-ion',
            assetId: DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID,
            center: { lat: 36.655, lon: 117.118, heightMeters: 35 },
            extentMeters: 1200,
            rotationDeg: 0,
            boardHeightMeters: 42
        },
        paris: {
            enabled: true,
            provider: 'cesium-ion',
            assetId: DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID,
            center: { lat: 48.8583736, lon: 2.2944813, heightMeters: 40 },
            extentMeters: 2000,
            rotationDeg: 0,
            boardHeightMeters: 80,
            scale: 1
        }
    };
    var state = null;
    var selectedLevelId = new URLSearchParams(window.location.search).get('levelId') || '';
    var selectedObject = null;
    var selectedTemplateId = 'tower-machine';
    var activeTool = 'select';
    var activeStatusFilter = 'all';
    var activeWorkbench = 'level';
    var activeEditorMode = 'defense';
    var activeGameplayTab = 'enemies';
    var selectedGameplayEntryId = '';
    var selectedGameplayAssetId = '';
    var activeModelCategory = 'all';
    var selectedModelId = '';
    var modelAssetPreviewApi = null;
    var modelPreviewInitGeneration = 0;
    var viewportViewMode = 'board';
    var previewApi = null;
    var gameplayAssetPreviewApi = null;
    var previewInitGeneration = 0;
    var gameplayPreviewInitGeneration = 0;
    var previewRefreshTimer = null;
    var isDirty = false;
    var regionSources = { countries: [], chinaCities: [] };
    var contentBrowserMiniApi = null;
    var selectedContentBrowserAssetId = '';

    var refs = {
        levelSummary: document.getElementById('levelSummary'),
        btnGenerateRegions: document.getElementById('btnGenerateRegions'),
        btnCreateLevel: document.getElementById('btnCreateLevel'),
        btnReload: document.getElementById('btnReload'),
        btnExport: document.getElementById('btnExport'),
        btnSave: document.getElementById('btnSave'),
        levelSearch: document.getElementById('levelSearch'),
        statusFilters: document.getElementById('statusFilters'),
        levelTree: document.getElementById('levelTree'),
        currentLevelName: document.getElementById('currentLevelName'),
        currentLevelMeta: document.getElementById('currentLevelMeta'),
        overviewStats: document.getElementById('overviewStats'),
        workbenchTabs: document.getElementById('workbenchTabs'),
        levelWorkbench: document.getElementById('levelWorkbench'),
        gameplayWorkbench: document.getElementById('gameplayWorkbench'),
        levelInspectorWorkspace: document.getElementById('levelInspectorWorkspace'),
        gameplayInspectorWorkspace: document.getElementById('gameplayInspectorWorkspace'),
        editorModeTabs: document.getElementById('editorModeTabs'),
        gameplayResourceTabs: document.getElementById('gameplayResourceTabs'),
        gameplaySearch: document.getElementById('gameplaySearch'),
        gameplayCityTitle: document.getElementById('gameplayCityTitle'),
        gameplayCityMeta: document.getElementById('gameplayCityMeta'),
        gameplayOverviewStats: document.getElementById('gameplayOverviewStats'),
        btnCreateGameplayEntry: document.getElementById('btnCreateGameplayEntry'),
        gameplayEntryList: document.getElementById('gameplayEntryList'),
        gameplayEditorTitle: document.getElementById('gameplayEditorTitle'),
        gameplayEditorHint: document.getElementById('gameplayEditorHint'),
        btnMoveGameplayUp: document.getElementById('btnMoveGameplayUp'),
        btnMoveGameplayDown: document.getElementById('btnMoveGameplayDown'),
        btnDuplicateGameplayEntry: document.getElementById('btnDuplicateGameplayEntry'),
        btnDeleteGameplayEntry: document.getElementById('btnDeleteGameplayEntry'),
        gameplayPreviewTitle: document.getElementById('gameplayPreviewTitle'),
        gameplayPreviewMeta: document.getElementById('gameplayPreviewMeta'),
        gameplayAssetPreviewEmpty: document.getElementById('gameplayAssetPreviewEmpty'),
        gameplayAssetPreviewImage: document.getElementById('gameplayAssetPreviewImage'),
        gameplayAssetPreviewHost: document.getElementById('gameplayAssetPreviewHost'),
        gameplayEditorForm: document.getElementById('gameplayEditorForm'),
        gameplayName: document.getElementById('gameplayName'),
        gameplayId: document.getElementById('gameplayId'),
        gameplayTags: document.getElementById('gameplayTags'),
        gameplayRarity: document.getElementById('gameplayRarity'),
        gameplaySummary: document.getElementById('gameplaySummary'),
        gameplayStatGrid: document.getElementById('gameplayStatGrid'),
        gameplayInspectorMeta: document.getElementById('gameplayInspectorMeta'),
        gameplaySelectionMeta: document.getElementById('gameplaySelectionMeta'),
        gameplayAssetUpload: document.getElementById('gameplayAssetUpload'),
        gameplayAssetName: document.getElementById('gameplayAssetName'),
        gameplayAssetType: document.getElementById('gameplayAssetType'),
        gameplayAssetList: document.getElementById('gameplayAssetList'),
        mapGrid: document.getElementById('mapGrid'),
        mapStage: document.getElementById('mapStage'),
        activeToolLabel: document.getElementById('activeToolLabel'),
        fieldLevelName: document.getElementById('fieldLevelName'),
        fieldStatus: document.getElementById('fieldStatus'),
        fieldCountry: document.getElementById('fieldCountry'),
        fieldCity: document.getElementById('fieldCity'),
        fieldDifficulty: document.getElementById('fieldDifficulty'),
        fieldDescription: document.getElementById('fieldDescription'),
        fieldGridCols: document.getElementById('fieldGridCols'),
        fieldGridRows: document.getElementById('fieldGridRows'),
        fieldTileSize: document.getElementById('fieldTileSize'),
        fieldGeoEnabled: document.getElementById('fieldGeoEnabled'),
        fieldGeoLat: document.getElementById('fieldGeoLat'),
        fieldGeoLon: document.getElementById('fieldGeoLon'),
        fieldGeoHeight: document.getElementById('fieldGeoHeight'),
        fieldGeoExtent: document.getElementById('fieldGeoExtent'),
        fieldGeoRotation: document.getElementById('fieldGeoRotation'),
        fieldGeoYOffset: document.getElementById('fieldGeoYOffset'),
        fieldGeoBoardHeight: document.getElementById('fieldGeoBoardHeight'),
        fieldGeoAssetId: document.getElementById('fieldGeoAssetId'),
        btnResizeMap: document.getElementById('btnResizeMap'),
        btnDeleteSelection: document.getElementById('btnDeleteSelection'),
        selectionInspector: document.getElementById('selectionInspector'),
        actorPalette: document.getElementById('actorPalette'),
        btnCreateActorTemplate: document.getElementById('btnCreateActorTemplate'),
        waveList: document.getElementById('waveList'),
        btnAddWave: document.getElementById('btnAddWave'),
        modelUpload: document.getElementById('modelUpload'),
        modelAssetList: document.getElementById('modelAssetList'),
        statusBadge: document.getElementById('statusBadge'),
        statusText: document.getElementById('statusText'),
        towerModelList: document.getElementById('towerModelList'),
        gameAssetSection: document.getElementById('gameAssetSection'),
        boardViewport: document.getElementById('boardViewport'),
        previewStageWrap: document.getElementById('previewStageWrap'),
        viewportViewTabs: document.getElementById('viewportViewTabs'),
        editorToolRibbon: document.getElementById('editorToolRibbon'),
        previewHost: document.getElementById('previewHost'),
        contentBrowserList: document.getElementById('contentBrowserList'),
        contentBrowserReload: document.getElementById('contentBrowserReload'),
        contentBrowserPreviewHost: document.getElementById('contentBrowserPreviewHost'),
        stageHintExtra: document.getElementById('stageHintExtra'),
        previewGizmoTranslate: document.getElementById('previewGizmoTranslate'),
        previewGizmoRotate: document.getElementById('previewGizmoRotate'),
        previewGizmoScale: document.getElementById('previewGizmoScale'),
        previewFocusSelection: document.getElementById('previewFocusSelection'),
        previewSceneOutlineSection: document.getElementById('previewSceneOutlineSection'),
        previewSceneOutlineList: document.getElementById('previewSceneOutlineList'),
        modelWorkbench: document.getElementById('modelWorkbench'),
        modelCategoryTabs: document.getElementById('modelCategoryTabs'),
        modelSearch: document.getElementById('modelSearch'),
        modelEditorTitle: document.getElementById('modelEditorTitle'),
        modelEditorMeta: document.getElementById('modelEditorMeta'),
        modelOverviewStats: document.getElementById('modelOverviewStats'),
        modelEntryList: document.getElementById('modelEntryList'),
        modelListCount: document.getElementById('modelListCount'),
        modelDetailTitle: document.getElementById('modelDetailTitle'),
        modelDetailMeta: document.getElementById('modelDetailMeta'),
        modelDetailName: document.getElementById('modelDetailName'),
        modelDetailCategory: document.getElementById('modelDetailCategory'),
        modelDetailPath: document.getElementById('modelDetailPath'),
        modelPreviewEmpty: document.getElementById('modelPreviewEmpty'),
        modelPreviewHost: document.getElementById('modelPreviewHost'),
        modelPreviewMeta: document.getElementById('modelPreviewMeta'),
        modelUploadReplace: document.getElementById('modelUploadReplace'),
        modelInspectorWorkspace: document.getElementById('modelInspectorWorkspace'),
        modelInspectorStats: document.getElementById('modelInspectorStats'),
        modelInspectorUpload: document.getElementById('modelInspectorUpload'),
        modelInspectorUploadName: document.getElementById('modelInspectorUploadName'),
        modelInspectorUploadCategory: document.getElementById('modelInspectorUploadCategory')
    };

    var TOOL_LABELS = {
        select: '选择/拖拽',
        road: '道路',
        obstacle: '障碍',
        spawn: '敌人出口',
        path: '敌人路径',
        buildSlot: '塔位',
        objective: '防守目标',
        explorePoint: '探索点',
        actor: '模型 Actor',
        erase: '橡皮擦'
    };

    var MODEL_CATEGORY_CONFIG = {
        all: { label: '全部', folder: '', color: '#8b9bb4' },
        Enemy: { label: '敌人', folder: 'Enemy', color: '#e55c5c' },
        Tower: { label: '防御塔', folder: 'Tower', color: '#5c8be5' },
        Buildings: { label: '建筑', folder: 'Buildings', color: '#e5a35c' },
        Props: { label: '地形/阻挡物/地板', folder: 'Props', color: '#5ce58b' },
        Charactor: { label: '角色', folder: 'Charactor', color: '#c85ce5' }
    };

    var DEFAULT_ACTOR_TEMPLATES = [
        {
            id: 'tower-machine',
            name: '机枪塔 Actor',
            category: 'tower',
            modelId: '',
            icon: 'T',
            stats: { hp: 160, attack: 18, range: 4.5, fireRate: 1.7, cost: 80, cooldown: 0, targeting: 'nearest' }
        },
        {
            id: 'tower-cannon',
            name: '加农炮 Actor',
            category: 'tower',
            modelId: '',
            icon: 'C',
            stats: { hp: 220, attack: 58, range: 4.1, fireRate: 0.75, cost: 150, cooldown: 0, targeting: 'area' }
        },
        {
            id: 'enemy-drone',
            name: '侦察无人机',
            category: 'enemy',
            modelId: '',
            icon: 'E',
            stats: { hp: 80, attack: 8, speed: 1.25, reward: 20, range: 0, fireRate: 0, cost: 0 }
        },
        {
            id: 'enemy-heavy',
            name: '重甲敌人',
            category: 'enemy',
            modelId: '',
            icon: 'H',
            stats: { hp: 260, attack: 20, speed: 0.62, reward: 55, range: 0, fireRate: 0, cost: 0 }
        },
        {
            id: 'defense-core',
            name: '防守核心',
            category: 'objective',
            modelId: '',
            icon: 'O',
            stats: { hp: 1000, attack: 0, range: 0, fireRate: 0, cost: 0, cooldown: 0 }
        },
        {
            id: 'explore-item',
            name: '探索交互物',
            category: 'model',
            modelId: '',
            icon: 'M',
            stats: { hp: 1, attack: 0, range: 1.5, fireRate: 0, cost: 0, cooldown: 0 }
        },
        {
            id: 'npc-guide',
            name: '探索 NPC',
            category: 'npc',
            modelId: '',
            icon: 'N',
            stats: { hp: 100, attack: 0, range: 2, fireRate: 0, cost: 0, cooldown: 0 }
        }
    ];

    var TOWER_MODEL_SPECS = [
        { id: 'machine', key: 'Q', name: '机枪塔' },
        { id: 'cannon', key: 'W', name: '加农炮' },
        { id: 'frost', key: 'E', name: '冰霜塔' },
        { id: 'mine', key: 'R', name: '感应地雷' },
        { id: 'beacon', key: 'T', name: '能量信标' },
        { id: 'stellar', key: 'Y', name: '星辉棱镜·天河' },
        { id: 'qinqiong', key: '1', name: '秦琼·门神' },
        { id: 'liqingzhao', key: '2', name: '李清照·易安' },
        { id: 'bianque', key: '3', name: '扁鹊·神医' }
    ];

    var DEFAULT_TOWER_GAMEPLAY_STATS = {
        machine: { cost: 80, hp: 100, attack: 18, range: 4.5, fireRate: 1.7, splash: 0 },
        cannon: { cost: 150, hp: 120, attack: 58, range: 4.1, fireRate: 0.75, splash: 1.35 },
        frost: { cost: 125, hp: 100, attack: 9, range: 4.8, fireRate: 1.05, splash: 0 },
        mine: { cost: 55, hp: 1, attack: 105, range: 0.72, fireRate: 0, splash: 1.45 },
        beacon: { cost: 115, hp: 80, attack: 0, range: 3.3, fireRate: 0, splash: 0 },
        stellar: { cost: 320, hp: 420, attack: 86, range: 6.2, fireRate: 1.25, splash: 1.25 },
        qinqiong: { cost: 260, hp: 780, attack: 74, range: 1.2, fireRate: 1.15, splash: 0 },
        liqingzhao: { cost: 300, hp: 180, attack: 140, range: 7.2, fireRate: 0.62, splash: 2.35 },
        bianque: { cost: 240, hp: 260, attack: 90, range: 4.8, fireRate: 0.85, splash: 0 }
    };

    var GAMEPLAY_RESOURCE_CONFIG = {
        enemies: {
            label: '敌人',
            assetType: 'Enemies',
            empty: '当前城市还没有敌人条目。',
            stats: [
                { key: 'hp', label: '生命值', step: '1' },
                { key: 'attack', label: '攻击', step: '1' },
                { key: 'speed', label: '速度', step: '0.1' },
                { key: 'reward', label: '奖励', step: '1' }
            ]
        },
        characters: {
            label: '角色',
            assetType: 'Characters',
            empty: '当前城市还没有角色条目。',
            stats: [
                { key: 'hp', label: '生命值', step: '1' },
                { key: 'attack', label: '攻击', step: '1' },
                { key: 'cost', label: '部署消耗', step: '1' },
                { key: 'range', label: '范围', step: '0.1' }
            ]
        },
        skills: {
            label: '技能',
            assetType: 'Skills',
            empty: '当前城市还没有技能条目。',
            stats: [
                { key: 'damage', label: '伤害', step: '1' },
                { key: 'cooldown', label: '冷却', step: '0.1' },
                { key: 'cost', label: '消耗', step: '1' },
                { key: 'range', label: '范围', step: '0.1' }
            ]
        },
        towers: {
            label: '防御塔',
            assetType: 'Towers',
            empty: '当前关卡还没有可用防御塔配置。',
            stats: [
                { key: 'cost', label: '费用', step: '1' },
                { key: 'hp', label: '生命值', step: '1' },
                { key: 'attack', label: '攻击/治疗', step: '1' },
                { key: 'range', label: '范围', step: '0.1' },
                { key: 'fireRate', label: '攻速', step: '0.1' },
                { key: 'splash', label: '溅射/效果范围', step: '0.1' }
            ]
        },
        cards: {
            label: '卡片',
            assetType: 'Cards',
            empty: '当前关卡还没有卡片配置，可从角色/技能生成后再微调。',
            stats: [
                { key: 'cost', label: '费用/票券', step: '1' },
                { key: 'weight', label: '抽取权重', step: '0.1' },
                { key: 'cooldown', label: '冷却', step: '0.1' },
                { key: 'unlockWave', label: '解锁波次', step: '1' },
                { key: 'maxCopies', label: '最大张数', step: '1' }
            ]
        }
    };

    function defaultGameAssetConfig() {
        return {
            customModelUrls: {},
            customDropModelUrl: '',
            customPlayerModelUrl: '',
            customAnimationUrls: { idle: '', walk: '', run: '' },
            modelScales: { moneyDrop: 1, player: 1, machine: 1, cannon: 1, frost: 1, mine: 1, beacon: 1, stellar: 1, qinqiong: 1, liqingzhao: 1, bianque: 1 },
            playerExploreTransform: {
                offsetMeters: { x: 0, y: 0, z: 0 },
                rotationDeg: { x: 0, y: 0, z: 0 }
            }
        };
    }

    function normalizeGameAssetConfig(raw) {
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
        return d;
    }

    var BUILT_IN_CITY_LAYOUTS = {
        beijing: {
            aliases: ['北京', '北京市', '中国·北京', '中国 · 北京'],
            defenseName: '北京·帝都枢纽',
            exploreName: '北京·霓虹街区',
            geo: CITY_GEO_CONFIGS.beijing,
            defense: {
                theme: { ground: '#98d94e', groundAlt: '#8bc34a', road: '#ffecb3', obstacle: '#ff7043', accent: '#ffeb3b', fog: '#e1f5fe' },
                path: [{ col: 0, row: 13 }, { col: 5, row: 13 }, { col: 5, row: 9 }, { col: 10, row: 9 }, { col: 10, row: 4 }, { col: 18, row: 4 }, { col: 18, row: 11 }, { col: 27, row: 11 }],
                obstacles: cellsRect(2, 2, 4, 2).concat(cellsRect(12, 7, 3, 2), cellsRect(21, 3, 3, 3), cellsRect(2, 15, 5, 2), cellsRect(22, 14, 4, 2))
            },
            explore: {
                theme: { ground: '#111827', groundAlt: '#1f2937', road: '#374151', obstacle: '#f43f5e', accent: '#fff1f2', fog: '#030712' },
                path: [{ col: 3, row: 9 }, { col: 10, row: 9 }, { col: 10, row: 4 }, { col: 17, row: 4 }, { col: 17, row: 13 }, { col: 24, row: 13 }],
                obstacles: cellsRect(1, 1, 5, 3).concat(cellsRect(21, 1, 5, 4), cellsRect(3, 14, 4, 3), cellsRect(12, 8, 4, 2), cellsRect(22, 8, 3, 3))
            }
        },
        shanghai: {
            aliases: ['上海', '上海市', '中国·上海', '中国 · 上海'],
            defenseName: '上海·外滩沙城',
            exploreName: '上海·学院环廊',
            geo: CITY_GEO_CONFIGS.shanghai,
            defense: {
                theme: { ground: '#81d4fa', groundAlt: '#4fc3f7', road: '#ffffff', obstacle: '#ffab40', accent: '#ffe082', fog: '#e0f7fa' },
                path: [{ col: 0, row: 3 }, { col: 8, row: 3 }, { col: 8, row: 14 }, { col: 15, row: 14 }, { col: 15, row: 7 }, { col: 23, row: 7 }, { col: 23, row: 15 }, { col: 27, row: 15 }],
                obstacles: cellsRect(3, 8, 3, 3).concat(cellsRect(11, 2, 4, 2), cellsRect(18, 11, 3, 4), cellsRect(24, 2, 3, 3), cellsRect(1, 15, 4, 2))
            },
            explore: {
                theme: { ground: '#065f46', groundAlt: '#064e3b', road: '#047857', obstacle: '#10b981', accent: '#ecfdf5', fog: '#022c22' },
                path: [{ col: 4, row: 3 }, { col: 23, row: 3 }, { col: 23, row: 14 }, { col: 4, row: 14 }, { col: 4, row: 3 }],
                obstacles: cellsRect(8, 6, 4, 6).concat(cellsRect(16, 6, 4, 6), cellsRect(1, 7, 2, 4), cellsRect(25, 7, 2, 4))
            }
        },
        guangzhou: {
            aliases: ['广州', '广州市', '中国·广州', '中国 · 广州', '中国 · 广州市'],
            defenseName: '广州·南岭雪径',
            exploreName: '广州·夜港平台',
            geo: CITY_GEO_CONFIGS.guangzhou,
            defense: {
                theme: { ground: '#a5d6a7', groundAlt: '#81c784', road: '#fff9c4', obstacle: '#f06292', accent: '#ff8a65', fog: '#f1f8e9' },
                path: [{ col: 0, row: 9 }, { col: 4, row: 9 }, { col: 4, row: 3 }, { col: 12, row: 3 }, { col: 12, row: 12 }, { col: 20, row: 12 }, { col: 20, row: 5 }, { col: 27, row: 5 }],
                obstacles: cellsRect(1, 1, 3, 2).concat(cellsRect(7, 7, 3, 4), cellsRect(15, 2, 3, 3), cellsRect(22, 10, 4, 4), cellsRect(9, 15, 8, 2))
            },
            explore: {
                theme: { ground: '#1e3a8a', groundAlt: '#1e40af', road: '#1d4ed8', obstacle: '#60a5fa', accent: '#dbeafe', fog: '#172554' },
                path: [{ col: 2, row: 5 }, { col: 9, row: 5 }, { col: 9, row: 11 }, { col: 18, row: 11 }, { col: 18, row: 6 }, { col: 26, row: 6 }],
                obstacles: cellsRect(1, 13, 7, 3).concat(cellsRect(12, 2, 5, 3), cellsRect(20, 10, 5, 5), cellsRect(3, 8, 3, 2))
            }
        },
        shenzhen: {
            aliases: ['深圳', '深圳市', '中国·深圳', '中国 · 深圳', '中国 · 深圳市', '广东·深圳'],
            defenseName: '深圳·科技裂谷',
            exploreName: '深圳·欢乐海岸',
            geo: CITY_GEO_CONFIGS.shenzhen,
            defense: {
                theme: { ground: '#e1f5fe', groundAlt: '#b3e5fc', road: '#81d4fa', obstacle: '#ba68c8', accent: '#ffd54f', fog: '#f5f5f5' },
                path: [{ col: 0, row: 15 }, { col: 6, row: 15 }, { col: 6, row: 11 }, { col: 14, row: 11 }, { col: 14, row: 6 }, { col: 8, row: 6 }, { col: 8, row: 2 }, { col: 21, row: 2 }, { col: 21, row: 9 }, { col: 27, row: 9 }],
                obstacles: cellsRect(2, 3, 4, 4).concat(cellsRect(10, 14, 5, 3), cellsRect(17, 5, 3, 5), cellsRect(23, 12, 4, 4), cellsRect(11, 8, 2, 2))
            },
            explore: {
                theme: { ground: '#4c1d95', groundAlt: '#5b21b6', road: '#6d28d9', obstacle: '#8b5cf6', accent: '#ede9fe', fog: '#2e1065' },
                path: [{ col: 5, row: 15 }, { col: 5, row: 9 }, { col: 12, row: 9 }, { col: 12, row: 3 }, { col: 21, row: 3 }, { col: 21, row: 12 }, { col: 26, row: 12 }],
                obstacles: cellsRect(1, 2, 5, 5).concat(cellsRect(8, 13, 5, 3), cellsRect(15, 7, 4, 4), cellsRect(22, 15, 4, 2))
            }
        },
        jinan: {
            aliases: ['济南', '济南市', '山东·济南', '山东 · 济南', '中国·济南', '中国 · 济南', '中国 · 济南市'],
            defenseName: '济南·泉港栈桥',
            exploreName: '济南·趵突露台',
            geo: CITY_GEO_CONFIGS.jinan,
            defense: {
                theme: { ground: '#80cbc4', groundAlt: '#4db6ac', road: '#e0f2f1', obstacle: '#ffd54f', accent: '#ffab91', fog: '#e0f2f1' },
                path: [{ col: 0, row: 6 }, { col: 7, row: 6 }, { col: 7, row: 12 }, { col: 13, row: 12 }, { col: 13, row: 8 }, { col: 19, row: 8 }, { col: 19, row: 3 }, { col: 24, row: 3 }, { col: 24, row: 13 }, { col: 27, row: 13 }],
                obstacles: cellsRect(1, 1, 5, 3).concat(cellsRect(10, 3, 4, 3), cellsRect(15, 13, 5, 3), cellsRect(21, 6, 3, 4), cellsRect(3, 14, 5, 3))
            },
            explore: {
                theme: { ground: '#90a0b8', groundAlt: '#8598ae', road: '#e2ecff', obstacle: '#6078a0', accent: '#befffc', fog: '#a0b0c8' },
                path: [{ col: 2, row: 8 }, { col: 8, row: 8 }, { col: 8, row: 3 }, { col: 19, row: 3 }, { col: 19, row: 14 }, { col: 26, row: 14 }],
                obstacles: cellsRect(1, 1, 4, 3).concat(cellsRect(10, 10, 4, 4), cellsRect(15, 6, 3, 3), cellsRect(23, 2, 4, 4), cellsRect(4, 14, 5, 2))
            }
        }
    };

    function init() {
        bindEvents();
        loadState();
    }

    function bindEvents() {
        refs.btnReload.addEventListener('click', reloadState);
        refs.btnSave.addEventListener('click', saveState);
        refs.btnExport.addEventListener('click', exportState);
        refs.btnCreateLevel.addEventListener('click', createManualLevel);
        refs.btnGenerateRegions.addEventListener('click', function () { generateRegionLevelSkeletons(true); });
        refs.levelSearch.addEventListener('input', renderLevelTree);
        refs.btnResizeMap.addEventListener('click', applyMapSize);
        refs.btnDeleteSelection.addEventListener('click', deleteSelection);
        refs.btnCreateActorTemplate.addEventListener('click', createActorTemplateFromSelection);
        refs.btnAddWave.addEventListener('click', addWaveRule);
        refs.modelUpload.addEventListener('change', function () {
            if (refs.modelUpload.files && refs.modelUpload.files[0]) {
                uploadModelAsset(refs.modelUpload.files[0]);
            }
        });

        if (refs.workbenchTabs) {
            refs.workbenchTabs.addEventListener('click', function (event) {
                var button = event.target.closest('[data-workbench]');
                if (!button) return;
                activeWorkbench = button.getAttribute('data-workbench') || 'level';
                refs.workbenchTabs.querySelectorAll('[data-workbench]').forEach(function (item) {
                    item.classList.toggle('active', item === button);
                });
                if (activeWorkbench !== 'gameplay') disposeGameplayAssetPreview();
                if (activeWorkbench !== 'model') disposeModelAssetPreview();
                renderAll();
            });
        }

        if (refs.gameplayResourceTabs) {
            refs.gameplayResourceTabs.addEventListener('click', function (event) {
                var button = event.target.closest('[data-gameplay-tab]');
                if (!button) return;
                activeGameplayTab = button.getAttribute('data-gameplay-tab') || 'enemies';
                selectedGameplayEntryId = '';
                selectedGameplayAssetId = '';
                refs.gameplayResourceTabs.querySelectorAll('[data-gameplay-tab]').forEach(function (item) {
                    item.classList.toggle('active', item === button);
                });
                renderGameplayEditor();
            });
        }

        if (refs.gameplaySearch) refs.gameplaySearch.addEventListener('input', renderGameplayEditor);
        if (refs.btnCreateGameplayEntry) refs.btnCreateGameplayEntry.addEventListener('click', createGameplayEntry);
        if (refs.btnDuplicateGameplayEntry) refs.btnDuplicateGameplayEntry.addEventListener('click', duplicateGameplayEntry);
        if (refs.btnDeleteGameplayEntry) refs.btnDeleteGameplayEntry.addEventListener('click', deleteGameplayEntry);
        if (refs.btnMoveGameplayUp) refs.btnMoveGameplayUp.addEventListener('click', function () { moveGameplayEntry(-1); });
        if (refs.btnMoveGameplayDown) refs.btnMoveGameplayDown.addEventListener('click', function () { moveGameplayEntry(1); });

        if (refs.modelCategoryTabs) {
            refs.modelCategoryTabs.addEventListener('click', function (event) {
                var button = event.target.closest('[data-model-category]');
                if (!button) return;
                activeModelCategory = button.getAttribute('data-model-category') || 'all';
                selectedModelId = '';
                refs.modelCategoryTabs.querySelectorAll('[data-model-category]').forEach(function (item) {
                    item.classList.toggle('active', item.getAttribute('data-model-category') === activeModelCategory);
                });
                renderModelEditor();
            });
        }
        if (refs.modelSearch) refs.modelSearch.addEventListener('input', renderModelEditor);
        if (refs.modelEntryList) {
            refs.modelEntryList.addEventListener('click', function (event) {
                var item = event.target.closest('[data-model-id]');
                if (!item) return;
                selectedModelId = item.getAttribute('data-model-id') || '';
                renderModelEditor();
            });
        }
        if (refs.modelUploadReplace) {
            refs.modelUploadReplace.addEventListener('change', function () {
                if (refs.modelUploadReplace.files && refs.modelUploadReplace.files[0]) {
                    replaceSelectedModel(refs.modelUploadReplace.files[0]);
                }
            });
        }
        if (refs.modelInspectorUpload) {
            refs.modelInspectorUpload.addEventListener('change', function () {
                if (refs.modelInspectorUpload.files && refs.modelInspectorUpload.files[0]) {
                    uploadNewModelFromInspector(refs.modelInspectorUpload.files[0]);
                }
            });
        }
        if (refs.gameplayEntryList) {
            refs.gameplayEntryList.addEventListener('click', function (event) {
                var actionButton = event.target.closest('[data-gameplay-action]');
                if (actionButton) {
                    var action = actionButton.getAttribute('data-gameplay-action');
                    var id = actionButton.getAttribute('data-gameplay-entry-id') || '';
                    selectedGameplayEntryId = id;
                    if (action === 'duplicate') duplicateGameplayEntry();
                    if (action === 'delete') deleteGameplayEntry();
                    if (action === 'move-up') moveGameplayEntry(-1);
                    if (action === 'move-down') moveGameplayEntry(1);
                    return;
                }
                var button = event.target.closest('[data-gameplay-entry-id]');
                if (!button) return;
                selectedGameplayEntryId = button.getAttribute('data-gameplay-entry-id') || '';
                selectedGameplayAssetId = '';
                renderGameplayEditor();
            });
        }
        if (refs.gameplayEditorForm) {
            refs.gameplayEditorForm.addEventListener('input', function (event) {
                handleGameplayFormInput(event.target);
            });
            refs.gameplayEditorForm.addEventListener('change', function (event) {
                handleGameplayFormInput(event.target);
            });
        }
        if (refs.gameplayAssetType) refs.gameplayAssetType.addEventListener('change', renderGameplayEditor);
        if (refs.gameplayAssetUpload) {
            refs.gameplayAssetUpload.addEventListener('change', function () {
                if (refs.gameplayAssetUpload.files && refs.gameplayAssetUpload.files[0]) {
                    uploadGameplayAsset(refs.gameplayAssetUpload.files[0]);
                }
            });
        }
        if (refs.gameplayAssetList) {
            refs.gameplayAssetList.addEventListener('click', function (event) {
                var previewCard = event.target.closest('[data-asset-preview-id]');
                if (previewCard && !event.target.closest('[data-asset-bind]')) {
                    selectedGameplayAssetId = previewCard.getAttribute('data-asset-preview-id') || '';
                    renderGameplayEditor();
                    return;
                }
                var button = event.target.closest('[data-asset-bind]');
                if (!button) return;
                bindGameplayAsset(button.getAttribute('data-asset-id') || '', button.getAttribute('data-asset-bind') || 'imagePath');
            });
        }

        refs.statusFilters.addEventListener('click', function (event) {
            var button = event.target.closest('[data-status-filter]');
            if (!button) return;
            activeStatusFilter = button.getAttribute('data-status-filter') || 'all';
            refs.statusFilters.querySelectorAll('[data-status-filter]').forEach(function (item) {
                item.classList.toggle('active', item === button);
            });
            renderLevelTree();
        });

        refs.editorModeTabs.addEventListener('click', function (event) {
            var button = event.target.closest('[data-editor-mode]');
            if (!button) return;
            activeEditorMode = button.getAttribute('data-editor-mode') || 'defense';
            refs.editorModeTabs.querySelectorAll('[data-editor-mode]').forEach(function (item) {
                item.classList.toggle('active', item === button);
            });
            selectedObject = null;
            renderAll();
            refreshPreviewNow();
        });

        document.querySelectorAll('[data-tool]').forEach(function (button) {
            button.addEventListener('click', function () {
                activeTool = button.getAttribute('data-tool') || 'select';
                document.querySelectorAll('[data-tool]').forEach(function (item) {
                    item.classList.toggle('active', item === button);
                });
                refs.activeToolLabel.textContent = '当前工具：' + TOOL_LABELS[activeTool];
            });
        });

        refs.levelTree.addEventListener('click', function (event) {
            var button = event.target.closest('[data-level-id]');
            if (!button) return;
            selectLevel(button.getAttribute('data-level-id'));
        });

        refs.mapGrid.addEventListener('click', function (event) {
            var marker = event.target.closest('[data-object-kind]');
            if (marker) {
                selectObject(marker.getAttribute('data-object-kind'), marker.getAttribute('data-object-id'));
                return;
            }
            var cell = event.target.closest('[data-col][data-row]');
            if (!cell) return;
            handleCellAction(Number(cell.dataset.col), Number(cell.dataset.row));
        });

        refs.mapGrid.addEventListener('dragover', function (event) {
            /* gap:1px 与 padding 会导致 target 落到 #mapGrid 自身，不写 preventDefault 则浏览器禁止 drop */
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
        });

        refs.mapGrid.addEventListener('drop', function (event) {
            event.preventDefault();
            var level = getLevel();
            if (!level || !level.map || !level.map.grid) return;
            var cellEl = event.target.closest('.map-cell[data-col][data-row]');
            var resolved =
                cellEl ||
                (function () {
                    var nodes = document.elementsFromPoint(event.clientX, event.clientY);
                    for (var li = 0; li < nodes.length; li += 1) {
                        var n = nodes[li];
                        if (
                            n.classList &&
                            n.classList.contains('map-cell') &&
                            n.getAttribute('data-col') != null &&
                            n.getAttribute('data-row') != null
                        ) {
                            return n;
                        }
                    }
                    return mapGridPickCellFromClientPoint(event.clientX, event.clientY, level.map.grid);
                })();
            if (!resolved || resolved.getAttribute('data-col') == null) return;
            var col = Number(resolved.getAttribute('data-col'));
            var row = Number(resolved.getAttribute('data-row'));
            if (!Number.isFinite(col) || !Number.isFinite(row)) return;
            var payload = readDragPayload(event);
            if (!payload) return;
            if (payload.kind === 'template') placeActorFromTemplate(payload.id, col, row);
            if (payload.kind === 'actor') moveActor(payload.id, col, row);
            if (payload.kind === 'marker') moveMarker(payload.markerKind, payload.id, col, row);
        });

        bindLevelFields();
        bindGameAssetPanel();

        if (refs.previewSceneOutlineList) {
            refs.previewSceneOutlineList.addEventListener('click', function (event) {
                var btn = event.target.closest('[data-outline-actor]');
                if (!btn) return;
                var id = btn.getAttribute('data-outline-actor') || '';
                if (!id) return;
                selectObject('actor', id);
            });
        }

        if (refs.viewportViewTabs) {
            refs.viewportViewTabs.addEventListener('click', function (event) {
                var button = event.target.closest('[data-view-mode]');
                if (!button) return;
                wireViewportViewMode(button.getAttribute('data-view-mode') || 'board');
            });
        }

        if (refs.previewGizmoTranslate && refs.previewGizmoRotate && refs.previewGizmoScale) {
            refs.previewGizmoTranslate.addEventListener('click', function () {
                setPreviewToolbarMode('translate');
            });
            refs.previewGizmoRotate.addEventListener('click', function () {
                setPreviewToolbarMode('rotate');
            });
            refs.previewGizmoScale.addEventListener('click', function () {
                setPreviewToolbarMode('scale');
            });
        }

        if (refs.previewFocusSelection) {
            refs.previewFocusSelection.addEventListener('click', function () {
                if (previewApi && typeof previewApi.focusSelection === 'function') previewApi.focusSelection();
            });
        }

        if (refs.contentBrowserReload) {
            refs.contentBrowserReload.addEventListener('click', function () {
                void refreshGameModelsCatalog().then(function () {
                    renderContentBrowser();
                    setStatus('已刷新内容浏览器', 'idle');
                });
            });
        }

        window.addEventListener('resize', function () {
            if (viewportViewMode === 'preview' && previewApi && typeof previewApi.resize === 'function') {
                previewApi.resize();
            }
        });
    }

    function normalizeGameModelsForCatalog() {
        return (state && Array.isArray(state.gameModelsCatalog) ? state.gameModelsCatalog : []).map(function (entry) {
            var pub = String(entry.publicUrl || '');
            return {
                id: String(entry.id || ''),
                name: String(entry.name || entry.relativePath || '模型'),
                path: pub,
                publicUrl: pub,
                relativePath: String(entry.relativePath || ''),
                summary: entry.relativePath ? 'GameModels/' + String(entry.relativePath) : 'GameModels',
                source: 'gameModels'
            };
        });
    }

    function sanitizeStateForSave(src) {
        var o = JSON.parse(JSON.stringify(src));
        delete o.gameModelsCatalog;
        return o;
    }

    async function refreshGameModelsCatalog() {
        if (!state) return;
        try {
            var r = await fetch('/api/game-models/catalog', { cache: 'no-store' });
            if (!r.ok) return;
            var data = await r.json();
            state.gameModelsCatalog = Array.isArray(data.entries) ? data.entries : [];
        } catch (e) {
            console.warn('[GameModels catalog]', e);
            state.gameModelsCatalog = [];
        }
    }

    function parseFetchErrorBody(status, text) {
        var detail = String(text || '').trim();
        if (!detail) return 'HTTP ' + status;
        try {
            var j = JSON.parse(detail);
            if (j && typeof j === 'object' && j.error) return String(j.error);
        } catch (ignore) {}
        return detail.length > 220 ? detail.slice(0, 220) + '…' : detail;
    }

    /** 状态栏与列表上展示：优先文件名，完整路径放 title */
    function modelBindShortLabel(url) {
        if (!url) return '未配置';
        var s = String(url);
        var tail = s.split(/[/\\?#]/).filter(Boolean).pop() || s;
        tail = tail.replace(/\+/g, ' ');
        if (tail.length > 36) tail = tail.slice(0, 34) + '…';
        return tail;
    }

    async function uploadFileToProjectUrl(file, options) {
        if (options && options.gameModelsUpload) {
            var contentGm = await fileToBase64(file);
            var resGm = await fetch('/api/game-models/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: file.name,
                    content: contentGm,
                    subdirectory: options.gameModelsSubdir != null ? String(options.gameModelsSubdir) : ''
                })
            });
            var resTextGm = await resGm.text();
            if (!resGm.ok) {
                throw new Error(parseFetchErrorBody(resGm.status, resTextGm));
            }
            await refreshGameModelsCatalog();
            var payloadGm = {};
            try {
                payloadGm = JSON.parse(resTextGm);
            } catch (e2) {
                throw new Error('服务器返回非 JSON');
            }
            return String(payloadGm.publicUrl || '');
        }
        var cityContext = getGameplayCityContext();
        var payload = null;
        var content = await fileToBase64(file);
        if (cityContext) {
            var requestBody = {
                name: file.name,
                content: content,
                cityCode: cityContext.cityCode,
                cityName: cityContext.cityName,
                assetType: options && options.assetType ? options.assetType : 'LevelAssets',
                resourceKind: options && options.resourceKind ? options.resourceKind : 'level-asset',
                assetName: options && options.assetName ? options.assetName : file.name.replace(/\.[^.]+$/, '')
            };
            var projectResponse = await fetch('/api/editor-assets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            var prText = await projectResponse.text();
            if (!projectResponse.ok) throw new Error(parseFetchErrorBody(projectResponse.status, prText));
            try {
                payload = JSON.parse(prText);
            } catch (eJson) {
                throw new Error('服务器返回非 JSON');
            }
            rememberEditorAsset(payload, requestBody.resourceKind);
            return String(payload.publicUrl || '');
        }
        var response = await fetch('/api/upload-model', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: file.name, content: content })
        });
        var upText = await response.text();
        if (!response.ok) throw new Error(parseFetchErrorBody(response.status, upText));
        try {
            payload = JSON.parse(upText);
        } catch (eUp) {
            throw new Error('服务器返回非 JSON');
        }
        return String(payload.url || '');
    }

    function rememberEditorAsset(payload, resourceKind) {
        if (!payload || !payload.projectPath) return;
        state.editorAssetsCatalog = state.editorAssetsCatalog || [];
        var nextAsset = {
            id: String(payload.id || uid('editor-asset')),
            name: String(payload.name || '未命名资源'),
            assetType: String(payload.assetType || 'LevelAssets'),
            resourceKind: String(resourceKind || payload.resourceKind || 'level-asset'),
            cityCode: String(payload.cityCode || ''),
            cityName: String(payload.cityName || ''),
            path: String(payload.projectPath || ''),
            projectPath: String(payload.projectPath || ''),
            publicUrl: String(payload.publicUrl || ''),
            summary: String(payload.cityName || '') + ' · ' + String(payload.name || ''),
            updatedAt: new Date().toISOString()
        };
        state.editorAssetsCatalog = state.editorAssetsCatalog.filter(function (item) { return item.id !== nextAsset.id; });
        state.editorAssetsCatalog.push(nextAsset);
    }

    function renderGameAssetPanel() {
        if (!state || !state.gameAssetConfig || !refs.towerModelList) return;
        var g = state.gameAssetConfig;
        refs.towerModelList.innerHTML = TOWER_MODEL_SPECS.map(function (spec) {
            var url = g.customModelUrls[spec.id] || '';
            var sc = g.modelScales[spec.id] != null ? g.modelScales[spec.id] : 1;
            return [
                '<div class="game-asset-tower-row">',
                '  <div class="game-asset-tower-title">' + escapeHtml(spec.key + ' · ' + spec.name) + '</div>',
                '  <div class="game-asset-tower-upload-col" data-tower-drop="' +
                    escapeAttr(spec.id) +
                    '" title="从底部「项目模型」拖入到此列（整块区域均可接住）">',
                '    <label class="game-asset-upload tight">替换模型',
                '      <input type="file" data-tower-file="' + escapeAttr(spec.id) + '" accept=".glb,.gltf,.obj,model/gltf-binary,model/gltf+json" />',
                '    </label>',
                '    <div class="game-asset-tower-drop">拖入项目模型</div>',
                '  </div>',
                '  <label class="field-block game-asset-scale-tower"><span>缩放</span>',
                '    <input type="number" data-tower-scale="' + escapeAttr(spec.id) + '" min="0.1" max="8" step="0.1" value="' + String(sc) + '" />',
                '  </label>',
                '  <div class="asset-url-hint" title="' + escapeAttr(url || '未绑定塔防模型文件') + '">' + escapeHtml(url ? modelBindShortLabel(url) : '未配置') + '</div>',
                '</div>'
            ].join('');
        }).join('');

        var ps = document.getElementById('gaPropScale');
        var ys = document.getElementById('gaPlayerScale');
        if (ps) ps.value = String(g.modelScales.moneyDrop != null ? g.modelScales.moneyDrop : 1);
        if (ys) ys.value = String(g.modelScales.player != null ? g.modelScales.player : 1);

        var pt = g.playerExploreTransform || defaultGameAssetConfig().playerExploreTransform;
        var om = pt.offsetMeters || { x: 0, y: 0, z: 0 };
        var rd = pt.rotationDeg || { x: 0, y: 0, z: 0 };
        var elOx = document.getElementById('gaOffX');
        var elOy = document.getElementById('gaOffY');
        var elOz = document.getElementById('gaOffZ');
        var elRx = document.getElementById('gaRotX');
        var elRy = document.getElementById('gaRotY');
        var elRz = document.getElementById('gaRotZ');
        if (elOx) elOx.value = String(om.x != null ? om.x : 0);
        if (elOy) elOy.value = String(om.y != null ? om.y : 0);
        if (elOz) elOz.value = String(om.z != null ? om.z : 0);
        if (elRx) elRx.value = String(rd.x != null ? rd.x : 0);
        if (elRy) elRy.value = String(rd.y != null ? rd.y : 0);
        if (elRz) elRz.value = String(rd.z != null ? rd.z : 0);
    }

    function bindGameAssetPanel() {
        if (!refs.gameAssetSection) return;
        refs.gameAssetSection.addEventListener('change', function (e) {
            var t = e.target;
            if (!t || !state) return;
            (async function () {
                if (t.classList && t.classList.contains('ga-pt')) {
                    if (!state.gameAssetConfig.playerExploreTransform) {
                        state.gameAssetConfig.playerExploreTransform = defaultGameAssetConfig().playerExploreTransform;
                    }
                    var pt2 = state.gameAssetConfig.playerExploreTransform;
                    var n = Number(t.value);
                    if (!Number.isFinite(n)) n = 0;
                    var k = t.getAttribute('data-ga-pt');
                    if (k === 'ox') pt2.offsetMeters.x = n;
                    if (k === 'oy') pt2.offsetMeters.y = n;
                    if (k === 'oz') pt2.offsetMeters.z = n;
                    if (k === 'rx') pt2.rotationDeg.x = n;
                    if (k === 'ry') pt2.rotationDeg.y = n;
                    if (k === 'rz') pt2.rotationDeg.z = n;
                    markDirty('已更新探索出生点变换');
                    return;
                }
                if (t.getAttribute('data-tower-file')) {
                    var tid = t.getAttribute('data-tower-file');
                    var file = t.files && t.files[0];
                    t.value = '';
                    if (!file) return;
                    try {
                        setStatus('正在上传「' + file.name + '」…', 'idle');
                        var url = await uploadFileToProjectUrl(file, { gameModelsUpload: true, gameModelsSubdir: 'Tower' });
                        if (url) {
                            state.gameAssetConfig.customModelUrls[tid] = url;
                            markDirty('已更新塔防单位模型');
                            setStatus(
                                '已成功绑定塔防模型「' + file.name + '」 · ' + modelBindShortLabel(url) + '（悬停「当前文件」格可见完整路径）',
                                'success'
                            );
                        } else {
                            setStatus('模型上传后未返回公开 URL（需 dev /api/game-models/upload）', 'error');
                        }
                    } catch (err) {
                        setStatus((err && err.message) || '上传失败', 'error');
                    }
                    renderGameAssetPanel();
                    return;
                }
                if (t.getAttribute('data-tower-scale')) {
                    var sid = t.getAttribute('data-tower-scale');
                    state.gameAssetConfig.modelScales[sid] = clamp(Number(t.value) || 1, 0.1, 8);
                    markDirty('已更新塔防单位缩放');
                    return;
                }
                if (t.classList && t.classList.contains('ga-scale-input') && t.getAttribute('data-ga-scale')) {
                    var gk = t.getAttribute('data-ga-scale');
                    state.gameAssetConfig.modelScales[gk] = clamp(Number(t.value) || 1, 0.1, 8);
                    markDirty('已更新探索缩放');
                    return;
                }
                if (t.getAttribute('data-ga') === 'propModel') {
                    var pf = t.files && t.files[0];
                    t.value = '';
                    if (!pf) return;
                    try {
                        setStatus('正在上传探索掉落模型…', 'idle');
                        var purl = await uploadFileToProjectUrl(pf, { assetType: 'LevelProps', resourceKind: 'drop-model', assetName: 'money-drop' });
                        if (purl) {
                            state.gameAssetConfig.customDropModelUrl = purl;
                            markDirty('已更新探索掉落模型');
                        }
                    } catch (err2) {
                        setStatus((err2 && err2.message) || '上传失败', 'error');
                    }
                    renderGameAssetPanel();
                    return;
                }
                if (t.getAttribute('data-ga') === 'playerModel') {
                    var pfile = t.files && t.files[0];
                    t.value = '';
                    if (!pfile) return;
                    try {
                        setStatus('正在上传角色模型…', 'idle');
                        var plurl = await uploadFileToProjectUrl(pfile, { assetType: 'Characters', resourceKind: 'player-model', assetName: 'explore-player' });
                        if (plurl) {
                            state.gameAssetConfig.customPlayerModelUrl = plurl;
                            markDirty('已更新探索角色模型');
                        }
                    } catch (err3) {
                        setStatus((err3 && err3.message) || '上传失败', 'error');
                    }
                    renderGameAssetPanel();
                    return;
                }
                if (t.getAttribute('data-ga-anim')) {
                    var anim = t.getAttribute('data-ga-anim');
                    var af = t.files && t.files[0];
                    t.value = '';
                    if (!af) return;
                    try {
                        setStatus('正在上传 ' + anim + ' 动画…', 'idle');
                        var aurl = await uploadFileToProjectUrl(af, { assetType: 'Animations', resourceKind: 'mixamo-' + anim, assetName: anim + '-animation' });
                        if (aurl) {
                            state.gameAssetConfig.customAnimationUrls[anim] = aurl;
                            markDirty('已更新 ' + anim + ' 动画');
                        }
                    } catch (err4) {
                        setStatus((err4 && err4.message) || '上传失败', 'error');
                    }
                    renderGameAssetPanel();
                }
            })();
        });

        if (refs.gameAssetSection && !refs.gameAssetSection.__towerCatalogDropBound) {
            refs.gameAssetSection.__towerCatalogDropBound = true;
            function towerDropZoneFromTarget(t) {
                if (!t) return null;
                var el = t.nodeType === 3 && t.parentElement ? t.parentElement : t;
                return el.closest ? el.closest('[data-tower-drop]') : null;
            }
            function readCatalogPayloadFromDrag(dataTransfer) {
                if (!dataTransfer) return null;
                var rawJson = '';
                try {
                    rawJson = String(dataTransfer.getData('application/json') || '').trim();
                } catch (e1) {
                    rawJson = '';
                }
                if (!rawJson) {
                    try {
                        rawJson = String(dataTransfer.getData('text/plain') || '').trim();
                    } catch (e2) {
                        rawJson = '';
                    }
                }
                if (!rawJson || rawJson.charAt(0) !== '{') return null;
                try {
                    var o = JSON.parse(rawJson);
                    return o && typeof o === 'object' ? o : null;
                } catch (e3) {
                    return null;
                }
            }
            refs.gameAssetSection.addEventListener('dragover', function (e) {
                var zone = towerDropZoneFromTarget(e.target);
                if (!zone) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            });
            refs.gameAssetSection.addEventListener('dragenter', function (e) {
                var zone = towerDropZoneFromTarget(e.target);
                if (!zone) return;
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
            });
            refs.gameAssetSection.addEventListener('drop', function (e) {
                var zone = towerDropZoneFromTarget(e.target);
                if (!zone || !state || !state.gameAssetConfig) return;
                e.preventDefault();
                var tid = zone.getAttribute('data-tower-drop');
                if (!tid) return;
                var payload = readCatalogPayloadFromDrag(e.dataTransfer);
                if (!payload || payload.kind !== 'catalogModel') return;
                var aid = payload.assetId || payload.id || '';
                var asset = getBrowsableModelAssets().find(function (item) {
                    return item.id === aid;
                });
                var url = asset ? asset.path || asset.publicUrl || '' : '';
                if (!url) {
                    setStatus('无法解析该模型路径，请先在「项目模型」中刷新列表。', 'error');
                    return;
                }
                state.gameAssetConfig.customModelUrls[tid] = url;
                markDirty('已从项目模型绑定塔防替换模型');
                setStatus('已绑定塔防模型：' + modelBindShortLabel(url) + '（路径见格内 / 悬停）', 'success');
                renderGameAssetPanel();
            });
        }
    }

    function bindLevelFields() {
        refs.fieldLevelName.addEventListener('input', function () { updateLevel('name', refs.fieldLevelName.value); });
        refs.fieldStatus.addEventListener('change', function () { updateLevel('status', refs.fieldStatus.value); renderLevelTree(); });
        refs.fieldCountry.addEventListener('input', function () { updatePath(getLevel(), 'location.countryName', refs.fieldCountry.value); markDirty('已更新国家'); renderLevelTree(); });
        refs.fieldCity.addEventListener('input', function () { updatePath(getLevel(), 'location.cityName', refs.fieldCity.value); markDirty('已更新城市'); renderLevelTree(); });
        refs.fieldDifficulty.addEventListener('change', function () {
            var level = getLevel();
            if (!level) return;
            level.difficulty = clamp(Number(refs.fieldDifficulty.value) || 1, 1, 5);
            refs.fieldDifficulty.value = String(level.difficulty);
            markDirty('已更新难度');
        });
        refs.fieldDescription.addEventListener('input', function () { updateLevel('description', refs.fieldDescription.value); });
        [
            refs.fieldGeoEnabled,
            refs.fieldGeoLat,
            refs.fieldGeoLon,
            refs.fieldGeoHeight,
            refs.fieldGeoExtent,
            refs.fieldGeoRotation,
            refs.fieldGeoYOffset,
            refs.fieldGeoBoardHeight,
            refs.fieldGeoAssetId
        ].filter(Boolean).forEach(function (field) {
            field.addEventListener('input', updateGeoFromFields);
            field.addEventListener('change', updateGeoFromFields);
        });
    }

    async function fetchAppConfig() {
        try {
            var cfgRes = await fetch('/api/app-config', { cache: 'no-store' });
            if (cfgRes.ok) {
                var cfg = await cfgRes.json();
                if (cfg.cesiumIonToken) {
                    window.CESIUM_ION_TOKEN = cfg.cesiumIonToken;
                    try {
                        window.localStorage.setItem('earth-guardian.cesiumIonToken', cfg.cesiumIonToken);
                    } catch (ignore) {}
                }
            }
        } catch (e) {
            // App config is optional; continue without it.
        }
    }

    async function loadState() {
        setStatus('正在读取项目关卡配置…', 'idle');
        try {
            await fetchAppConfig();
            regionSources = await loadRegionSources();
            var response = await fetch(API_URL, { cache: 'no-store' });
            if (!response.ok) throw new Error('读取失败: ' + response.status);
            state = normalizeState(await response.json());
            var runtimeGameplay = await fetchRuntimeCityGameplay();
            var gameplaySynced = mergeRuntimeCityGameplayConfigs(runtimeGameplay);
            var generated = generateRegionLevelSkeletons(false);
            var geoSynced = syncGeoConfigs(false);
            var synced = syncBuiltInCityLayouts(false);
            selectedLevelId = pickLevelId(selectedLevelId);
            await refreshGameModelsCatalog();
            renderAll();
            isDirty = generated > 0 || synced > 0 || geoSynced > 0 || gameplaySynced > 0;
            persistLocalBackup();
            setStatus(generated + synced + geoSynced + gameplaySynced > 0 ? '已同步 ' + gameplaySynced + ' 个运行时玩法条目、' + synced + ' 个城市布局、' + geoSynced + ' 个真实地图坐标，生成 ' + generated + ' 个骨架，保存后写入项目' : '配置已加载', generated + synced + geoSynced + gameplaySynced > 0 ? 'dirty' : 'success');
        } catch (error) {
            var backup = readLocalBackup();
            state = normalizeState(backup || { version: ENGINE_VERSION, catalog: {}, levels: [] });
            selectedLevelId = pickLevelId(selectedLevelId);
            await refreshGameModelsCatalog();
            renderAll();
            isDirty = false;
            setStatus('项目读取失败，已载入本地备份: ' + error.message, 'error');
        }
    }

    async function reloadState() {
        if (isDirty && !window.confirm('当前有未保存修改，确定重新载入项目文件吗？')) return;
        await loadState();
    }

    async function saveState() {
        try {
            setStatus('正在保存到项目文件…', 'idle');
            var response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sanitizeStateForSave(state))
            });
            if (!response.ok) throw new Error('保存失败: ' + response.status);
            state = normalizeState(await response.json());
            selectedLevelId = pickLevelId(selectedLevelId);
            isDirty = false;
            persistLocalBackup();
            await refreshGameModelsCatalog();
            renderAll();
            setStatus('已保存到 Web/data/level-editor-state.json', 'success');
        } catch (error) {
            persistLocalBackup();
            setStatus('保存失败，已保留本地备份: ' + error.message, 'error');
        }
    }

    function exportState() {
        var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'earth-guardian-level-engine-export.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setStatus('已导出当前编辑配置', 'success');
    }

    async function loadRegionSources() {
        var countries = [];
        var chinaCities = [];
        try {
            var world = await fetchGeoJsonScript('../data/world-data.js', '__WORLD_GEOJSON__');
            var countryCapitalCoords = await fetchCountryCapitalCoords();
            countries = (world.features || []).map(function (feature) {
                var code = String(feature.id || slugify(feature.properties && feature.properties.name) || '');
                return {
                    kind: 'country',
                    code: code,
                    name: String(feature.properties && feature.properties.name || 'Unknown Country'),
                    geo: countryGeoFromFeature(feature, code, countryCapitalCoords)
                };
            }).filter(function (item) { return item.name && item.name !== 'Antarctica'; });
        } catch (error) {
            setStatus('世界国家数据读取失败，仅保留现有关卡: ' + error.message, 'error');
        }

        try {
            var china = await fetchGeoJsonScript('../data/china-data.js', '__CHINA_GEOJSON__');
            var provinces = (china.features || []).map(function (feature) {
                return feature.properties && feature.properties.adcode;
            }).filter(Boolean);
            var cityGroups = await Promise.all(provinces.map(loadProvinceCities));
            chinaCities = cityGroups.flat().filter(function (city) { return city.code && city.name; });
        } catch (error) {
            setStatus('中国城市数据读取失败，仅生成国家骨架: ' + error.message, 'error');
        }

        return { countries: countries, chinaCities: chinaCities };
    }

    async function fetchRuntimeCityGameplay() {
        try {
            var response = await fetch('/api/runtime-city-gameplay', { cache: 'no-store' });
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            return null;
        }
    }

    async function loadProvinceCities(adcode) {
        try {
            var variableName = '__PROVINCE_' + adcode + '_GEOJSON__';
            var data = await fetchGeoJsonScript('../data/provinces/' + adcode + '-data.js', variableName);
            return (data.features || []).map(function (feature) {
                var props = feature.properties || {};
                return {
                    kind: 'china-city',
                    code: String(props.adcode || ''),
                    name: String(props.name || ''),
                    countryCode: 'CN',
                    countryName: '中国',
                    provinceCode: String(adcode),
                    center: props.center || props.centroid || null,
                    geo: geoFromLonLatArray(props.center || props.centroid, 1600)
                };
            });
        } catch (error) {
            return [];
        }
    }

    async function fetchGeoJsonScript(url, variableName) {
        var response = await fetch(url, { cache: 'force-cache' });
        if (!response.ok) throw new Error(url + ' ' + response.status);
        var text = await response.text();
        var prefix = 'window.' + variableName + ' = ';
        var start = text.indexOf(prefix);
        if (start === -1) throw new Error('找不到 ' + variableName);
        start += prefix.length;
        var end = text.lastIndexOf(';');
        var json = text.slice(start, end > start ? end : undefined).trim();
        return JSON.parse(json);
    }

    function generateRegionLevelSkeletons(markAsDirty) {
        if (!state) return 0;
        var created = 0;
        var existing = new Set(state.levels.map(function (level) { return level.id; }));
        regionSources.countries.forEach(function (country) {
            var id = 'country-' + slugify(country.code || country.name);
            if (existing.has(id)) return;
            state.levels.push(createDraftLevel({
                id: id,
                name: country.name + ' · 未设计关卡',
                countryCode: country.code,
                countryName: country.name,
                cityCode: '',
                cityName: '',
                regionLabel: country.name,
                source: 'world-country',
                geo: country.geo
            }));
            existing.add(id);
            created += 1;
        });
        regionSources.chinaCities.forEach(function (city) {
            var id = 'city-cn-' + city.code;
            if (existing.has(id)) return;
            state.levels.push(createDraftLevel({
                id: id,
                name: city.name + ' · 未设计关卡',
                countryCode: 'CN',
                countryName: '中国',
                cityCode: city.code,
                cityName: city.name,
                regionLabel: '中国 · ' + city.name,
                source: 'china-city',
                geo: city.geo
            }));
            existing.add(id);
            created += 1;
        });
        if (created > 0) {
            sortLevels();
            if (markAsDirty) {
                selectedLevelId = pickLevelId(selectedLevelId);
                markDirty('已生成 ' + created + ' 个国家/城市关卡骨架');
                renderAll();
            }
        } else if (markAsDirty) {
            setStatus('所有国家和中国城市都已有关卡骨架', 'success');
        }
        if (markAsDirty) {
            syncBuiltInCityLayouts(true);
            syncGeoConfigs(true);
        }
        return created;
    }

    function syncGeoConfigs(markAsDirty) {
        if (!state) return 0;
        var synced = 0;
        state.levels.forEach(function (level) {
            var geo = resolveGeoForLevel(level);
            if (!geo) return;
            var isWorldCountry = level.location && level.location.source === 'world-country';

            var pinManual = level.extensions && level.extensions.manualWorldGeoPin === true;

            if (level.map && level.map.geo && level.map.geo.enabled) {
                if (!isWorldCountry || pinManual) return;
            }
            level.map.geo = cloneGeoConfig(geo);
            synced += 1;
        });
        if (synced > 0 && markAsDirty) {
            markDirty('已同步 ' + synced + ' 个真实地图坐标');
            renderAll();
        }
        return synced;
    }

    function syncBuiltInCityLayouts(markAsDirty) {
        if (!state) return 0;
        var synced = 0;
        state.levels.forEach(function (level) {
            var cityKey = matchBuiltInCity(level);
            if (!cityKey) return;
            var layout = BUILT_IN_CITY_LAYOUTS[cityKey];
            var needsDefense = !hasDefenseLayout(level.map);
            var needsExplore = !hasExploreLayout(level.map);
            var needsGeo = !!(layout.geo && (!level.map.geo || !level.map.geo.enabled));
            if (!needsDefense && !needsExplore && !needsGeo) return;
            if (needsDefense) applyDefenseLayout(level, layout);
            if (needsExplore) applyExploreLayout(level, layout);
            if (needsGeo) level.map.geo = cloneGeoConfig(layout.geo);
            level.status = 'designed';
            level.extensions = level.extensions || {};
            level.extensions.syncedBuiltInLayout = {
                city: cityKey,
                defense: layout.defenseName,
                exploration: layout.exploreName
            };
            synced += 1;
        });
        if (synced > 0) {
            sortLevels();
            if (markAsDirty) {
                markDirty('已同步 ' + synced + ' 个城市的塔防/探索布局');
                renderAll();
            }
        }
        return synced;
    }

    function matchBuiltInCity(level) {
        var haystack = [
            level.id,
            level.name,
            level.location.countryName,
            level.location.cityName,
            level.location.regionLabel,
            level.location.cityCode
        ].join(' ').replace(/\s+/g, '');
        var keys = Object.keys(BUILT_IN_CITY_LAYOUTS);
        for (var index = 0; index < keys.length; index += 1) {
            var key = keys[index];
            if (BUILT_IN_CITY_LAYOUTS[key].aliases.some(function (alias) {
                return haystack.indexOf(alias.replace(/\s+/g, '')) !== -1;
            })) {
                return key;
            }
        }
        return '';
    }

    function resolveGeoForLevel(level) {
        var specialGeo = resolveSpecialGeoForLevel(level);
        if (specialGeo) return specialGeo;
        var builtIn = BUILT_IN_CITY_LAYOUTS[matchBuiltInCity(level)];
        if (builtIn && builtIn.geo) return builtIn.geo;
        var cityCode = String(level.location && level.location.cityCode || '');
        var cityName = normalizeChineseCityName(level.location && (level.location.cityName || level.location.regionLabel) || level.name || '');
        if (cityCode) {
            var city = regionSources.chinaCities.find(function (item) { return String(item.code) === cityCode; });
            if (city && city.geo) return city.geo;
        }
        if (cityName) {
            var cityByName = regionSources.chinaCities.find(function (item) { return normalizeChineseCityName(item.name) === cityName; });
            if (cityByName && cityByName.geo) return cityByName.geo;
        }
        var countryCode = String(level.location && level.location.countryCode || '').replace(/^country-/i, '').toUpperCase();
        var countryName = String(level.location && (level.location.countryName || level.location.regionLabel) || level.name || '').replace(/ · .+$/, '');
        var country = regionSources.countries.find(function (item) {
            return String(item.code || '').toUpperCase() === countryCode || String(item.name || '').toLowerCase() === countryName.toLowerCase();
        });
        return country && country.geo ? country.geo : null;
    }

    function resolveSpecialGeoForLevel(level) {
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

    function isJinanLevel(level) {
        var haystack = [
            level && level.id,
            level && level.name,
            level && level.location && level.location.cityName,
            level && level.location && level.location.regionLabel,
            level && level.location && level.location.cityCode
        ].filter(Boolean).join(' ').replace(/\s+/g, '');
        return /济南|泉城|370100|shandong|cn-370100|shandong_370100/i.test(haystack);
    }

    function hasDefenseLayout(map) {
        return !!(map.roads.length || map.obstacles.length || map.enemyPaths.some(function (path) { return path.cells.length; }));
    }

    function hasExploreLayout(map) {
        return !!(map.explorationLayout && (map.explorationLayout.path.length || map.explorationLayout.obstacles.length));
    }

    function applyDefenseLayout(level, layout) {
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

    function applyExploreLayout(level, layout) {
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

    function createDraftLevel(options) {
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

    function renderAll() {
        renderWorkbenchShell();
        renderLevelTree();
        renderLevelDetails();
        renderMap();
        renderActorPalette();
        renderWaveList();
        renderModelAssets();
        renderGameAssetPanel();
        renderOverview();
        renderGameplayEditor();
        renderModelEditor();
        syncViewportPanels();
        renderContentBrowser();
    }

    function renderPreviewSceneOutline() {
        if (!refs.previewSceneOutlineSection || !refs.previewSceneOutlineList) return;
        var show = activeWorkbench === 'level' && viewportViewMode === 'preview';
        refs.previewSceneOutlineSection.classList.toggle('view-hidden', !show);
        refs.previewSceneOutlineSection.setAttribute('aria-hidden', show ? 'false' : 'true');
        if (!show || !state) {
            refs.previewSceneOutlineList.innerHTML = '';
            return;
        }
        var level = getLevel();
        if (!level || !level.map || !Array.isArray(level.map.actors)) {
            refs.previewSceneOutlineList.innerHTML = '<div class="empty-state">暂无 Actor。</div>';
            return;
        }
        var actors = level.map.actors;
        if (!actors.length) {
            refs.previewSceneOutlineList.innerHTML = '<div class="empty-state">场景中尚无已放置的 Actor。</div>';
            return;
        }
        var selId = selectedObject && selectedObject.kind === 'actor' ? selectedObject.id : '';
        refs.previewSceneOutlineList.innerHTML = actors
            .map(function (actor) {
                var active = actor.id === selId ? ' preview-scene-outline-item--active' : '';
                var icon = actor.icon ? String(actor.icon).slice(0, 3) : '◆';
                var cat = actor.category ? String(actor.category) : '';
                return [
                    '<button type="button" class="preview-scene-outline-item' +
                        active +
                        '" data-outline-actor="' +
                        escapeAttr(actor.id) +
                        '" title="' +
                        escapeAttr(cat + ' · ' + (actor.name || actor.id)) +
                        '">',
                    '  <span class="preview-scene-outline-icon">' + escapeHtml(icon) + '</span>',
                    '  <span class="preview-scene-outline-text">',
                    '    <strong>' + escapeHtml(actor.name || actor.id) + '</strong>',
                    '    <span>' + escapeHtml(cat || 'Actor') + '</span>',
                    '  </span>',
                    '</button>'
                ].join('');
            })
            .join('');
    }

    function renderWorkbenchShell() {
        var gameplay = activeWorkbench === 'gameplay';
        var model = activeWorkbench === 'model';
        var level = activeWorkbench === 'level';
        if (refs.levelWorkbench) refs.levelWorkbench.classList.toggle('view-hidden', !level);
        if (refs.levelWorkbench) refs.levelWorkbench.setAttribute('aria-hidden', level ? 'false' : 'true');
        if (refs.gameplayWorkbench) {
            refs.gameplayWorkbench.classList.toggle('view-hidden', !gameplay);
            refs.gameplayWorkbench.setAttribute('aria-hidden', gameplay ? 'false' : 'true');
        }
        if (refs.modelWorkbench) {
            refs.modelWorkbench.classList.toggle('view-hidden', !model);
            refs.modelWorkbench.setAttribute('aria-hidden', model ? 'false' : 'true');
        }
        if (refs.levelInspectorWorkspace) refs.levelInspectorWorkspace.classList.toggle('view-hidden', !level);
        if (refs.gameplayInspectorWorkspace) {
            refs.gameplayInspectorWorkspace.classList.toggle('view-hidden', !gameplay);
            refs.gameplayInspectorWorkspace.setAttribute('aria-hidden', gameplay ? 'false' : 'true');
        }
        if (refs.modelInspectorWorkspace) {
            refs.modelInspectorWorkspace.classList.toggle('view-hidden', !model);
            refs.modelInspectorWorkspace.setAttribute('aria-hidden', model ? 'false' : 'true');
        }
        if (refs.workbenchTabs) {
            refs.workbenchTabs.querySelectorAll('[data-workbench]').forEach(function (item) {
                item.classList.toggle('active', item.getAttribute('data-workbench') === activeWorkbench);
            });
        }
        if (refs.levelSummary) {
            if (gameplay) {
                refs.levelSummary.textContent = '按当前关卡/城市维护敌人、防御塔、卡片、角色、技能与项目资源目录。';
            } else if (model) {
                refs.levelSummary.textContent = '统一管理项目模型资产，按分类浏览、预览和上传替换。';
            } else {
                refs.levelSummary.textContent = '自动生成关卡骨架，自由布置塔防与第三人称探索地图。';
            }
        }
        if (!gameplay) disposeGameplayAssetPreview();
        if (!model) disposeModelAssetPreview();
    }

    function renderGameplayEditor() {
        var cityContext = getGameplayCityContext();
        var config = cityContext ? ensureCityGameplayConfig(cityContext) : null;
        if (config) {
            var preferredTab = pickPreferredGameplayTab(config, activeGameplayTab);
            if (preferredTab !== activeGameplayTab) {
                activeGameplayTab = preferredTab;
                if (refs.gameplayResourceTabs) {
                    refs.gameplayResourceTabs.querySelectorAll('[data-gameplay-tab]').forEach(function (item) {
                        item.classList.toggle('active', item.getAttribute('data-gameplay-tab') === activeGameplayTab);
                    });
                }
            }
        }
        var collection = config ? config[activeGameplayTab] : [];
        var keyword = refs.gameplaySearch ? String(refs.gameplaySearch.value || '').trim().toLowerCase() : '';
        var filtered = collection.filter(function (entry) {
            if (!keyword) return true;
            var haystack = [entry.name, entry.id, entry.summary].concat(entry.tags || []).join(' ').toLowerCase();
            return haystack.indexOf(keyword) !== -1;
        });
        if (refs.gameplayCityTitle) refs.gameplayCityTitle.textContent = cityContext ? cityContext.cityName + ' · 卡片/玩法编辑器' : '请选择带城市信息的关卡';
        if (refs.gameplayCityMeta) refs.gameplayCityMeta.textContent = cityContext ? '当前城市代码：' + cityContext.cityCode + '，保存后会写入该关卡可用卡片、防御塔与城市资源。' : '先在左侧选择一个城市关卡，然后维护该关卡的敌人、防御塔、卡片、角色和技能。';
        if (refs.gameplayOverviewStats) {
            refs.gameplayOverviewStats.innerHTML = cityContext
                ? [
                    { label: '敌人', value: config.enemies.length },
                    { label: '防御塔', value: config.towers.length },
                    { label: '卡片', value: config.cards.length },
                    { label: '角色', value: config.characters.length },
                    { label: '技能', value: config.skills.length }
                ].map(function (card) {
                    return '<div class="stat-card"><strong>' + escapeHtml(String(card.value)) + '</strong><span>' + escapeHtml(card.label) + '</span></div>';
                }).join('')
                : '';
        }
        renderGameplayEntryList(filtered, cityContext);
        renderGameplayForm(filtered, cityContext, config);
        renderGameplayInspector(cityContext, config, filtered);
    }

    function getModelsByCategory(category) {
        var assets = getBrowsableModelAssets();
        if (category === 'all') return assets;
        var folder = MODEL_CATEGORY_CONFIG[category] ? MODEL_CATEGORY_CONFIG[category].folder : '';
        if (!folder) return [];
        return assets.filter(function (asset) {
            return getModelAssetCategoryFolder(asset).toLowerCase() === folder.toLowerCase();
        });
    }

    function getModelAssetCategoryFolder(asset) {
        var rel = String(asset && (asset.relativePath || asset.summary || asset.path || asset.publicUrl) || '').replace(/\\/g, '/');
        rel = rel.replace(/^\/?GameModels\//i, '');
        rel = rel.replace(/^\/?public\/GameModels\//i, '');
        var first = rel.split('/').filter(Boolean)[0] || '';
        if (/^characters?$/i.test(first) || /^charactor$/i.test(first)) return 'Charactor';
        if (/^buildings?$/i.test(first)) return 'Buildings';
        if (/^props?$|^terrain$/i.test(first)) return 'Props';
        if (/^towers?$/i.test(first)) return 'Tower';
        if (/^enem(y|ies)$/i.test(first)) return 'Enemy';
        return first;
    }

    function renderModelEditor() {
        if (activeWorkbench !== 'model') return;
        var allAssets = getBrowsableModelAssets();
        var categoryAssets = getModelsByCategory(activeModelCategory);
        var keyword = refs.modelSearch ? String(refs.modelSearch.value || '').trim().toLowerCase() : '';
        var filtered = categoryAssets.filter(function (asset) {
            if (!keyword) return true;
            var haystack = [asset.name, asset.id, asset.summary, asset.path].join(' ').toLowerCase();
            return haystack.indexOf(keyword) !== -1;
        });

        var counts = {};
        Object.keys(MODEL_CATEGORY_CONFIG).forEach(function (key) {
            if (key === 'all') {
                counts[key] = allAssets.length;
            } else {
                counts[key] = getModelsByCategory(key).length;
            }
        });

        if (refs.modelOverviewStats) {
            refs.modelOverviewStats.innerHTML = Object.keys(MODEL_CATEGORY_CONFIG).map(function (key) {
                var cfg = MODEL_CATEGORY_CONFIG[key];
                return '<div class="stat-card"><strong>' + escapeHtml(String(counts[key] || 0)) + '</strong><span>' + escapeHtml(cfg.label) + '</span></div>';
            }).join('');
        }

        if (refs.modelListCount) {
            refs.modelListCount.textContent = '共 ' + filtered.length + ' 项';
        }

        if (refs.modelEntryList) {
            if (!filtered.length) {
                refs.modelEntryList.innerHTML = '<div class="empty-state">当前分类暂无模型。点击右侧「上传新模型」或扫描 public/GameModels。</div>';
            } else {
                if (!selectedModelId || !filtered.some(function (a) { return a.id === selectedModelId; })) {
                    selectedModelId = filtered[0].id;
                }
                refs.modelEntryList.innerHTML = filtered.map(function (asset) {
                    var active = asset.id === selectedModelId ? ' active' : '';
                    var cat = String(asset.summary || asset.relativePath || '');
                    var folder = getModelAssetCategoryFolder(asset);
                    var matchedKey = Object.keys(MODEL_CATEGORY_CONFIG).find(function (k) {
                        return k !== 'all' && MODEL_CATEGORY_CONFIG[k].folder.toLowerCase() === folder.toLowerCase();
                    });
                    var catLabel = matchedKey ? MODEL_CATEGORY_CONFIG[matchedKey].label : (folder || '未分类');
                    return [
                        '<button type="button" class="list-item gameplay-entry-card' + active + '" data-model-id="' + escapeAttr(asset.id) + '">',
                        '  <strong>' + escapeHtml(asset.name) + '</strong>',
                        '  <span>' + escapeHtml(cat) + '</span>',
                        '  <div class="gameplay-entry-meta">',
                        '    <span class="gameplay-chip">' + escapeHtml(catLabel) + '</span>',
                        '  </div>',
                        '</button>'
                    ].join('');
                }).join('');
            }
        }

        var selected = filtered.find(function (a) { return a.id === selectedModelId; }) || null;
        renderModelDetail(selected);
        renderModelInspector(counts);
    }

    function renderModelDetail(asset) {
        if (refs.modelDetailTitle) refs.modelDetailTitle.textContent = asset ? asset.name : '模型详情';
        if (refs.modelDetailMeta) refs.modelDetailMeta.textContent = asset ? '已选择' : '未选择';
        if (refs.modelDetailName) refs.modelDetailName.value = asset ? asset.name : '';
        var catLabel = '';
        if (asset) {
            var firstDir = getModelAssetCategoryFolder(asset);
            var matchedKey = Object.keys(MODEL_CATEGORY_CONFIG).find(function (k) {
                return k !== 'all' && MODEL_CATEGORY_CONFIG[k].folder.toLowerCase() === firstDir.toLowerCase();
            });
            catLabel = matchedKey ? MODEL_CATEGORY_CONFIG[matchedKey].label : (firstDir || '未分类');
        }
        if (refs.modelDetailCategory) refs.modelDetailCategory.value = catLabel;
        if (refs.modelDetailPath) refs.modelDetailPath.value = asset ? (asset.path || asset.publicUrl || '') : '';

        if (refs.modelPreviewEmpty) refs.modelPreviewEmpty.classList.toggle('view-hidden', !!asset);
        if (refs.modelPreviewHost) refs.modelPreviewHost.classList.toggle('view-hidden', !asset);
        if (refs.modelPreviewMeta) refs.modelPreviewMeta.textContent = asset ? (asset.name + ' · 模型预览') : '未绑定模型';

        if (!asset) {
            disposeModelAssetPreview();
            return;
        }
        ensureModelAssetPreview(asset.publicUrl || asset.path || '');
    }

    function ensureModelAssetPreview(modelUrl) {
        if (!refs.modelPreviewHost) return;
        if (!modelUrl) return;
        if (!modelAssetPreviewApi) {
            var generation = (modelPreviewInitGeneration += 1);
            import('./gameplay-asset-preview.js').then(function (mod) {
                if (generation !== modelPreviewInitGeneration || !refs.modelPreviewHost) return;
                modelAssetPreviewApi = mod.createGameplayAssetPreview({ host: refs.modelPreviewHost });
                modelAssetPreviewApi.setAsset(modelUrl);
            }).catch(function (error) {
                setStatus('模型预览初始化失败: ' + error.message, 'error');
            });
            return;
        }
        modelAssetPreviewApi.setAsset(modelUrl);
    }

    function renderModelInspector(counts) {
        if (!refs.modelInspectorStats) return;
        refs.modelInspectorStats.innerHTML = Object.keys(MODEL_CATEGORY_CONFIG).map(function (key) {
            var cfg = MODEL_CATEGORY_CONFIG[key];
            return [
                '<button type="button" class="list-item" data-inspector-category="' + escapeAttr(key) + '" style="cursor:pointer">',
                '  <strong>' + escapeHtml(cfg.label) + '</strong>',
                '  <span>' + escapeHtml(String(counts[key] || 0)) + ' 个模型</span>',
                '</button>'
            ].join('');
        }).join('');

        refs.modelInspectorStats.querySelectorAll('[data-inspector-category]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                activeModelCategory = btn.getAttribute('data-inspector-category') || 'all';
                selectedModelId = '';
                if (refs.modelCategoryTabs) {
                    refs.modelCategoryTabs.querySelectorAll('[data-model-category]').forEach(function (item) {
                        item.classList.toggle('active', item.getAttribute('data-model-category') === activeModelCategory);
                    });
                }
                renderModelEditor();
            });
        });
    }

    async function replaceSelectedModel(file) {
        var selected = getModelsByCategory(activeModelCategory).find(function (a) { return a.id === selectedModelId; });
        if (!selected) {
            setStatus('请先选择一个要替换的模型。', 'error');
            refs.modelUploadReplace.value = '';
            return;
        }
        var subdir = getModelAssetCategoryFolder(selected);
        try {
            setStatus('正在替换模型 ' + file.name + '…', 'idle');
            var content = await fileToBase64(file);
            var res = await fetch('/api/game-models/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: file.name,
                    content: content,
                    subdirectory: subdir
                })
            });
            var resText = await res.text();
            if (!res.ok) throw new Error(parseFetchErrorBody(res.status, resText));
            var payload = JSON.parse(resText);
            await refreshGameModelsCatalog();
            selectedModelId = '';
            refs.modelUploadReplace.value = '';
            markDirty('已替换模型');
            renderModelEditor();
            setStatus('模型已替换: ' + String(payload.projectPath || ''), 'success');
        } catch (error) {
            refs.modelUploadReplace.value = '';
            setStatus('模型替换失败: ' + error.message, 'error');
        }
    }

    async function uploadNewModelFromInspector(file) {
        var category = refs.modelInspectorUploadCategory ? refs.modelInspectorUploadCategory.value : 'Enemy';
        var nameHint = refs.modelInspectorUploadName ? String(refs.modelInspectorUploadName.value || '').trim() : '';
        var subdir = String(category || '');
        var uploadName = nameHint || file.name;
        try {
            setStatus('正在上传新模型 ' + uploadName + '…', 'idle');
            var content = await fileToBase64(file);
            var res = await fetch('/api/game-models/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: uploadName + (file.name.match(/\.[^.]+$/) ? '' : '.glb'),
                    content: content,
                    subdirectory: subdir
                })
            });
            var resText = await res.text();
            if (!res.ok) throw new Error(parseFetchErrorBody(res.status, resText));
            var payload = JSON.parse(resText);
            await refreshGameModelsCatalog();
            if (refs.modelInspectorUploadName) refs.modelInspectorUploadName.value = '';
            if (refs.modelInspectorUpload) refs.modelInspectorUpload.value = '';
            activeModelCategory = category;
            selectedModelId = '';
            if (refs.modelCategoryTabs) {
                refs.modelCategoryTabs.querySelectorAll('[data-model-category]').forEach(function (item) {
                    item.classList.toggle('active', item.getAttribute('data-model-category') === activeModelCategory);
                });
            }
            markDirty('已上传新模型');
            renderModelEditor();
            setStatus('新模型已保存: ' + String(payload.projectPath || ''), 'success');
        } catch (error) {
            if (refs.modelInspectorUpload) refs.modelInspectorUpload.value = '';
            setStatus('模型上传失败: ' + error.message, 'error');
        }
    }

    function renderGameplayEntryList(entries, cityContext) {
        if (!refs.gameplayEntryList) return;
        if (!cityContext) {
            refs.gameplayEntryList.innerHTML = '<div class="empty-state">先从左侧选中一个城市关卡，玩法编辑器会自动切到该城市的资源库。</div>';
            return;
        }
        if (!entries.length) {
            refs.gameplayEntryList.innerHTML = '<div class="empty-state">' + GAMEPLAY_RESOURCE_CONFIG[activeGameplayTab].empty + '</div>';
            return;
        }
        if (!selectedGameplayEntryId || !entries.some(function (entry) { return entry.id === selectedGameplayEntryId; })) {
            selectedGameplayEntryId = entries[0].id;
        }
        refs.gameplayEntryList.innerHTML = entries.map(function (entry) {
            var thumb = resolveGameplayEntryThumbnail(entry);
            return [
                '<button type="button" class="list-item gameplay-entry-card' + (entry.id === selectedGameplayEntryId ? ' active' : '') + '" data-gameplay-entry-id="' + escapeAttr(entry.id) + '">',
                thumb ? '  <img class="gameplay-asset-thumb" src="' + escapeAttr(thumb) + '" alt="' + escapeAttr(entry.name) + '">' : '',
                '  <strong>' + escapeHtml(entry.name) + '</strong>',
                '  <span>' + escapeHtml(entry.summary || '未填写简介') + '</span>',
                '  <div class="gameplay-entry-meta">',
                '    <span class="gameplay-chip">' + escapeHtml(entry.rarity || 'common') + '</span>',
                '    <span class="gameplay-chip">' + escapeHtml((entry.tags || []).join(' / ') || cityContext.cityName) + '</span>',
                entry.placement ? '    <span class="gameplay-chip">' + escapeHtml(gameplayPlacementLabel(entry.placement)) + '</span>' : '',
                '  </div>',
                '  <div class="inline-controls">',
                '    <button type="button" class="mini-button" data-gameplay-action="move-up" data-gameplay-entry-id="' + escapeAttr(entry.id) + '">上移</button>',
                '    <button type="button" class="mini-button" data-gameplay-action="move-down" data-gameplay-entry-id="' + escapeAttr(entry.id) + '">下移</button>',
                '    <button type="button" class="mini-button" data-gameplay-action="duplicate" data-gameplay-entry-id="' + escapeAttr(entry.id) + '">复制</button>',
                '    <button type="button" class="mini-button danger" data-gameplay-action="delete" data-gameplay-entry-id="' + escapeAttr(entry.id) + '">删除</button>',
                '  </div>',
                '</button>'
            ].join('');
        }).join('');
    }

    function renderGameplayForm(entries, cityContext) {
        var entry = getSelectedGameplayEntry(entries);
        var disabled = !entry;
        if (refs.gameplayEditorTitle) refs.gameplayEditorTitle.textContent = entry ? entry.name : (GAMEPLAY_RESOURCE_CONFIG[activeGameplayTab].label + '详情');
        if (refs.gameplayEditorHint) refs.gameplayEditorHint.textContent = cityContext ? cityContext.cityName + ' · ' + GAMEPLAY_RESOURCE_CONFIG[activeGameplayTab].label : '城市玩法配置';
        if (refs.gameplayName) refs.gameplayName.value = entry ? entry.name : '';
        if (refs.gameplayId) refs.gameplayId.value = entry ? entry.id : '';
        if (refs.gameplayTags) refs.gameplayTags.value = entry ? (entry.tags || []).join(', ') : '';
        if (refs.gameplayRarity) refs.gameplayRarity.value = entry ? entry.rarity : '';
        if (refs.gameplaySummary) refs.gameplaySummary.value = entry ? entry.summary : '';
        [refs.gameplayName, refs.gameplayId, refs.gameplayTags, refs.gameplayRarity, refs.gameplaySummary].forEach(function (field) {
            if (field) field.disabled = disabled;
        });
        setGameplayEntryActionButtons(disabled, entries, entry);
        if (refs.gameplayStatGrid) {
            var statsHtml = GAMEPLAY_RESOURCE_CONFIG[activeGameplayTab].stats.map(function (field) {
                var value = entry && entry.stats ? entry.stats[field.key] : '';
                return [
                    '<label class="field-block">',
                    '  <span>' + escapeHtml(field.label) + '</span>',
                    '  <input type="number" data-gameplay-stat="' + escapeAttr(field.key) + '" step="' + escapeAttr(field.step) + '" value="' + escapeAttr(value === '' || value == null ? '' : String(value)) + '"' + (disabled ? ' disabled' : '') + '>',
                    '</label>'
                ].join('');
            }).join('');
            var placementHtml = activeGameplayTab === 'characters' || activeGameplayTab === 'towers'
                ? [
                    '<label class="field-block">',
                    '  <span>部署位置</span>',
                    '  <select data-gameplay-placement' + (disabled ? ' disabled' : '') + '>',
                    '    <option value="roadside"' + (!entry || entry.placement !== 'road' ? ' selected' : '') + '>道路两侧</option>',
                    '    <option value="road"' + (entry && entry.placement === 'road' ? ' selected' : '') + '>道路上</option>',
                    '  </select>',
                    '</label>'
                ].join('')
                : '';
            refs.gameplayStatGrid.innerHTML = statsHtml + placementHtml;
        }
    }

    function gameplayPlacementLabel(placement) {
        return placement === 'road' ? '道路上' : placement === 'roadside' ? '道路两侧' : '部署位置未设置';
    }

    function renderGameplayInspector(cityContext, config, entries) {
        var entry = getSelectedGameplayEntry(entries);
        var assetType = refs.gameplayAssetType ? refs.gameplayAssetType.value : GAMEPLAY_RESOURCE_CONFIG[activeGameplayTab].assetType;
        var assets = cityContext ? getGameplayAssets(cityContext, assetType) : [];
        if (refs.gameplayAssetType && (!refs.gameplayAssetType.value || refs.gameplayAssetType.value === '')) {
            refs.gameplayAssetType.value = GAMEPLAY_RESOURCE_CONFIG[activeGameplayTab].assetType;
        }
        if (refs.gameplayAssetName && !refs.gameplayAssetName.value && entry) refs.gameplayAssetName.value = entry.name;
        if (refs.gameplayInspectorMeta) refs.gameplayInspectorMeta.textContent = cityContext ? '当前城市：' + cityContext.cityName + '（' + cityContext.cityCode + '）' : '先从左侧关卡树选择一个城市关卡，再在这里维护该关卡的敌人、防御塔、卡片、角色和技能。';
        if (refs.gameplaySelectionMeta) {
            refs.gameplaySelectionMeta.innerHTML = cityContext ? [
                '<div class="list-item"><strong>城市代码</strong><span>' + escapeHtml(cityContext.cityCode) + '</span></div>',
                '<div class="list-item"><strong>敌人 / 塔 / 卡片 / 角色 / 技能</strong><span>' + String(config.enemies.length) + ' / ' + String(config.towers.length) + ' / ' + String(config.cards.length) + ' / ' + String(config.characters.length) + ' / ' + String(config.skills.length) + '</span></div>',
                '<div class="list-item"><strong>当前选择</strong><span>' + escapeHtml(entry ? entry.name : '未选择条目') + '</span></div>',
                '<div class="list-item"><strong>模型 / 图片</strong><span>' + escapeHtml(entry ? String(entry.assetRefs.modelPath || '未绑定') + ' / ' + String(entry.assetRefs.imagePath || '未绑定') : '未绑定') + '</span></div>'
            ].join('') : '<div class="empty-state">没有可编辑的城市。</div>';
        }
        if (!refs.gameplayAssetList) return;
        if (!cityContext) {
            refs.gameplayAssetList.innerHTML = '<div class="empty-state">请选择城市后再上传资源。</div>';
            renderGameplayAssetPreview(null, entry);
            return;
        }
        if (!assets.length) {
            refs.gameplayAssetList.innerHTML = '<div class="empty-state">当前分类下还没有项目资源。上传后会写入 public/Arts/' + escapeHtml(assetType) + '/' + escapeHtml(cityContext.cityName) + '/</div>';
            renderGameplayAssetPreview(null, entry);
            return;
        }
        refs.gameplayAssetList.innerHTML = assets.map(function (asset) {
            var isImage = isImageAssetPath(asset.publicUrl || asset.path);
            return [
                '<div class="list-item gameplay-asset-card' + (asset.id === selectedGameplayAssetId ? ' active' : '') + '" data-asset-preview-id="' + escapeAttr(asset.id) + '">',
                isImage ? '  <img class="gameplay-asset-thumb" src="' + escapeAttr(asset.publicUrl || asset.path) + '" alt="' + escapeAttr(asset.name) + '">' : '',
                '  <div class="gameplay-asset-kind">' + escapeHtml(asset.resourceKind || asset.assetType) + '</div>',
                '  <strong>' + escapeHtml(asset.name) + '</strong>',
                '  <span>' + escapeHtml(asset.summary || asset.publicUrl || asset.path) + '</span>',
                '  <code>' + escapeHtml(asset.path || asset.projectPath || '') + '</code>',
                '  <div class="inline-controls">',
                '    <button type="button" class="mini-button" data-asset-id="' + escapeAttr(asset.id) + '" data-asset-bind="modelPath">绑定模型</button>',
                '    <button type="button" class="mini-button" data-asset-id="' + escapeAttr(asset.id) + '" data-asset-bind="imagePath">绑定图片</button>',
                '  </div>',
                '</div>'
            ].join('');
        }).join('');
        renderGameplayAssetPreview(getSelectedGameplayAsset(entry, assets), entry);
    }

    function schedulePreviewRefresh() {
        if (viewportViewMode !== 'preview') return;
        clearTimeout(previewRefreshTimer);
        previewRefreshTimer = setTimeout(function () {
            refreshPreviewNow();
        }, 80);
    }

    function refreshPreviewNow() {
        if (viewportViewMode !== 'preview' || !previewApi || typeof previewApi.refresh !== 'function') return;
        if (typeof previewApi.resize === 'function') previewApi.resize();
        previewApi.refresh();
        if (selectedObject && selectedObject.kind === 'actor') {
            previewApi.setSelectedActor(selectedObject.id);
        }
    }

    function syncViewportPanels() {
        var board = viewportViewMode === 'board';
        if (refs.boardViewport) refs.boardViewport.classList.toggle('view-hidden', !board);
        if (refs.previewStageWrap) {
            refs.previewStageWrap.classList.toggle('view-hidden', board);
            refs.previewStageWrap.setAttribute('aria-hidden', board ? 'true' : 'false');
        }
        if (refs.editorToolRibbon) refs.editorToolRibbon.classList.toggle('view-hidden', !board);
        updateStageHintText();
        if (!board && previewApi && typeof previewApi.resize === 'function') {
            previewApi.resize();
        }
        renderPreviewSceneOutline();
    }

    function updateStageHintText() {
        if (!refs.stageHintExtra) return;
        if (viewportViewMode === 'preview') {
            refs.stageHintExtra.textContent =
                '鼠标左键拖拽旋转场景，滚轮缩放，右键平移；左键点中 Actor（或拖拽 Gizmo：移动·旋转·缩放）会优先编辑对象。Esc 取消选择；底部内容浏览器可把模型拖到地面；Inspector 仍可精确数值。';
            return;
        }
        refs.stageHintExtra.textContent = '点击格子放置，拖拽已有 Actor 移动，右侧可精确编辑属性。';
    }

    function initPreviewLayer() {
        if (previewApi || !refs.previewHost) return;
        var gen = (previewInitGeneration += 1);
        import('./level-editor-preview.js')
            .then(function (mod) {
                if (gen !== previewInitGeneration || viewportViewMode !== 'preview') return;
                previewApi = mod.createPreview({
                    host: refs.previewHost,
                    getLevel: getLevel,
                    getActiveEditorMode: function () {
                        return activeEditorMode;
                    },
                    getCatalog: function () {
                        return state
                            ? {
                                  modelAssets: (state.catalog && state.catalog.modelAssets) || [],
                                  editorAssetsCatalog: state.editorAssetsCatalog || [],
                                  gameModels: normalizeGameModelsForCatalog()
                              }
                            : { modelAssets: [], editorAssetsCatalog: [], gameModels: [] };
                    },
                    onSelectActor: onPreviewSelectActor,
                    onActorModified: onPreviewActorCommitted,
                    onDropCatalogModel: onDropCatalogModelInPreview,
                    onDropActorTemplate: onDropActorTemplateInPreview,
                    onTransformModeChange: setPreviewToolbarMode
                });
                setPreviewToolbarMode('translate');
                previewApi.refresh();
                if (selectedObject && selectedObject.kind === 'actor') {
                    previewApi.setSelectedActor(selectedObject.id);
                }
                renderContentBrowser();
                renderPreviewSceneOutline();
            })
            .catch(function (err) {
                console.error(err);
                setStatus('预览模块加载失败：请确认通过 http(s) 打开本页并能访问 CDN。', 'error');
            });
    }

    function disposePreviewLayer() {
        previewInitGeneration += 1;
        clearTimeout(previewRefreshTimer);
        if (!previewApi) return;
        try {
            previewApi.dispose();
        } catch (e) {
            console.warn('[Preview]', e);
        }
        previewApi = null;
    }

    function onPreviewSelectActor(actorId) {
        if (actorId) selectedObject = { kind: 'actor', id: actorId };
        else selectedObject = null;
        renderSelectionInspector();
        renderMap();
        renderPreviewSceneOutline();
    }

    function onPreviewActorCommitted() {
        markDirty('已更新 Actor 变换');
        renderSelectionInspector();
        renderOverview();
    }

    function onDropCatalogModelInPreview(payload) {
        var level = getLevel();
        if (!level || !payload || !payload.assetId) return;
        var template = state.actorTemplates.find(function (t) { return t.id === 'explore-item'; }) || state.actorTemplates[0];
        var asset = getBrowsableModelAssets().find(function (item) { return item.id === payload.assetId; });
        var col = Math.floor(level.map.grid.cols / 2);
        var row = Math.floor(level.map.grid.rows / 2);
        placeActorFromTemplate(template.id, col, row);
        var actor = level.map.actors[level.map.actors.length - 1];
        actor.modelId = payload.assetId;
        actor.modelPath = asset ? asset.path || asset.publicUrl || '' : '';
        applyWorldHitToActor(actor, payload.worldX, payload.worldY, payload.worldZ);
        selectedObject = { kind: 'actor', id: actor.id };
        markDirty('已在预览中放置模型');
        renderAll();
    }

    function onDropActorTemplateInPreview(payload) {
        var level = getLevel();
        if (!level || !payload || !payload.templateId) return;
        var col = Math.floor(level.map.grid.cols / 2);
        var row = Math.floor(level.map.grid.rows / 2);
        placeActorFromTemplate(payload.templateId, col, row);
        var actor = level.map.actors[level.map.actors.length - 1];
        var wx =
            payload.worldX != null && Number.isFinite(Number(payload.worldX))
                ? Number(payload.worldX)
                : (level.map.grid.cols / 2 - 0.5) * (level.map.grid.tileSize || 2);
        var wy = payload.worldY != null && Number.isFinite(Number(payload.worldY)) ? Number(payload.worldY) : 0;
        var wz =
            payload.worldZ != null && Number.isFinite(Number(payload.worldZ))
                ? Number(payload.worldZ)
                : (level.map.grid.rows / 2 - 0.5) * (level.map.grid.tileSize || 2);
        applyWorldHitToActor(actor, wx, wy, wz);
        selectedObject = { kind: 'actor', id: actor.id };
        markDirty('已在预览中放置 Actor');
        renderAll();
    }

    function setPreviewToolbarMode(mode) {
        if (!refs.previewGizmoTranslate) return;
        var map = [
            ['translate', refs.previewGizmoTranslate],
            ['rotate', refs.previewGizmoRotate],
            ['scale', refs.previewGizmoScale]
        ];
        map.forEach(function (entry) {
            if (!entry[1]) return;
            entry[1].classList.toggle('active', entry[0] === mode);
        });
        if (previewApi && typeof previewApi.setTransformMode === 'function') previewApi.setTransformMode(mode);
    }

    function renderContentBrowser() {
        var list = refs.contentBrowserList;
        if (!list || !state) return;
        var assets = getBrowsableModelAssets();
        if (!assets.length) {
            selectedContentBrowserAssetId = '';
            list.innerHTML =
                '<div class="empty-state">暂无模型。将 .glb/.gltf 放进项目 <code>public/GameModels/</code> 或使用右侧「上传模型」，然后点「刷新」。</div>';
            showContentBrowserMiniPreview('');
            return;
        }

        if (selectedContentBrowserAssetId && !assets.some(function (a) { return a.id === selectedContentBrowserAssetId; })) {
            selectedContentBrowserAssetId = '';
        }

        list.innerHTML = assets
            .map(function (asset) {
                var active = asset.id === selectedContentBrowserAssetId ? ' content-browser-chip--active' : '';
                return [
                    '<div class="content-browser-chip' +
                        active +
                        '" draggable="true" data-asset-chip="' +
                        escapeAttr(asset.id) +
                        '" data-preview-url="' +
                        escapeAttr(asset.path || asset.publicUrl || '') +
                        '">',
                    '  <div class="content-browser-chip-icon">' + escapeHtml(asset.name.slice(0, 2).toUpperCase()) + '</div>',
                    '  <div class="content-browser-chip-meta">',
                    '    <strong>' + escapeHtml(asset.name || asset.id) + '</strong>',
                    '    <span>' + escapeHtml(asset.summary || asset.path || asset.publicUrl || 'GameModels') + '</span>',
                    '  </div>',
                    '</div>'
                ].join('');
            })
            .join('');

        list.querySelectorAll('[data-asset-chip]').forEach(function (chip) {
            chip.addEventListener('dragstart', function (event) {
                var id = chip.getAttribute('data-asset-chip');
                var payloadJson = JSON.stringify({ kind: 'catalogModel', assetId: id, id: id });
                if (event.dataTransfer) {
                    event.dataTransfer.setData('application/json', payloadJson);
                    /* 部分环境与浏览器对自定义 MIME 的 getData 不稳定，mirror 一份到 text/plain 供 Inspector 接住 */
                    event.dataTransfer.setData('text/plain', payloadJson);
                    event.dataTransfer.effectAllowed = 'copy';
                }
            });
            chip.addEventListener('click', function (event) {
                if (event.target && event.target.closest && event.target.closest('a')) return;
                selectedContentBrowserAssetId = chip.getAttribute('data-asset-chip') || '';
                list.querySelectorAll('[data-asset-chip]').forEach(function (c) {
                    c.classList.toggle('content-browser-chip--active', c.getAttribute('data-asset-chip') === selectedContentBrowserAssetId);
                });
                showContentBrowserMiniPreview(chip.getAttribute('data-preview-url') || '');
            });
        });

        if (!selectedContentBrowserAssetId && assets[0]) {
            selectedContentBrowserAssetId = assets[0].id;
            list.querySelectorAll('[data-asset-chip]').forEach(function (c) {
                c.classList.toggle('content-browser-chip--active', c.getAttribute('data-asset-chip') === selectedContentBrowserAssetId);
            });
            showContentBrowserMiniPreview(assets[0].path || assets[0].publicUrl || '');
        } else if (selectedContentBrowserAssetId) {
            var cur = assets.find(function (a) {
                return a.id === selectedContentBrowserAssetId;
            });
            showContentBrowserMiniPreview(cur ? cur.path || cur.publicUrl || '' : '');
        }
    }

    function showContentBrowserMiniPreview(url) {
        var host = refs.contentBrowserPreviewHost;
        if (!host) return;
        if (!url) {
            if (contentBrowserMiniApi && typeof contentBrowserMiniApi.dispose === 'function') {
                contentBrowserMiniApi.dispose();
            }
            contentBrowserMiniApi = null;
            host.innerHTML =
                '<div class="empty-state content-browser-mini-empty">点击下方卡片或拖拽到场景；支持 .glb / .gltf / .obj 目录扫描。</div>';
            return;
        }
        import('./content-browser-model-preview.js')
            .then(function (mod) {
                if (!refs.contentBrowserPreviewHost) return;
                if (contentBrowserMiniApi && typeof contentBrowserMiniApi.dispose === 'function') {
                    contentBrowserMiniApi.dispose();
                }
                contentBrowserMiniApi = mod.createContentBrowserMiniPreview({ host: refs.contentBrowserPreviewHost });
                return contentBrowserMiniApi.setUrl(url);
            })
            .catch(function (e) {
                console.warn('[ContentBrowser preview]', e);
            });
    }

    function wireViewportViewMode(next) {
        viewportViewMode = next;
        if (refs.viewportViewTabs) {
            refs.viewportViewTabs.querySelectorAll('[data-view-mode]').forEach(function (b) {
                var on = b.getAttribute('data-view-mode') === next;
                b.classList.toggle('active', on);
                b.setAttribute('aria-selected', on ? 'true' : 'false');
            });
        }
        disposePreviewLayer();
        if (next === 'preview') initPreviewLayer();
        syncViewportPanels();
    }

    function getBrowsableModelAssets() {
        if (!state) return [];
        var merged = [];
        normalizeGameModelsForCatalog()
            .concat(state.catalog.modelAssets || [])
            .concat(
                (state.editorAssetsCatalog || []).filter(function (asset) {
                    return isModelAssetPath(asset.publicUrl || asset.path || asset.projectPath);
                }).map(function (asset) {
                    return {
                        id: asset.id,
                        name: asset.name,
                        summary: asset.summary,
                        path: asset.publicUrl || asset.path || asset.projectPath,
                        source: 'editorAssets'
                    };
                })
            )
            .forEach(function (asset) {
                if (!asset || !asset.id || merged.some(function (item) { return item.id === asset.id; })) return;
                merged.push(asset);
            });
        return merged;
    }

    function getEnemyTypeLookup(level) {
        return getAvailableEnemyTypes(level).reduce(function (lookup, enemy) {
            lookup[enemy.id] = enemy;
            return lookup;
        }, {});
    }

    function renderLevelTree() {
        var query = refs.levelSearch.value.trim().toLowerCase();
        var levels = state.levels.filter(function (level) {
            if (activeStatusFilter !== 'all' && level.status !== activeStatusFilter) return false;
            if (!query) return true;
            return [
                level.name,
                level.location.countryName,
                level.location.cityName,
                level.location.regionLabel
            ].join(' ').toLowerCase().indexOf(query) !== -1;
        });

        if (!levels.length) {
            refs.levelTree.innerHTML = '<div class="empty-state">当前筛选下没有关卡。</div>';
            return;
        }

        var groups = groupLevels(levels);
        refs.levelTree.innerHTML = Object.keys(groups).sort(compareRegionKeys).map(function (key) {
            var items = groups[key];
            return [
                '<section class="tree-group">',
                '  <div class="tree-heading"><span>' + escapeHtml(key) + '</span><span>' + items.length + '</span></div>',
                items.map(renderLevelCard).join(''),
                '</section>'
            ].join('');
        }).join('');
    }

    function renderLevelCard(level) {
        return [
            '<button class="level-card' + (level.id === selectedLevelId ? ' active' : '') + '" data-level-id="' + escapeAttr(level.id) + '">',
            '  <strong>' + escapeHtml(level.name) + '</strong>',
            '  <span>' + escapeHtml(level.location.regionLabel || level.location.countryName || '未设置地区') + '</span>',
            '  <div class="badge-row">',
            '    <span class="mini-badge ' + escapeAttr(level.status) + '">' + escapeHtml(statusLabel(level.status)) + '</span>',
            '    <span class="mini-badge">Actor ' + level.map.actors.length + '</span>',
            '    <span class="mini-badge">道路 ' + level.map.roads.length + '</span>',
            '    <span class="mini-badge">难度 ' + level.difficulty + '</span>',
            '  </div>',
            '</button>'
        ].join('');
    }

    function renderLevelDetails() {
        var level = getLevel();
        var cityConfig = getCurrentCityGameplayConfig();
        if (!level) {
            refs.currentLevelName.textContent = '请选择关卡';
            refs.currentLevelMeta.textContent = '无可编辑关卡。';
            return;
        }
        refs.currentLevelName.textContent = level.name;
        refs.currentLevelMeta.textContent = [
            level.location.regionLabel || level.location.countryName || '未设置地区',
            level.map.grid.cols + 'x' + level.map.grid.rows,
            activeEditorMode === 'explore' ? '探索布局' : '塔防布局',
            statusLabel(level.status)
        ].concat(cityConfig && (cityConfig.characters.length || cityConfig.skills.length || cityConfig.enemies.length)
            ? ['角色 ' + cityConfig.characters.length, '技能 ' + cityConfig.skills.length, '敌人 ' + cityConfig.enemies.length]
            : []).join(' · ');
        refs.levelSummary.textContent = '当前关卡：' + level.name + '。使用工具栏绘制地图，拖拽 Actor 模板到画布。';
        refs.fieldLevelName.value = level.name;
        refs.fieldStatus.value = level.status;
        refs.fieldCountry.value = level.location.countryName || '';
        refs.fieldCity.value = level.location.cityName || '';
        refs.fieldDifficulty.value = String(level.difficulty);
        refs.fieldDescription.value = level.description || '';
        refs.fieldGridCols.value = String(level.map.grid.cols);
        refs.fieldGridRows.value = String(level.map.grid.rows);
        refs.fieldTileSize.value = String(level.map.grid.tileSize);
        renderGeoFields(level);
        renderSelectionInspector();
    }

    function renderGeoFields(level) {
        if (!refs.fieldGeoEnabled) return;
        var geo = normalizeGeoConfig(level.map.geo);
        refs.fieldGeoEnabled.value = geo.enabled ? 'true' : 'false';
        refs.fieldGeoLat.value = String(geo.center.lat || '');
        refs.fieldGeoLon.value = String(geo.center.lon || '');
        refs.fieldGeoHeight.value = String(geo.center.heightMeters || 0);
        refs.fieldGeoExtent.value = String(geo.extentMeters || 1000);
        refs.fieldGeoRotation.value = String(geo.rotationDeg || 0);
        refs.fieldGeoYOffset.value = String(geo.yOffsetMeters || 0);
        if (refs.fieldGeoBoardHeight) refs.fieldGeoBoardHeight.value = String(geo.boardHeightMeters || 32);
        refs.fieldGeoAssetId.value = geo.assetId || DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID;
    }

    function renderOverview() {
        var level = getLevel();
        if (!level) {
            refs.overviewStats.innerHTML = '';
            return;
        }
        var exploreLayout = ensureExplorationLayout(level.map);
        var cards = activeEditorMode === 'explore' ? [
            { label: '探索尺寸', value: level.map.grid.cols + 'x' + level.map.grid.rows },
            { label: '探索路线', value: exploreLayout.path.length },
            { label: '探索点', value: level.map.explorationPoints.length },
            { label: 'Actor', value: level.map.actors.length }
        ] : [
            { label: '地图尺寸', value: level.map.grid.cols + 'x' + level.map.grid.rows },
            { label: 'Actor', value: level.map.actors.length },
            { label: '敌人出口', value: level.map.spawnPoints.length },
            { label: '波次', value: level.waveRules.length }
        ];
        refs.overviewStats.innerHTML = cards.map(function (card) {
            return '<div class="stat-card"><strong>' + escapeHtml(String(card.value)) + '</strong><span>' + escapeHtml(card.label) + '</span></div>';
        }).join('');
    }

    function renderMap() {
        var level = getLevel();
        if (!level) {
            refs.mapGrid.innerHTML = '';
            refs.mapGrid.classList.remove('map-grid--jinan-texture');
            return;
        }
        var grid = level.map.grid;
        var cellSize = clamp(Math.floor(720 / Math.max(grid.cols, grid.rows)), 16, 34);
        refs.mapGrid.style.setProperty('--cell-size', cellSize + 'px');
        refs.mapGrid.style.setProperty('--grid-texture-width', (grid.cols * cellSize + Math.max(0, grid.cols - 1)) + 'px');
        refs.mapGrid.style.setProperty('--grid-texture-height', (grid.rows * cellSize + Math.max(0, grid.rows - 1)) + 'px');
        refs.mapGrid.style.setProperty('--jinan-map-texture', 'url("' + JINAN_MAP_TEXTURE_URL + '")');
        refs.mapGrid.style.gridTemplateColumns = 'repeat(' + grid.cols + ', var(--cell-size))';
        refs.mapGrid.style.gridTemplateRows = 'repeat(' + grid.rows + ', var(--cell-size))';
        refs.mapGrid.classList.toggle('map-grid--jinan-texture', isJinanLevel(level));

        var html = [];
        var defensePathKeys = activeEditorMode === 'defense' ? getDefenseEditorPathKeys(level) : null;
        for (var row = 0; row < grid.rows; row += 1) {
            for (var col = 0; col < grid.cols; col += 1) {
                html.push(renderCell(level, col, row, defensePathKeys));
            }
        }
        refs.mapGrid.innerHTML = html.join('');
        bindMarkerDrag();
    }

    function renderCell(level, col, row, defensePathKeys) {
        var classes = ['map-cell'];
        var exploreLayout = ensureExplorationLayout(level.map);
        if (activeEditorMode === 'explore') {
            if (hasCell(exploreLayout.path, col, row)) classes.push('path');
            if (hasCell(exploreLayout.obstacles, col, row)) classes.push('obstacle');
        } else {
            if (hasCell(level.map.obstacles, col, row)) classes.push('obstacle');
            else if (defensePathKeys && defensePathKeys.has(String(col) + ',' + String(row))) classes.push('path');
            if (hasCell(level.map.buildSlots, col, row)) classes.push('build-slot');
        }
        var markers = [];
        if (activeEditorMode === 'explore') {
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
        level.map.actors.filter(atCell(col, row)).forEach(function (actor) {
            markers.push(markerHtml('actor', actor.id, actor.icon || actor.name.charAt(0), 'actor-marker ' + actor.category, selectedObject));
        });
        return '<div class="' + classes.join(' ') + '" data-col="' + col + '" data-row="' + row + '">' + markers.join('') + '</div>';
    }

    function markerHtml(kind, id, label, className, selection) {
        var selected = selection && selection.kind === kind && selection.id === id;
        return '<span draggable="true" class="' + className + (selected ? ' selected' : '') + '" data-object-kind="' + escapeAttr(kind) + '" data-object-id="' + escapeAttr(id) + '">' + escapeHtml(label.slice(0, 2)) + '</span>';
    }

    function bindMarkerDrag() {
        refs.mapGrid.querySelectorAll('[data-object-kind]').forEach(function (marker) {
            marker.addEventListener('dragstart', function (event) {
                event.dataTransfer.setData('application/json', JSON.stringify({
                    kind: marker.dataset.objectKind === 'actor' ? 'actor' : 'marker',
                    markerKind: marker.dataset.objectKind,
                    id: marker.dataset.objectId
                }));
            });
        });
    }

    function handleCellAction(col, row) {
        var level = getLevel();
        if (!level) return;
        if (activeTool === 'select') {
            selectedObject = null;
            renderSelectionInspector();
            renderMap();
            return;
        }
        if (activeEditorMode === 'explore') {
            var exploreLayout = ensureExplorationLayout(level.map);
            if (activeTool === 'road' || activeTool === 'path') toggleCell(exploreLayout.path, col, row);
            if (activeTool === 'obstacle') toggleCell(exploreLayout.obstacles, col, row);
            if (activeTool === 'spawn') setExploreStartPoint(col, row);
            if (activeTool === 'objective') setExploreExitPoint(col, row);
            if (activeTool === 'buildSlot') addExplorePoint(col, row);
        } else {
            if (activeTool === 'road') toggleCell(level.map.roads, col, row);
            if (activeTool === 'obstacle') toggleCell(level.map.obstacles, col, row);
            if (activeTool === 'path') togglePathCell(level, col, row);
            if (activeTool === 'buildSlot') toggleCell(level.map.buildSlots, col, row);
            if (activeTool === 'spawn') addSpawnPoint(col, row);
            if (activeTool === 'objective') setObjectivePoint(col, row);
        }
        if (activeTool === 'explorePoint') addExplorePoint(col, row);
        if (activeTool === 'actor') placeActorFromTemplate(selectedTemplateId, col, row);
        if (activeTool === 'erase') eraseCell(col, row);
        level.status = level.status === 'draft' ? 'needs-work' : level.status;
        markDirty('已更新地图');
        renderAll();
    }

    function togglePathCell(level, col, row) {
        if (!level.map.enemyPaths.length) {
            level.map.enemyPaths.push({ id: 'path-main', name: '主敌人路径', cells: [] });
        }
        toggleCell(level.map.enemyPaths[0].cells, col, row);
    }

    function addSpawnPoint(col, row) {
        var level = getLevel();
        var existing = level.map.spawnPoints.find(function (point) { return point.col === col && point.row === row; });
        if (existing) {
            selectObject('spawn', existing.id);
            return;
        }
        var id = uid('spawn');
        level.map.spawnPoints.push({ id: id, name: '敌人出口 ' + (level.map.spawnPoints.length + 1), col: col, row: row, pathId: 'path-main' });
        selectedObject = { kind: 'spawn', id: id };
    }

    function setObjectivePoint(col, row) {
        var level = getLevel();
        level.map.objectivePoint = { id: level.map.objectivePoint && level.map.objectivePoint.id || 'objective-main', name: '防守核心', col: col, row: row };
        selectedObject = { kind: 'objective', id: level.map.objectivePoint.id };
    }

    function setExploreStartPoint(col, row) {
        var level = getLevel();
        var layout = ensureExplorationLayout(level.map);
        layout.startPoint = { id: layout.startPoint && layout.startPoint.id || 'explore-start', name: '探索起点', col: col, row: row };
        selectedObject = { kind: 'spawn', id: layout.startPoint.id };
    }

    function setExploreExitPoint(col, row) {
        var level = getLevel();
        var layout = ensureExplorationLayout(level.map);
        layout.exitPoint = { id: layout.exitPoint && layout.exitPoint.id || 'explore-exit', name: '探索终点', col: col, row: row };
        selectedObject = { kind: 'objective', id: layout.exitPoint.id };
    }

    function addExplorePoint(col, row) {
        var level = getLevel();
        var id = uid('poi');
        level.map.explorationPoints.push({ id: id, name: '探索点 ' + (level.map.explorationPoints.length + 1), col: col, row: row, modelId: '', interaction: 'inspect', radius: 2 });
        selectedObject = { kind: 'explorePoint', id: id };
    }

    function ensureWorldOffset(actor) {
        if (!actor.worldOffsetMeters || typeof actor.worldOffsetMeters !== 'object') {
            actor.worldOffsetMeters = { x: 0, y: 0, z: 0 };
        }
        ['x', 'y', 'z'].forEach(function (k) {
            if (!Number.isFinite(Number(actor.worldOffsetMeters[k]))) actor.worldOffsetMeters[k] = 0;
        });
    }

    function applyWorldHitToActor(actor, wx, wy, wz) {
        var level = getLevel();
        if (!level) return;
        var cols = level.map.grid.cols;
        var rows = level.map.grid.rows;
        var ts = level.map.grid.tileSize;
        var col = clamp(Math.floor(wx / ts + cols / 2), 0, cols - 1);
        var row = clamp(Math.floor(wz / ts + rows / 2), 0, rows - 1);
        actor.col = col;
        actor.row = row;
        ensureWorldOffset(actor);
        var cx = (col - cols / 2 + 0.5) * ts;
        var cz = (row - rows / 2 + 0.5) * ts;
        actor.worldOffsetMeters.x = wx - cx;
        actor.worldOffsetMeters.y = wy;
        actor.worldOffsetMeters.z = wz - cz;
    }

    function placeActorFromTemplate(templateId, col, row) {
        var level = getLevel();
        var template = findActorTemplate(templateId);
        if (!level || !template) return;
        var actor = {
            id: uid('actor'),
            templateId: template.id,
            name: template.name,
            category: template.category,
            icon: template.icon || template.name.charAt(0),
            modelId: template.modelId || '',
            modelPath: template.modelPath || '',
            col: col,
            row: row,
            rotation: 0,
            scale:
                template.templateModelScale != null && template.templateModelScale > 0
                    ? template.templateModelScale
                    : 1,
            worldOffsetMeters: { x: 0, y: 0, z: 0 },
            team: template.category === 'enemy' ? 'enemy' : 'player',
            stats: clone(template.stats || {})
        };
        level.map.actors.push(actor);
        selectedObject = { kind: 'actor', id: actor.id };
        level.status = level.status === 'draft' ? 'needs-work' : level.status;
        markDirty('已放置 Actor');
        renderAll();
    }

    function moveActor(actorId, col, row) {
        var level = getLevel();
        var actor = level.map.actors.find(function (item) { return item.id === actorId; });
        if (!actor) return;
        actor.col = col;
        actor.row = row;
        selectedObject = { kind: 'actor', id: actor.id };
        markDirty('已移动 Actor');
        renderAll();
    }

    function moveMarker(kind, id, col, row) {
        var level = getLevel();
        var item = null;
        var layout = ensureExplorationLayout(level.map);
        if (kind === 'spawn') item = activeEditorMode === 'explore' ? layout.startPoint : level.map.spawnPoints.find(byId(id));
        if (kind === 'explorePoint') item = level.map.explorationPoints.find(byId(id));
        if (kind === 'objective') item = activeEditorMode === 'explore' ? layout.exitPoint : level.map.objectivePoint && level.map.objectivePoint.id === id ? level.map.objectivePoint : null;
        if (!item) return;
        item.col = col;
        item.row = row;
        selectedObject = { kind: kind, id: id };
        markDirty('已移动地图标记');
        renderAll();
    }

    function eraseCell(col, row) {
        var level = getLevel();
        var layout = ensureExplorationLayout(level.map);
        if (activeEditorMode === 'explore') {
            removeCell(layout.path, col, row);
            removeCell(layout.obstacles, col, row);
            if (layout.startPoint && layout.startPoint.col === col && layout.startPoint.row === row) layout.startPoint = null;
            if (layout.exitPoint && layout.exitPoint.col === col && layout.exitPoint.row === row) layout.exitPoint = null;
        } else {
            removeCell(level.map.roads, col, row);
            removeCell(level.map.obstacles, col, row);
            removeCell(level.map.buildSlots, col, row);
            level.map.enemyPaths.forEach(function (path) { removeCell(path.cells, col, row); });
            level.map.spawnPoints = level.map.spawnPoints.filter(notAtCell(col, row));
            if (level.map.objectivePoint && level.map.objectivePoint.col === col && level.map.objectivePoint.row === row) {
                level.map.objectivePoint = null;
            }
        }
        level.map.explorationPoints = level.map.explorationPoints.filter(notAtCell(col, row));
        level.map.actors = level.map.actors.filter(notAtCell(col, row));
        selectedObject = null;
    }

    function renderActorPalette() {
        var templates = getAvailableActorTemplates();
        if (!templates.length) {
            refs.actorPalette.innerHTML = '<div class="empty-state">暂无可用 Actor 模板。</div>';
            return;
        }
        if (!templates.some(function (template) { return template.id === selectedTemplateId; })) {
            selectedTemplateId = templates[0].id;
        }
        refs.actorPalette.innerHTML =
            '<p class="section-hint actor-palette-hint">从下方模板拖到「棋盘布局」或「关卡预览」；松手落在格缝时也会按坐标吸附到最近格。每行可绑定项目模型与缩放（与塔防单位替换一致）。</p>' +
            templates
                .map(function (template) {
                    var t = findActorTemplate(template.id) || template;
                    var url = String(t.modelPath || '');
                    var sc =
                        t.templateModelScale != null && t.templateModelScale > 0 ? t.templateModelScale : 1;
                    var cityOnly = template.source === 'cityGameplay';
                    var modelUi = cityOnly
                        ? '<p class="section-hint" style="margin:8px 10px;font-size:10px;">城市玩法条目：请到「Gameplay」工作台为敌人/模型换绑；此处占位只读。</p>'
                        : '  <div class="actor-template-model game-asset-tower-row">' +
                          '    <div class="game-asset-tower-title">模型</div>' +
                          '    <div class="game-asset-tower-upload-col" data-actor-template-drop="' +
                          escapeAttr(template.id) +
                          '" title="从底部「项目模型」拖入">' +
                          '      <label class="game-asset-upload tight">替换模型' +
                          '        <input type="file" data-actor-template-file="' +
                          escapeAttr(template.id) +
                          '" accept=".glb,.gltf,.obj,model/gltf-binary,model/gltf+json" />' +
                          '      </label>' +
                          '      <div class="game-asset-tower-drop">拖入项目模型</div>' +
                          '    </div>' +
                          '    <label class="field-block game-asset-scale-tower"><span>缩放</span>' +
                          '      <input type="number" data-actor-template-scale="' +
                          escapeAttr(template.id) +
                          '" min="0.1" max="8" step="0.1" value="' +
                          String(sc) +
                          '" />' +
                          '    </label>' +
                          '    <div class="asset-url-hint" title="' +
                          escapeAttr(url || '未绑定 Actor 模板模型') +
                          '">' +
                          escapeHtml(url ? modelBindShortLabel(url) : '未配置') +
                          '</div>' +
                          '  </div>';
                    return (
                        '<div class="actor-template-wrap' +
                        (template.id === selectedTemplateId ? ' actor-template-wrap--selected' : '') +
                        '">' +
                        '  <div class="actor-template' +
                        (template.id === selectedTemplateId ? ' selected' : '') +
                        '" draggable="true" data-template-id="' +
                        escapeAttr(template.id) +
                        '">' +
                        '    <strong>' +
                        escapeHtml(template.name) +
                        '</strong>' +
                        '    <span>' +
                        escapeHtml(actorCategoryLabel(template.category)) +
                        ' · ' +
                        escapeHtml(summaryStats(template.stats)) +
                        (template.source === 'cityGameplay' ? ' · 城市玩法库' : '') +
                        '</span>' +
                        '  </div>' +
                        modelUi +
                        '</div>'
                    );
                })
                .join('');

        refs.actorPalette.querySelectorAll('[data-template-id]').forEach(function (item) {
            item.addEventListener('click', function () {
                selectedTemplateId = item.getAttribute('data-template-id');
                activeTool = 'actor';
                document.querySelectorAll('[data-tool]').forEach(function (tool) {
                    tool.classList.toggle('active', tool.getAttribute('data-tool') === 'actor');
                });
                refs.activeToolLabel.textContent = '当前工具：模型 Actor';
                renderActorPalette();
            });
            item.addEventListener('dragstart', function (event) {
                selectedTemplateId = item.getAttribute('data-template-id');
                var payloadJson = JSON.stringify({ kind: 'template', id: selectedTemplateId });
                if (event.dataTransfer) {
                    event.dataTransfer.setData('application/json', payloadJson);
                    event.dataTransfer.setData('text/plain', payloadJson);
                    event.dataTransfer.effectAllowed = 'copy';
                }
            });
        });
        bindActorTemplateModelControls();
    }

    function bindActorTemplateModelControls() {
        if (!refs.actorPalette) return;
        refs.actorPalette.querySelectorAll('[data-actor-template-scale]').forEach(function (input) {
            input.addEventListener('change', function () {
                var id = input.getAttribute('data-actor-template-scale');
                var t = state.actorTemplates.find(function (x) { return x.id === id; });
                if (!t) return;
                t.templateModelScale = clamp(Number(input.value) || 1, 0.1, 8);
                markDirty('已更新模板缩放');
                schedulePreviewRefresh();
            });
        });
        refs.actorPalette.querySelectorAll('[data-actor-template-file]').forEach(function (inp) {
            inp.addEventListener('change', function () {
                var id = inp.getAttribute('data-actor-template-file');
                if (!inp.files || !inp.files[0]) return;
                applyActorTemplateUploadedModel(id, inp.files[0]);
                inp.value = '';
            });
        });
        refs.actorPalette.querySelectorAll('[data-actor-template-drop]').forEach(function (zone) {
            zone.addEventListener('dragover', function (e) {
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
            });
            zone.addEventListener('drop', async function (e) {
                e.preventDefault();
                var id = zone.getAttribute('data-actor-template-drop');
                var f =
                    e.dataTransfer.files && e.dataTransfer.files[0] ? e.dataTransfer.files[0] : null;
                if (f) applyActorTemplateUploadedModel(id, f);
            });
        });
    }

    async function applyActorTemplateUploadedModel(templateId, file) {
        try {
            setStatus('正在上传「' + file.name + '」…', 'idle');
            var url = await uploadFileToProjectUrl(file, { gameModelsUpload: true, gameModelsSubdir: 'ActorTemplates' });
            var tpl = state.actorTemplates.find(function (x) { return x.id === templateId; });
            if (!tpl) {
                setStatus('仅能修改「项目 Actor 模板」。城市玩法库条目请在 Gameplay 工作台绑定模型。', 'error');
                return;
            }
            if (!url) {
                setStatus('上传成功但未返回 publicUrl（请查看终端 /api 报错）', 'error');
                return;
            }
            tpl.modelPath = url;
            markDirty('已绑定模板模型');
            renderActorPalette();
            schedulePreviewRefresh();
            setStatus(
                'Actor 模板已绑定「' + file.name + '」 · 当前：' + modelBindShortLabel(url) + '（悬停右侧格可看完整路径）',
                'success'
            );
        } catch (error) {
            setStatus('上传失败：' + ((error && error.message) || String(error)), 'error');
        }
    }

    function renderSelectionInspector() {
        var level = getLevel();
        var target = findSelectedObject(level);
        if (!target) {
            refs.selectionInspector.className = 'selection-inspector empty-state';
            refs.selectionInspector.innerHTML = '未选择对象。';
            return;
        }
        refs.selectionInspector.className = 'selection-inspector';
        refs.selectionInspector.innerHTML = buildInspectorForm(target.kind, target.item);
        refs.selectionInspector.querySelectorAll('[data-inspect-field]').forEach(function (input) {
            input.addEventListener('input', function () { updateSelectedField(input); });
            input.addEventListener('change', function () { updateSelectedField(input); });
        });
    }

    function buildInspectorForm(kind, item) {
        var modelOptions = ['<option value="">未绑定模型</option>'].concat(getBrowsableModelAssets().map(function (asset) {
            return '<option value="' + escapeAttr(asset.id) + '"' + (asset.id === item.modelId ? ' selected' : '') + '>' + escapeHtml(asset.name) + '</option>';
        })).join('');
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

    function fieldHtml(label, path, value, type, step) {
        return '<label class="field-block"><span>' + escapeHtml(label) + '</span><input data-inspect-field="' + escapeAttr(path) + '" type="' + (type || 'text') + '"' + (step ? ' step="' + step + '"' : '') + ' value="' + escapeAttr(value == null ? '' : value) + '"></label>';
    }

    function selectHtml(label, path, options) {
        return '<label class="field-block"><span>' + escapeHtml(label) + '</span><select data-inspect-field="' + escapeAttr(path) + '">' + options + '</select></label>';
    }

    function updateSelectedField(input) {
        var target = findSelectedObject(getLevel());
        if (!target) return;
        var path = input.getAttribute('data-inspect-field');
        var next = input.type === 'number' ? Number(input.value) : input.value;
        updatePath(target.item, path, next);
        if (path === 'col' || path === 'row') {
            target.item[path] = Math.max(0, Math.floor(Number(next) || 0));
            renderMap();
        }
        markDirty('已更新对象属性');
        renderOverview();
        schedulePreviewRefresh();
    }

    function renderWaveList() {
        var level = getLevel();
        var enemyLookup = getEnemyTypeLookup(level);
        if (!level) {
            refs.waveList.innerHTML = '';
            return;
        }
        if (!level.waveRules.length) {
            refs.waveList.innerHTML = '<div class="empty-state">暂无波次。点击新增波次开始配置。</div>';
            return;
        }
        refs.waveList.innerHTML = level.waveRules.map(function (wave, index) {
            var enemyName = enemyLookup[wave.enemyTypeId] ? enemyLookup[wave.enemyTypeId].name : (wave.enemyTypeId || '未指定敌人');
            var op = String(wave.overrideModelPath || '');
            var oscale = wave.overrideModelScale != null && wave.overrideModelScale > 0 ? wave.overrideModelScale : 1;
            return [
                '<div class="wave-card">',
                '  <div class="wave-card-head">',
                '    <strong>第 ' + wave.waveNumber + ' 波 · ' + escapeHtml(enemyName) + '</strong>',
                '    <span>数量 ' + wave.count + ' · 间隔 ' + wave.interval + 's · 出口 ' + escapeHtml(wave.spawnPointId || '自动') + '</span>',
                '    <div class="inline-controls">',
                '      <button class="mini-button" data-wave-action="edit" data-wave-index="' + index + '">快速编辑</button>',
                '      <button class="mini-button danger" data-wave-action="remove" data-wave-index="' + index + '">删除</button>',
                '    </div>',
                '  </div>',
                '  <div class="wave-card-model game-asset-tower-row">',
                '    <div class="game-asset-tower-title">敌人外观 · 可选覆盖</div>',
                '    <div class="game-asset-tower-upload-col" data-wave-model-drop="' + index + '">',
                '      <label class="game-asset-upload tight">替换模型',
                '        <input type="file" data-wave-model-file="' + index + '" accept=".glb,.gltf,.obj,model/gltf-binary,model/gltf+json" />',
                '      </label>',
                '      <div class="game-asset-tower-drop">拖入项目模型</div>',
                '    </div>',
                '    <label class="field-block game-asset-scale-tower"><span>缩放</span>',
                '      <input type="number" data-wave-override-scale="' +
                    index +
                    '" min="0.1" max="8" step="0.1" value="' +
                    String(oscale) +
                    '" />',
                '    </label>',
                '    <div class="asset-url-hint" title="' + escapeAttr(op || '若留空则沿用敌人条目的模型路径') + '">' +
                escapeHtml(op ? modelBindShortLabel(op) : '沿用敌人') +
                '</div>',
                '  </div>',
                '</div>'
            ].join('');
        }).join('');
        refs.waveList.querySelectorAll('[data-wave-action]').forEach(function (button) {
            button.addEventListener('click', function () {
                var index = Number(button.getAttribute('data-wave-index'));
                if (button.getAttribute('data-wave-action') === 'remove') removeWaveRule(index);
                else editWaveRule(index);
            });
        });
        bindWaveAppearanceControls(level);
    }

    function bindWaveAppearanceControls(level) {
        if (!refs.waveList || !level || !level.waveRules) return;
        refs.waveList.querySelectorAll('[data-wave-override-scale]').forEach(function (input) {
            input.addEventListener('input', function () {
                var wi = Number(input.getAttribute('data-wave-override-scale'));
                var wave = level.waveRules[wi];
                if (!wave) return;
                wave.overrideModelScale = clamp(Number(input.value) || 1, 0.1, 8);
                markDirty('已更新波次模型缩放');
            });
        });
        refs.waveList.querySelectorAll('[data-wave-model-file]').forEach(function (inp) {
            inp.addEventListener('change', function () {
                var wi = Number(inp.getAttribute('data-wave-model-file'));
                var wave = level.waveRules[wi];
                if (!wave || !inp.files || !inp.files[0]) return;
                applyWaveOverrideModel(level, wi, inp.files[0]);
                inp.value = '';
            });
        });
        refs.waveList.querySelectorAll('[data-wave-model-drop]').forEach(function (zone) {
            zone.addEventListener('dragover', function (e) {
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
            });
            zone.addEventListener('drop', function (e) {
                e.preventDefault();
                var wi = Number(zone.getAttribute('data-wave-model-drop'));
                var wave = level.waveRules[wi];
                if (!wave || !e.dataTransfer.files || !e.dataTransfer.files[0]) return;
                applyWaveOverrideModel(level, wi, e.dataTransfer.files[0]);
            });
        });
    }

    async function applyWaveOverrideModel(level, waveIndex, file) {
        try {
            setStatus('正在上传「' + file.name + '」…', 'idle');
            var url = await uploadFileToProjectUrl(file, { gameModelsUpload: true, gameModelsSubdir: 'Waves' });
            var wave = level.waveRules[waveIndex];
            if (!wave) {
                setStatus('找不到对应波次', 'error');
                return;
            }
            if (!url) {
                setStatus('上传成功但未返回 publicUrl', 'error');
                return;
            }
            wave.overrideModelPath = url;
            markDirty('已绑定波次模型');
            renderWaveList();
            setStatus(
                '波次 #' + String(wave.waveNumber || waveIndex + 1) + ' 已绑定「' + file.name + '」 · ' + modelBindShortLabel(url),
                'success'
            );
        } catch (error) {
            setStatus('上传失败：' + ((error && error.message) || String(error)), 'error');
        }
    }

    function addWaveRule() {
        var level = getLevel();
        if (!level) return;
        var enemies = getAvailableEnemyTypes(level);
        var enemy = enemies[0] || createEnemyTypeFromTemplates(level);
        var spawn = level.map.spawnPoints[0];
        level.waveRules.push({
            id: uid('wave'),
            waveNumber: level.waveRules.length + 1,
            enemyTypeId: enemy.id,
            count: 12,
            interval: 1.2,
            spawnPointId: spawn ? spawn.id : '',
            pathId: 'path-main',
            reward: 50,
            overrideModelPath: '',
            overrideModelScale: 1
        });
        markDirty('已新增波次');
        renderWaveList();
        renderOverview();
    }

    function editWaveRule(index) {
        var level = getLevel();
        var wave = level.waveRules[index];
        if (!wave) return;
        var enemies = getAvailableEnemyTypes(level);
        var enemyPrompt = enemies.map(function (enemy) { return enemy.id + ':' + enemy.name; }).join('\n');
        if (enemyPrompt) {
            var enemyTypeId = window.prompt('敌人 ID（可用候选）\n' + enemyPrompt, String(wave.enemyTypeId || enemies[0].id));
            if (enemyTypeId !== null) wave.enemyTypeId = String(enemyTypeId || wave.enemyTypeId || enemies[0].id);
        }
        var count = window.prompt('敌人数量', String(wave.count));
        if (count !== null) wave.count = Math.max(1, Number(count) || wave.count);
        var interval = window.prompt('刷新间隔（秒）', String(wave.interval));
        if (interval !== null) wave.interval = Math.max(0.1, Number(interval) || wave.interval);
        markDirty('已更新波次');
        renderWaveList();
    }

    function removeWaveRule(index) {
        var level = getLevel();
        level.waveRules.splice(index, 1);
        level.waveRules.forEach(function (wave, waveIndex) { wave.waveNumber = waveIndex + 1; });
        markDirty('已删除波次');
        renderWaveList();
        renderOverview();
    }

    function renderModelAssets() {
        var assets = getBrowsableModelAssets();
        if (!assets.length) {
            refs.modelAssetList.innerHTML = '<div class="empty-state">暂无模型资产。上传模型后可作为 Actor 使用。</div>';
            return;
        }
        refs.modelAssetList.innerHTML = assets.map(function (asset) {
            return [
                '<div class="list-item">',
                '  <strong>' + escapeHtml(asset.name) + '</strong>',
                '  <span>' + escapeHtml(asset.path || asset.url || '未设置路径') + '</span>',
                '  <div class="inline-controls">',
                '    <button class="mini-button" data-model-template="' + escapeAttr(asset.id) + '">变成 Actor 模板</button>',
                '  </div>',
                '</div>'
            ].join('');
        }).join('');
        refs.modelAssetList.querySelectorAll('[data-model-template]').forEach(function (button) {
            button.addEventListener('click', function () {
                createActorTemplateFromModel(button.getAttribute('data-model-template'));
            });
        });
    }

    async function uploadModelAsset(file) {
        try {
            setStatus('正在上传模型 ' + file.name + '…', 'idle');
            var url = await uploadFileToProjectUrl(file, { gameModelsUpload: true, gameModelsSubdir: '' });
            var id = uniqueCatalogId(state.catalog.modelAssets, slugify(file.name.replace(/\.[^.]+$/, '')) || 'uploaded-model');
            state.catalog.modelAssets.push({
                id: id,
                name: file.name.replace(/\.[^.]+$/, ''),
                summary: '上传的自定义模型',
                path: url || ''
            });
            createActorTemplateFromModel(id);
            refs.modelUpload.value = '';
            markDirty('已上传模型');
            renderAll();
        } catch (error) {
            refs.modelUpload.value = '';
            setStatus('模型上传失败: ' + error.message, 'error');
        }
    }

    function createActorTemplateFromSelection() {
        var name = window.prompt('Actor 模板名称', '新 Actor 模板');
        if (!name) return;
        var id = uniqueTemplateId(slugify(name) || 'custom-actor');
        state.actorTemplates.push({
            id: id,
            name: name,
            category: 'model',
            modelId: '',
            modelPath: '',
            templateModelScale: 1,
            icon: name.charAt(0).toUpperCase(),
            stats: { hp: 100, attack: 0, range: 1, fireRate: 0, cost: 0, cooldown: 0 }
        });
        selectedTemplateId = id;
        markDirty('已新增 Actor 模板');
        renderActorPalette();
    }

    function createActorTemplateFromModel(modelId) {
        var asset = getBrowsableModelAssets().find(function (item) { return item.id === modelId; });
        if (!asset) return;
        var id = uniqueTemplateId('model-' + modelId);
        state.actorTemplates.push({
            id: id,
            name: asset.name + ' Actor',
            category: 'model',
            modelId: modelId,
            modelPath: asset.path || asset.publicUrl || '',
            templateModelScale: 1,
            icon: 'M',
            stats: { hp: 1, attack: 0, range: 1, fireRate: 0, cost: 0, cooldown: 0 }
        });
        selectedTemplateId = id;
        markDirty('已从模型创建 Actor 模板');
        renderActorPalette();
    }

    function applyMapSize() {
        var level = getLevel();
        if (!level) return;
        var cols = clamp(Number(refs.fieldGridCols.value) || DEFAULT_GRID_COLS, 8, 80);
        var rows = clamp(Number(refs.fieldGridRows.value) || DEFAULT_GRID_ROWS, 8, 80);
        var tileSize = clamp(Number(refs.fieldTileSize.value) || DEFAULT_TILE_SIZE, 1, 10);
        level.map.grid.cols = cols;
        level.map.grid.rows = rows;
        level.map.grid.tileSize = tileSize;
        ensureExplorationLayout(level.map).grid = { cols: cols, rows: rows, tileSize: tileSize };
        trimMapToBounds(level.map);
        markDirty('已更新地图尺寸');
        renderAll();
        syncPreviewIfOpen();
    }

    function updateGeoFromFields() {
        var level = getLevel();
        if (!level || !refs.fieldGeoEnabled) return;
        var builtInDefault = BUILT_IN_CITY_LAYOUTS[matchBuiltInCity(level)] && BUILT_IN_CITY_LAYOUTS[matchBuiltInCity(level)].geo;
        var fallback = builtInDefault || normalizeGeoConfig(level.map.geo);
        var enabled = refs.fieldGeoEnabled.value === 'true';
        var lat = Number(refs.fieldGeoLat.value);
        var lon = Number(refs.fieldGeoLon.value);
        if (!Number.isFinite(lat)) lat = fallback.center.lat;
        if (!Number.isFinite(lon)) lon = fallback.center.lon;
        level.map.geo = normalizeGeoConfig({
            enabled: enabled,
            provider: 'cesium-ion',
            assetId: refs.fieldGeoAssetId.value || fallback.assetId || DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID,
            center: {
                lat: lat,
                lon: lon,
                heightMeters: Number(refs.fieldGeoHeight.value) || fallback.center.heightMeters || 0
            },
            extentMeters: Number(refs.fieldGeoExtent.value) || fallback.extentMeters || 1000,
            rotationDeg: Number(refs.fieldGeoRotation.value) || 0,
            yOffsetMeters: Number(refs.fieldGeoYOffset.value) || 0,
            boardHeightMeters: Number(refs.fieldGeoBoardHeight && refs.fieldGeoBoardHeight.value) || fallback.boardHeightMeters || 32,
            scale: fallback.scale || 1
        });
        level.status = level.status === 'draft' ? 'needs-work' : level.status;
        markDirty('已更新真实地图配置');
        syncPreviewIfOpen();
    }

    function createManualLevel() {
        var id = uniqueLevelId('custom-level');
        var level = createDraftLevel({
            id: id,
            name: '自定义关卡',
            countryCode: 'CUSTOM',
            countryName: '自定义国家',
            cityCode: '',
            cityName: '自定义城市',
            regionLabel: '自定义国家 · 自定义城市',
            source: 'manual'
        });
        state.levels.unshift(level);
        selectedLevelId = level.id;
        markDirty('已创建自定义关卡');
        renderAll();
    }

    function syncPreviewIfOpen() {
        if (viewportViewMode !== 'preview' || !previewApi || typeof previewApi.refresh !== 'function') return;
        previewApi.refresh();
        if (selectedObject && selectedObject.kind === 'actor' && typeof previewApi.setSelectedActor === 'function') {
            previewApi.setSelectedActor(selectedObject.id);
        }
    }

    function selectLevel(levelId) {
        selectedLevelId = levelId;
        selectedObject = null;
        selectedGameplayEntryId = '';
        selectedGameplayAssetId = '';
        renderAll();
        syncPreviewIfOpen();
    }

    function selectObject(kind, id) {
        selectedObject = { kind: kind, id: id };
        renderSelectionInspector();
        renderMap();
        if (viewportViewMode === 'preview' && previewApi && typeof previewApi.setSelectedActor === 'function') {
            if (kind === 'actor') previewApi.setSelectedActor(id);
            else previewApi.setSelectedActor(null);
        }
        renderPreviewSceneOutline();
    }

    function deleteSelection() {
        var level = getLevel();
        if (!level || !selectedObject) return;
        var layout = ensureExplorationLayout(level.map);
        if (selectedObject.kind === 'actor') level.map.actors = level.map.actors.filter(function (item) { return item.id !== selectedObject.id; });
        if (selectedObject.kind === 'spawn') {
            if (activeEditorMode === 'explore' && layout.startPoint && layout.startPoint.id === selectedObject.id) layout.startPoint = null;
            else level.map.spawnPoints = level.map.spawnPoints.filter(function (item) { return item.id !== selectedObject.id; });
        }
        if (selectedObject.kind === 'explorePoint') level.map.explorationPoints = level.map.explorationPoints.filter(function (item) { return item.id !== selectedObject.id; });
        if (selectedObject.kind === 'objective') {
            if (activeEditorMode === 'explore' && layout.exitPoint && layout.exitPoint.id === selectedObject.id) layout.exitPoint = null;
            else level.map.objectivePoint = null;
        }
        selectedObject = null;
        markDirty('已删除选中对象');
        renderAll();
        syncPreviewIfOpen();
    }

    function normalizeState(raw) {
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

    function normalizeCatalog(catalog) {
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

    function normalizeCatalogItem(item) {
        var next = item && typeof item === 'object' ? item : {};
        return {
            id: String(next.id || slugify(next.name || '') || uid('asset')),
            name: String(next.name || next.id || '未命名资产'),
            summary: String(next.summary || ''),
            path: String(next.path || next.url || '')
        };
    }

    function normalizeEditorAssetsCatalog(raw) {
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

    function normalizeCityGameplayConfigs(raw) {
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
        });
        return normalized;
    }

    function mergeRuntimeCityGameplayConfigs(raw) {
        if (!raw || typeof raw !== 'object' || !state) return 0;
        var normalized = normalizeCityGameplayConfigs(raw);
        var imported = 0;
        Object.keys(normalized).forEach(function (key) {
            var runtimeConfig = normalized[key];
            var resolvedKey = resolveCityGameplayConfigKey({
                key: key,
                cityCode: runtimeConfig.cityCode,
                cityName: runtimeConfig.cityName
            }, key);
            if (!state.cityGameplayConfigs[resolvedKey]) {
                state.cityGameplayConfigs[resolvedKey] = {
                    cityCode: runtimeConfig.cityCode,
                    cityName: runtimeConfig.cityName,
                    aliases: runtimeConfig.aliases || [],
                    enemies: [],
                    characters: [],
                    skills: [],
                    towers: [],
                    cards: [],
                    updatedAt: runtimeConfig.updatedAt || ''
                };
            }
            var target = state.cityGameplayConfigs[resolvedKey];
            target.cityCode = target.cityCode || runtimeConfig.cityCode;
            target.cityName = target.cityName || runtimeConfig.cityName;
            target.aliases = mergeDistinctStrings(target.aliases || [], runtimeConfig.aliases || [], [target.cityCode, target.cityName, runtimeConfig.cityCode, runtimeConfig.cityName]);
            ['enemies', 'characters', 'skills', 'towers', 'cards'].forEach(function (kind) {
                imported += mergeGameplayEntryList(target[kind], runtimeConfig[kind]);
            });
        });
        return imported;
    }

    function mergeGameplayEntryList(target, source) {
        var added = 0;
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
            if (!existing.tags || !existing.tags.length) existing.tags = clone(entry.tags || []);
            if (!existing.assetRefs || !Object.keys(existing.assetRefs).length) existing.assetRefs = clone(entry.assetRefs || {});
            existing.stats = Object.assign({}, entry.stats || {}, existing.stats || {});
        });
        return added;
    }

    function mergeDistinctStrings() {
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

    function normalizeGameplayEntries(raw, kind) {
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
        var source = []
            .concat(config.characters || [])
            .concat(config.skills || []);
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

    function normalizeGameplayPlacement(value) {
        var placement = String(value || 'roadside').trim();
        return placement === 'road' || placement === 'on-road' || placement === 'path' ? 'road' : 'roadside';
    }

    function getGameplayCityContext() {
        var level = getLevel();
        if (!level || !level.location) return null;
        var cityName = String(level.location.cityName || '').trim();
        var cityCode = String(level.location.cityCode || slugify(cityName || level.id || 'city')).trim();
        if (!cityName && !cityCode) return null;
        return {
            cityCode: cityCode || slugify(cityName || 'city'),
            cityName: cityName || level.name || '未命名城市',
            key: cityCode || slugify(cityName || level.name || 'city')
        };
    }

    function normalizeCityIdentity(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[·\s]/g, '')
            .replace(/市$/g, '');
    }

    function resolveCityGameplayConfigKey(cityContext, preferredKey) {
        if (!state || !state.cityGameplayConfigs) return preferredKey || cityContext.key || cityContext.cityCode || slugify(cityContext.cityName || 'city');
        var desired = mergeDistinctStrings(
            preferredKey,
            cityContext.key,
            cityContext.cityCode,
            cityContext.cityName,
            slugify(cityContext.cityName || '')
        ).map(normalizeCityIdentity).filter(Boolean);
        var keys = Object.keys(state.cityGameplayConfigs);
        for (var i = 0; i < keys.length; i += 1) {
            var key = keys[i];
            var config = state.cityGameplayConfigs[key];
            var candidates = mergeDistinctStrings(key, config.cityCode, config.cityName, config.aliases || []).map(normalizeCityIdentity).filter(Boolean);
            if (candidates.some(function (candidate) { return desired.indexOf(candidate) !== -1; })) {
                return key;
            }
        }
        return preferredKey || cityContext.key || cityContext.cityCode || slugify(cityContext.cityName || 'city');
    }

    function ensureCityGameplayConfig(cityContext) {
        var resolvedKey = resolveCityGameplayConfigKey(cityContext);
        if (!state.cityGameplayConfigs[resolvedKey]) {
            state.cityGameplayConfigs[resolvedKey] = {
                cityCode: cityContext.cityCode,
                cityName: cityContext.cityName,
                aliases: mergeDistinctStrings(cityContext.cityName, cityContext.cityCode),
                enemies: [],
                characters: [],
                skills: [],
                towers: [],
                cards: [],
                updatedAt: ''
            };
        }
        if (!Array.isArray(state.cityGameplayConfigs[resolvedKey].towers)) {
            state.cityGameplayConfigs[resolvedKey].towers = buildDefaultTowerEntries(state.cityGameplayConfigs[resolvedKey]);
        }
        if (!Array.isArray(state.cityGameplayConfigs[resolvedKey].cards)) {
            state.cityGameplayConfigs[resolvedKey].cards = buildDefaultCardEntries(state.cityGameplayConfigs[resolvedKey]);
        }
        return state.cityGameplayConfigs[resolvedKey];
    }

    function pickPreferredGameplayTab(config, currentTab) {
        if (!config) return currentTab;
        if (config[currentTab] && config[currentTab].length) return currentTab;
        return ['cards', 'towers', 'characters', 'skills', 'enemies'].find(function (tab) {
            return config[tab] && config[tab].length;
        }) || currentTab;
    }

    function createGameplayEntry() {
        var cityContext = getGameplayCityContext();
        if (!cityContext) {
            setStatus('请先在左侧选择一个带城市信息的关卡', 'error');
            return;
        }
        var config = ensureCityGameplayConfig(cityContext);
        var kindLabel = GAMEPLAY_RESOURCE_CONFIG[activeGameplayTab].label;
        var id = uniqueGameplayEntryId(config[activeGameplayTab], slugify(cityContext.cityName + '-' + kindLabel) || activeGameplayTab);
        config[activeGameplayTab].push({
            id: id,
            name: cityContext.cityName + '·新' + kindLabel,
            summary: '',
            tags: [cityContext.cityName],
            rarity: 'common',
            placement: activeGameplayTab === 'characters' || activeGameplayTab === 'towers' ? 'roadside' : '',
            stats: {},
            assetRefs: {},
            cityCode: cityContext.cityCode,
            cityName: cityContext.cityName,
            updatedAt: new Date().toISOString()
        });
        selectedGameplayEntryId = id;
        markDirty('已新增' + kindLabel + '条目');
        renderGameplayEditor();
    }

    function duplicateGameplayEntry() {
        var collection = getGameplayCollection();
        var entry = getSelectedGameplayEntry();
        if (!collection || !entry) return;
        var copy = clone(entry);
        copy.id = uniqueGameplayEntryId(collection, entry.id + '-copy');
        copy.name = entry.name + ' 复制';
        copy.updatedAt = new Date().toISOString();
        var index = collection.findIndex(function (item) { return item.id === entry.id; });
        collection.splice(index + 1, 0, copy);
        selectedGameplayEntryId = copy.id;
        selectedGameplayAssetId = '';
        markDirty('已复制玩法条目');
        renderGameplayEditor();
    }

    function deleteGameplayEntry() {
        var collection = getGameplayCollection();
        var entry = getSelectedGameplayEntry();
        if (!collection || !entry) return;
        if (!window.confirm('确定删除「' + entry.name + '」吗？')) return;
        var index = collection.findIndex(function (item) { return item.id === entry.id; });
        if (index === -1) return;
        collection.splice(index, 1);
        selectedGameplayEntryId = collection[index] ? collection[index].id : collection[index - 1] ? collection[index - 1].id : '';
        selectedGameplayAssetId = '';
        markDirty('已删除玩法条目');
        renderGameplayEditor();
    }

    function moveGameplayEntry(direction) {
        var collection = getGameplayCollection();
        var entry = getSelectedGameplayEntry();
        if (!collection || !entry || !direction) return;
        var index = collection.findIndex(function (item) { return item.id === entry.id; });
        var targetIndex = index + direction;
        if (index < 0 || targetIndex < 0 || targetIndex >= collection.length) return;
        var moved = collection.splice(index, 1)[0];
        collection.splice(targetIndex, 0, moved);
        selectedGameplayEntryId = moved.id;
        markDirty(direction < 0 ? '已上移玩法条目' : '已下移玩法条目');
        renderGameplayEditor();
    }

    function getGameplayCollection() {
        var cityContext = getGameplayCityContext();
        if (!cityContext) return null;
        return ensureCityGameplayConfig(cityContext)[activeGameplayTab];
    }

    function getSelectedGameplayEntry(entries) {
        var list = Array.isArray(entries) ? entries : getGameplayCollection();
        if (!Array.isArray(list) || !list.length) return null;
        var found = list.find(function (item) { return item.id === selectedGameplayEntryId; }) || null;
        if (!found) {
            selectedGameplayEntryId = list[0].id;
            found = list[0];
        }
        return found;
    }

    function handleGameplayFormInput(target) {
        var entry = getSelectedGameplayEntry();
        var list = getGameplayCollection();
        if (!entry || !list || !target) return;
        if (target.name === 'name') {
            entry.name = String(target.value || '').trim();
            if (refs.gameplayAssetName && !refs.gameplayAssetName.value) refs.gameplayAssetName.value = entry.name;
            markDirty('已更新玩法条目名称');
            renderGameplayEditor();
            return;
        }
        if (target.name === 'id') {
            var nextId = ensureUniqueGameplayEntryId(list, target.value, entry.id);
            entry.id = nextId;
            selectedGameplayEntryId = nextId;
            if (refs.gameplayId && refs.gameplayId.value !== nextId) refs.gameplayId.value = nextId;
            markDirty('已更新玩法条目 ID');
            renderGameplayEditor();
            return;
        }
        if (target.name === 'tags') {
            entry.tags = String(target.value || '').split(',').map(function (part) { return part.trim(); }).filter(Boolean);
            markDirty('已更新玩法标签');
            renderGameplayEntryList(getFilteredGameplayEntries(), getGameplayCityContext());
            return;
        }
        if (target.name === 'rarity') {
            entry.rarity = String(target.value || '').trim();
            markDirty('已更新玩法稀有度');
            renderGameplayEntryList(getFilteredGameplayEntries(), getGameplayCityContext());
            return;
        }
        if (target.name === 'summary') {
            entry.summary = String(target.value || '');
            markDirty('已更新玩法简介');
            renderGameplayEntryList(getFilteredGameplayEntries(), getGameplayCityContext());
            return;
        }
        if (target.hasAttribute('data-gameplay-placement')) {
            entry.placement = normalizeGameplayPlacement(target.value);
            markDirty('已更新单位部署位置');
            renderGameplayEntryList(getFilteredGameplayEntries(), getGameplayCityContext());
            return;
        }
        if (target.hasAttribute('data-gameplay-stat')) {
            var statKey = target.getAttribute('data-gameplay-stat');
            var numeric = Number(target.value);
            if (!entry.stats || typeof entry.stats !== 'object') entry.stats = {};
            entry.stats[statKey] = Number.isFinite(numeric) ? numeric : 0;
            markDirty('已更新玩法数值');
        }
    }

    function getFilteredGameplayEntries() {
        var config = getGameplayCityContext();
        var collection = config ? ensureCityGameplayConfig(config)[activeGameplayTab] : [];
        var keyword = refs.gameplaySearch ? String(refs.gameplaySearch.value || '').trim().toLowerCase() : '';
        return collection.filter(function (entry) {
            if (!keyword) return true;
            var haystack = [entry.name, entry.id, entry.summary].concat(entry.tags || []).join(' ').toLowerCase();
            return haystack.indexOf(keyword) !== -1;
        });
    }

    function ensureUniqueGameplayEntryId(list, value, currentId) {
        var baseId = String(value || '').trim().replace(/\s+/g, '-');
        if (!baseId) baseId = currentId || uid(activeGameplayTab);
        var candidate = baseId;
        var serial = 1;
        while (list.some(function (item) { return item.id === candidate && item.id !== currentId; })) {
            candidate = baseId + '-' + String(serial);
            serial += 1;
        }
        return candidate;
    }

    function getGameplayAssets(cityContext, assetType) {
        return (state.editorAssetsCatalog || []).filter(function (asset) {
            return asset.cityCode === cityContext.cityCode && asset.assetType === assetType;
        });
    }

    function bindGameplayAsset(assetId, bindKey) {
        var entry = getSelectedGameplayEntry();
        if (!entry) {
            setStatus('请先选择一个玩法条目', 'error');
            return;
        }
        var asset = (state.editorAssetsCatalog || []).find(function (item) { return item.id === assetId; });
        if (!asset) return;
        if (!entry.assetRefs || typeof entry.assetRefs !== 'object') entry.assetRefs = {};
        entry.assetRefs[bindKey] = asset.publicUrl || asset.path;
        if (bindKey === 'modelPath') entry.assetRefs.modelId = asset.id;
        if (bindKey === 'imagePath') entry.assetRefs.imageId = asset.id;
        entry.updatedAt = new Date().toISOString();
        selectedGameplayAssetId = asset.id;
        markDirty('已绑定项目资源');
        renderGameplayEditor();
    }

    async function uploadGameplayAsset(file) {
        var cityContext = getGameplayCityContext();
        if (!cityContext) {
            refs.gameplayAssetUpload.value = '';
            setStatus('请先选择一个城市关卡再上传资源', 'error');
            return;
        }
        var assetType = refs.gameplayAssetType ? refs.gameplayAssetType.value || GAMEPLAY_RESOURCE_CONFIG[activeGameplayTab].assetType : GAMEPLAY_RESOURCE_CONFIG[activeGameplayTab].assetType;
        var assetName = refs.gameplayAssetName && refs.gameplayAssetName.value ? refs.gameplayAssetName.value.trim() : file.name.replace(/\.[^.]+$/, '');
        try {
            setStatus('正在保存城市资源 ' + file.name + '…', 'idle');
            var content = await fileToBase64(file);
            var response = await fetch('/api/editor-assets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: file.name,
                    content: content,
                    cityCode: cityContext.cityCode,
                    cityName: cityContext.cityName,
                    assetType: assetType,
                    resourceKind: activeGameplayTab,
                    assetName: assetName
                })
            });
            if (!response.ok) throw new Error('上传失败: ' + response.status);
            var payload = await response.json();
            var id = String(payload.id || uniqueCatalogId(state.editorAssetsCatalog || [], slugify(cityContext.cityName + '-' + assetName) || 'editor-asset'));
            state.editorAssetsCatalog = state.editorAssetsCatalog || [];
            state.editorAssetsCatalog = state.editorAssetsCatalog.filter(function (item) { return item.id !== id; });
            state.editorAssetsCatalog.push({
                id: id,
                name: String(payload.name || assetName),
                assetType: String(payload.assetType || assetType),
                resourceKind: String(payload.resourceKind || activeGameplayTab),
                cityCode: cityContext.cityCode,
                cityName: cityContext.cityName,
                path: String(payload.projectPath || ''),
                projectPath: String(payload.projectPath || ''),
                publicUrl: String(payload.publicUrl || ''),
                summary: cityContext.cityName + ' · ' + assetName,
                updatedAt: new Date().toISOString()
            });
            if (refs.gameplayAssetName) refs.gameplayAssetName.value = assetName;
            refs.gameplayAssetUpload.value = '';
            markDirty('已保存城市资源到项目');
            var selectedEntry = getSelectedGameplayEntry();
            if (selectedEntry) {
                var bindKey = /\.(png|jpg|jpeg|webp)$/i.test(file.name) ? 'imagePath' : 'modelPath';
                bindGameplayAsset(id, bindKey);
            } else {
                renderGameplayEditor();
            }
            setStatus('已保存到 ' + String(payload.projectPath || 'public/Arts'), 'success');
        } catch (error) {
            refs.gameplayAssetUpload.value = '';
            setStatus('城市资源保存失败: ' + error.message, 'error');
        }
    }

    function uniqueGameplayEntryId(list, baseId) {
        var candidate = baseId;
        var serial = 1;
        while (list.some(function (item) { return item.id === candidate; })) {
            candidate = baseId + '-' + String(serial);
            serial += 1;
        }
        return candidate;
    }

    function getCurrentCityGameplayConfig() {
        var cityContext = getGameplayCityContext();
        return cityContext ? ensureCityGameplayConfig(cityContext) : null;
    }

    function buildGameplayEnemyTypes(level) {
        var cityContext = getGameplayCityContext();
        var config = cityContext ? ensureCityGameplayConfig(cityContext) : null;
        if (!config) return [];
        return config.enemies.map(function (entry) {
            return {
                id: entry.id,
                name: entry.name,
                modelId: entry.assetRefs && entry.assetRefs.modelId ? entry.assetRefs.modelId : '',
                modelPath: entry.assetRefs && entry.assetRefs.modelPath ? entry.assetRefs.modelPath : '',
                hp: Number(entry.stats && entry.stats.hp) || 100,
                speed: Number(entry.stats && entry.stats.speed) || 1,
                reward: Number(entry.stats && entry.stats.reward) || 20,
                source: 'cityGameplay'
            };
        });
    }

    function getAvailableEnemyTypes(level) {
        var localEnemies = Array.isArray(level && level.enemyTypes) ? level.enemyTypes : [];
        var cityEnemies = buildGameplayEnemyTypes(level);
        var merged = [];
        cityEnemies.concat(localEnemies).forEach(function (enemy) {
            if (!enemy || !enemy.id || merged.some(function (item) { return item.id === enemy.id; })) return;
            merged.push(enemy);
        });
        return merged;
    }

    function buildGameplayActorTemplates() {
        var cityContext = getGameplayCityContext();
        var config = cityContext ? ensureCityGameplayConfig(cityContext) : null;
        if (!config) return [];
        return ['enemies', 'characters', 'skills'].flatMap(function (kind) {
            return config[kind].map(function (entry) {
                var category = kind === 'enemies' ? 'enemy' : kind === 'characters' ? 'npc' : 'model';
                return {
                    id: 'city-template-' + kind + '-' + entry.id,
                    name: entry.name,
                    category: category,
                    modelId: entry.assetRefs && entry.assetRefs.modelId ? entry.assetRefs.modelId : '',
                    modelPath: entry.assetRefs && entry.assetRefs.modelPath ? entry.assetRefs.modelPath : '',
                    templateModelScale: 1,
                    icon: kind === 'enemies' ? 'E' : kind === 'characters' ? 'C' : 'S',
                    source: 'cityGameplay',
                    sourceEntryId: entry.id,
                    sourceKind: kind,
                    stats: Object.assign({ hp: 100, attack: 0, range: 1, fireRate: 0, cost: 0, cooldown: 0 }, entry.stats || {})
                };
            });
        });
    }

    function getAvailableActorTemplates() {
        var merged = [];
        state.actorTemplates.concat(buildGameplayActorTemplates()).forEach(function (template) {
            if (!template || !template.id || merged.some(function (item) { return item.id === template.id; })) return;
            merged.push(template);
        });
        return merged;
    }

    function findActorTemplate(templateId) {
        return getAvailableActorTemplates().find(function (item) { return item.id === templateId; }) || state.actorTemplates[0];
    }

    function setGameplayEntryActionButtons(disabled, entries, entry) {
        var list = Array.isArray(entries) ? entries : [];
        var index = entry ? list.findIndex(function (item) { return item.id === entry.id; }) : -1;
        if (refs.btnDuplicateGameplayEntry) refs.btnDuplicateGameplayEntry.disabled = disabled;
        if (refs.btnDeleteGameplayEntry) refs.btnDeleteGameplayEntry.disabled = disabled;
        if (refs.btnMoveGameplayUp) refs.btnMoveGameplayUp.disabled = disabled || index <= 0;
        if (refs.btnMoveGameplayDown) refs.btnMoveGameplayDown.disabled = disabled || index === -1 || index >= list.length - 1;
    }

    function resolveGameplayEntryThumbnail(entry) {
        if (!entry || !entry.assetRefs) return '';
        return isImageAssetPath(entry.assetRefs.imagePath) ? entry.assetRefs.imagePath : '';
    }

    function isImageAssetPath(value) {
        return /\.(png|jpg|jpeg|webp|gif)$/i.test(String(value || ''));
    }

    function isModelAssetPath(value) {
        return /\.(glb|gltf|obj|fbx|dae|stl)$/i.test(String(value || ''));
    }

    function getSelectedGameplayAsset(entry, assets) {
        if (!entry && !selectedGameplayAssetId) return null;
        var list = Array.isArray(assets) ? assets : [];
        var picked = selectedGameplayAssetId ? list.find(function (asset) { return asset.id === selectedGameplayAssetId; }) : null;
        if (picked) return picked;
        if (selectedGameplayAssetId) {
            picked = (state.editorAssetsCatalog || []).find(function (asset) { return asset.id === selectedGameplayAssetId; }) || null;
            if (picked) return picked;
        }
        if (entry && entry.assetRefs) {
            var refsToTry = [entry.assetRefs.imagePath, entry.assetRefs.modelPath];
            for (var i = 0; i < refsToTry.length; i += 1) {
                var match = list.find(function (asset) { return asset.publicUrl === refsToTry[i] || asset.path === refsToTry[i] || asset.projectPath === refsToTry[i]; }) ||
                    (state.editorAssetsCatalog || []).find(function (asset) { return asset.publicUrl === refsToTry[i] || asset.path === refsToTry[i] || asset.projectPath === refsToTry[i]; });
                if (match) {
                    selectedGameplayAssetId = match.id;
                    return match;
                }
            }
        }
        selectedGameplayAssetId = list[0] ? list[0].id : '';
        return list[0] || null;
    }

    function renderGameplayAssetPreview(asset, entry) {
        var hasImage = asset && isImageAssetPath(asset.publicUrl || asset.path);
        var hasModel = asset && isModelAssetPath(asset.publicUrl || asset.path);
        if (refs.gameplayPreviewTitle) refs.gameplayPreviewTitle.textContent = asset ? asset.name : (entry ? entry.name : '资源预览');
        if (refs.gameplayPreviewMeta) refs.gameplayPreviewMeta.textContent = asset ? (asset.assetType + ' · ' + (asset.cityName || '未命名城市')) : '未选择资源';
        if (refs.gameplayAssetPreviewEmpty) refs.gameplayAssetPreviewEmpty.classList.toggle('view-hidden', !!asset);
        if (refs.gameplayAssetPreviewImage) {
            refs.gameplayAssetPreviewImage.classList.toggle('view-hidden', !hasImage);
            refs.gameplayAssetPreviewImage.src = hasImage ? String(asset.publicUrl || asset.path) : '';
        }
        if (refs.gameplayAssetPreviewHost) refs.gameplayAssetPreviewHost.classList.toggle('view-hidden', !hasModel);
        if (!hasModel) {
            disposeGameplayAssetPreview();
            return;
        }
        ensureGameplayAssetPreview(String(asset.publicUrl || asset.path));
    }

    function ensureGameplayAssetPreview(modelUrl) {
        if (!refs.gameplayAssetPreviewHost) return;
        if (!gameplayAssetPreviewApi) {
            var generation = (gameplayPreviewInitGeneration += 1);
            import('./gameplay-asset-preview.js').then(function (mod) {
                if (generation !== gameplayPreviewInitGeneration || !refs.gameplayAssetPreviewHost) return;
                gameplayAssetPreviewApi = mod.createGameplayAssetPreview({ host: refs.gameplayAssetPreviewHost });
                gameplayAssetPreviewApi.setAsset(modelUrl);
            }).catch(function (error) {
                setStatus('模型预览初始化失败: ' + error.message, 'error');
            });
            return;
        }
        gameplayAssetPreviewApi.setAsset(modelUrl);
    }

    function disposeGameplayAssetPreview() {
        if (gameplayAssetPreviewApi && gameplayAssetPreviewApi.dispose) {
            gameplayAssetPreviewApi.dispose();
            gameplayAssetPreviewApi = null;
        }
    }

    function disposeModelAssetPreview() {
        if (modelAssetPreviewApi && modelAssetPreviewApi.dispose) {
            modelAssetPreviewApi.dispose();
            modelAssetPreviewApi = null;
        }
    }

    function normalizeLevel(level) {
        var source = level && typeof level === 'object' ? level : {};
        var location = normalizeLocation(source);
        var map = normalizeMap(source.map, source);
        var normalized = {
            id: String(source.id || source.code || uniqueLevelId('level')),
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

    function normalizeLocation(source) {
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

    function normalizeEnvironment(environment) {
        var source = environment && typeof environment === 'object' ? environment : {};
        return {
            floorTextureId: String(source.floorTextureId || ''),
            sceneModelId: String(source.sceneModelId || ''),
            lightingProfile: String(source.lightingProfile || 'default-lighting'),
            entryScene: String(source.entryScene || ''),
            notes: String(source.notes || '')
        };
    }

    function normalizeMap(map, seed) {
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
        trimMapToBounds(normalized);
        return normalized;
    }

    function createDefaultMap() {
        return {
            grid: { cols: DEFAULT_GRID_COLS, rows: DEFAULT_GRID_ROWS, tileSize: DEFAULT_TILE_SIZE },
            theme: { ground: '#456a78', road: '#c8a96b', obstacle: '#52616b', accent: '#c8ff3d' },
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
                theme: { ground: '#456a78', road: '#c8a96b', obstacle: '#52616b', accent: '#c8ff3d' },
                path: [],
                obstacles: [],
                startPoint: { id: 'explore-start', name: '探索起点', col: 0, row: 9 },
                exitPoint: { id: 'explore-exit', name: '探索终点', col: 24, row: 9 }
            },
            geo: { enabled: false, provider: 'cesium-ion', assetId: DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID, center: { lat: 0, lon: 0, heightMeters: 0 }, extentMeters: 1000, rotationDeg: 0, yOffsetMeters: 0, boardHeightMeters: 32 },
            actors: []
        };
    }

    function normalizeGeoConfig(geo) {
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

    async function fetchCountryCapitalCoords() {
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

    function countryGeoFromFeature(feature, code, remoteCapitals) {
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

    function geoFromLonLatArray(center, extentMeters) {
        if (!Array.isArray(center) || center.length < 2) return null;
        var lon = Number(center[0]);
        var lat = Number(center[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return makeGeoConfig(lat, lon, extentMeters || 1600);
    }

    function makeGeoConfig(lat, lon, extentMeters) {
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

    function geometryCenter(coordinates) {
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

    function visitCoordinatePairs(value, visitor) {
        if (!Array.isArray(value)) return;
        if (typeof value[0] === 'number' && typeof value[1] === 'number') {
            visitor(Number(value[0]), Number(value[1]));
            return;
        }
        value.forEach(function (item) { visitCoordinatePairs(item, visitor); });
    }

    function normalizeTheme(theme) {
        var source = theme && typeof theme === 'object' ? theme : {};
        return {
            ground: String(source.ground || '#456a78'),
            groundAlt: String(source.groundAlt || source.ground || '#456a78'),
            road: String(source.road || source.path || '#c8a96b'),
            path: String(source.path || source.road || '#c8a96b'),
            obstacle: String(source.obstacle || '#52616b'),
            accent: String(source.accent || '#c8ff3d'),
            fog: String(source.fog || source.groundAlt || source.ground || '#456a78')
        };
    }

    function normalizeEnemyPaths(paths, fallbackRoads) {
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

    /** 与 src/main.ts 中 expandPath 一致：曼哈顿连接折线路径为多格带子 */
    function expandPathWaypointPolyline(points) {
        /** @type {Set<string>} */
        var bucket = new Set();
        if (!points || points.length < 2) {
            points = points || [];
            for (var k = 0; k < points.length; k += 1)
                bucket.add(String(points[k].col) + ',' + String(points[k].row));
            return bucket;
        }
        for (var idx = 0; idx < points.length - 1; idx += 1) {
            var start = points[idx];
            var endPt = points[idx + 1];
            var cx = Number(start.col) || 0;
            var cy = Number(start.row) || 0;
            bucket.add(String(cx) + ',' + String(cy));

            while (cx !== Number(endPt.col)) {
                cx += Math.sign(Number(endPt.col) - cx);
                bucket.add(String(cx) + ',' + String(cy));
            }
            while (cy !== Number(endPt.row)) {
                cy += Math.sign(Number(endPt.row) - cy);
                bucket.add(String(cx) + ',' + String(cy));
            }
        }
        return bucket;
    }

    /** 对齐 src/main.ts `uniqueCells` */
    function uniqueDefenseCells(cells, cols, rows) {
        var seen = {};
        /** @type {Array<{col:number,row:number}>} */
        var result = [];
        for (var i = 0; i < cells.length; i += 1) {
            var cell = cells[i];
            var normalized = {
                col: clamp(Math.round(Number(cell.col) || 0), 0, cols - 1),
                row: clamp(Math.round(Number(cell.row) || 0), 0, rows - 1)
            };
            var key = normalized.col + ',' + normalized.row;
            if (seen[key]) continue;
            seen[key] = true;
            result.push(normalized);
        }
        return result;
    }

    function manhattanDefense(a, b) {
        return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
    }

    function sameDefenseCell(a, b) {
        return !!b && a.col === b.col && a.row === b.row;
    }

    /** 对齐 src/main.ts `orderEditorPathCells` — 从出生点贪心串联路格终点 */
    function orderEditorPathCellsDefense(cells, start, end, cols, rows) {
        var remaining = uniqueDefenseCells(cells, cols, rows).slice();
        /** @type {Array<{col:number,row:number}>} */
        var ordered = [];
        var current = start;
        if (!remaining.some(function (cell) { return sameDefenseCell(cell, start); }))
            ordered.push({ col: start.col, row: start.row });
        while (remaining.length > 0) {
            var nextIndex = remaining.findIndex(function (cell) {
                return manhattanDefense(cell, current) === 1;
            });
            if (nextIndex < 0) {
                nextIndex = remaining.reduce(function (bestIndex, cell, index) {
                    return manhattanDefense(cell, current) <
                        manhattanDefense(remaining[bestIndex], current)
                        ? index
                        : bestIndex;
                }, 0);
            }
            var next = remaining.splice(nextIndex, 1)[0];
            ordered.push(next);
            current = next;
        }
        if (!ordered.some(function (cell) { return sameDefenseCell(cell, end); })) ordered.push({ col: end.col, row: end.row });
        return uniqueDefenseCells(ordered, cols, rows);
    }

    function projectGridCellDefense(cell, cols, rows) {
        return {
            col: clamp(Math.round(Number(cell.col) || 0), 0, cols - 1),
            row: clamp(Math.round(Number(cell.row) || 0), 0, rows - 1)
        };
    }

    /** 对齐 editorLevelToRuntimeMap：首条非空 enemyPaths.cells，否则 roads */
    function defensePathSourceCells(map) {
        if (map.enemyPaths) {
            for (var pi = 0; pi < map.enemyPaths.length; pi += 1) {
                var p = map.enemyPaths[pi];
                if (p && p.cells && p.cells.length) return p.cells.slice();
            }
        }
        return map.roads && map.roads.length ? map.roads.slice() : [];
    }

    /** 对齐 buildFallbackPath + uniqueCells — 拐角折线顶点列表 */
    function buildDefenseFallbackVertexList(spawn, objective, cols, rows) {
        var midA = {
            col: clamp(Math.floor((spawn.col + objective.col) / 2), 0, cols - 1),
            row: spawn.row
        };
        var midB = { col: midA.col, row: objective.row };
        return uniqueDefenseCells([spawn, midA, midB, objective], cols, rows);
    }

    /**
     * 塔防棋盘 / 行军带：与 editorLevelToRuntimeMap → expandPath 完全一致
     * （路格排序 + Manhattan 铺开），不再只做 cells∪roads 的简单并集。
     */
    function getDefenseEditorPathKeys(level) {
        var map = level.map;
        if (!map || !map.grid)
            /** @type {Set<string>} */ return new Set();
        var cols = clamp(Math.floor(Number(map.grid.cols) || DEFAULT_GRID_COLS), 4, 80);
        var rows = clamp(Math.floor(Number(map.grid.rows) || DEFAULT_GRID_ROWS), 4, 80);

        var objectiveDefault = { col: cols - 1, row: Math.floor(rows / 2) };
        var objective = map.objectivePoint
            ? projectGridCellDefense(map.objectivePoint, cols, rows)
            : objectiveDefault;
        var spawn = Array.isArray(map.spawnPoints) && map.spawnPoints[0]
            ? projectGridCellDefense(map.spawnPoints[0], cols, rows)
            : { col: 0, row: objective.row };

        var raw = defensePathSourceCells(map);
        var projected = uniqueDefenseCells(
            raw.map(function (c) {
                return projectGridCellDefense(c, cols, rows);
            }),
            cols,
            rows
        );

        var orderedPath = orderEditorPathCellsDefense(projected, spawn, objective, cols, rows);
        var fallbackPath = buildDefenseFallbackVertexList(spawn, objective, cols, rows);
        /** 与 main：`path = projectedPath.length >= 2 ? projectedPath : fallbackPath` */
        var pathVerts = orderedPath.length >= 2 ? orderedPath : fallbackPath;
        return expandPathWaypointPolyline(pathVerts);
    }

    function normalizeSpawnPoints(points, legacyTd) {
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

    function normalizeExplorePoints(points, legacyExplore) {
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

    function normalizeExplorationLayout(layout, fallbackMap) {
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
            startPoint: normalizePoint(source.startPoint) || { id: 'explore-start', name: '探索起点', col: 0, row: Math.floor((fallbackMap.grid.rows || DEFAULT_GRID_ROWS) / 2) },
            exitPoint: normalizePoint(source.exitPoint) || { id: 'explore-exit', name: '探索终点', col: Math.max(0, (fallbackMap.grid.cols || DEFAULT_GRID_COLS) - 4), row: Math.floor((fallbackMap.grid.rows || DEFAULT_GRID_ROWS) / 2) }
        };
        return normalized;
    }

    function normalizeActors(actors, seed) {
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
                rotation: Number(source.rotation) || 0,
                scale: Number(source.scale) || 1,
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

    function normalizeActorTemplate(template) {
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

    function normalizeStats(stats) {
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

    function normalizeEnemyTypes(enemyTypes, seed) {
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

    function normalizeWaveRules(waveRules, seed) {
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

    function normalizeModeProfiles(modeProfiles) {
        var source = modeProfiles && typeof modeProfiles === 'object' ? modeProfiles : {};
        return {
            towerDefense: source.towerDefense && typeof source.towerDefense === 'object' ? source.towerDefense : { enabled: true },
            exploration: source.exploration && typeof source.exploration === 'object' ? source.exploration : { enabled: true }
        };
    }

    function normalizeCell(cell) {
        return { col: Number(cell.col) || 0, row: Number(cell.row) || 0 };
    }

    function normalizeCells(cells) {
        return Array.isArray(cells) ? cells.map(normalizeCell) : [];
    }

    function normalizePoint(point) {
        if (!point || typeof point !== 'object') return null;
        return {
            id: String(point.id || 'point'),
            name: String(point.name || point.label || '点位'),
            col: Number(point.col) || 0,
            row: Number(point.row) || 0
        };
    }

    function defaultObjectivePoint(grid) {
        return { id: 'objective-main', name: '防守核心', col: Math.max(0, grid.cols - 4), row: Math.floor(grid.rows / 2) };
    }

    function normalizeStatus(status, map) {
        if (status === 'designed' || status === 'needs-work' || status === 'draft') return status;
        var hasWork = map && (map.actors.length || map.roads.length || map.spawnPoints.length || map.explorationPoints.length);
        return hasWork ? 'needs-work' : 'draft';
    }

    function createEnemyTypeFromTemplates(level) {
        var enemyTemplate = buildGameplayActorTemplates().find(function (item) { return item.category === 'enemy'; }) ||
            getAvailableActorTemplates().find(function (item) { return item.category === 'enemy'; });
        var enemy = {
            id: enemyTemplate ? enemyTemplate.id : 'enemy-drone',
            name: enemyTemplate ? enemyTemplate.name : '侦察无人机',
            modelId: enemyTemplate ? enemyTemplate.modelId : '',
            modelPath: enemyTemplate ? enemyTemplate.modelPath || '' : '',
            modelScale:
                enemyTemplate && enemyTemplate.templateModelScale != null && enemyTemplate.templateModelScale > 0
                    ? enemyTemplate.templateModelScale
                    : 1,
            hp: enemyTemplate ? enemyTemplate.stats.hp : 80,
            speed: enemyTemplate ? enemyTemplate.stats.speed || 1 : 1,
            reward: enemyTemplate ? enemyTemplate.stats.reward || 20 : 20
        };
        level.enemyTypes.push(enemy);
        return enemy;
    }

    function getLevel() {
        return state && state.levels.find(function (level) { return level.id === selectedLevelId; });
    }

    function updateLevel(field, value) {
        var level = getLevel();
        if (!level) return;
        level[field] = value;
        markDirty('已更新关卡');
        renderLevelTree();
        renderOverview();
    }

    function findSelectedObject(level) {
        if (!level || !selectedObject) return null;
        var layout = ensureExplorationLayout(level.map);
        var item = null;
        if (selectedObject.kind === 'actor') item = level.map.actors.find(byId(selectedObject.id));
        if (selectedObject.kind === 'spawn') item = activeEditorMode === 'explore' ? layout.startPoint : level.map.spawnPoints.find(byId(selectedObject.id));
        if (selectedObject.kind === 'explorePoint') item = level.map.explorationPoints.find(byId(selectedObject.id));
        if (selectedObject.kind === 'objective') item = activeEditorMode === 'explore' ? layout.exitPoint : level.map.objectivePoint;
        if (item) return { kind: selectedObject.kind, item: item };
        return null;
    }

    function markDirty(message) {
        isDirty = true;
        persistLocalBackup();
        setStatus(message || '已有未保存修改', 'dirty');
    }

    function setStatus(message, mode) {
        refs.statusText.textContent = message;
        refs.statusBadge.textContent = mode === 'error' ? '错误' : mode === 'success' ? '已保存' : mode === 'dirty' ? '未保存' : '运行中';
        refs.statusBadge.className = 'status-badge ' + (mode || 'idle');
    }

    function persistLocalBackup() {
        try {
            localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(state));
        } catch (error) {}
    }

    function readLocalBackup() {
        try {
            return JSON.parse(localStorage.getItem(LOCAL_BACKUP_KEY) || localStorage.getItem(LEGACY_BACKUP_KEY) || 'null');
        } catch (error) {
            return null;
        }
    }

    function readDragPayload(event) {
        try {
            return JSON.parse(event.dataTransfer.getData('application/json'));
        } catch (error) {
            try {
                var raw = event.dataTransfer.getData('text/plain');
                return raw ? JSON.parse(raw) : null;
            } catch (error2) {
                return null;
            }
        }
    }

    /**
     * 当落点落在网格 gap / 容器 padding 上时，用几何换算到格子（与 .map-cell 的 grid 布局一致）。
     */
    function mapGridPickCellFromClientPoint(clientX, clientY, grid) {
        if (!refs.mapGrid || !grid) return null;
        var el = refs.mapGrid;
        var rect = el.getBoundingClientRect();
        var st = getComputedStyle(el);
        var padL = parseFloat(st.paddingLeft) || 0;
        var padT = parseFloat(st.paddingTop) || 0;
        var cols = grid.cols;
        var rows = grid.rows;
        var csStr = el.style.getPropertyValue('--cell-size') || getComputedStyle(el).getPropertyValue('--cell-size');
        var cs = parseFloat(csStr) || 28;
        var gap = parseFloat(st.rowGap || st.columnGap || st.gap) || 1;
        var stride = cs + gap;
        var x = clientX - rect.left - padL;
        var y = clientY - rect.top - padT;
        var col = Math.floor(x / stride);
        var row = Math.floor(y / stride);
        var ox = x - col * stride;
        var oy = y - row * stride;
        if (ox > cs || oy > cs) return null;
        if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
        var wrap = document.createElement('div');
        wrap.setAttribute('data-col', String(col));
        wrap.setAttribute('data-row', String(row));
        return wrap;
    }

    function fileToBase64(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
                resolve(String(reader.result || '').split(',')[1] || '');
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function trimMapToBounds(map) {
        var cols = map.grid.cols;
        var rows = map.grid.rows;
        map.roads = map.roads.filter(inBounds(cols, rows));
        map.obstacles = map.obstacles.filter(inBounds(cols, rows));
        map.buildSlots = map.buildSlots.filter(inBounds(cols, rows));
        map.enemyPaths.forEach(function (path) { path.cells = path.cells.filter(inBounds(cols, rows)); });
        map.spawnPoints = map.spawnPoints.filter(inBounds(cols, rows));
        map.explorationPoints = map.explorationPoints.filter(inBounds(cols, rows));
        map.actors = map.actors.filter(inBounds(cols, rows));
        if (map.objectivePoint && !inBounds(cols, rows)(map.objectivePoint)) map.objectivePoint = defaultObjectivePoint(map.grid);
        if (map.explorationLayout) {
            map.explorationLayout.path = map.explorationLayout.path.filter(inBounds(cols, rows));
            map.explorationLayout.obstacles = map.explorationLayout.obstacles.filter(inBounds(cols, rows));
            if (map.explorationLayout.startPoint && !inBounds(cols, rows)(map.explorationLayout.startPoint)) map.explorationLayout.startPoint = { id: 'explore-start', name: '探索起点', col: 0, row: Math.floor(rows / 2) };
            if (map.explorationLayout.exitPoint && !inBounds(cols, rows)(map.explorationLayout.exitPoint)) map.explorationLayout.exitPoint = { id: 'explore-exit', name: '探索终点', col: Math.max(0, cols - 4), row: Math.floor(rows / 2) };
        }
        map.enemyExits = map.spawnPoints;
    }

    function pickLevelId(preferredId) {
        if (!state || !state.levels.length) return '';
        return state.levels.some(function (level) { return level.id === preferredId; }) ? preferredId : state.levels[0].id;
    }

    function groupLevels(levels) {
        return levels.reduce(function (groups, level) {
            var key = level.location.countryName || '未设置国家';
            if (level.location.cityName) key = key + ' / 城市';
            if (!groups[key]) groups[key] = [];
            groups[key].push(level);
            return groups;
        }, {});
    }

    function sortLevels(targetState) {
        var target = targetState || state;
        if (!target || !Array.isArray(target.levels)) return;
        target.levels.sort(function (left, right) {
            var a = (left.location.countryName + left.location.cityName + left.name).toLowerCase();
            var b = (right.location.countryName + right.location.cityName + right.name).toLowerCase();
            return a.localeCompare(b, 'zh-Hans-CN');
        });
    }

    function compareRegionKeys(left, right) {
        if (left === '中国 / 城市') return -1;
        if (right === '中国 / 城市') return 1;
        return left.localeCompare(right, 'zh-Hans-CN');
    }

    function statusLabel(status) {
        if (status === 'designed') return '已设计';
        if (status === 'needs-work') return '需完善';
        return '未设计';
    }

    function actorCategoryLabel(category) {
        if (category === 'tower') return '防御塔';
        if (category === 'enemy') return '敌人';
        if (category === 'objective') return '防守核心';
        if (category === 'npc') return 'NPC';
        return '模型';
    }

    function summaryStats(stats) {
        return 'HP ' + (stats.hp || 0) + ' / 攻击 ' + (stats.attack || 0) + ' / 射程 ' + (stats.range || 0);
    }

    function splitRegion(region) {
        var parts = String(region || '').split(/[·・\-\/]/).map(function (part) { return part.trim(); }).filter(Boolean);
        return { country: parts[0] || region || '', city: parts[1] || '' };
    }

    function buildRegionLabel(location, fallback) {
        if (location.countryName && location.cityName) return location.countryName + ' · ' + location.cityName;
        return fallback || location.countryName || '未设置地区';
    }

    function inferCountryCode(countryName) {
        if (countryName === '中国') return 'CN';
        if (countryName === '美国') return 'US';
        if (countryName === '日本') return 'JP';
        if (countryName === '法国') return 'FR';
        return '';
    }

    function uniqueLevelId(seed) {
        var base = slugify(seed) || 'level';
        var candidate = base;
        var index = 2;
        while (state && state.levels.some(function (level) { return level.id === candidate; })) {
            candidate = base + '-' + index;
            index += 1;
        }
        return candidate;
    }

    function uniqueTemplateId(seed) {
        var base = slugify(seed) || 'actor-template';
        var candidate = base;
        var index = 2;
        while (state.actorTemplates.some(function (template) { return template.id === candidate; })) {
            candidate = base + '-' + index;
            index += 1;
        }
        return candidate;
    }

    function uniqueCatalogId(items, seed) {
        var base = slugify(seed) || 'asset';
        var candidate = base;
        var index = 2;
        while (items.some(function (item) { return item.id === candidate; })) {
            candidate = base + '-' + index;
            index += 1;
        }
        return candidate;
    }

    function uid(prefix) {
        return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    }

    function slugify(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/['’]/g, '')
            .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 70);
    }

    function updatePath(target, path, value) {
        if (!target) return;
        var parts = path.split('.');
        var cursor = target;
        for (var i = 0; i < parts.length - 1; i += 1) {
            if (!cursor[parts[i]] || typeof cursor[parts[i]] !== 'object') cursor[parts[i]] = {};
            cursor = cursor[parts[i]];
        }
        cursor[parts[parts.length - 1]] = value;
    }

    function toggleCell(cells, col, row) {
        var index = cells.findIndex(function (cell) { return cell.col === col && cell.row === row; });
        if (index >= 0) cells.splice(index, 1);
        else cells.push({ col: col, row: row });
    }

    function removeCell(cells, col, row) {
        var index = cells.findIndex(function (cell) { return cell.col === col && cell.row === row; });
        if (index >= 0) cells.splice(index, 1);
    }

    function hasCell(cells, col, row) {
        return Array.isArray(cells) && cells.some(function (cell) { return cell.col === col && cell.row === row; });
    }

    function ensureExplorationLayout(map) {
        if (!map.explorationLayout) {
            map.explorationLayout = normalizeExplorationLayout(null, map);
        }
        map.explorationLayout.path = Array.isArray(map.explorationLayout.path) ? map.explorationLayout.path : [];
        map.explorationLayout.obstacles = Array.isArray(map.explorationLayout.obstacles) ? map.explorationLayout.obstacles : [];
        return map.explorationLayout;
    }

    function cloneCells(cells) {
        return (cells || []).map(function (cell) {
            return { col: cell.col, row: cell.row };
        });
    }

    function cloneGeoConfig(geo) {
        return normalizeGeoConfig(clone(geo));
    }

    function cellsRect(col, row, width, height) {
        var cells = [];
        for (var y = row; y < row + height; y += 1) {
            for (var x = col; x < col + width; x += 1) {
                cells.push({ col: x, row: y });
            }
        }
        return cells;
    }

    function atCell(col, row) {
        return function (item) { return item.col === col && item.row === row; };
    }

    function notAtCell(col, row) {
        return function (item) { return item.col !== col || item.row !== row; };
    }

    function inBounds(cols, rows) {
        return function (item) { return item.col >= 0 && item.col < cols && item.row >= 0 && item.row < rows; };
    }

    function byId(id) {
        return function (item) { return item && item.id === id; };
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function normalizeChineseCityName(value) {
        return String(value || '')
            .replace(/^中国[·\s-]*/, '')
            .replace(/ · .+$/, '')
            .replace(/[市区县盟州地区特别行政\s]/g, '')
            .trim();
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeAttr(value) {
        return escapeHtml(value);
    }

    document.addEventListener('DOMContentLoaded', init);
})();
