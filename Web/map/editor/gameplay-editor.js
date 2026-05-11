import { escapeAttr, escapeHtml, fileToBase64, slugify, uid } from './utils.js';
import { GAMEPLAY_RESOURCE_CONFIG } from './content.js';
import { DEFENSE_ELEMENT_OPTIONS, DEFENSE_FUNCTION_OPTIONS, DEFENSE_STATUS_OPTIONS } from './content.js';
import {
    normalizeGameplayPlacement,
    mergeDistinctStrings,
    buildDefaultEnemyEntries,
    buildDefaultTowerEntries,
    buildDefaultBossEntries,
    buildDefaultCardEntries,
    buildDefaultDefenseItemEntries,
    normalizeGameAssetConfig
} from './normalizers.js';
import { gameplayPlacementLabel, isImageAssetPath, isModelAssetPath, modelBindShortLabel, pickPreferredGameplayTab, uniqueCatalogId } from './display-utils.js';
import { uniqueGameplayEntryId } from './id-utils.js';
import { projectPathFromVideoPublicUrl as publicUrlToProjectPath } from './cutscene-utils.js';
import { addWaveRule as addSharedWaveRule, bindWaveEditorUi as bindSharedWaveEditorUi, createWaveRulesFromLegacySpawnPoints, renderWaveList as renderSharedWaveList } from './wave-editor.js';

var GAMEPLAY_MODEL_SUBDIR_BY_TAB = {
    enemies: 'Enemy',
    bosses: 'Enemy',
    towers: 'Tower',
    items: 'Props',
    characters: 'Charactor'
};

var VISIBLE_GAMEPLAY_TABS = ['enemies', 'bosses', 'towers', 'waves', 'cards', 'items', 'characters'];
var DEFENSE_STANDARD_WAVE_COUNT = 20;

function normalizeGameplayTabId(tabId) {
    var resolved = String(tabId || 'enemies');
    return VISIBLE_GAMEPLAY_TABS.indexOf(resolved) >= 0 ? resolved : 'enemies';
}

function gameplayTabSupportsDirectModelOverride(activeTab) {
    return !!GAMEPLAY_MODEL_SUBDIR_BY_TAB[String(activeTab || '')];
}

function gameplayModelSubdirForTab(activeTab) {
    return GAMEPLAY_MODEL_SUBDIR_BY_TAB[String(activeTab || '')] || 'Props';
}

function gameplayModelActionLabel(activeTab) {
    return GAMEPLAY_RESOURCE_CONFIG[activeTab] ? GAMEPLAY_RESOURCE_CONFIG[activeTab].label : '资源';
}

var GAMEPLAY_ANIMATION_FIELDS_BY_TAB = {
    enemies: [
        { id: 'move', label: '移动动画' },
        { id: 'attack', label: '攻击动画' }
    ],
    bosses: [
        { id: 'move', label: '移动动画' },
        { id: 'attack', label: '攻击动画' }
    ],
    towers: [
        { id: 'idle', label: '静止动画' },
        { id: 'attack', label: '攻击动画' }
    ],
    characters: [
        { id: 'idle', label: '待机动画' },
        { id: 'walk', label: '行走动画' },
        { id: 'run', label: '奔跑动画' },
        { id: 'attack', label: '普通攻击动画' },
        { id: 'skillE', label: 'E 技能动画' },
        { id: 'skillR', label: 'R 技能动画' }
    ]
};

function gameplayAnimationHintText(activeTab) {
    switch (String(activeTab || '')) {
        case 'enemies':
            return '敌人仅支持移动与攻击动画。';
        case 'bosses':
            return 'Boss 使用独立槽位管理移动与攻击动画，不再混在普通敌人里。';
        case 'towers':
            return '防御塔支持静止与攻击动画。';
        case 'characters':
            return '探索主角默认读取当前项目的玩家模型与 idle / walk / run / 普攻 / E / R 动画；你也可以在这里补充或替换。';
        default:
            return '';
    }
}

function getNormalizedGameAssetConfig(env) {
    var state = getState(env);
    if (!state) return normalizeGameAssetConfig(null);
    state.gameAssetConfig = normalizeGameAssetConfig(state.gameAssetConfig);
    return state.gameAssetConfig;
}

function buildExploreCharacterEntries(env, cityContext) {
    var gameAssetConfig = getNormalizedGameAssetConfig(env);
    return [
        {
            id: 'explore-player',
            name: '探索主角',
            summary: '当前项目探索模式使用的玩家角色。模型与动作默认同步全局游戏资产配置。',
            tags: mergeDistinctStrings('explore', 'player', cityContext && cityContext.cityName ? cityContext.cityName : ''),
            rarity: 'global',
            placement: '',
            element: '',
            functionTags: [],
            effects: [],
            cleanseEffects: [],
            effectDurationSec: 2,
            stats: {},
            assetRefs: {
                modelPath: String(gameAssetConfig.customPlayerModelUrl || '').trim(),
                animationPaths: {
                    idle: String(gameAssetConfig.customAnimationUrls.idle || '').trim(),
                    walk: String(gameAssetConfig.customAnimationUrls.walk || '').trim(),
                    run: String(gameAssetConfig.customAnimationUrls.run || '').trim(),
                    attack: String(gameAssetConfig.customAnimationUrls.attack || '').trim(),
                    skillE: String(gameAssetConfig.customAnimationUrls.skillE || '').trim(),
                    skillR: String(gameAssetConfig.customAnimationUrls.skillR || '').trim()
                }
            },
            cityCode: cityContext && cityContext.cityCode ? cityContext.cityCode : '',
            cityName: cityContext && cityContext.cityName ? cityContext.cityName : '',
            updatedAt: ''
        }
    ];
}

function isGlobalExplorePlayerEntry(activeTab, entry) {
    return String(activeTab || '') === 'characters' && !!entry && String(entry.id || '') === 'explore-player';
}

function syncExploreCharacterEntriesFromGlobal(env, config) {
    if (!config) return;
    config.characters = buildExploreCharacterEntries(env, config);
}

function gameplayAnimationFieldsForTab(activeTab) {
    return GAMEPLAY_ANIMATION_FIELDS_BY_TAB[String(activeTab || '')] || [];
}

function ensureGameplayAssetRefs(entry) {
    if (!entry.assetRefs || typeof entry.assetRefs !== 'object') entry.assetRefs = {};
    return entry.assetRefs;
}

function ensureGameplayAnimationPaths(entry, activeTab) {
    var assetRefs = ensureGameplayAssetRefs(entry);
    if (!assetRefs.animationPaths || typeof assetRefs.animationPaths !== 'object') assetRefs.animationPaths = {};
    gameplayAnimationFieldsForTab(activeTab).forEach(function (field) {
        if (typeof assetRefs.animationPaths[field.id] !== 'string') assetRefs.animationPaths[field.id] = '';
    });
    return assetRefs.animationPaths;
}

function getGameplayAnimationPath(entry, activeTab, animId) {
    if (!entry || !entry.assetRefs || !entry.assetRefs.animationPaths) return '';
    var paths = ensureGameplayAnimationPaths(entry, activeTab);
    return String(paths[animId] || '').trim();
}

function createGameplayAssetRefsForTab(activeTab) {
    var entry = { assetRefs: {} };
    ensureGameplayAnimationPaths(entry, activeTab);
    return entry.assetRefs;
}

var gameplayModelAiGenerationState = null;
var gameplayModelAiPollTimer = 0;
var gameplayCardImageAiState = {
    contextKey: '',
    open: false,
    prompt: '',
    lastPresetId: '',
    generating: false,
    statusText: '',
    statusTone: 'idle',
    lastResult: null
};

var GAMEPLAY_CARD_ELEMENT_HINTS = {
    force: '强烈近未来战斗感、硬朗结构、力量型视觉焦点',
    electric: '电流纹理、科技能量轨迹、冷色高亮特效',
    thermal: '热能辉光、火焰或赤金能量、强烈明暗反差',
    light: '棱镜折射、发光碎片、圣洁或高维能量质感',
    sound: '声波纹理、震荡环、频谱与律动感视觉元素'
};

function gameplayCardImageContextKey(cityContext, entry) {
    return [cityContext && cityContext.cityCode || '', entry && entry.id || ''].join('|');
}

function gameplayCardImageSubjectLabel(entry) {
    return String(entry && entry.name || '卡片角色').trim() || '卡片角色';
}

function gameplayCardImageElementHint(entry) {
    return GAMEPLAY_CARD_ELEMENT_HINTS[String(entry && entry.element || '')] || '高辨识度主体、清晰轮廓、适合卡牌封面展示';
}

function buildGameplayCardImagePromptPresets(entry, cityContext) {
    var cityName = String(cityContext && cityContext.cityName || '未来都市').trim() || '未来都市';
    var subject = gameplayCardImageSubjectLabel(entry);
    var summary = String(entry && entry.summary || '').trim();
    var rarity = String(entry && entry.rarity || 'S').trim() || 'S';
    var elementHint = gameplayCardImageElementHint(entry);
    var functionHint = Array.isArray(entry && entry.functionTags) && entry.functionTags.length
        ? '体现' + entry.functionTags.join('、') + '的战斗气质'
        : '强调技能感与角色辨识度';
    var summaryText = summary ? '，参考设定：' + summary : '';
    return [
        {
            id: 'hero-portrait',
            title: '主角立绘版',
            summary: '突出单主体、竖版封面感和高稀有度视觉张力。',
            prompt: cityName + '主题，' + subject + '，竖版游戏卡图插画，单主体全身立绘，居中构图，' + elementHint + '，' + functionHint + '，' + rarity + '级高稀有度卡牌气质，适合作为游戏卡片封面，细节清晰，背景克制，无水印，无 logo，无额外文字' + summaryText
        },
        {
            id: 'action-scene',
            title: '技能爆发版',
            summary: '强化攻击动作、技能特效和冲击力。',
            prompt: cityName + '科幻卡牌角色插画，' + subject + '释放招式的瞬间，动态姿态，技能能量爆发，' + elementHint + '，高对比光影，纵向构图，保留主体完整，适合卡片页面封面，高清细节，无水印，无 logo，无 UI' + summaryText
        },
        {
            id: 'card-cover',
            title: '封面设计版',
            summary: '保留更多上方标题区和下方信息区的视觉留白。',
            prompt: cityName + '风格游戏卡牌封面，' + subject + '，主体居中偏上，四周有可用于卡牌信息排版的留白区域，' + elementHint + '，画面干净，视觉聚焦明确，适合作为卡牌资源图，纵向海报比例，无水印，无 logo，无文字' + summaryText
        }
    ];
}

function ensureGameplayCardImageAiState(entry, cityContext, presets) {
    var nextKey = gameplayCardImageContextKey(cityContext, entry);
    if (gameplayCardImageAiState.contextKey !== nextKey) {
        gameplayCardImageAiState.contextKey = nextKey;
        gameplayCardImageAiState.open = false;
        gameplayCardImageAiState.prompt = presets[0] ? presets[0].prompt : '';
        gameplayCardImageAiState.lastPresetId = presets[0] ? presets[0].id : '';
        gameplayCardImageAiState.generating = false;
        gameplayCardImageAiState.statusText = '可先选择一条默认提示词，再生成并替换当前卡图。';
        gameplayCardImageAiState.statusTone = 'idle';
        gameplayCardImageAiState.lastResult = null;
    }
    return gameplayCardImageAiState;
}

function setGameplayCardImageAiStatusEl(element, text, tone) {
    if (!element) return;
    element.textContent = text || '';
    element.classList.remove('is-success', 'is-error', 'is-pending');
    if (tone === 'success') element.classList.add('is-success');
    else if (tone === 'error') element.classList.add('is-error');
    else if (tone === 'pending') element.classList.add('is-pending');
}

function gameplayCardImageAiOpenPath(env, cityContext) {
    if (gameplayCardImageAiState.lastResult && gameplayCardImageAiState.lastResult.projectPath) {
        return String(gameplayCardImageAiState.lastResult.projectPath || '').trim();
    }
    return typeof env.getGameplayCardImageDirectoryHint === 'function'
        ? String(env.getGameplayCardImageDirectoryHint(cityContext) || '').trim()
        : '';
}

function renderGameplayCardImageAiUi(refs, env, cityContext, entry, activeTab) {
    if (!refs.gameplayCardPreviewActions) return;
    var visible = !!(cityContext && activeTab === 'cards' && entry);
    if (!visible) {
        if (refs.gameplayCardAiFields) refs.gameplayCardAiFields.classList.add('view-hidden');
        return;
    }
    var presets = buildGameplayCardImagePromptPresets(entry, cityContext);
    var state = ensureGameplayCardImageAiState(entry, cityContext, presets);
    var openPath = gameplayCardImageAiOpenPath(env, cityContext);
    if (refs.btnToggleGameplayCardAi) {
        refs.btnToggleGameplayCardAi.textContent = state.open ? '收起 AI 生图' : 'AI生成卡图';
    }
    if (refs.gameplayCardAiFields) {
        refs.gameplayCardAiFields.classList.toggle('view-hidden', !state.open);
    }
    if (refs.gameplayCardAiPromptPresets) {
        refs.gameplayCardAiPromptPresets.innerHTML = presets.map(function (preset) {
            var active = state.lastPresetId === preset.id ? ' is-active' : '';
            return [
                '<button type="button" class="theme-board-ai-preset' + active + '" data-gameplay-card-ai-preset="' + escapeAttr(preset.id) + '">',
                '  <strong>' + escapeHtml(preset.title) + '</strong>',
                '  <span>' + escapeHtml(preset.summary) + '</span>',
                '</button>'
            ].join('');
        }).join('');
    }
    if (refs.gameplayCardAiPrompt) {
        refs.gameplayCardAiPrompt.value = state.prompt || '';
        refs.gameplayCardAiPrompt.disabled = state.generating;
    }
    if (refs.btnGenerateGameplayCardAi) {
        refs.btnGenerateGameplayCardAi.disabled = !state.open || state.generating || !String(state.prompt || '').trim();
        refs.btnGenerateGameplayCardAi.textContent = state.generating ? '正在生成卡图…' : '生成并替换当前卡图';
    }
    if (refs.btnOpenGameplayCardAiLocation) {
        refs.btnOpenGameplayCardAiLocation.disabled = !state.open || !openPath;
        refs.btnOpenGameplayCardAiLocation.title = openPath
            ? '在文件管理器中打开：' + openPath
            : '当前卡图还没有可打开的保存位置';
    }
    setGameplayCardImageAiStatusEl(refs.gameplayCardAiStatus, state.statusText || '', state.statusTone || 'idle');
}

