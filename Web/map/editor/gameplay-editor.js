import { escapeAttr, escapeHtml, fileToBase64, slugify, uid } from './utils.js';
import { GAMEPLAY_RESOURCE_CONFIG } from './content.js';
import { DEFENSE_ELEMENT_OPTIONS, DEFENSE_FUNCTION_OPTIONS, DEFENSE_STATUS_OPTIONS } from './content.js';
import {
    normalizeGameplayPlacement,
    mergeDistinctStrings,
    buildDefaultEnemyEntries,
    buildDefaultTowerEntries,
    buildDefaultCardEntries,
    buildDefaultDefenseItemEntries
} from './normalizers.js';
import { gameplayPlacementLabel, isImageAssetPath, isModelAssetPath, modelBindShortLabel, pickPreferredGameplayTab, uniqueCatalogId } from './display-utils.js';
import { uniqueGameplayEntryId } from './id-utils.js';
import { projectPathFromVideoPublicUrl as publicUrlToProjectPath } from './cutscene-utils.js';

var GAMEPLAY_MODEL_SUBDIR_BY_TAB = {
    enemies: 'Enemy',
    towers: 'Tower',
    items: 'Props',
    characters: 'Charactor'
};

function gameplayTabSupportsDirectModelOverride(activeTab) {
    return !!GAMEPLAY_MODEL_SUBDIR_BY_TAB[String(activeTab || '')];
}

function gameplayModelSubdirForTab(activeTab) {
    return GAMEPLAY_MODEL_SUBDIR_BY_TAB[String(activeTab || '')] || 'Props';
}

function gameplayModelActionLabel(activeTab) {
    return GAMEPLAY_RESOURCE_CONFIG[activeTab] ? GAMEPLAY_RESOURCE_CONFIG[activeTab].label : '资源';
}

var gameplayModelAiGenerationState = null;
var gameplayModelAiPollTimer = 0;

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
        if (!targetEntry.assetRefs || typeof targetEntry.assetRefs !== 'object') targetEntry.assetRefs = {};
        targetEntry.assetRefs.modelPath = String(payload.publicUrl || '');
        delete targetEntry.assetRefs.modelId;
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
    return env.getActiveGameplayTab() || 'enemies';
}

function setActiveGameplayTab(env, tabId) {
    env.setActiveGameplayTab(tabId || 'enemies');
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
        item.classList.toggle('active', item.getAttribute('data-gameplay-tab') === getActiveGameplayTab(env));
    });
}

