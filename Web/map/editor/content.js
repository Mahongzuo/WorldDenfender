// editor/content.js — Static gameplay constants and data tables.
// No imports, no DOM, no runtime state.

export var API_URL = '/api/level-editor-config';
export var LOCAL_BACKUP_KEY = 'earth-guardian.level-engine.backup.v2';
export var LEGACY_BACKUP_KEY = 'earth-guardian.level-editor.backup.v1';
export var ENGINE_VERSION = 2;

export var DEFAULT_GRID_COLS = 28;
export var DEFAULT_GRID_ROWS = 18;
export var DEFAULT_TILE_SIZE = 2;

export var ERASER_RADIUS_STORAGE_KEY = 'earth-guardian.level-editor.eraserBrushRadius';
export var ERASER_RADIUS_MAX = 12;

export var GEO_MAPPING_STORAGE_KEY = 'earth-guardian.level-editor.geoMappingEnabled';

export var SHELL_LEFT_COLLAPSE_KEY = 'earth-guardian.level-editor.shellLeftCollapsed';
export var SHELL_RIGHT_COLLAPSE_KEY = 'earth-guardian.level-editor.shellRightCollapsed';
export var SHELL_INSPECTOR_WIDTH_KEY = 'earth-guardian.level-editor.shellInspectorWidthPx';

export var CONTENT_BROWSER_FLOAT_GEOM_KEY = 'earth-guardian.level-editor.contentBrowserFloat.geometry';

export var TOOL_LABELS = {
    select: '选择/拖拽',
    road: '道路',
    obstacle: '障碍',
    spawn: '敌人出口',
    path: '敌人路径',
    buildSlot: '塔位',
    objective: '防守目标',
    explorePoint: '探索点',
    safeZone: '安全区',
    actor: '模型 Actor',
    erase: '橡皮擦',
    boardImage: '棋盘配图'
};

export var LEVEL_CONTENT_BROWSER_FILTER_ORDER = [
    'all',
    'obstacle',
    'spawn',
    'path',
    'buildSlot',
    'objective',
    'explorePoint',
    'safeZone',
    'actor'
];

export var LCB_CELL_KIND_LABEL = {
    obstacleCell: '障碍',
    pathCell: '敌人路径',
    buildSlotCell: '塔位',
    safeZoneCell: '安全区'
};

export var MODEL_CATEGORY_CONFIG = {
    all: { label: '全部', folder: '', color: '#8b9bb4' },
    Enemy: { label: '敌人', folder: 'Enemy', color: '#e55c5c' },
    Tower: { label: '防御塔', folder: 'Tower', color: '#5c8be5' },
    Buildings: { label: '建筑', folder: 'Buildings', color: '#e5a35c' },
    Props: { label: '地形/阻挡物/地板', folder: 'Props', color: '#5ce58b' },
    Charactor: { label: '角色', folder: 'Charactor', color: '#c85ce5' }
};

export var DEFAULT_ACTOR_TEMPLATES = [
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

export var TOWER_MODEL_SPECS = [
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

export var DEFAULT_TOWER_GAMEPLAY_STATS = {
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

export var GAMEPLAY_RESOURCE_CONFIG = {
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