async function generateGameplayCardImage(refs, env) {
    var activeTab = getActiveGameplayTab(env);
    var cityContext = getGameplayCityContext(env);
    var entry = getSelectedGameplayEntry(env);
    if (activeTab !== 'cards' || !cityContext || !entry) {
        env.setStatus('请先选择一张卡片', 'error');
        return;
    }
    var state = gameplayCardImageAiState;
    var prompt = String(state.prompt || '').trim();
    if (!prompt) {
        state.statusText = '请先输入或选择一段卡图提示词。';
        state.statusTone = 'error';
        renderGameplayEditor(refs, env);
        return;
    }
    state.generating = true;
    state.open = true;
    state.statusText = '正在调用火山引擎生成卡图并写入当前城市 Cards 资源目录…';
    state.statusTone = 'pending';
    renderGameplayEditor(refs, env);
    try {
        var payload = await env.generateGameplayCardImageForEntry(prompt, cityContext, entry);
        var assetRefs = ensureGameplayAssetRefs(entry);
        assetRefs.imagePath = String(payload.publicUrl || '');
        if (payload.id) assetRefs.imageId = String(payload.id || '');
        entry.updatedAt = new Date().toISOString();
        state.generating = false;
        state.lastResult = {
            projectPath: String(payload.projectPath || ''),
            publicUrl: String(payload.publicUrl || ''),
            fileName: String(payload.fileName || ''),
            prompt: prompt
        };
        state.statusText = '已生成并替换当前卡图。';
        state.statusTone = 'success';
        setSelectedGameplayAssetId(env, String(payload.id || ''));
        env.markDirty('已 AI 生成卡片图片');
        env.setStatus('卡图已生成并写入 ' + String(payload.projectPath || 'public/Arts/Cards'), 'success');
        renderGameplayEditor(refs, env);
    } catch (error) {
        state.generating = false;
        state.statusText = '卡图生成失败：' + ((error && error.message) || '未知错误');
        state.statusTone = 'error';
        env.setStatus(state.statusText, 'error');
        renderGameplayEditor(refs, env);
    }
}

function clearGameplayModelAiPollTimer() {
    if (gameplayModelAiPollTimer) {
        window.clearTimeout(gameplayModelAiPollTimer);
        gameplayModelAiPollTimer = 0;
    }
}

function getGameplayConfigKey(env, cityContext) {
    if (!env || !cityContext || typeof env.resolveCityGameplayConfigKey !== 'function') return '';
    return String(env.resolveCityGameplayConfigKey(cityContext) || '');
}

function formatGameplayModelAiProgress(progress) {
    var numeric = Number(progress);
    if (!Number.isFinite(numeric)) return '';
    var percent = numeric > 1 ? numeric : numeric * 100;
    percent = Math.max(0, Math.min(100, Math.round(percent)));
    return '（' + String(percent) + '%）';
}

function readGameplayModelAiError(payload) {
    if (!payload || typeof payload !== 'object') return '';
    if (payload.error) return String(payload.error);
    if (payload.message) return String(payload.message);
    if (payload.taskError && typeof payload.taskError === 'object' && payload.taskError.message) {
        return String(payload.taskError.message);
    }
    return '';
}

function getGameplayModelAiStateForSelection(env) {
    if (!gameplayModelAiGenerationState) return null;
    var cityContext = getGameplayCityContext(env);
    if (!cityContext) return null;
    if (gameplayModelAiGenerationState.configKey !== getGameplayConfigKey(env, cityContext)) return null;
    if (gameplayModelAiGenerationState.activeTab !== getActiveGameplayTab(env)) return null;
    if (gameplayModelAiGenerationState.entryId !== getSelectedGameplayEntryId(env)) return null;
    return gameplayModelAiGenerationState;
}

function buildGameplayModelAiStatusText(state, activeTab) {
    var label = gameplayModelActionLabel(activeTab);
    if (!state) {
        return '上传照片后，使用 Meshy 生成并替换当前' + label + '模型。';
    }
    if (state.errorMessage) {
        return 'Meshy 生成失败：' + state.errorMessage;
    }
    if (state.status === 'IMPORTED') {
        return state.projectPath
            ? '已导入到 ' + state.projectPath + '，并替换当前' + label + '模型。'
            : '已替换当前' + label + '模型。';
    }
    if (state.status === 'IMPORTING') {
        return 'Meshy 已生成完成，正在写入项目模型…';
    }
    return 'Meshy 正在生成当前' + label + '模型' + formatGameplayModelAiProgress(state.progress) + '。';
}

function updateGameplayModelAiStatusUi(refs, env) {
    var statusEl = refs.gameplayAiModelStatus;
    var uploadEl = refs.gameplayAiModelImageUpload;
    var activeTab = getActiveGameplayTab(env);
    var currentState = getGameplayModelAiStateForSelection(env);
    if (statusEl) {
        statusEl.textContent = buildGameplayModelAiStatusText(currentState, activeTab);
        statusEl.classList.toggle('is-busy', !!(currentState && !currentState.errorMessage && currentState.status !== 'IMPORTED'));
        statusEl.classList.toggle('is-error', !!(currentState && currentState.errorMessage));
        statusEl.classList.toggle('is-success', !!(currentState && currentState.status === 'IMPORTED'));
    }
    if (uploadEl) {
        uploadEl.disabled = !!(currentState && !currentState.errorMessage && currentState.status !== 'IMPORTED');
        uploadEl.title = uploadEl.disabled ? '当前条目的 Meshy 任务正在执行中' : '上传照片后调用 Meshy 生成三维模型';
    }
}

function findGameplayEntryForAiState(env, taskState) {
    if (!taskState) return null;
    var state = getState(env);
    var cityConfigs = state && state.cityGameplayConfigs ? state.cityGameplayConfigs : null;
    var config = cityConfigs && cityConfigs[taskState.configKey];
    if (!config) return null;
    var list = Array.isArray(config[taskState.activeTab]) ? config[taskState.activeTab] : [];
    return list.find(function (item) {
        return String(item && item.id || '') === String(taskState.entryId || '');
    }) || null;
}

async function readJsonPayload(response) {
    var text = await response.text();
    var payload = {};
    if (text) {
        try {
            payload = JSON.parse(text);
        } catch (_error) {
            payload = {};
        }
    }
    if (!response.ok) {
        throw new Error(readGameplayModelAiError(payload) || ('请求失败：' + response.status));
    }
    return payload;
}

function scheduleGameplayModelAiPoll(refs, env, delayMs) {
    clearGameplayModelAiPollTimer();
    gameplayModelAiPollTimer = window.setTimeout(function () {
        void pollGameplayModelAiTask(refs, env);
    }, Math.max(1500, Number(delayMs) || 3500));
}

async function importGameplayModelAiTask(refs, env, taskState) {
    if (!taskState || !taskState.taskId) return;
    gameplayModelAiGenerationState = Object.assign({}, taskState, {
        status: 'IMPORTING',
        errorMessage: ''
    });
    updateGameplayModelAiStatusUi(refs, env);
    renderGameplayEditor(refs, env);
    try {
        var payload = await readJsonPayload(await fetch('/api/meshy/image-to-3d/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                taskId: taskState.taskId,
                subdirectory: gameplayModelSubdirForTab(taskState.activeTab),
                nameHint: taskState.cityName + '-' + taskState.entryName
            })
        }));
        if (typeof env.refreshGameModelsCatalog === 'function') {
            await env.refreshGameModelsCatalog();
        }
        var targetEntry = findGameplayEntryForAiState(env, taskState);
        if (!targetEntry) {
            throw new Error('原始玩法条目已不存在，模型已导入但未自动绑定');
        }
        if (isGlobalExplorePlayerEntry(taskState.activeTab, targetEntry)) {
            var playerCfg = getNormalizedGameAssetConfig(env);
            playerCfg.customPlayerModelUrl = String(payload.publicUrl || '');
            syncExploreCharacterEntriesFromGlobal(env, ensureCityGameplayConfig(env, getGameplayCityContext(env)));
        } else {
            if (!targetEntry.assetRefs || typeof targetEntry.assetRefs !== 'object') targetEntry.assetRefs = {};
            targetEntry.assetRefs.modelPath = String(payload.publicUrl || '');
            delete targetEntry.assetRefs.modelId;
        }
        targetEntry.updatedAt = new Date().toISOString();
        gameplayModelAiGenerationState = Object.assign({}, taskState, {
            status: 'IMPORTED',
            errorMessage: '',
            progress: 100,
            publicUrl: String(payload.publicUrl || ''),
            projectPath: String(payload.projectPath || '')
        });
        env.markDirty('已使用 Meshy 替换本城' + gameplayModelActionLabel(taskState.activeTab) + '模型');
        env.setStatus('Meshy 模型已写入 ' + String(payload.projectPath || 'public/GameModels') + ' 并绑定到当前条目', 'success');
        renderGameplayEditor(refs, env);
    } catch (error) {
        gameplayModelAiGenerationState = Object.assign({}, taskState, {
            errorMessage: (error && error.message) || '导入失败'
        });
        env.setStatus('Meshy 模型导入失败: ' + ((error && error.message) || '未知错误'), 'error');
        updateGameplayModelAiStatusUi(refs, env);
        renderGameplayEditor(refs, env);
    }
}

async function pollGameplayModelAiTask(refs, env) {
    var taskState = gameplayModelAiGenerationState;
    clearGameplayModelAiPollTimer();
    if (!taskState || !taskState.taskId) return;
    try {
        var payload = await readJsonPayload(await fetch('/api/meshy/image-to-3d/' + encodeURIComponent(taskState.taskId), {
            cache: 'no-store'
        }));
        var nextStatus = String(payload.status || '').toUpperCase() || 'PENDING';
        gameplayModelAiGenerationState = Object.assign({}, taskState, {
            status: nextStatus,
            progress: payload.progress,
            errorMessage: readGameplayModelAiError(payload),
            thumbnailUrl: String(payload.thumbnailUrl || ''),
            sourceModelUrl: String(payload.modelUrl || '')
        });
        updateGameplayModelAiStatusUi(refs, env);
        renderGameplayEditor(refs, env);
        if (nextStatus === 'SUCCEEDED' || nextStatus === 'COMPLETED') {
            await importGameplayModelAiTask(refs, env, gameplayModelAiGenerationState);
            return;
        }
        if (nextStatus === 'FAILED' || nextStatus === 'CANCELED' || nextStatus === 'CANCELLED' || nextStatus === 'EXPIRED') {
            env.setStatus('Meshy 生成失败: ' + (gameplayModelAiGenerationState.errorMessage || '任务未完成'), 'error');
            return;
        }
        scheduleGameplayModelAiPoll(refs, env, 3500);
    } catch (error) {
        gameplayModelAiGenerationState = Object.assign({}, taskState, {
            errorMessage: (error && error.message) || '轮询失败'
        });
        updateGameplayModelAiStatusUi(refs, env);
        env.setStatus('查询 Meshy 任务失败: ' + ((error && error.message) || '未知错误'), 'error');
    }
}

async function startGameplayModelAiGeneration(refs, env, file) {
    var entry = getSelectedGameplayEntry(env);
    var activeTab = getActiveGameplayTab(env);
    var cityContext = getGameplayCityContext(env);
    if (!entry || !gameplayTabSupportsDirectModelOverride(activeTab)) {
        env.setStatus('请先选择一个支持模型替换的玩法条目', 'error');
        if (refs.gameplayAiModelImageUpload) refs.gameplayAiModelImageUpload.value = '';
        return;
    }
    if (!cityContext) {
        env.setStatus('请先选择带城市信息的关卡', 'error');
        if (refs.gameplayAiModelImageUpload) refs.gameplayAiModelImageUpload.value = '';
        return;
    }
    try {
        clearGameplayModelAiPollTimer();
        gameplayModelAiGenerationState = {
            taskId: '',
            activeTab: activeTab,
            configKey: getGameplayConfigKey(env, cityContext),
            cityName: cityContext.cityName,
            entryId: String(entry.id || ''),
            entryName: String(entry.name || gameplayModelActionLabel(activeTab)),
            progress: 0,
            status: 'UPLOADING',
            errorMessage: ''
        };
        updateGameplayModelAiStatusUi(refs, env);
        renderGameplayEditor(refs, env);
        env.setStatus('正在提交 Meshy 图片转 3D 任务…', 'idle');
        var mimeType = String(file.type || '').trim() || 'image/png';
        var payload = await readJsonPayload(await fetch('/api/meshy/image-to-3d', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageDataUrl: 'data:' + mimeType + ';base64,' + (await fileToBase64(file)),
                nameHint: cityContext.cityName + '-' + String(entry.name || gameplayModelActionLabel(activeTab))
            })
        }));
        gameplayModelAiGenerationState = Object.assign({}, gameplayModelAiGenerationState, {
            taskId: String(payload.taskId || ''),
            status: 'PENDING'
        });
        if (refs.gameplayAiModelImageUpload) refs.gameplayAiModelImageUpload.value = '';
        updateGameplayModelAiStatusUi(refs, env);
        renderGameplayEditor(refs, env);
        env.setStatus('已提交 Meshy 任务，正在生成 3D 模型…', 'idle');
        scheduleGameplayModelAiPoll(refs, env, 1200);
    } catch (error) {
        if (refs.gameplayAiModelImageUpload) refs.gameplayAiModelImageUpload.value = '';
        gameplayModelAiGenerationState = Object.assign({}, gameplayModelAiGenerationState || {}, {
            errorMessage: (error && error.message) || '提交失败'
        });
        updateGameplayModelAiStatusUi(refs, env);
        env.setStatus('Meshy 任务创建失败: ' + ((error && error.message) || '未知错误'), 'error');
        renderGameplayEditor(refs, env);
    }
}

/** @returns {string} public/ 相对路径，供 reveal API 使用 */
function publicSitePathForReveal(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    if (/^public[\\/]/i.test(s)) return s.replace(/\\/g, '/');
    if (/^https?:\/\//i.test(s)) {
        try {
            var pathname = new URL(s).pathname || '';
            return pathname || '';
        } catch (_e) {
            return '';
        }
    }
    var q = s.split('#')[0].split('?')[0];
    return q.charAt(0) === '/' ? q : '';
}