function getGameplayCollection(env) {
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
    var cityContext = getGameplayCityContext(env);
    var collection = cityContext ? ensureCityGameplayConfig(env, cityContext)[getActiveGameplayTab(env)] : [];
    var keyword = refs.gameplaySearch ? String(refs.gameplaySearch.value || '').trim().toLowerCase() : '';
    return collection.filter(function (entry) {
        if (!keyword) return true;
        var haystack = [entry.name, entry.id, entry.summary].concat(entry.tags || []).join(' ').toLowerCase();
        return haystack.indexOf(keyword) !== -1;
    });
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
        modelSourceLabel = '本城玩法条目';
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
    var supportsElement = activeTab === 'enemies' || activeTab === 'towers' || activeTab === 'characters' || activeTab === 'skills';
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
    var supportsFunctions = activeTab === 'towers' || activeTab === 'characters' || activeTab === 'skills';
    var supportsEffects = activeTab === 'enemies' || activeTab === 'towers' || activeTab === 'characters' || activeTab === 'skills';
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
            '      <div class="gameplay-entry-menu-anchor">',
            '        <button type="button" class="mini-button gameplay-entry-ops-btn" data-gameplay-menu-toggle aria-expanded="false">操作</button>',
            '        <div class="gameplay-entry-menu view-hidden" role="menu">',
            '          <button type="button" role="menuitem" class="gameplay-entry-menu-item" data-gameplay-action="move-up" data-gameplay-entry-id="' + escapeAttr(entry.id) + '">上移</button>',
            '          <button type="button" role="menuitem" class="gameplay-entry-menu-item" data-gameplay-action="move-down" data-gameplay-entry-id="' + escapeAttr(entry.id) + '">下移</button>',
            '          <button type="button" role="menuitem" class="gameplay-entry-menu-item" data-gameplay-action="duplicate" data-gameplay-entry-id="' + escapeAttr(entry.id) + '">复制</button>',
            '          <button type="button" role="menuitem" class="gameplay-entry-menu-item danger" data-gameplay-action="delete" data-gameplay-entry-id="' + escapeAttr(entry.id) + '">删除</button>',
            '        </div>',
            '      </div>',
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
    if (refs.gameplayEditorTitle) refs.gameplayEditorTitle.textContent = entry ? entry.name : (GAMEPLAY_RESOURCE_CONFIG[getActiveGameplayTab(env)].label + '详情');
    if (refs.gameplayEditorHint) refs.gameplayEditorHint.textContent = cityContext ? cityContext.cityName + ' · ' + GAMEPLAY_RESOURCE_CONFIG[getActiveGameplayTab(env)].label : '城市玩法配置';
    if (refs.gameplayName) refs.gameplayName.value = entry ? entry.name : '';
    if (refs.gameplayId) refs.gameplayId.value = entry ? entry.id : '';
    if (refs.gameplayTags) refs.gameplayTags.value = entry ? (entry.tags || []).join(', ') : '';
    if (refs.gameplayRarity) refs.gameplayRarity.value = entry ? entry.rarity : '';
    if (refs.gameplaySummary) refs.gameplaySummary.value = entry ? entry.summary : '';
    [refs.gameplayName, refs.gameplayId, refs.gameplayTags, refs.gameplayRarity, refs.gameplaySummary].forEach(function (field) {
        if (field) field.disabled = disabled;
    });
    setGameplayEntryActionButtons(refs, disabled, entries, entry);
    if (refs.gameplayStatGrid) {
        var activeTab = getActiveGameplayTab(env);
        var statsHtml = GAMEPLAY_RESOURCE_CONFIG[activeTab].stats.map(function (field) {
            var value = entry && entry.stats ? entry.stats[field.key] : '';
            return [
                '<label class="field-block">',
                '  <span>' + escapeHtml(field.label) + '</span>',
                '  <input type="number" data-gameplay-stat="' + escapeAttr(field.key) + '" step="' + escapeAttr(field.step) + '" value="' + escapeAttr(value === '' || value == null ? '' : String(value)) + '"' + (disabled ? ' disabled' : '') + '>',
                '</label>'
            ].join('');
        }).join('');
        var placementHtml = activeTab === 'characters' || activeTab === 'towers'
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
            : '先从左侧关卡树选择一个城市关卡，再在这里维护该关卡的敌人、防御塔、卡片、角色和技能。';
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
                [['敌人', config.enemies.length], ['防御塔', config.towers.length], ['卡片', config.cards.length], ['角色', config.characters.length], ['技能', config.skills.length], ['道具', config.items.length]].map(function (pair) {
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
    if (!entry.assetRefs || typeof entry.assetRefs !== 'object') entry.assetRefs = {};
    entry.assetRefs[bindKey] = asset.publicUrl || asset.path;
    if (bindKey === 'modelPath') entry.assetRefs.modelId = asset.id;
    if (bindKey === 'imagePath') entry.assetRefs.imageId = asset.id;
    entry.updatedAt = new Date().toISOString();
    setSelectedGameplayAssetId(env, asset.id);
    env.markDirty('已绑定项目资源');
    renderGameplayEditor(refs, env);
}

function handleGameplayFormInput(refs, env, target) {
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

function clearGameplayTowerLocalModel(refs, env) {
    var entry = getSelectedGameplayEntry(env);
    var activeTab = getActiveGameplayTab(env);
    if (!entry || !gameplayTabSupportsDirectModelOverride(activeTab)) return;
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
        state.cityGameplayConfigs[resolvedKey] = {
            cityCode: cityContext.cityCode,
            cityName: cityContext.cityName,
            aliases: mergeDistinctStrings(cityContext.cityName, cityContext.cityCode),
            enemies: buildDefaultEnemyEntries(cityContext),
            towers: buildDefaultTowerEntries(cityContext),
            cards: buildDefaultCardEntries(cityContext),
            items: buildDefaultDefenseItemEntries(cityContext),
            characters: [],
            skills: [],
            updatedAt: ''
        };
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
    if (!Array.isArray(state.cityGameplayConfigs[resolvedKey].characters)) state.cityGameplayConfigs[resolvedKey].characters = [];
    if (!Array.isArray(state.cityGameplayConfigs[resolvedKey].skills)) state.cityGameplayConfigs[resolvedKey].skills = [];
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
    var cityContext = getGameplayCityContext(env);
    if (!cityContext) {
        env.setStatus('请先选择一个城市关卡。', 'error');
        return;
    }
    var config = ensureCityGameplayConfig(env, cityContext);
    var activeTab = getActiveGameplayTab(env);
    var kindLabel = GAMEPLAY_RESOURCE_CONFIG[activeTab].label;
    var id = uniqueGameplayEntryId(config[activeTab], slugify(cityContext.cityName + '-' + kindLabel) || activeTab);
    config[activeTab].push({
        id: id,
        name: cityContext.cityName + '·新' + kindLabel,
        summary: '',
        tags: [cityContext.cityName],
        rarity: 'common',
        placement: activeTab === 'characters' || activeTab === 'towers' ? 'roadside' : '',
        element: '',
        functionTags: [],
        effects: [],
        cleanseEffects: activeTab === 'items' ? ['electromagneticInterference'] : [],
        effectDurationSec: 2,
        stats: {},
        assetRefs: {},
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
    var config = cityContext ? ensureCityGameplayConfig(env, cityContext) : null;
    if (config) {
        var preferredTab = pickPreferredGameplayTab(config, getActiveGameplayTab(env));
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
            ? '当前城市代码：' + cityContext.cityCode + '，保存后会写入该关卡可用卡片、防御塔与城市资源。'
            : '先在左侧选择一个城市关卡，然后维护该关卡的敌人、防御塔、卡片、角色和技能。';
    }
    if (refs.gameplayOverviewStats) {
        refs.gameplayOverviewStats.innerHTML = cityContext
            ? [
                { label: '敌人', value: config.enemies.length },
                { label: '防御塔', value: config.towers.length },
                { label: '卡片', value: config.cards.length },
                { label: '角色', value: config.characters.length },
                { label: '技能', value: config.skills.length },
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
        refs.gameplayEditorForm.addEventListener('input', function (event) {
            handleGameplayFormInput(refs, env, event.target);
        });
        refs.gameplayEditorForm.addEventListener('change', function (event) {
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