/** 防御塔模型：优先定位已绑定文件，否则打开 Tower 目录 */
function gameplayTowerModelRevealProjectPath(env, cityContext, entry, activeTab) {
    if (!gameplayTabSupportsDirectModelOverride(activeTab) || !cityContext || !entry) return '';
    if (isGlobalExplorePlayerEntry(activeTab, entry)) {
        var playerCfg = getNormalizedGameAssetConfig(env);
        var playerRaw = String(playerCfg.customPlayerModelUrl || '').trim();
        var playerSitePath = publicSitePathForReveal(playerRaw);
        if (playerSitePath && /^public\//i.test(playerSitePath)) return playerSitePath;
        var playerProjectPath = playerSitePath ? publicUrlToProjectPath(playerSitePath) : '';
        return playerProjectPath || 'public/GameModels/Charactor';
    }
    var eff = resolveEffectiveGameplayEntryBindPaths(env, cityContext, entry, activeTab);
    var raw = eff && eff.modelPath ? String(eff.modelPath).trim() : '';
    var sitePath = publicSitePathForReveal(raw);
    if (sitePath && /^public\//i.test(sitePath)) return sitePath;
    var fromRoot = sitePath ? publicUrlToProjectPath(sitePath) : '';
    if (fromRoot) return fromRoot;
    return 'public/GameModels/' + gameplayModelSubdirForTab(activeTab);
}

function closeGameplayTowerModelPickModal(refs) {
    if (!refs.gameplayTowerModelPickModal) return;
    refs.gameplayTowerModelPickModal.classList.add('view-hidden');
    refs.gameplayTowerModelPickModal.setAttribute('aria-hidden', 'true');
}

/** @param {{ relativePath?: string, summary?: string }} asset */
function gameplayTowerModelPickSortBucket(asset, activeTab) {
    var rp = String((asset && asset.relativePath) || '') + ' ' + String((asset && asset.summary) || '');
    var preferredDir = gameplayModelSubdirForTab(activeTab);
    var preferredPattern = new RegExp('(?:[\\\\/]|^)'+ preferredDir +'(?:[\\\\/]|$)', 'i');
    if (preferredPattern.test(rp)) return 0;
    if (/[\\/]Tower[\\/]/i.test(rp) || /GameModels[\\/]Tower/i.test(rp)) return 1;
    return 2;
}

function renderGameplayTowerModelPickList(refs, env, filterText) {
    var listEl = refs.gameplayTowerModelPickList;
    if (!listEl || typeof env.getBrowsableModelAssets !== 'function') return;
    var activeTab = getActiveGameplayTab(env);
    var kw = String(filterText || '').trim().toLowerCase();
    var assets = env.getBrowsableModelAssets().filter(function (a) {
        if (!a) return false;
        var url = a.path || a.publicUrl || '';
        if (!isModelAssetPath(url)) return false;
        if (!kw) return true;
        var hay = [a.name, a.id, a.summary, url, a.relativePath].join(' ').toLowerCase();
        return hay.indexOf(kw) !== -1;
    });
    assets.sort(function (x, y) {
        var bx = gameplayTowerModelPickSortBucket(x, activeTab);
        var by = gameplayTowerModelPickSortBucket(y, activeTab);
        if (bx !== by) return bx - by;
        return String(x.name || '').localeCompare(String(y.name || ''), 'zh-Hans-CN');
    });
    if (!assets.length) {
        listEl.innerHTML =
            '<div class="empty-state">没有匹配的模型。请确认已在「项目模型」中刷新列表，或尝试清空搜索关键词。</div>';
        return;
    }
    listEl.innerHTML = assets.map(function (a) {
        var url = a.path || a.publicUrl || '';
        var tail = modelBindShortLabel(url);
        return [
            '<button type="button" class="gameplay-tower-pick-item" role="option"',
            ' data-pick-model-url="' + escapeAttr(url) + '" data-pick-model-id="' + escapeAttr(a.id || '') + '">',
            '  <strong>' + escapeHtml(a.name || tail) + '</strong>',
            '  <span class="gameplay-tower-pick-meta">' + escapeHtml(a.summary || '') + '</span>',
            '  <code>' + escapeHtml(tail) + '</code>',
            '</button>'
        ].join('');
    }).join('');
}

function openGameplayTowerProjectModelPicker(refs, env) {
    var entry = getSelectedGameplayEntry(env);
    var activeTab = getActiveGameplayTab(env);
    if (!entry || !gameplayTabSupportsDirectModelOverride(activeTab)) {
        env.setStatus('请先选择一个支持模型替换的玩法条目', 'error');
        return;
    }
    if (!getGameplayCityContext(env)) {
        env.setStatus('请先选择带城市信息的关卡', 'error');
        return;
    }
    if (typeof env.getBrowsableModelAssets !== 'function') {
        env.setStatus('当前环境无法枚举项目模型', 'error');
        return;
    }
    if (refs.gameplayTowerModelPickFilter) refs.gameplayTowerModelPickFilter.value = '';
        renderGameplayTowerModelPickList(refs, env, '');
    if (refs.gameplayTowerModelPickModal) {
        refs.gameplayTowerModelPickModal.classList.remove('view-hidden');
        refs.gameplayTowerModelPickModal.setAttribute('aria-hidden', 'false');
        if (refs.gameplayTowerModelPickModal.focus) refs.gameplayTowerModelPickModal.focus();
    }
}

function applyPickedGameplayTowerModel(refs, env, url, modelId) {
    var u = String(url || '').trim();
    if (!u) return;
    var entry = getSelectedGameplayEntry(env);
    var activeTab = getActiveGameplayTab(env);
    if (!entry || !gameplayTabSupportsDirectModelOverride(activeTab)) return;
    if (isGlobalExplorePlayerEntry(activeTab, entry)) {
        var playerCfg = getNormalizedGameAssetConfig(env);
        playerCfg.customPlayerModelUrl = u;
        syncExploreCharacterEntriesFromGlobal(env, ensureCityGameplayConfig(env, getGameplayCityContext(env)));
        setSelectedGameplayAssetId(env, '');
        env.markDirty('已为探索主角绑定项目模型');
        env.setStatus('已选择探索角色模型：' + modelBindShortLabel(u), 'success');
        closeGameplayTowerModelPickModal(refs);
        renderGameplayEditor(refs, env);
        return;
    }
    if (!entry.assetRefs || typeof entry.assetRefs !== 'object') entry.assetRefs = {};
    entry.assetRefs.modelPath = u;
    var mid = String(modelId || '').trim();
    if (mid) entry.assetRefs.modelId = mid;
    else delete entry.assetRefs.modelId;
    entry.updatedAt = new Date().toISOString();
    setSelectedGameplayAssetId(env, '');
    env.markDirty('已从项目模型绑定本城' + gameplayModelActionLabel(activeTab));
    env.setStatus('已选择项目模型：' + modelBindShortLabel(u), 'success');
    closeGameplayTowerModelPickModal(refs);
    renderGameplayEditor(refs, env);
}

function getState(env) {
    return env.getState();
}

function getGameplayCityContext(env) {
    return env.getGameplayCityContext();
}

function getActiveGameplayTab(env) {
    return normalizeGameplayTabId(env.getActiveGameplayTab());
}

function setActiveGameplayTab(env, tabId) {
    env.setActiveGameplayTab(normalizeGameplayTabId(tabId));
}

function getSelectedGameplayEntryId(env) {
    return env.getSelectedGameplayEntryId() || '';
}

function setSelectedGameplayEntryId(env, entryId) {
    env.setSelectedGameplayEntryId(entryId || '');
}

function getSelectedGameplayAssetId(env) {
    return env.getSelectedGameplayAssetId() || '';
}

function setSelectedGameplayAssetId(env, assetId) {
    env.setSelectedGameplayAssetId(assetId || '');
}

function updateGameplayTabUi(refs, env) {
    if (!refs.gameplayResourceTabs) return;
    refs.gameplayResourceTabs.querySelectorAll('[data-gameplay-tab]').forEach(function (item) {
        var tabId = item.getAttribute('data-gameplay-tab') || '';
        var visible = VISIBLE_GAMEPLAY_TABS.indexOf(tabId) >= 0;
        item.classList.toggle('view-hidden', !visible);
        item.disabled = !visible;
        item.setAttribute('aria-hidden', visible ? 'false' : 'true');
        item.classList.toggle('active', visible && tabId === getActiveGameplayTab(env));
    });
}

function getGameplayCollection(env) {
    if (getActiveGameplayTab(env) === 'waves') return [];
    var cityContext = getGameplayCityContext(env);
    if (!cityContext) return null;
    return ensureCityGameplayConfig(env, cityContext)[getActiveGameplayTab(env)];
}

function getSelectedGameplayEntry(env, entries) {
    var list = Array.isArray(entries) ? entries : getGameplayCollection(env);
    if (!Array.isArray(list) || !list.length) return null;
    var found = list.find(function (item) {
        return item.id === getSelectedGameplayEntryId(env);
    }) || null;
    if (!found) {
        setSelectedGameplayEntryId(env, list[0].id);
        found = list[0];
    }
    return found;
}

function getFilteredGameplayEntries(refs, env) {
    if (getActiveGameplayTab(env) === 'waves') return [];
    var cityContext = getGameplayCityContext(env);
    var collection = cityContext ? ensureCityGameplayConfig(env, cityContext)[getActiveGameplayTab(env)] : [];
    var keyword = refs.gameplaySearch ? String(refs.gameplaySearch.value || '').trim().toLowerCase() : '';
    return collection.filter(function (entry) {
        if (!keyword) return true;
        var haystack = [entry.name, entry.id, entry.summary].concat(entry.tags || []).join(' ').toLowerCase();
        return haystack.indexOf(keyword) !== -1;
    });
}

function getAllProjectLevels(env) {
    var state = getState(env);
    return Array.isArray(state && state.levels) ? state.levels : [];
}

function getLevelDisplayName(level) {
    if (!level) return '未命名关卡';
    return String(level.cityName || level.name || level.id || '未命名关卡');
}

function getEffectiveWaveRules(level) {
    var explicitRules = Array.isArray(level && level.waveRules) ? level.waveRules : [];
    return explicitRules.length ? explicitRules : createWaveRulesFromLegacySpawnPoints(level);
}

function getWaveTabCurrentLevel(env) {
    var selected = typeof env.getLevel === 'function' ? env.getLevel() : null;
    if (selected) return selected;
    return getAllProjectLevels(env)[0] || null;
}

function setGameplayWaveWorkbenchMode(refs, active) {
    if (refs.gameplayWorkbench) refs.gameplayWorkbench.classList.toggle('gameplay-workbench--waves', !!active);
}

function buildWaveLevelSelectOptions(env, currentLevel) {
    return getAllProjectLevels(env).map(function (level) {
        var levelId = String(level && level.id || '');
        return '<option value="' + escapeAttr(levelId) + '"' + (currentLevel && currentLevel.id === levelId ? ' selected' : '') + '>' + escapeHtml(getLevelDisplayName(level)) + '</option>';
    }).join('');
}

function getNextMissingStandardWave(level) {
    var used = {};
    getEffectiveWaveRules(level).forEach(function (rule) {
        var waveNumber = Math.max(1, Math.round(Number(rule.waveNumber) || 1));
        if (waveNumber <= DEFENSE_STANDARD_WAVE_COUNT) used[waveNumber] = true;
    });
    for (var wave = 1; wave <= DEFENSE_STANDARD_WAVE_COUNT; wave += 1) {
        if (!used[wave]) return wave;
    }
    return DEFENSE_STANDARD_WAVE_COUNT;
}

function getNextEndlessWave(level) {
    return Math.max(DEFENSE_STANDARD_WAVE_COUNT + 1, getEffectiveWaveRules(level).reduce(function (maxWave, rule) {
        return Math.max(maxWave, Math.round(Number(rule.waveNumber) || 0) + 1);
    }, DEFENSE_STANDARD_WAVE_COUNT + 1));
}

function setGameplayStandardFormVisible(refs, visible) {
    if (!refs.gameplayEditorForm) return;
    Array.from(refs.gameplayEditorForm.children || []).forEach(function (child) {
        if (refs.gameplayWaveManagerPanel && child === refs.gameplayWaveManagerPanel) {
            child.classList.toggle('view-hidden', visible);
            return;
        }
        child.classList.toggle('view-hidden', !visible);
    });
}

function renderGameplayWaveOverviewStats(refs, env) {
    if (!refs.gameplayOverviewStats) return;
    var levels = getAllProjectLevels(env);
    var legacyLevels = 0;
    var totalWaveCount = 0;
    var totalRuleCount = 0;
    var totalSpawnCount = 0;
    levels.forEach(function (level) {
        var effectiveRules = getEffectiveWaveRules(level);
        var waveNumbers = {};
        effectiveRules.forEach(function (rule) {
            waveNumbers[Math.max(1, Math.round(Number(rule.waveNumber) || 1))] = true;
        });
        totalWaveCount += Object.keys(waveNumbers).length;
        totalRuleCount += effectiveRules.length;
        totalSpawnCount += level && level.map && Array.isArray(level.map.spawnPoints) ? level.map.spawnPoints.length : 0;
        if ((!Array.isArray(level && level.waveRules) || !level.waveRules.length) && createWaveRulesFromLegacySpawnPoints(level).length) {
            legacyLevels += 1;
        }
    });
    refs.gameplayOverviewStats.innerHTML = [
        { label: '关卡', value: levels.length },
        { label: '总波次', value: totalWaveCount },
        { label: '刷怪规则', value: totalRuleCount },
        { label: '出生点', value: totalSpawnCount },
        { label: '待迁移旧配置', value: legacyLevels }
    ].map(function (card) {
        return '<div class="stat-card"><strong>' + escapeHtml(String(card.value)) + '</strong><span>' + escapeHtml(card.label) + '</span></div>';
    }).join('');
}

function renderGameplayWaveLevelList(refs, env) {
    if (!refs.gameplayEntryList) return;
    var keyword = refs.gameplaySearch ? String(refs.gameplaySearch.value || '').trim().toLowerCase() : '';
    var currentLevel = getWaveTabCurrentLevel(env);
    var levels = getAllProjectLevels(env).filter(function (level) {
        if (!keyword) return true;
        var haystack = [level && level.name, level && level.id, level && level.cityName, level && level.cityCode].join(' ').toLowerCase();
        return haystack.indexOf(keyword) >= 0;
    });
    if (!levels.length) {
        refs.gameplayEntryList.innerHTML = '<div class="empty-state">当前没有可编辑的关卡波次。</div>';
        return;
    }
    refs.gameplayEntryList.innerHTML = levels.map(function (level) {
        var effectiveRules = getEffectiveWaveRules(level);
        var waveNumbers = {};
        var spawnPoints = level && level.map && Array.isArray(level.map.spawnPoints) ? level.map.spawnPoints : [];
        effectiveRules.forEach(function (rule) {
            waveNumbers[Math.max(1, Math.round(Number(rule.waveNumber) || 1))] = true;
        });
        var hasLegacyOnly = (!Array.isArray(level.waveRules) || !level.waveRules.length) && effectiveRules.length > 0;
        return [
            '<div class="list-item gameplay-entry-card gameplay-wave-level-card' + (currentLevel && level.id === currentLevel.id ? ' active' : '') + '">',
            '  <div class="gameplay-entry-main">',
            '    <div class="gameplay-entry-title-row">',
            '      <button type="button" class="gameplay-entry-select" data-gameplay-wave-level-id="' + escapeAttr(String(level.id || '')) + '">' + escapeHtml(getLevelDisplayName(level)) + '</button>',
            '    </div>',
            '    <span class="gameplay-entry-summary">' + escapeHtml(level && level.cityCode ? ('城市代码：' + level.cityCode) : '普通关卡') + '</span>',
            '    <div class="gameplay-entry-meta">',
            '      <span class="gameplay-chip">' + escapeHtml(String(Object.keys(waveNumbers).length)) + ' 波</span>',
            '      <span class="gameplay-chip">' + escapeHtml(String(effectiveRules.length)) + ' 条刷怪</span>',
            '      <span class="gameplay-chip">' + escapeHtml(String(spawnPoints.length)) + ' 个出生点</span>',
            hasLegacyOnly ? '      <span class="gameplay-chip">待迁移旧配置</span>' : '',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('');
    }).join('');
}

function renderGameplayWaveInspector(refs, env, level) {
    if (refs.gameplayInspectorMeta) {
        refs.gameplayInspectorMeta.textContent = level
            ? '项目级波次管理。左侧展示全部关卡，右侧编辑当前关卡的每一波与出生点刷怪组合。'
            : '请选择一个关卡后再编辑波次。';
    }
    if (refs.gameplaySelectionMeta) {
        var effectiveRules = level ? getEffectiveWaveRules(level) : [];
        var waveNumbers = {};
        effectiveRules.forEach(function (rule) {
            waveNumbers[Math.max(1, Math.round(Number(rule.waveNumber) || 1))] = true;
        });
        refs.gameplaySelectionMeta.innerHTML = level
            ? [
                '<div class="list-item"><strong>当前关卡</strong><span>' + escapeHtml(getLevelDisplayName(level)) + '</span></div>',
                '<div class="list-item"><strong>关卡 ID</strong><span>' + escapeHtml(String(level.id || '')) + '</span></div>',
                '<div class="list-item"><strong>出生点</strong><span>' + escapeHtml(String(level.map && Array.isArray(level.map.spawnPoints) ? level.map.spawnPoints.length : 0)) + '</span></div>',
                '<div class="list-item"><strong>波次数</strong><span>' + escapeHtml(String(Object.keys(waveNumbers).length)) + '</span></div>',
                '<div class="list-item"><strong>刷怪规则</strong><span>' + escapeHtml(String(effectiveRules.length)) + '</span></div>'
            ].join('')
            : '<div class="empty-state">没有可编辑的关卡。</div>';
    }
    if (refs.gameplayTowerPreviewActions) refs.gameplayTowerPreviewActions.classList.add('view-hidden');
    if (refs.gameplayCardPreviewActions) refs.gameplayCardPreviewActions.classList.add('view-hidden');
    if (refs.gameplayAssetPreviewImage) {
        refs.gameplayAssetPreviewImage.classList.add('view-hidden');
        refs.gameplayAssetPreviewImage.src = '';
    }
    if (refs.gameplayAssetPreviewHost) refs.gameplayAssetPreviewHost.classList.add('view-hidden');
    if (refs.gameplayAssetPreviewEmpty) {
        refs.gameplayAssetPreviewEmpty.classList.remove('view-hidden');
        refs.gameplayAssetPreviewEmpty.textContent = level
            ? '波次不直接绑定单个预览资源。请在右侧为刷怪规则选择敌人、出生点，并按需覆盖模型。'
            : '请选择一个关卡后开始配置波次。';
    }
    if (typeof env.disposeGameplayAssetPreview === 'function') env.disposeGameplayAssetPreview();
    if (refs.gameplayAssetList) refs.gameplayAssetList.innerHTML = '';
}

function renderGameplayWaveManager(refs, env, level) {
    if (!refs.gameplayWaveManagerPanel) return;
    setGameplayStandardFormVisible(refs, false);
    if (refs.gameplayEditorTitle) refs.gameplayEditorTitle.textContent = level ? (getLevelDisplayName(level) + ' · 波次配置') : '波次配置';
    if (refs.gameplayEditorHint) refs.gameplayEditorHint.textContent = level
        ? '每条规则代表“第几波 + 哪个出生点 + 刷什么敌人 + 数量/间隔”。出生点只负责入口与路径。'
        : '请选择一个关卡后再编辑波次。';
    if (refs.btnCreateGameplayEntry) refs.btnCreateGameplayEntry.disabled = true;
    if (refs.btnDuplicateGameplayEntry) refs.btnDuplicateGameplayEntry.disabled = true;
    if (refs.btnDeleteGameplayEntry) refs.btnDeleteGameplayEntry.disabled = true;
    if (refs.btnMoveGameplayUp) refs.btnMoveGameplayUp.disabled = true;
    if (refs.btnMoveGameplayDown) refs.btnMoveGameplayDown.disabled = true;
    if (!level) {
        refs.gameplayWaveManagerPanel.innerHTML = '<div class="empty-state">当前没有可编辑的关卡波次。</div>';
        return;
    }
    var nextStandardWave = getNextMissingStandardWave(level);
    var nextEndlessWave = getNextEndlessWave(level);
    refs.gameplayWaveManagerPanel.innerHTML = [
        '<div class="gameplay-wave-toolbar">',
        '  <label class="field-block gameplay-wave-level-select">',
        '    <span>当前关卡</span>',
        '    <select data-wave-level-select>' + buildWaveLevelSelectOptions(env, level) + '</select>',
        '  </label>',
        '  <div class="inline-controls">',
        '    <button type="button" class="mini-button" data-wave-add-standard>补第 ' + escapeHtml(String(nextStandardWave)) + ' 波</button>',
        '    <button type="button" class="mini-button" data-wave-add-endless>新增无尽第 ' + escapeHtml(String(nextEndlessWave)) + ' 波</button>',
        '  </div>',
        '</div>',
        '<div class="gameplay-wave-project-summary">',
        '  <div>',
        '    <strong>' + escapeHtml(getLevelDisplayName(level)) + ' · 波次配置</strong>',
        '    <p>这里只保留每一波、每个敌人出口、出什么怪、出几只怪。标准模式固定 1-20 波；第 20 波后可选择进入无尽模式，无尽波从第 21 波开始。</p>',
        '    <p>未手写规则的波次会回退到运行时默认刷怪逻辑；如果你要精确控制，就直接给对应波次加规则。</p>',
        '  </div>',
        '</div>',
        '<div class="gameplay-wave-list" data-wave-manager-list></div>'
    ].join('');
    var waveRefs = {
        btnAddWave: null,
        waveList: refs.gameplayWaveManagerPanel.querySelector('[data-wave-manager-list]')
    };
    var waveEnv = {
        getLevel: function () { return level; },
        getAvailableEnemyTypes: function () { return getAvailableEnemyTypes(env, level); },
        markDirty: function (message) { env.markDirty(message); },
        setStatus: function (message, tone) { env.setStatus(message, tone); },
        uploadFileToProjectUrl: function (file, options) { return env.uploadFileToProjectUrl(file, options); },
        renderOverview: function () { renderGameplayEditor(refs, env); },
        renderWaveManager: function () { renderGameplayEditor(refs, env); }
    };
    renderSharedWaveList(waveRefs, waveEnv);
    bindSharedWaveEditorUi(waveRefs, waveEnv);
    var levelSelect = refs.gameplayWaveManagerPanel.querySelector('[data-wave-level-select]');
    if (levelSelect) {
        levelSelect.addEventListener('change', function () {
            if (typeof env.selectLevel === 'function') env.selectLevel(levelSelect.value || '');
            renderGameplayEditor(refs, env);
        });
    }
    var addStandardButton = refs.gameplayWaveManagerPanel.querySelector('[data-wave-add-standard]');
    if (addStandardButton) {
        addStandardButton.addEventListener('click', function () {
            addSharedWaveRule(waveRefs, waveEnv, { waveNumber: getNextMissingStandardWave(level) });
        });
    }
    var addEndlessButton = refs.gameplayWaveManagerPanel.querySelector('[data-wave-add-endless]');
    if (addEndlessButton) {
        addEndlessButton.addEventListener('click', function () {
            addSharedWaveRule(waveRefs, waveEnv, { waveNumber: getNextEndlessWave(level) });
        });
    }
}

function renderGameplayWavesTab(refs, env) {
    var level = getWaveTabCurrentLevel(env);
    setGameplayWaveWorkbenchMode(refs, true);
    renderGameplayWaveOverviewStats(refs, env);
    renderGameplayWaveManager(refs, env, level);
    renderGameplayWaveInspector(refs, env, level);
}

function ensureUniqueGameplayEntryId(env, list, value, currentId) {
    var baseId = String(value || '').trim().replace(/\s+/g, '-');
    if (!baseId) baseId = currentId || uid(getActiveGameplayTab(env));
    var candidate = baseId;
    var serial = 1;
    while (list.some(function (item) { return item.id === candidate && item.id !== currentId; })) {
        candidate = baseId + '-' + String(serial);
        serial += 1;
    }
    return candidate;
}

function getGameplayAssets(env, cityContext, assetType) {
    var state = getState(env);
    return ((state && state.editorAssetsCatalog) || []).filter(function (asset) {
        return asset.cityCode === cityContext.cityCode && asset.assetType === assetType;
    });
}

function closeAllGameplayEntryMenus(refs) {
    if (!refs.gameplayEntryList) return;
    refs.gameplayEntryList.querySelectorAll('[data-gameplay-menu-toggle]').forEach(function (btn) {
        btn.setAttribute('aria-expanded', 'false');
    });
    refs.gameplayEntryList.querySelectorAll('.gameplay-entry-menu').forEach(function (menu) {
        menu.classList.add('view-hidden');
    });
}

function resolveGameplayEntryThumbnail(entry) {
    if (!entry || !entry.assetRefs) return '';
    if (isImageAssetPath(entry.assetRefs.imagePath)) return entry.assetRefs.imagePath;
    return '';
}

/** 玩法条目可预览/绑定的资源路径：条目自身优先，防御塔额外回落到全局「游戏资产」中的同 ID 模型。 */
function resolveEffectiveGameplayEntryBindPaths(env, cityContext, entry, activeTab) {
    if (!entry) return { imagePath: '', modelPath: '', modelSourceLabel: '' };
    var ar = entry.assetRefs || {};
    var imagePath = ar.imagePath ? String(ar.imagePath) : '';
    var modelPath = ar.modelPath ? String(ar.modelPath) : '';
    var modelSourceLabel = '';
    if (modelPath) {
        modelSourceLabel = activeTab === 'characters' ? '全局探索角色' : '本城玩法条目';
    } else if (activeTab === 'towers' && entry.id) {
        var state = getState(env);
        var gMap = state && state.gameAssetConfig && state.gameAssetConfig.customModelUrls;
        var g = gMap && gMap[entry.id] ? String(gMap[entry.id]) : '';
        if (g) {
            modelPath = g;
            modelSourceLabel = '全局游戏资产（本城未覆盖）';
        }
    }
    return {
        imagePath: imagePath,
        modelPath: modelPath,
        modelSourceLabel: modelSourceLabel
    };
}

function setGameplayEntryActionButtons(refs, disabled, entries, entry) {
    var list = Array.isArray(entries) ? entries : [];
    var index = entry ? list.findIndex(function (item) { return item.id === entry.id; }) : -1;
    if (refs.btnDuplicateGameplayEntry) refs.btnDuplicateGameplayEntry.disabled = disabled;
    if (refs.btnDeleteGameplayEntry) refs.btnDeleteGameplayEntry.disabled = disabled;
    if (refs.btnMoveGameplayUp) refs.btnMoveGameplayUp.disabled = disabled || index <= 0;
    if (refs.btnMoveGameplayDown) refs.btnMoveGameplayDown.disabled = disabled || index === -1 || index >= list.length - 1;
}

function renderGameplayOptionCheckboxes(options, selected, attrName, disabled) {
    var active = new Set(Array.isArray(selected) ? selected : []);
    return options.map(function (option) {
        return [
            '<label class="gameplay-checkbox-chip">',
            '  <input type="checkbox" ' + attrName + '="' + escapeAttr(option.id) + '"' + (active.has(option.id) ? ' checked' : '') + (disabled ? ' disabled' : '') + '>',
            '  <span>' + escapeHtml(option.label) + '</span>',
            '</label>'
        ].join('');
    }).join('');
}

function getTaxonomyQueryRoot(refs) {
    return refs.gameplayTaxonomyPanel || refs.gameplayStatGrid;
}

function renderGameplayElementField(activeTab, entry, disabled) {
    var supportsElement = activeTab === 'enemies' || activeTab === 'bosses' || activeTab === 'towers';
    if (!supportsElement) return '';
    return [
        '<label class="field-block">',
        '  <span>属性</span>',
        '  <select data-gameplay-element' + (disabled ? ' disabled' : '') + '>',
        DEFENSE_ELEMENT_OPTIONS.map(function (option) {
            var selected = (entry && entry.element || '') === option.id ? ' selected' : '';
            return '<option value="' + escapeAttr(option.id) + '"' + selected + '>' + escapeHtml(option.label) + '</option>';
        }).join(''),
        '  </select>',
        '</label>'
    ].join('');
}

function renderGameplayTaxonomyPanel(activeTab, entry, disabled) {
    var supportsFunctions = activeTab === 'towers';
    var supportsEffects = activeTab === 'enemies' || activeTab === 'bosses' || activeTab === 'towers';
    var supportsCleanse = activeTab === 'items';
    if (!supportsFunctions && !supportsEffects && !supportsCleanse) return '';
    var parts = [];
    if (supportsFunctions) {
        parts.push(
            '<section class="gameplay-taxonomy-row">' +
            '  <div class="gameplay-taxonomy-label">功能定位</div>' +
            '  <p class="gameplay-taxonomy-hint">描述单位职能（单体/群体/治疗等）；同步到游戏后写入塔模板标签，主要用于元素与扩展逻辑，不改变默认索敌规则。</p>' +
            '  <div class="gameplay-taxonomy-chips">' + renderGameplayOptionCheckboxes(DEFENSE_FUNCTION_OPTIONS, entry && entry.functionTags, 'data-gameplay-function-tag', disabled) + '</div>' +
            '</section>'
        );
    }
    if (supportsEffects) {
        var durRaw = entry && entry.effectDurationSec;
        var durNum = Number(durRaw);
        var durVal = Number.isFinite(durNum) && durNum > 0 ? durNum : 2;
        parts.push(
            '<section class="gameplay-taxonomy-row">' +
            '  <div class="gameplay-taxonomy-label">施加效果</div>' +
            '  <p class="gameplay-taxonomy-hint">勾选的状态会在塔防战斗中对敌人施加对应负面效果；持续时间为每个已勾选效果在敌人身上的持续秒数。保存城市玩法并同步游戏后生效。</p>' +
            '  <div class="gameplay-taxonomy-chips">' + renderGameplayOptionCheckboxes(DEFENSE_STATUS_OPTIONS, entry && entry.effects, 'data-gameplay-effect', disabled) + '</div>' +
            '  <label class="field-block gameplay-effect-duration">' +
            '    <span>效果持续时间（秒）</span>' +
            '    <input type="number" data-gameplay-effect-duration min="0.1" max="120" step="0.1" value="' + escapeAttr(String(durVal)) + '"' + (disabled ? ' disabled' : '') + '>' +
            '  </label>' +
            '</section>'
        );
    }
    if (supportsCleanse) {
        parts.push(
            '<section class="gameplay-taxonomy-row">' +
            '  <div class="gameplay-taxonomy-label">可解除效果</div>' +
            '  <p class="gameplay-taxonomy-hint">与塔防净化道具对应；保存并同步游戏后生效。</p>' +
            '  <div class="gameplay-taxonomy-chips">' + renderGameplayOptionCheckboxes(DEFENSE_STATUS_OPTIONS, entry && entry.cleanseEffects, 'data-gameplay-cleanse-effect', disabled) + '</div>' +
            '</section>'
        );
    }
    return parts.join('');
}

function renderGameplayAnimationPanel(activeTab, entry, disabled) {
    var fields = gameplayAnimationFieldsForTab(activeTab);
    if (!fields.length) return '';
    return [
        '<section class="gameplay-taxonomy-row">',
        '  <div class="gameplay-taxonomy-label">动画配置</div>',
        '  <p class="gameplay-taxonomy-hint">' + escapeHtml(gameplayAnimationHintText(activeTab)) + '</p>',
        '  <div class="form-grid two">',
        fields.map(function (field) {
            var path = getGameplayAnimationPath(entry, activeTab, field.id);
            return [
                '    <div class="field-block">',
                '      <span>' + escapeHtml(field.label) + '</span>',
                '      <div class="inline-controls">',
                '        <label class="mini-button upload-button">上传 / 替换',
                '          <input type="file" data-gameplay-animation-upload="' + escapeAttr(field.id) + '" accept=".glb,.gltf,model/gltf-binary,model/gltf+json"' + (disabled ? ' disabled' : '') + '>',
                '        </label>',
                '        <button type="button" class="mini-button" data-gameplay-animation-clear="' + escapeAttr(field.id) + '"' + (disabled || !path ? ' disabled' : '') + '>清除</button>',
                '      </div>',
                '      <div class="asset-url-hint" title="' + escapeAttr(path || '未绑定动画文件') + '">' + escapeHtml(path ? modelBindShortLabel(path) : '未配置') + '</div>',
                '    </div>'
            ].join('');
        }).join(''),
        '  </div>',
        '</section>'
    ].join('');
}

function optionLabels(options, ids) {
    var selected = Array.isArray(ids) ? ids : [];
    return selected.map(function (id) {
        var match = options.find(function (option) { return option.id === id; });
        return match ? match.label : id;
    }).filter(Boolean);
}

function getSelectedGameplayAsset(env, entry, assets) {
    if (!entry && !getSelectedGameplayAssetId(env)) return null;
    var state = getState(env);
    var list = Array.isArray(assets) ? assets : [];
    var picked = getSelectedGameplayAssetId(env)
        ? list.find(function (asset) { return asset.id === getSelectedGameplayAssetId(env); })
        : null;
    if (picked) return picked;
    if (getSelectedGameplayAssetId(env)) {
        picked = ((state && state.editorAssetsCatalog) || []).find(function (asset) {
            return asset.id === getSelectedGameplayAssetId(env);
        }) || null;
        if (picked) return picked;
    }
    if (entry) {
        var effBind = resolveEffectiveGameplayEntryBindPaths(env, getGameplayCityContext(env), entry, getActiveGameplayTab(env));
        var refsToTry = []
            .concat(
                entry.assetRefs && typeof entry.assetRefs === 'object'
                    ? [entry.assetRefs.imagePath, entry.assetRefs.modelPath]
                    : []
            )
            .concat([effBind.imagePath, effBind.modelPath]);
        for (var i = 0; i < refsToTry.length; i += 1) {
            var match = list.find(function (asset) {
                return asset.publicUrl === refsToTry[i] || asset.path === refsToTry[i] || asset.projectPath === refsToTry[i];
            }) || ((state && state.editorAssetsCatalog) || []).find(function (asset) {
                return asset.publicUrl === refsToTry[i] || asset.path === refsToTry[i] || asset.projectPath === refsToTry[i];
            });
            if (match) {
                setSelectedGameplayAssetId(env, match.id);
                return match;
            }
        }
        var hasDirect = refsToTry.some(function (p) {
            return p && String(p).trim();
        });
        if (hasDirect) {
            setSelectedGameplayAssetId(env, '');
            return null;
        }
    }
    setSelectedGameplayAssetId(env, list[0] ? list[0].id : '');
    return list[0] || null;
}

function renderGameplayAssetPreview(refs, env, asset, entry) {
    var tab = getActiveGameplayTab(env);
    var eff = resolveEffectiveGameplayEntryBindPaths(env, getGameplayCityContext(env), entry, tab);
    var assetUrl = asset ? String(asset.publicUrl || asset.path || '') : '';
    var directImg = eff.imagePath;
    var directModel = eff.modelPath;
    var hasImageFromAsset = !!(assetUrl && isImageAssetPath(assetUrl));
    var hasModelFromAsset = !!(assetUrl && isModelAssetPath(assetUrl));
    var hasImageFromEntry = !!(directImg && isImageAssetPath(directImg));
    var hasModelFromEntry = !!(directModel && isModelAssetPath(directModel));
    var hasImage = hasImageFromAsset || hasImageFromEntry;
    var hasModel = hasModelFromAsset || hasModelFromEntry;
    var imgSrc = hasImageFromAsset ? assetUrl : (hasImageFromEntry ? directImg : '');
    var modelSrc = hasModelFromAsset ? assetUrl : (hasModelFromEntry ? directModel : '');

    if (refs.gameplayPreviewTitle) refs.gameplayPreviewTitle.textContent = asset ? asset.name : (entry ? entry.name : '资源预览');
    if (refs.gameplayPreviewMeta) {
        if (asset) {
            refs.gameplayPreviewMeta.textContent = asset.assetType + ' · ' + (asset.cityName || '未命名城市');
        } else if (hasImage || hasModel) {
            refs.gameplayPreviewMeta.textContent =
                eff.modelSourceLabel ||
                (hasModel ? '模型预览' : '已绑定项目路径（可直接预览；上传新文件可替换绑定）');
        } else {
            refs.gameplayPreviewMeta.textContent = '未选择资源';
        }
    }
    if (refs.gameplayAssetPreviewEmpty) refs.gameplayAssetPreviewEmpty.classList.toggle('view-hidden', hasImage || hasModel);
    if (refs.gameplayAssetPreviewImage) {
        refs.gameplayAssetPreviewImage.classList.toggle('view-hidden', !hasImage);
        refs.gameplayAssetPreviewImage.src = hasImage ? imgSrc : '';
    }
    if (refs.gameplayAssetPreviewHost) refs.gameplayAssetPreviewHost.classList.toggle('view-hidden', !hasModel);
    if (!hasModel) {
        env.disposeGameplayAssetPreview();
        return;
    }
    env.ensureGameplayAssetPreview(modelSrc);
}

function renderGameplayEntryList(refs, env, entries, cityContext) {
    if (!refs.gameplayEntryList) return;
    if (!cityContext) {
        refs.gameplayEntryList.innerHTML = '<div class="empty-state">先从左侧选中一个城市关卡，玩法编辑器会自动切到该城市的资源库。</div>';
        return;
    }
    if (!entries.length) {
        refs.gameplayEntryList.innerHTML = '<div class="empty-state">' + GAMEPLAY_RESOURCE_CONFIG[getActiveGameplayTab(env)].empty + '</div>';
        return;
    }
    if (!getSelectedGameplayEntryId(env) || !entries.some(function (entry) { return entry.id === getSelectedGameplayEntryId(env); })) {
        setSelectedGameplayEntryId(env, entries[0].id);
    }
    var allowEntryMutation = getActiveGameplayTab(env) !== 'characters';
    refs.gameplayEntryList.innerHTML = entries.map(function (entry) {
        var thumb = resolveGameplayEntryThumbnail(entry);
        var element = DEFENSE_ELEMENT_OPTIONS.find(function (option) { return option.id === entry.element; });
        var taxonomyLabels = []
            .concat(element && element.id ? [element.label] : [])
            .concat(optionLabels(DEFENSE_FUNCTION_OPTIONS, entry.functionTags))
            .concat(optionLabels(DEFENSE_STATUS_OPTIONS, entry.cleanseEffects));
        return [
            '<div class="list-item gameplay-entry-card' + (entry.id === getSelectedGameplayEntryId(env) ? ' active' : '') + '">',
            thumb
                ? '  <button type="button" class="gameplay-entry-thumb-btn" data-gameplay-select-id="' + escapeAttr(entry.id) + '" title="选择此条目">'
                    + '<img class="gameplay-asset-thumb" src="' + escapeAttr(thumb) + '" alt="' + escapeAttr(entry.name) + '">'
                    + '</button>'
                : '',
            '  <div class="gameplay-entry-main">',
            '    <div class="gameplay-entry-title-row">',
            '      <button type="button" class="gameplay-entry-select" data-gameplay-select-id="' + escapeAttr(entry.id) + '">' + escapeHtml(entry.name) + '</button>',
            allowEntryMutation ? '      <div class="gameplay-entry-menu-anchor">' : '',
            allowEntryMutation ? '        <button type="button" class="mini-button gameplay-entry-ops-btn" data-gameplay-menu-toggle aria-expanded="false">操作</button>' : '',
            allowEntryMutation ? '        <div class="gameplay-entry-menu view-hidden" role="menu">' : '',
            allowEntryMutation ? '          <button type="button" role="menuitem" class="gameplay-entry-menu-item" data-gameplay-action="move-up" data-gameplay-entry-id="' + escapeAttr(entry.id) + '">上移</button>' : '',
            allowEntryMutation ? '          <button type="button" role="menuitem" class="gameplay-entry-menu-item" data-gameplay-action="move-down" data-gameplay-entry-id="' + escapeAttr(entry.id) + '">下移</button>' : '',
            allowEntryMutation ? '          <button type="button" role="menuitem" class="gameplay-entry-menu-item" data-gameplay-action="duplicate" data-gameplay-entry-id="' + escapeAttr(entry.id) + '">复制</button>' : '',
            allowEntryMutation ? '          <button type="button" role="menuitem" class="gameplay-entry-menu-item danger" data-gameplay-action="delete" data-gameplay-entry-id="' + escapeAttr(entry.id) + '">删除</button>' : '',
            allowEntryMutation ? '        </div>' : '',
            allowEntryMutation ? '      </div>' : '',
            '    </div>',
            '    <span class="gameplay-entry-summary">' + escapeHtml(entry.summary || '未填写简介') + '</span>',
            '    <div class="gameplay-entry-meta">',
            '      <span class="gameplay-chip">' + escapeHtml(entry.rarity || 'common') + '</span>',
            '      <span class="gameplay-chip">' + escapeHtml((entry.tags || []).join(' / ') || cityContext.cityName) + '</span>',
            entry.placement ? '      <span class="gameplay-chip">' + escapeHtml(gameplayPlacementLabel(entry.placement)) + '</span>' : '',
            taxonomyLabels.length ? '      <span class="gameplay-chip">' + escapeHtml(taxonomyLabels.slice(0, 3).join(' / ')) + '</span>' : '',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('');
    }).join('');
}

function renderGameplayForm(refs, env, entries, cityContext) {
    var entry = getSelectedGameplayEntry(env, entries);
    var disabled = !entry;
    var activeTab = getActiveGameplayTab(env);
    var isLockedCharacterTab = activeTab === 'characters';
    if (refs.gameplayEditorTitle) refs.gameplayEditorTitle.textContent = entry ? entry.name : (GAMEPLAY_RESOURCE_CONFIG[getActiveGameplayTab(env)].label + '详情');
    if (refs.gameplayEditorHint) refs.gameplayEditorHint.textContent = cityContext ? cityContext.cityName + ' · ' + GAMEPLAY_RESOURCE_CONFIG[getActiveGameplayTab(env)].label : '城市玩法配置';
    if (refs.gameplayName) refs.gameplayName.value = entry ? entry.name : '';
    if (refs.gameplayId) refs.gameplayId.value = entry ? entry.id : '';
    if (refs.gameplayTags) refs.gameplayTags.value = entry ? (entry.tags || []).join(', ') : '';
    if (refs.gameplayRarity) refs.gameplayRarity.value = entry ? entry.rarity : '';
    if (refs.gameplaySummary) refs.gameplaySummary.value = entry ? entry.summary : '';
    [refs.gameplayName, refs.gameplayId, refs.gameplayTags, refs.gameplayRarity, refs.gameplaySummary].forEach(function (field) {
        if (field) field.disabled = disabled || isLockedCharacterTab;
    });
    setGameplayEntryActionButtons(refs, disabled, entries, entry);
    if (refs.btnCreateGameplayEntry) refs.btnCreateGameplayEntry.disabled = !cityContext || isLockedCharacterTab;
    if (isLockedCharacterTab) {
        if (refs.btnDuplicateGameplayEntry) refs.btnDuplicateGameplayEntry.disabled = true;
        if (refs.btnDeleteGameplayEntry) refs.btnDeleteGameplayEntry.disabled = true;
        if (refs.btnMoveGameplayUp) refs.btnMoveGameplayUp.disabled = true;
        if (refs.btnMoveGameplayDown) refs.btnMoveGameplayDown.disabled = true;
    }
    if (refs.gameplayStatGrid) {
        var statsHtml = GAMEPLAY_RESOURCE_CONFIG[activeTab].stats.map(function (field) {
            var value = entry && entry.stats ? entry.stats[field.key] : '';
            var extraAttrs = field.key === 'refundRatio' ? ' min="0" max="1"' : '';
            return [
                '<label class="field-block">',
                '  <span>' + escapeHtml(field.label) + '</span>',
                '  <input type="number" data-gameplay-stat="' + escapeAttr(field.key) + '" step="' + escapeAttr(field.step) + '" value="' + escapeAttr(value === '' || value == null ? '' : String(value)) + '"' + extraAttrs + (disabled ? ' disabled' : '') + '>',
                '</label>'
            ].join('');
        }).join('');
        var placementHtml = activeTab === 'towers'
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
        refs.gameplayStatGrid.innerHTML = statsHtml + placementHtml + renderGameplayElementField(activeTab, entry, disabled);
    }
    if (refs.gameplayTaxonomyPanel) {
        var taxHtml = renderGameplayTaxonomyPanel(activeTab, entry, disabled);
        refs.gameplayTaxonomyPanel.innerHTML = taxHtml;
        refs.gameplayTaxonomyPanel.classList.toggle('view-hidden', !taxHtml);
    }
    if (refs.gameplayAnimationPanel) {
        var animHtml = renderGameplayAnimationPanel(activeTab, entry, disabled);
        refs.gameplayAnimationPanel.innerHTML = animHtml;
        refs.gameplayAnimationPanel.classList.toggle('view-hidden', !animHtml);
    }
    if (refs.gameplayModelScale) {
        var currentScale = entry && entry.assetRefs && entry.assetRefs.modelScale ? Number(entry.assetRefs.modelScale) : 1;
        refs.gameplayModelScale.value = currentScale;
        refs.gameplayModelScale.disabled = disabled || isLockedCharacterTab;
    }
}

function renderGameplayInspector(refs, env, cityContext, config, entries) {
    var entry = getSelectedGameplayEntry(env, entries);
    var activeTab = getActiveGameplayTab(env);
    var wantAssetType = GAMEPLAY_RESOURCE_CONFIG[activeTab].assetType;
    if (refs.gameplayAssetType && refs.gameplayAssetType.querySelector('option[value="' + wantAssetType + '"]')) {
        refs.gameplayAssetType.value = wantAssetType;
    }
    var assetType = refs.gameplayAssetType ? refs.gameplayAssetType.value : wantAssetType;
    var assets = cityContext ? getGameplayAssets(env, cityContext, assetType) : [];
    if (refs.gameplayAssetName && !refs.gameplayAssetName.value && entry) refs.gameplayAssetName.value = entry.name;
    if (refs.gameplayInspectorMeta) {
        refs.gameplayInspectorMeta.textContent = cityContext
            ? '当前城市：' + cityContext.cityName + '（' + cityContext.cityCode + '）'
            : '先从左侧关卡树选择一个城市关卡，再在这里维护该关卡的敌人、防御塔、卡片、Boss、道具与探索角色。';
    }
    if (refs.gameplaySelectionMeta) {
        var effMeta = entry ? resolveEffectiveGameplayEntryBindPaths(env, cityContext, entry, activeTab) : null;
        var ownModel =
            entry && entry.assetRefs && entry.assetRefs.modelPath ? String(entry.assetRefs.modelPath) : '';
        var ownImg =
            entry && entry.assetRefs && entry.assetRefs.imagePath ? String(entry.assetRefs.imagePath) : '';
        refs.gameplaySelectionMeta.innerHTML = cityContext
            ? [
                '<div class="list-item"><strong>城市代码</strong><span>' + escapeHtml(cityContext.cityCode) + '</span></div>',
                '<div class="gameplay-inspector-counts" role="group" aria-label="敌人、防御塔、卡片、角色、技能、道具数量">',
                [['敌人', config.enemies.length], ['Boss', config.bosses.length], ['防御塔', config.towers.length], ['卡片', config.cards.length], ['角色', config.characters.length], ['道具', config.items.length]].map(function (pair) {
                    return '<span class="gic-chip"><strong>' + String(pair[1]) + '</strong><span>' + escapeHtml(pair[0]) + '</span></span>';
                }).join(''),
                '</div>',
                '<div class="list-item"><strong>当前选择</strong><span>' + escapeHtml(entry ? entry.name : '未选择条目') + '</span></div>',
                '<div class="list-item"><strong>模型</strong><span>' +
                    escapeHtml(
                        entry
                            ? (ownModel || '—') +
                                  ' → 生效：' +
                                  (effMeta && effMeta.modelPath ? effMeta.modelPath : '—') +
                                  (effMeta && effMeta.modelSourceLabel ? '（' + effMeta.modelSourceLabel + '）' : '')
                            : '未绑定'
                    ) +
                    '</span></div>',
                '<div class="list-item"><strong>图片</strong><span>' +
                    escapeHtml(
                        entry ? ownImg || (effMeta && effMeta.imagePath) || '未绑定' : '未绑定'
                    ) +
                    '</span></div>'
            ].join('')
            : '<div class="empty-state">没有可编辑的城市。</div>';
    }
    if (refs.gameplayTowerPreviewActions) {
        refs.gameplayTowerPreviewActions.classList.toggle(
            'view-hidden',
            !(cityContext && gameplayTabSupportsDirectModelOverride(activeTab) && entry)
        );
    }
    if (refs.gameplayCardPreviewActions) {
        refs.gameplayCardPreviewActions.classList.toggle('view-hidden', !(cityContext && activeTab === 'cards' && entry));
    }
    renderGameplayCardImageAiUi(refs, env, cityContext, entry, activeTab);
    if (refs.btnOpenGameplayTowerModelLocation) {
        var revealPath =
            cityContext && gameplayTabSupportsDirectModelOverride(activeTab) && entry
                ? gameplayTowerModelRevealProjectPath(env, cityContext, entry, activeTab)
                : '';
        refs.btnOpenGameplayTowerModelLocation.disabled = !revealPath;
        refs.btnOpenGameplayTowerModelLocation.title = revealPath
            ? '在文件管理器中打开：' + revealPath + '（与过场「打开视频保存位置」相同）'
            : '请切换到敌人 / 防御塔 / 道具 / 角色并选择一个条目';
    }
    if (refs.btnPickGameplayTowerProjectModel) {
        var towerPickOk = cityContext && gameplayTabSupportsDirectModelOverride(activeTab) && entry;
        refs.btnPickGameplayTowerProjectModel.disabled = !towerPickOk;
        refs.btnPickGameplayTowerProjectModel.title = towerPickOk
            ? '从已扫描的 public/GameModels 等模型中选择并绑定到当前条目'
            : '请切换到敌人 / 防御塔 / 道具 / 角色并选择一个条目';
    }
            updateGameplayModelAiStatusUi(refs, env);
    if (!refs.gameplayAssetList) return;
    if (!cityContext) {
        refs.gameplayAssetList.innerHTML = '<div class="empty-state">请选择城市后再上传资源。</div>';
        renderGameplayAssetPreview(refs, env, null, entry);
        return;
    }
    if (!assets.length) {
        refs.gameplayAssetList.innerHTML = '<div class="empty-state">当前分类下还没有项目资源。上传后会写入 public/Arts/' + escapeHtml(assetType) + '/' + escapeHtml(cityContext.cityName) + '/</div>';
        renderGameplayAssetPreview(refs, env, null, entry);
        return;
    }
    refs.gameplayAssetList.innerHTML = assets.map(function (asset) {
        var isImage = isImageAssetPath(asset.publicUrl || asset.path);
        return [
            '<div class="list-item gameplay-asset-card' + (asset.id === getSelectedGameplayAssetId(env) ? ' active' : '') + '" data-asset-preview-id="' + escapeAttr(asset.id) + '">',
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
    renderGameplayAssetPreview(refs, env, getSelectedGameplayAsset(env, entry, assets), entry);
    env.renderExploreGameplayPanels();
}

function bindGameplayAsset(refs, env, assetId, bindKey) {
    var entry = getSelectedGameplayEntry(env);
    if (!entry) {
        env.setStatus('请先选择一个玩法条目', 'error');
        return;
    }
    var state = getState(env);
    var asset = ((state && state.editorAssetsCatalog) || []).find(function (item) { return item.id === assetId; });
    if (!asset) return;
    if (isGlobalExplorePlayerEntry(getActiveGameplayTab(env), entry) && bindKey === 'modelPath') {
        var playerCfg = getNormalizedGameAssetConfig(env);
        playerCfg.customPlayerModelUrl = asset.publicUrl || asset.path;
        syncExploreCharacterEntriesFromGlobal(env, ensureCityGameplayConfig(env, getGameplayCityContext(env)));
        setSelectedGameplayAssetId(env, asset.id);
        env.markDirty('已绑定探索角色模型');
        renderGameplayEditor(refs, env);
        return;
    }
    if (!entry.assetRefs || typeof entry.assetRefs !== 'object') entry.assetRefs = {};
    entry.assetRefs[bindKey] = asset.publicUrl || asset.path;
    if (bindKey === 'modelPath') entry.assetRefs.modelId = asset.id;
    if (bindKey === 'imagePath') entry.assetRefs.imageId = asset.id;
    entry.updatedAt = new Date().toISOString();
    setSelectedGameplayAssetId(env, asset.id);
    env.markDirty('已绑定项目资源');
    renderGameplayEditor(refs, env);
}

function handleGameplayFormInput(refs, env, target, options) {
    var commit = !(options && options.commit === false);
    var entry = getSelectedGameplayEntry(env);
    var list = getGameplayCollection(env);
    if (!entry || !list || !target) return;
    if (target.name === 'name') {
        entry.name = String(target.value || '').trim();
        if (refs.gameplayAssetName && !refs.gameplayAssetName.value) refs.gameplayAssetName.value = entry.name;
        env.markDirty('已更新玩法条目名称');
        renderGameplayEditor(refs, env);
        return;
    }
    if (target.name === 'id') {
        var nextId = ensureUniqueGameplayEntryId(env, list, target.value, entry.id);
        entry.id = nextId;
        setSelectedGameplayEntryId(env, nextId);
        if (refs.gameplayId && refs.gameplayId.value !== nextId) refs.gameplayId.value = nextId;
        env.markDirty('已更新玩法条目 ID');
        renderGameplayEditor(refs, env);
        return;
    }
    if (target.name === 'tags') {
        entry.tags = String(target.value || '').split(',').map(function (part) { return part.trim(); }).filter(Boolean);
        env.markDirty('已更新玩法标签');
        renderGameplayEntryList(refs, env, getFilteredGameplayEntries(refs, env), getGameplayCityContext(env));
        return;
    }
    if (target.name === 'rarity') {
        entry.rarity = String(target.value || '').trim();
        env.markDirty('已更新玩法稀有度');
        renderGameplayEntryList(refs, env, getFilteredGameplayEntries(refs, env), getGameplayCityContext(env));
        return;
    }
    if (target.name === 'summary') {
        entry.summary = String(target.value || '');
        env.markDirty('已更新玩法简介');
        renderGameplayEntryList(refs, env, getFilteredGameplayEntries(refs, env), getGameplayCityContext(env));
        return;
    }
    if (target.hasAttribute('data-gameplay-placement')) {
        entry.placement = normalizeGameplayPlacement(target.value);
        env.markDirty('已更新单位部署位置');
        renderGameplayEntryList(refs, env, getFilteredGameplayEntries(refs, env), getGameplayCityContext(env));
        return;
    }
    if (target.hasAttribute('data-gameplay-element')) {
        entry.element = String(target.value || '');
        env.markDirty('已更新属性');
        renderGameplayEntryList(refs, env, getFilteredGameplayEntries(refs, env), getGameplayCityContext(env));
        return;
    }
    if (target.hasAttribute('data-gameplay-effect-duration')) {
        var dv = Number(target.value);
        entry.effectDurationSec = Number.isFinite(dv) ? Math.min(120, Math.max(0.1, Math.round(dv * 10) / 10)) : 2;
        target.value = String(entry.effectDurationSec);
        env.markDirty('已更新效果持续时间');
        renderGameplayEditor(refs, env);
        return;
    }
    var checkboxGroups = [
        { attr: 'data-gameplay-function-tag', key: 'functionTags', message: '已更新功能定位' },
        { attr: 'data-gameplay-effect', key: 'effects', message: '已更新效果' },
        { attr: 'data-gameplay-cleanse-effect', key: 'cleanseEffects', message: '已更新可解除效果' }
    ];
    var taxRoot = getTaxonomyQueryRoot(refs);
    for (var i = 0; i < checkboxGroups.length; i += 1) {
        var group = checkboxGroups[i];
        if (target.hasAttribute(group.attr)) {
            entry[group.key] = taxRoot
                ? Array.from(taxRoot.querySelectorAll('input[' + group.attr + ']:checked')).map(function (input) {
                    return input.getAttribute(group.attr);
                }).filter(Boolean)
                : [];
            env.markDirty(group.message);
            renderGameplayEntryList(refs, env, getFilteredGameplayEntries(refs, env), getGameplayCityContext(env));
            return;
        }
    }
    if (target.hasAttribute('data-gameplay-stat')) {
        var statKey = target.getAttribute('data-gameplay-stat');
        var numeric = Number(target.value);
        if (!entry.stats || typeof entry.stats !== 'object') entry.stats = {};
        entry.stats[statKey] = Number.isFinite(numeric) ? numeric : 0;
        env.markDirty('已更新玩法数值');
    }
    if (target.id === 'gameplayModelScale') {
        if (!commit) return;
        var scaleVal = Number(target.value);
        if (!entry.assetRefs || typeof entry.assetRefs !== 'object') entry.assetRefs = {};
        if (Number.isFinite(scaleVal) && scaleVal >= 0.01 && scaleVal <= 1000) {
            entry.assetRefs.modelScale = scaleVal;
            env.markDirty('已更新模型缩放');
        } else {
            delete entry.assetRefs.modelScale;
            target.value = '1';
            env.markDirty('已重置模型缩放为默认值');
        }
    }
}

async function uploadGameplayAsset(refs, env, file) {
    var cityContext = getGameplayCityContext(env);
    if (!cityContext) {
        if (refs.gameplayAssetUpload) refs.gameplayAssetUpload.value = '';
        env.setStatus('请先选择一个城市关卡再上传资源', 'error');
        return;
    }
    var assetType = refs.gameplayAssetType
        ? refs.gameplayAssetType.value || GAMEPLAY_RESOURCE_CONFIG[getActiveGameplayTab(env)].assetType
        : GAMEPLAY_RESOURCE_CONFIG[getActiveGameplayTab(env)].assetType;
    var assetName = refs.gameplayAssetName && refs.gameplayAssetName.value
        ? refs.gameplayAssetName.value.trim()
        : file.name.replace(/\.[^.]+$/, '');
    try {
        env.setStatus('正在保存城市资源 ' + file.name + '…', 'idle');
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
                resourceKind: getActiveGameplayTab(env),
                assetName: assetName
            })
        });
        if (!response.ok) throw new Error('上传失败: ' + response.status);
        var payload = await response.json();
        var state = getState(env);
        var id = String(payload.id || uniqueCatalogId((state && state.editorAssetsCatalog) || [], slugify(cityContext.cityName + '-' + assetName) || 'editor-asset'));
        state.editorAssetsCatalog = state.editorAssetsCatalog || [];
        state.editorAssetsCatalog = state.editorAssetsCatalog.filter(function (item) { return item.id !== id; });
        state.editorAssetsCatalog.push({
            id: id,
            name: String(payload.name || assetName),
            assetType: String(payload.assetType || assetType),
            resourceKind: String(payload.resourceKind || getActiveGameplayTab(env)),
            cityCode: cityContext.cityCode,
            cityName: cityContext.cityName,
            path: String(payload.projectPath || ''),
            projectPath: String(payload.projectPath || ''),
            publicUrl: String(payload.publicUrl || ''),
            summary: cityContext.cityName + ' · ' + assetName,
            updatedAt: new Date().toISOString()
        });
        if (refs.gameplayAssetName) refs.gameplayAssetName.value = assetName;
        if (refs.gameplayAssetUpload) refs.gameplayAssetUpload.value = '';
        env.markDirty('已保存城市资源到项目');
        var selectedEntry = getSelectedGameplayEntry(env);
        if (selectedEntry) {
            var bindKey = /\.(png|jpg|jpeg|webp)$/i.test(file.name) ? 'imagePath' : 'modelPath';
            bindGameplayAsset(refs, env, id, bindKey);
        } else {
            renderGameplayEditor(refs, env);
        }
        env.setStatus('已保存到 ' + String(payload.projectPath || 'public/Arts'), 'success');
    } catch (error) {
        if (refs.gameplayAssetUpload) refs.gameplayAssetUpload.value = '';
        env.setStatus('城市资源保存失败: ' + error.message, 'error');
    }
}

function triggerGameplayCardImageUpload(refs, env) {
    var entry = getSelectedGameplayEntry(env);
    if (!entry || getActiveGameplayTab(env) !== 'cards') {
        env.setStatus('请先选择一张卡片', 'error');
        return false;
    }
    if (refs.gameplayAssetType && refs.gameplayAssetType.querySelector('option[value="Cards"]')) {
        refs.gameplayAssetType.value = 'Cards';
    }
    if (refs.gameplayAssetName) refs.gameplayAssetName.value = entry.name || '卡片';
    return true;
}

function clearGameplayCardImage(refs, env) {
    var entry = getSelectedGameplayEntry(env);
    if (!entry || getActiveGameplayTab(env) !== 'cards' || !entry.assetRefs || !entry.assetRefs.imagePath) return;
    delete entry.assetRefs.imagePath;
    delete entry.assetRefs.imageId;
    entry.updatedAt = new Date().toISOString();
    env.markDirty('已清除卡片图片');
    renderGameplayEditor(refs, env);
}

async function uploadGameplayTowerLocalModel(refs, env, file) {
    var entry = getSelectedGameplayEntry(env);
    var activeTab = getActiveGameplayTab(env);
    if (!entry || !gameplayTabSupportsDirectModelOverride(activeTab)) {
        env.setStatus('请先选择一个支持模型替换的玩法条目', 'error');
        if (refs.gameplayTowerModelUpload) refs.gameplayTowerModelUpload.value = '';
        return;
    }
    if (!getGameplayCityContext(env)) {
        env.setStatus('请先选择带城市信息的关卡', 'error');
        if (refs.gameplayTowerModelUpload) refs.gameplayTowerModelUpload.value = '';
        return;
    }
    try {
        env.setStatus('正在上传' + gameplayModelActionLabel(activeTab) + '模型…', 'idle');
        var url = await env.uploadFileToProjectUrl(file, { gameModelsUpload: true, gameModelsSubdir: gameplayModelSubdirForTab(activeTab) });
        if (!url) {
            env.setStatus('上传未返回可用 URL（需开发服务器与 game-models API）', 'error');
            if (refs.gameplayTowerModelUpload) refs.gameplayTowerModelUpload.value = '';
            return;
        }
        if (isGlobalExplorePlayerEntry(activeTab, entry)) {
            var playerCfg = getNormalizedGameAssetConfig(env);
            playerCfg.customPlayerModelUrl = url;
            syncExploreCharacterEntriesFromGlobal(env, ensureCityGameplayConfig(env, getGameplayCityContext(env)));
            setSelectedGameplayAssetId(env, '');
            env.markDirty('已更新探索角色模型');
            env.setStatus('已写入探索角色模型；运行时会直接使用该文件', 'success');
            if (refs.gameplayTowerModelUpload) refs.gameplayTowerModelUpload.value = '';
            renderGameplayEditor(refs, env);
            return;
        }
        if (!entry.assetRefs || typeof entry.assetRefs !== 'object') entry.assetRefs = {};
        entry.assetRefs.modelPath = url;
        delete entry.assetRefs.modelId;
        entry.updatedAt = new Date().toISOString();
        setSelectedGameplayAssetId(env, '');
        env.markDirty('已绑定本城' + gameplayModelActionLabel(activeTab) + '模型');
        env.setStatus('已写入本城' + gameplayModelActionLabel(activeTab) + '模型；保存后该城市将优先使用此文件', 'success');
        if (refs.gameplayTowerModelUpload) refs.gameplayTowerModelUpload.value = '';
        renderGameplayEditor(refs, env);
    } catch (err) {
        if (refs.gameplayTowerModelUpload) refs.gameplayTowerModelUpload.value = '';
        env.setStatus((err && err.message) || '上传失败', 'error');
    }
}

async function uploadGameplayAnimationAsset(refs, env, animationId, file) {
    var entry = getSelectedGameplayEntry(env);
    var activeTab = getActiveGameplayTab(env);
    if (!entry) {
        env.setStatus('请先选择一个玩法条目', 'error');
        return;
    }
    if (!gameplayAnimationFieldsForTab(activeTab).some(function (field) { return field.id === animationId; })) {
        env.setStatus('当前条目不支持该动画槽位', 'error');
        return;
    }
    try {
        env.setStatus('正在上传' + gameplayModelActionLabel(activeTab) + '动画…', 'idle');
        var url = await env.uploadFileToProjectUrl(file, {
            assetType: 'Animations',
            resourceKind: 'gameplay-' + activeTab + '-' + animationId,
            assetName: String(entry.id || activeTab) + '-' + animationId + '-animation'
        });
        if (!url) {
            env.setStatus('上传未返回可用 URL', 'error');
            return;
        }
        if (isGlobalExplorePlayerEntry(activeTab, entry)) {
            var playerCfg = getNormalizedGameAssetConfig(env);
            playerCfg.customAnimationUrls[animationId] = url;
            syncExploreCharacterEntriesFromGlobal(env, ensureCityGameplayConfig(env, getGameplayCityContext(env)));
            env.markDirty('已更新探索角色动画');
            env.setStatus('已绑定探索角色动画：' + modelBindShortLabel(url), 'success');
            renderGameplayEditor(refs, env);
            return;
        }
        ensureGameplayAnimationPaths(entry, activeTab)[animationId] = url;
        entry.updatedAt = new Date().toISOString();
        env.markDirty('已更新' + gameplayModelActionLabel(activeTab) + '动画');
        env.setStatus('已绑定动画：' + modelBindShortLabel(url), 'success');
        renderGameplayEditor(refs, env);
    } catch (error) {
        env.setStatus('动画上传失败: ' + ((error && error.message) || '未知错误'), 'error');
    }
}

function clearGameplayAnimationAsset(refs, env, animationId) {
    var entry = getSelectedGameplayEntry(env);
    var activeTab = getActiveGameplayTab(env);
    if (!entry) return;
    if (isGlobalExplorePlayerEntry(activeTab, entry)) {
        var cfg = getNormalizedGameAssetConfig(env);
        if (!cfg.customAnimationUrls[animationId]) return;
        delete cfg.customAnimationUrls[animationId];
        syncExploreCharacterEntriesFromGlobal(env, ensureCityGameplayConfig(env, getGameplayCityContext(env)));
        env.markDirty('已清除探索角色动画配置');
        renderGameplayEditor(refs, env);
        return;
    }
    var paths = ensureGameplayAnimationPaths(entry, activeTab);
    if (!paths[animationId]) return;
    delete paths[animationId];
    entry.updatedAt = new Date().toISOString();
    env.markDirty('已清除动画配置');
    renderGameplayEditor(refs, env);
}

function clearGameplayTowerLocalModel(refs, env) {
    var entry = getSelectedGameplayEntry(env);
    var activeTab = getActiveGameplayTab(env);
    if (!entry || !gameplayTabSupportsDirectModelOverride(activeTab)) return;
    if (isGlobalExplorePlayerEntry(activeTab, entry)) {
        var cfg = getNormalizedGameAssetConfig(env);
        if (!cfg.customPlayerModelUrl) return;
        cfg.customPlayerModelUrl = '';
        syncExploreCharacterEntriesFromGlobal(env, ensureCityGameplayConfig(env, getGameplayCityContext(env)));
        setSelectedGameplayAssetId(env, '');
        env.markDirty('已清除探索角色模型覆盖');
        renderGameplayEditor(refs, env);
        return;
    }
    if (!entry.assetRefs) return;
    if (!entry.assetRefs.modelPath && !entry.assetRefs.modelId) return;
    delete entry.assetRefs.modelPath;
    delete entry.assetRefs.modelId;
    entry.updatedAt = new Date().toISOString();
    setSelectedGameplayAssetId(env, '');
    env.markDirty('已清除本城' + gameplayModelActionLabel(activeTab) + '模型覆盖');
    renderGameplayEditor(refs, env);
}

export function ensureCityGameplayConfig(env, cityContext) {
    var state = getState(env);
    state.cityGameplayConfigs = state.cityGameplayConfigs || {};
    var resolvedKey = env.resolveCityGameplayConfigKey(cityContext);
    var created = !state.cityGameplayConfigs[resolvedKey];
    if (created) {
        var createdConfig = {
            cityCode: cityContext.cityCode,
            cityName: cityContext.cityName,
            aliases: mergeDistinctStrings(cityContext.cityName, cityContext.cityCode),
            enemies: buildDefaultEnemyEntries(cityContext),
            bosses: buildDefaultBossEntries(cityContext),
            towers: buildDefaultTowerEntries(cityContext),
            cards: [],
            items: buildDefaultDefenseItemEntries(cityContext),
            characters: buildExploreCharacterEntries(env, cityContext),
            skills: [],
            updatedAt: ''
        };
        createdConfig.cards = buildDefaultCardEntries(createdConfig);
        state.cityGameplayConfigs[resolvedKey] = createdConfig;
    }
    if (!Array.isArray(state.cityGameplayConfigs[resolvedKey].aliases)) {
        state.cityGameplayConfigs[resolvedKey].aliases = mergeDistinctStrings(
            cityContext.cityName,
            cityContext.cityCode,
            state.cityGameplayConfigs[resolvedKey].cityName,
            state.cityGameplayConfigs[resolvedKey].cityCode
        );
    }
    if (!Array.isArray(state.cityGameplayConfigs[resolvedKey].towers)) {
        state.cityGameplayConfigs[resolvedKey].towers = buildDefaultTowerEntries(state.cityGameplayConfigs[resolvedKey]);
    }
    if (!Array.isArray(state.cityGameplayConfigs[resolvedKey].cards)) {
        state.cityGameplayConfigs[resolvedKey].cards = buildDefaultCardEntries(state.cityGameplayConfigs[resolvedKey]);
    }
    if (!Array.isArray(state.cityGameplayConfigs[resolvedKey].items)) {
        state.cityGameplayConfigs[resolvedKey].items = buildDefaultDefenseItemEntries(state.cityGameplayConfigs[resolvedKey]);
    }
    if (!Array.isArray(state.cityGameplayConfigs[resolvedKey].enemies)) state.cityGameplayConfigs[resolvedKey].enemies = [];
    if (!state.cityGameplayConfigs[resolvedKey].enemies.length) {
        state.cityGameplayConfigs[resolvedKey].enemies = buildDefaultEnemyEntries(state.cityGameplayConfigs[resolvedKey]);
    }
    if (!Array.isArray(state.cityGameplayConfigs[resolvedKey].bosses) || !state.cityGameplayConfigs[resolvedKey].bosses.length) {
        state.cityGameplayConfigs[resolvedKey].bosses = buildDefaultBossEntries(state.cityGameplayConfigs[resolvedKey]);
    }
    syncExploreCharacterEntriesFromGlobal(env, state.cityGameplayConfigs[resolvedKey]);
    if (!Array.isArray(state.cityGameplayConfigs[resolvedKey].skills)) state.cityGameplayConfigs[resolvedKey].skills = [];
    if (!Array.isArray(state.cityGameplayConfigs[resolvedKey].cards) || !state.cityGameplayConfigs[resolvedKey].cards.length) {
        state.cityGameplayConfigs[resolvedKey].cards = buildDefaultCardEntries(state.cityGameplayConfigs[resolvedKey]);
    }
    return state.cityGameplayConfigs[resolvedKey];
}

export function getCurrentCityGameplayConfig(env) {
    var cityContext = getGameplayCityContext(env);
    return cityContext ? ensureCityGameplayConfig(env, cityContext) : null;
}

function buildGameplayEnemyTypes(env) {
    var cityContext = getGameplayCityContext(env);
    var config = cityContext ? ensureCityGameplayConfig(env, cityContext) : null;
    if (!config) return [];
    return config.enemies.map(function (entry) {
        var scale = entry.assetRefs ? Number(entry.assetRefs.modelScale) : NaN;
        return {
            id: entry.id,
            name: entry.name,
            modelId: entry.assetRefs && entry.assetRefs.modelId ? entry.assetRefs.modelId : '',
            modelPath: entry.assetRefs && entry.assetRefs.modelPath ? entry.assetRefs.modelPath : '',
            modelScale: Number.isFinite(scale) && scale > 0 ? scale : 1,
            hp: Number(entry.stats && entry.stats.hp) || 100,
            speed: Number(entry.stats && entry.stats.speed) || 1,
            reward: Number(entry.stats && entry.stats.reward) || 20,
            source: 'cityGameplay'
        };
    });
}

export function getAvailableEnemyTypes(env, level) {
    var localEnemies = Array.isArray(level && level.enemyTypes) ? level.enemyTypes : [];
    var cityEnemies = buildGameplayEnemyTypes(env);
    var merged = [];
    cityEnemies.concat(localEnemies).forEach(function (enemy) {
        if (!enemy || !enemy.id || merged.some(function (item) { return item.id === enemy.id; })) return;
        merged.push(enemy);
    });
    return merged;
}

export function buildGameplayActorTemplates(env) {
    var cityContext = getGameplayCityContext(env);
    var config = cityContext ? ensureCityGameplayConfig(env, cityContext) : null;
    if (!config) return [];
    return ['enemies', 'bosses', 'skills'].flatMap(function (kind) {
        return config[kind].map(function (entry) {
            var category = kind === 'skills' ? 'model' : 'enemy';
            return {
                id: 'city-template-' + kind + '-' + entry.id,
                name: entry.name,
                category: category,
                modelId: entry.assetRefs && entry.assetRefs.modelId ? entry.assetRefs.modelId : '',
                modelPath: entry.assetRefs && entry.assetRefs.modelPath ? entry.assetRefs.modelPath : '',
                templateModelScale: 1,
                icon: kind === 'bosses' ? 'B' : kind === 'enemies' ? 'E' : 'S',
                source: 'cityGameplay',
                sourceEntryId: entry.id,
                sourceKind: kind,
                stats: Object.assign({ hp: 100, attack: 0, range: 1, fireRate: 0, cost: 0, cooldown: 0 }, entry.stats || {})
            };
        });
    });
}

export function getAvailableActorTemplates(env) {
    var state = getState(env);
    var merged = [];
    (state.actorTemplates || []).concat(buildGameplayActorTemplates(env)).forEach(function (template) {
        if (!template || !template.id || merged.some(function (item) { return item.id === template.id; })) return;
        merged.push(template);
    });
    return merged;
}

export function findActorTemplate(env, templateId) {
    var state = getState(env);
    return getAvailableActorTemplates(env).find(function (item) { return item.id === templateId; }) || state.actorTemplates[0];
}

export function createGameplayEntry(refs, env) {
    var activeTab = getActiveGameplayTab(env);
    if (activeTab === 'waves') {
        env.setStatus('请在右侧波次管理器里新增波次。', 'error');
        return;
    }
    var cityContext = getGameplayCityContext(env);
    if (!cityContext) {
        env.setStatus('请先选择一个城市关卡。', 'error');
        return;
    }
    var config = ensureCityGameplayConfig(env, cityContext);
    if (activeTab === 'characters') {
        env.setStatus('探索角色页直接映射当前项目主角，不支持新增条目', 'error');
        return;
    }
    var kindLabel = GAMEPLAY_RESOURCE_CONFIG[activeTab].label;
    var id = uniqueGameplayEntryId(config[activeTab], slugify(cityContext.cityName + '-' + kindLabel) || activeTab);
    config[activeTab].push({
        id: id,
        name: cityContext.cityName + '·新' + kindLabel,
        summary: '',
        tags: [cityContext.cityName],
        rarity: 'common',
        placement: activeTab === 'towers' ? 'roadside' : '',
        element: '',
        functionTags: [],
        effects: [],
        cleanseEffects: activeTab === 'items' ? ['electromagneticInterference'] : [],
        effectDurationSec: 2,
        stats: {},
        assetRefs: createGameplayAssetRefsForTab(activeTab),
        cityCode: cityContext.cityCode,
        cityName: cityContext.cityName,
        updatedAt: new Date().toISOString()
    });
    setSelectedGameplayEntryId(env, id);
    env.markDirty('已新增' + kindLabel + '条目');
    renderGameplayEditor(refs, env);
}

export function duplicateGameplayEntry(refs, env) {
    var collection = getGameplayCollection(env);
    var entry = getSelectedGameplayEntry(env);
    if (getActiveGameplayTab(env) === 'characters') return;
    if (!collection || !entry) return;
    var copy = JSON.parse(JSON.stringify(entry));
    copy.id = uniqueGameplayEntryId(collection, entry.id + '-copy');
    copy.name = entry.name + ' 复制';
    copy.updatedAt = new Date().toISOString();
    var index = collection.findIndex(function (item) { return item.id === entry.id; });
    collection.splice(index + 1, 0, copy);
    setSelectedGameplayEntryId(env, copy.id);
    setSelectedGameplayAssetId(env, '');
    env.markDirty('已复制玩法条目');
    renderGameplayEditor(refs, env);
}

export function deleteGameplayEntry(refs, env) {
    var collection = getGameplayCollection(env);
    var entry = getSelectedGameplayEntry(env);
    if (getActiveGameplayTab(env) === 'characters') return;
    if (!collection || !entry) return;
    if (!window.confirm('确定删除「' + entry.name + '」吗？')) return;
    var index = collection.findIndex(function (item) { return item.id === entry.id; });
    if (index === -1) return;
    collection.splice(index, 1);
    setSelectedGameplayEntryId(env, collection[index] ? collection[index].id : collection[index - 1] ? collection[index - 1].id : '');
    setSelectedGameplayAssetId(env, '');
    env.markDirty('已删除玩法条目');
    renderGameplayEditor(refs, env);
}

export function moveGameplayEntry(refs, env, direction) {
    var collection = getGameplayCollection(env);
    var entry = getSelectedGameplayEntry(env);
    if (getActiveGameplayTab(env) === 'characters') return;
    if (!collection || !entry || !direction) return;
    var index = collection.findIndex(function (item) { return item.id === entry.id; });
    var targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= collection.length) return;
    var moved = collection.splice(index, 1)[0];
    collection.splice(targetIndex, 0, moved);
    setSelectedGameplayEntryId(env, moved.id);
    env.markDirty(direction < 0 ? '已上移玩法条目' : '已下移玩法条目');
    renderGameplayEditor(refs, env);
}

export function renderGameplayEditor(refs, env) {
    var cityContext = getGameplayCityContext(env);
    if (getActiveGameplayTab(env) === 'waves') {
        if (refs.gameplayCityTitle) refs.gameplayCityTitle.textContent = '项目关卡 · 波次管理器';
        if (refs.gameplayCityMeta) refs.gameplayCityMeta.textContent = '统一管理全部关卡的波次配置。出生点负责入口和路径，刷怪内容统一收敛到波次规则。';
        renderGameplayWavesTab(refs, env);
        return;
    }
    setGameplayWaveWorkbenchMode(refs, false);
    setGameplayStandardFormVisible(refs, true);
    var config = cityContext ? ensureCityGameplayConfig(env, cityContext) : null;
    if (config) {
        var preferredTab = normalizeGameplayTabId(pickPreferredGameplayTab(config, getActiveGameplayTab(env)));
        if (preferredTab !== getActiveGameplayTab(env)) {
            setActiveGameplayTab(env, preferredTab);
            updateGameplayTabUi(refs, env);
        }
    }
    var collection = config ? config[getActiveGameplayTab(env)] : [];
    var keyword = refs.gameplaySearch ? String(refs.gameplaySearch.value || '').trim().toLowerCase() : '';
    var filtered = collection.filter(function (entry) {
        if (!keyword) return true;
        var haystack = [entry.name, entry.id, entry.summary].concat(entry.tags || []).join(' ').toLowerCase();
        return haystack.indexOf(keyword) !== -1;
    });
    if (refs.gameplayCityTitle) {
        refs.gameplayCityTitle.textContent = cityContext ? cityContext.cityName + ' · 卡片/玩法编辑器' : '请选择带城市信息的关卡';
    }
    if (refs.gameplayCityMeta) {
        refs.gameplayCityMeta.textContent = cityContext
            ? '当前城市代码：' + cityContext.cityCode + '，保存后会写入该关卡可用敌人、Boss、防御塔、卡片、道具与城市资源；探索主角 tab 会直接映射当前项目的探索角色。'
            : '先在左侧选择一个城市关卡，然后维护该关卡的敌人、Boss、防御塔、卡片与道具；探索主角 tab 会直接映射当前项目的探索角色。';
    }
    if (refs.gameplayOverviewStats) {
        refs.gameplayOverviewStats.innerHTML = cityContext
            ? [
                { label: '敌人', value: config.enemies.length },
                { label: 'Boss', value: config.bosses.length },
                { label: '防御塔', value: config.towers.length },
                { label: '卡片', value: config.cards.length },
                { label: '探索角色', value: config.characters.length },
                { label: '道具', value: config.items.length }
            ].map(function (card) {
                return '<div class="stat-card"><strong>' + escapeHtml(String(card.value)) + '</strong><span>' + escapeHtml(card.label) + '</span></div>';
            }).join('')
            : '';
    }
    renderGameplayEntryList(refs, env, filtered, cityContext);
    renderGameplayForm(refs, env, filtered, cityContext, config);
    renderGameplayInspector(refs, env, cityContext, config, filtered);
}

export function bindGameplayUi(refs, env) {
    var root = refs.gameplayWorkbench || refs.gameplayInspectorWorkspace || refs.gameplayEntryList;
    if (!root || root.dataset.gameplayUiBound === '1') return;
    root.dataset.gameplayUiBound = '1';

    if (refs.gameplayResourceTabs) {
        refs.gameplayResourceTabs.addEventListener('click', function (event) {
            var button = event.target.closest('[data-gameplay-tab]');
            if (!button) return;
            setActiveGameplayTab(env, button.getAttribute('data-gameplay-tab') || 'enemies');
            setSelectedGameplayEntryId(env, '');
            setSelectedGameplayAssetId(env, '');
            updateGameplayTabUi(refs, env);
            renderGameplayEditor(refs, env);
        });
    }
    if (refs.gameplaySearch) refs.gameplaySearch.addEventListener('input', function () { renderGameplayEditor(refs, env); });
    if (refs.btnCreateGameplayEntry) refs.btnCreateGameplayEntry.addEventListener('click', function () { createGameplayEntry(refs, env); });
    if (refs.btnDuplicateGameplayEntry) refs.btnDuplicateGameplayEntry.addEventListener('click', function () { duplicateGameplayEntry(refs, env); });
    if (refs.btnDeleteGameplayEntry) refs.btnDeleteGameplayEntry.addEventListener('click', function () { deleteGameplayEntry(refs, env); });
    if (refs.btnMoveGameplayUp) refs.btnMoveGameplayUp.addEventListener('click', function () { moveGameplayEntry(refs, env, -1); });
    if (refs.btnMoveGameplayDown) refs.btnMoveGameplayDown.addEventListener('click', function () { moveGameplayEntry(refs, env, 1); });

    if (refs.gameplayEntryList) {
        refs.gameplayEntryList.addEventListener('click', function (event) {
            var waveLevelButton = event.target.closest('[data-gameplay-wave-level-id]');
            if (waveLevelButton) {
                event.stopPropagation();
                if (typeof env.selectLevel === 'function') env.selectLevel(waveLevelButton.getAttribute('data-gameplay-wave-level-id') || '');
                renderGameplayEditor(refs, env);
                return;
            }
            var menuToggle = event.target.closest('[data-gameplay-menu-toggle]');
            if (menuToggle) {
                event.stopPropagation();
                var wrap = menuToggle.closest('.gameplay-entry-menu-anchor');
                var menu = wrap && wrap.querySelector('.gameplay-entry-menu');
                var expanded = menuToggle.getAttribute('aria-expanded') === 'true';
                closeAllGameplayEntryMenus(refs);
                if (!expanded && menu) {
                    menuToggle.setAttribute('aria-expanded', 'true');
                    menu.classList.remove('view-hidden');
                }
                return;
            }
            var actionButton = event.target.closest('[data-gameplay-action]');
            if (actionButton) {
                event.stopPropagation();
                var action = actionButton.getAttribute('data-gameplay-action');
                var id = actionButton.getAttribute('data-gameplay-entry-id') || '';
                setSelectedGameplayEntryId(env, id);
                closeAllGameplayEntryMenus(refs);
                if (action === 'duplicate') duplicateGameplayEntry(refs, env);
                if (action === 'delete') deleteGameplayEntry(refs, env);
                if (action === 'move-up') moveGameplayEntry(refs, env, -1);
                if (action === 'move-down') moveGameplayEntry(refs, env, 1);
                return;
            }
            var selectBtn = event.target.closest('[data-gameplay-select-id]');
            if (!selectBtn) return;
            event.stopPropagation();
            setSelectedGameplayEntryId(env, selectBtn.getAttribute('data-gameplay-select-id') || '');
            setSelectedGameplayAssetId(env, '');
            closeAllGameplayEntryMenus(refs);
            renderGameplayEditor(refs, env);
        });
    }

    document.addEventListener('click', function (event) {
        if (env.getActiveWorkbench() !== 'gameplay') return;
        if (!refs.gameplayEntryList) return;
        if (event.target.closest('.gameplay-entry-menu-anchor')) return;
        closeAllGameplayEntryMenus(refs);
    });

    if (refs.gameplayEditorForm) {
        refs.gameplayEditorForm.addEventListener('click', function (event) {
            var clearButton = event.target.closest('[data-gameplay-animation-clear]');
            if (!clearButton) return;
            clearGameplayAnimationAsset(refs, env, clearButton.getAttribute('data-gameplay-animation-clear') || '');
        });
        refs.gameplayEditorForm.addEventListener('input', function (event) {
            handleGameplayFormInput(refs, env, event.target);
        });
        refs.gameplayEditorForm.addEventListener('change', function (event) {
            var target = event.target;
            var uploadId = target && target.getAttribute ? target.getAttribute('data-gameplay-animation-upload') : '';
            if (uploadId) {
                var file = target.files && target.files[0];
                if (file) void uploadGameplayAnimationAsset(refs, env, uploadId, file);
                if (target) target.value = '';
                return;
            }
            handleGameplayFormInput(refs, env, event.target);
        });
    }
    if (refs.gameplayAssetType) refs.gameplayAssetType.addEventListener('change', function () { renderGameplayEditor(refs, env); });
    if (refs.gameplayAssetUpload) {
        refs.gameplayAssetUpload.addEventListener('change', function () {
            if (refs.gameplayAssetUpload.files && refs.gameplayAssetUpload.files[0]) {
                uploadGameplayAsset(refs, env, refs.gameplayAssetUpload.files[0]);
            }
        });
    }
    root.addEventListener('click', function (event) {
        var actionButton = event.target.closest('[data-gameplay-card-action]');
        if (!actionButton) return;
        var action = actionButton.getAttribute('data-gameplay-card-action') || '';
        if (action === 'clear') clearGameplayCardImage(refs, env);
        if (action === 'toggle-ai') {
            gameplayCardImageAiState.open = !gameplayCardImageAiState.open;
            renderGameplayEditor(refs, env);
        }
        if (action === 'generate-ai') {
            void generateGameplayCardImage(refs, env);
        }
        if (action === 'open-ai-location') {
            var cityContext = getGameplayCityContext(env);
            var openPath = gameplayCardImageAiOpenPath(env, cityContext);
            if (!openPath || typeof env.revealProjectPathInExplorer !== 'function') return;
            void env.revealProjectPathInExplorer(openPath).catch(function (error) {
                env.setStatus((error && error.message) || '打开卡图保存位置失败', 'error');
            });
        }
        return;
    });
    root.addEventListener('click', function (event) {
        var presetButton = event.target.closest('[data-gameplay-card-ai-preset]');
        if (!presetButton) return;
        var cityContext = getGameplayCityContext(env);
        var entry = getSelectedGameplayEntry(env);
        if (!cityContext || !entry || getActiveGameplayTab(env) !== 'cards') return;
        var presetId = presetButton.getAttribute('data-gameplay-card-ai-preset') || '';
        var presets = buildGameplayCardImagePromptPresets(entry, cityContext);
        var preset = presets.find(function (item) { return item.id === presetId; });
        if (!preset) return;
        gameplayCardImageAiState.open = true;
        gameplayCardImageAiState.prompt = preset.prompt;
        gameplayCardImageAiState.lastPresetId = preset.id;
        gameplayCardImageAiState.statusText = '已填入「' + preset.title + '」提示词。';
        gameplayCardImageAiState.statusTone = 'idle';
        renderGameplayEditor(refs, env);
    });
    root.addEventListener('input', function (event) {
        var scaleInput = event.target && event.target.closest ? event.target.closest('#gameplayModelScale') : null;
        if (scaleInput) {
            handleGameplayFormInput(refs, env, scaleInput, { commit: false });
            return;
        }
        var promptInput = event.target.closest('[data-gameplay-card-ai-prompt]');
        if (!promptInput) return;
        gameplayCardImageAiState.prompt = String(promptInput.value || '');
        if (!gameplayCardImageAiState.generating) {
            gameplayCardImageAiState.statusText = '可继续修改提示词，然后生成替换当前卡图。';
            gameplayCardImageAiState.statusTone = 'idle';
        }
        if (refs.btnGenerateGameplayCardAi) {
            refs.btnGenerateGameplayCardAi.disabled = !String(gameplayCardImageAiState.prompt || '').trim() || gameplayCardImageAiState.generating;
        }
    });
    root.addEventListener('keydown', function (event) {
        var promptInput = event.target.closest('[data-gameplay-card-ai-prompt]');
        if (!promptInput) return;
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            void generateGameplayCardImage(refs, env);
        }
    });
    root.addEventListener('change', function (event) {
        var scaleInput = event.target && event.target.closest ? event.target.closest('#gameplayModelScale') : null;
        if (scaleInput) {
            handleGameplayFormInput(refs, env, scaleInput);
            return;
        }
        var uploadInput = event.target.closest('[data-gameplay-card-upload]');
        if (!uploadInput) return;
        var file = uploadInput.files && uploadInput.files[0];
        if (!file) return;
        if (triggerGameplayCardImageUpload(refs, env)) {
            void uploadGameplayAsset(refs, env, file);
        }
        uploadInput.value = '';
    });
    if (refs.gameplayAssetList) {
        refs.gameplayAssetList.addEventListener('click', function (event) {
            var previewCard = event.target.closest('[data-asset-preview-id]');
            if (previewCard && !event.target.closest('[data-asset-bind]')) {
                setSelectedGameplayAssetId(env, previewCard.getAttribute('data-asset-preview-id') || '');
                renderGameplayEditor(refs, env);
                return;
            }
            var button = event.target.closest('[data-asset-bind]');
            if (!button) return;
            bindGameplayAsset(refs, env, button.getAttribute('data-asset-id') || '', button.getAttribute('data-asset-bind') || 'imagePath');
        });
    }
    if (refs.gameplayTowerModelUpload) {
        refs.gameplayTowerModelUpload.addEventListener('change', function () {
            var f = refs.gameplayTowerModelUpload.files && refs.gameplayTowerModelUpload.files[0];
            if (f) void uploadGameplayTowerLocalModel(refs, env, f);
        });
    }
    if (refs.gameplayAiModelImageUpload) {
        refs.gameplayAiModelImageUpload.addEventListener('change', function () {
            var imageFile = refs.gameplayAiModelImageUpload.files && refs.gameplayAiModelImageUpload.files[0];
            if (imageFile) void startGameplayModelAiGeneration(refs, env, imageFile);
        });
    }
    if (refs.btnClearGameplayTowerModel) {
        refs.btnClearGameplayTowerModel.addEventListener('click', function () {
            clearGameplayTowerLocalModel(refs, env);
        });
    }
    if (refs.btnOpenGameplayTowerModelLocation && refs.btnOpenGameplayTowerModelLocation.dataset.bound !== '1') {
        refs.btnOpenGameplayTowerModelLocation.dataset.bound = '1';
        refs.btnOpenGameplayTowerModelLocation.addEventListener('click', function () {
            var cityContext = getGameplayCityContext(env);
            var tab = getActiveGameplayTab(env);
            var selEntry = getSelectedGameplayEntry(env);
            var p = gameplayTowerModelRevealProjectPath(env, cityContext, selEntry, tab);
            if (!p) {
                env.setStatus('请先选择敌人 / 防御塔 / 道具 / 角色条目，并选择带城市信息的关卡', 'error');
                return;
            }
            if (typeof env.revealProjectPathInExplorer !== 'function') {
                env.setStatus('当前环境不支持在资源管理器中打开路径', 'error');
                return;
            }
            void env.revealProjectPathInExplorer(p).catch(function (err) {
                env.setStatus((err && err.message) || '打开资源管理器失败', 'error');
            });
        });
    }
    if (refs.btnPickGameplayTowerProjectModel) {
        refs.btnPickGameplayTowerProjectModel.addEventListener('click', function () {
            openGameplayTowerProjectModelPicker(refs, env);
        });
    }
    if (refs.gameplayTowerModelPickModal && refs.gameplayTowerModelPickModal.dataset.gpPickBound !== '1') {
        refs.gameplayTowerModelPickModal.dataset.gpPickBound = '1';
        refs.gameplayTowerModelPickModal.addEventListener('click', function (e) {
            if (e.target === refs.gameplayTowerModelPickModal) closeGameplayTowerModelPickModal(refs);
        });
        refs.gameplayTowerModelPickModal.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeGameplayTowerModelPickModal(refs);
        });
        if (refs.btnCancelGameplayTowerModelPick) {
            refs.btnCancelGameplayTowerModelPick.addEventListener('click', function () {
                closeGameplayTowerModelPickModal(refs);
            });
        }
        if (refs.btnCloseGameplayTowerModelPick) {
            refs.btnCloseGameplayTowerModelPick.addEventListener('click', function () {
                closeGameplayTowerModelPickModal(refs);
            });
        }
        if (refs.gameplayTowerModelPickFilter) {
            refs.gameplayTowerModelPickFilter.addEventListener('input', function () {
                renderGameplayTowerModelPickList(refs, env, refs.gameplayTowerModelPickFilter.value);
            });
        }
        if (refs.gameplayTowerModelPickList) {
            refs.gameplayTowerModelPickList.addEventListener('click', function (e) {
                var btn = e.target.closest('.gameplay-tower-pick-item');
                if (!btn) return;
                var url = btn.getAttribute('data-pick-model-url') || '';
                var mid = btn.getAttribute('data-pick-model-id') || '';
                applyPickedGameplayTowerModel(refs, env, url, mid);
            });
        }
    }
}
