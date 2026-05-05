import { escapeAttr, escapeHtml } from './utils.js';
import { modelBindShortLabel } from './display-utils.js';
import { findLevelById } from './id-utils.js';
import { effectiveCutsceneVideoProjectPath, formatIntroVideoStatusLines } from './cutscene-utils.js';

var GLOBAL_SETTINGS_TABS = ['levels', 'cutscenes', 'audio', 'backgrounds'];

function getState(env) {
    return env.getState();
}

function getActiveGlobalSettingsTab(env) {
    return env.getActiveGlobalSettingsTab() || 'levels';
}

function setActiveGlobalSettingsTab(env, tabId) {
    var next = tabId || 'levels';
    if (GLOBAL_SETTINGS_TABS.indexOf(next) === -1) next = 'levels';
    env.setActiveGlobalSettingsTab(next);
    return next;
}

function getGlobalCutsceneEditLevelId(env) {
    return env.getGlobalCutsceneEditLevelId() || '';
}

function setGlobalCutsceneEditLevelId(env, levelId) {
    env.setGlobalCutsceneEditLevelId(levelId || '');
}

function syncGlobalSettingsHero(refs, env) {
    if (refs.globalSettingsHeroTitle) refs.globalSettingsHeroTitle.textContent = '全局设置';
    if (!refs.globalSettingsHeroDetail) return;
    var lines = {
        levels: '当前：关卡管理。可新建/删除关卡，与左侧关卡树数据一致。',
        cutscenes: '当前：过场动画。总览各关已配置的 map.cutscenes；选择关卡后编辑开场与波次视频（与棋盘主题工作台同源）。',
        audio: '当前：全局音效。配置 gameAssetConfig.globalAudio，进入关卡前菜单 BGM 与各默认战斗音效。',
        backgrounds: '当前：背景图片。配置 gameAssetConfig.globalScreenUi，用于开始页与选关页等 UI。'
    };
    refs.globalSettingsHeroDetail.textContent = lines[getActiveGlobalSettingsTab(env)] || lines.levels;
}

function syncGlobalCutsceneEditTarget(env) {
    var state = getState(env);
    var levels = state && state.levels ? state.levels : [];
    if (!levels.length) {
        setGlobalCutsceneEditLevelId(env, '');
        return;
    }
    var currentId = getGlobalCutsceneEditLevelId(env);
    if (!currentId || !findLevelById(levels, currentId)) {
        var currentLevel = env.getLevel();
        setGlobalCutsceneEditLevelId(env, (currentLevel && currentLevel.id) || levels[0].id);
    }
}

function getGlobalCutsceneTargetLevel(env) {
    var state = getState(env);
    var levels = state && state.levels ? state.levels : [];
    return findLevelById(levels, getGlobalCutsceneEditLevelId(env));
}

function ensureCutscenesForLevel(level) {
    if (!level || !level.map) return null;
    if (!level.map.cutscenes) level.map.cutscenes = {};
    return level.map.cutscenes;
}

function renderGlobalLevelsManageList(refs, env) {
    var mount = refs.globalLevelsManageList;
    var state = getState(env);
    if (!mount || !state) return;
    if (!state.levels.length) {
        mount.innerHTML = '<p class="section-hint">暂无关卡，请点击「新建关卡」。</p>';
        return;
    }
    mount.innerHTML = state.levels
        .map(function (level) {
            var region = [level.countryName, level.cityName].filter(Boolean).join(' · ') || '—';
            return [
                '<div class="global-level-manage-row panel-surface" data-level-manage-id="' + escapeAttr(level.id) + '">',
                '  <div class="global-level-manage-row__main">',
                '    <strong>' + escapeHtml(level.name || level.id) + '</strong>',
                '    <span class="section-hint">' + escapeHtml(region) + ' · id: ' + escapeHtml(level.id) + '</span>',
                '  </div>',
                '  <div class="global-level-manage-row__actions">',
                '    <button type="button" class="mini-button" data-level-open="' + escapeAttr(level.id) + '">在编辑器中打开</button>',
                '    <button type="button" class="mini-button danger" data-level-delete="' + escapeAttr(level.id) + '">删除</button>',
                '  </div>',
                '</div>'
            ].join('');
        })
        .join('');
}

function populateGlobalCutsceneLevelSelect(refs, env) {
    var select = refs.globalCutsceneLevelSelect;
    var state = getState(env);
    if (!select || !state) return;
    var preserveId = getGlobalCutsceneEditLevelId(env);
    select.innerHTML = state.levels
        .map(function (level) {
            var label = (level.name || level.id) + ' (' + level.id + ')';
            return '<option value="' + escapeAttr(level.id) + '">' + escapeHtml(label) + '</option>';
        })
        .join('');
    syncGlobalCutsceneEditTarget(env);
    if (preserveId && findLevelById(state.levels, preserveId)) {
        setGlobalCutsceneEditLevelId(env, preserveId);
    }
    select.value = getGlobalCutsceneEditLevelId(env);
    if (!select.value && state.levels.length) {
        select.selectedIndex = 0;
        setGlobalCutsceneEditLevelId(env, select.value || '');
    }
}

function renderGlobalCutsceneOverview(refs, env) {
    var mount = refs.globalCutsceneOverview;
    var state = getState(env);
    if (!mount || !state) return;
    if (!state.levels.length) {
        mount.innerHTML = '<p class="section-hint">暂无关卡。</p>';
        return;
    }
    mount.innerHTML = [
        '<table class="global-cutscene-table">',
        '<thead><tr><th>关卡</th><th>开场</th><th>波次视频</th><th></th></tr></thead>',
        '<tbody>',
        state.levels
            .map(function (level) {
                var cutscenes = level.map && level.map.cutscenes;
                var intro = cutscenes && cutscenes.introVideo && cutscenes.introVideo.url;
                var waves = cutscenes && Array.isArray(cutscenes.waveVideos) ? cutscenes.waveVideos : [];
                var waveWithUrl = waves.filter(function (wave) {
                    return wave && wave.url;
                }).length;
                var introLabel = intro ? modelBindShortLabel(intro) : '—';
                return (
                    '<tr data-cutscene-overview-id="' +
                    escapeAttr(level.id) +
                    '">' +
                    '<td>' +
                    escapeHtml(level.name || level.id) +
                    '</td>' +
                    '<td>' +
                    escapeHtml(introLabel) +
                    '</td>' +
                    '<td>' +
                    waveWithUrl +
                    ' / ' +
                    waves.length +
                    '</td>' +
                    '<td><button type="button" class="mini-button" data-cutscene-edit="' +
                    escapeAttr(level.id) +
                    '">编辑</button></td>' +
                    '</tr>'
                );
            })
            .join(''),
        '</tbody></table>'
    ].join('');
}

function renderGlobalCutsceneEditor(refs, env) {
    if (!refs.gIntroVideoInfo) return;
    var level = getGlobalCutsceneTargetLevel(env);
    if (!level || !level.map) {
        refs.gIntroVideoInfo.textContent = '请先选择关卡';
        if (refs.gIntroVideoTitle) refs.gIntroVideoTitle.value = '';
        if (refs.gWaveVideoList) refs.gWaveVideoList.innerHTML = '';
        return;
    }
    var cutscenes = level.map.cutscenes || {};
    var intro = cutscenes.introVideo || {};
    var status = formatIntroVideoStatusLines(intro);
    refs.gIntroVideoInfo.textContent = status.text;
    if (refs.gBtnOpenIntroVideoLocation) {
        refs.gBtnOpenIntroVideoLocation.disabled = !status.openPath;
        refs.gBtnOpenIntroVideoLocation.title = status.openPath
            ? '在文件管理器中打开该文件，便于手动替换'
            : '上传并保存到项目 public 目录后可在此打开';
    }
    if (refs.gIntroVideoTitle) refs.gIntroVideoTitle.value = intro.title || '';
    if (!refs.gWaveVideoList) return;
    var waveVideos = Array.isArray(cutscenes.waveVideos) ? cutscenes.waveVideos : [];
    if (!waveVideos.length) {
        refs.gWaveVideoList.innerHTML = '<p class="section-hint" style="margin:8px 0;">暂无波次视频，点击「＋ 添加」新增。</p>';
        return;
    }
    refs.gWaveVideoList.innerHTML = waveVideos
        .map(function (waveVideo, idx) {
            var hasUrl = !!waveVideo.url;
            return [
                '<div class="wave-video-item" data-wv-idx="' + idx + '" style="border:1px solid var(--border,#354);border-radius:6px;padding:10px 12px;margin-bottom:8px;">',
                '  <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">',
                '    <label style="flex:0 0 auto;font-size:12px;opacity:.7;">第',
                '      <input type="number" class="g-wv-wave-input" min="1" max="999" value="' + (waveVideo.afterWave || 1) + '"',
                '        style="width:52px;margin:0 3px;" data-wv-idx="' + idx + '">',
                '    波后</label>',
                '    <button type="button" class="mini-button g-wv-upload-btn" data-wv-idx="' + idx + '" style="flex:1;">',
                '      ' + (hasUrl ? '替换视频' : '上传视频'),
                '      <input type="file" class="g-wv-file-input" accept="video/mp4,video/webm,video/ogg,video/*"',
                '        data-wv-idx="' + idx + '" style="position:absolute;inset:0;opacity:0;cursor:pointer;">',
                '    </button>',
                '    <button type="button" class="mini-button g-wv-remove-btn" data-wv-idx="' + idx + '" style="color:var(--error-color,#d87880);">✕</button>',
                '  </div>',
                '  <div class="section-hint g-wv-url-info" style="word-break:break-all;min-height:1.2em;font-size:11px;">',
                '    ' + escapeHtml(hasUrl ? waveVideo.url : '未上传视频'),
                '  </div>',
                '  <label class="field-block" style="margin-top:6px;">',
                '    <span style="font-size:12px;">字幕标题（可选）</span>',
                '    <input type="text" class="g-wv-title-input" placeholder="留空则不显示字幕"',
                '      value="' + escapeAttr(waveVideo.title || '') + '" data-wv-idx="' + idx + '">',
                '  </label>',
                '</div>'
            ].join('');
        })
        .join('');
}

function setGlobalSettingsTab(refs, env, tabId) {
    var next = setActiveGlobalSettingsTab(env, tabId);
    if (refs.globalSettingsSubTabs) {
        refs.globalSettingsSubTabs.querySelectorAll('[data-global-tab]').forEach(function (button) {
            var on = button.getAttribute('data-global-tab') === next;
            button.classList.toggle('active', on);
            button.setAttribute('aria-selected', on ? 'true' : 'false');
        });
    }
    GLOBAL_SETTINGS_TABS.forEach(function (key) {
        var panel = document.getElementById('globalTabPanel' + key.charAt(0).toUpperCase() + key.slice(1));
        if (!panel) return;
        var show = key === next;
        panel.classList.toggle('view-hidden', !show);
        panel.setAttribute('aria-hidden', show ? 'false' : 'true');
    });
    syncGlobalSettingsHero(refs, env);
    if (next === 'levels') renderGlobalLevelsManageList(refs, env);
    if (next === 'cutscenes') {
        syncGlobalCutsceneEditTarget(env);
        populateGlobalCutsceneLevelSelect(refs, env);
        renderGlobalCutsceneOverview(refs, env);
        renderGlobalCutsceneEditor(refs, env);
    }
    if (next === 'audio') env.renderGlobalAudioPanel(getState(env));
    if (next === 'backgrounds') env.renderGlobalScreenUiForm();
}

export function refreshGlobalSettingsWorkbench(refs, env) {
    setGlobalSettingsTab(refs, env, getActiveGlobalSettingsTab(env));
}

export function bindGlobalCutscenePanel(refs, env) {
    var panel = document.getElementById('globalTabPanelCutscenes');
    if (!panel || panel.dataset.gCutsceneBound === '1') return;
    panel.dataset.gCutsceneBound = '1';
    if (refs.gIntroVideoFile) {
        refs.gIntroVideoFile.addEventListener('change', async function () {
            var file = refs.gIntroVideoFile.files && refs.gIntroVideoFile.files[0];
            if (!file) return;
            var level = getGlobalCutsceneTargetLevel(env);
            try {
                env.setStatus('正在上传开场视频 ' + file.name + '…', 'idle');
                var uploaded = await env.uploadVideoFile(file, level);
                var cutscenes = ensureCutscenesForLevel(level);
                if (!cutscenes) return;
                cutscenes.introVideo = { url: uploaded.url };
                if (uploaded.projectPath) cutscenes.introVideo.projectPath = uploaded.projectPath;
                var introTitle = (refs.gIntroVideoTitle && refs.gIntroVideoTitle.value.trim()) || '';
                if (introTitle) cutscenes.introVideo.title = introTitle;
                else delete cutscenes.introVideo.title;
                refs.gIntroVideoFile.value = '';
                env.markDirty('已上传开场视频（全局过场页）');
                renderGlobalCutsceneEditor(refs, env);
                renderGlobalCutsceneOverview(refs, env);
                env.setStatus('开场视频已上传', 'idle');
            } catch (error) {
                refs.gIntroVideoFile.value = '';
                env.setStatus('视频上传失败: ' + (error && error.message), 'error');
            }
        });
    }
    if (refs.gIntroVideoTitle) {
        refs.gIntroVideoTitle.addEventListener('change', function () {
            var level = getGlobalCutsceneTargetLevel(env);
            var cutscenes = ensureCutscenesForLevel(level);
            if (!cutscenes || !cutscenes.introVideo) return;
            var title = refs.gIntroVideoTitle.value.trim();
            if (title) cutscenes.introVideo.title = title;
            else delete cutscenes.introVideo.title;
            env.markDirty('已更新开场视频标题');
        });
    }
    if (refs.gBtnClearIntroVideo) {
        refs.gBtnClearIntroVideo.addEventListener('click', function () {
            var level = getGlobalCutsceneTargetLevel(env);
            var cutscenes = ensureCutscenesForLevel(level);
            if (!cutscenes) return;
            delete cutscenes.introVideo;
            env.markDirty('已清除开场视频');
            renderGlobalCutsceneEditor(refs, env);
            renderGlobalCutsceneOverview(refs, env);
        });
    }
    if (refs.gBtnOpenIntroVideoLocation && refs.gBtnOpenIntroVideoLocation.dataset.bound !== '1') {
        refs.gBtnOpenIntroVideoLocation.dataset.bound = '1';
        refs.gBtnOpenIntroVideoLocation.addEventListener('click', function () {
            var level = getGlobalCutsceneTargetLevel(env);
            var intro = level && level.map && level.map.cutscenes && level.map.cutscenes.introVideo;
            var projectPath = effectiveCutsceneVideoProjectPath(intro);
            if (!projectPath) {
                env.setStatus('无法定位项目内文件：请使用「上传开场视频」写入 public 目录', 'error');
                return;
            }
            void env.revealProjectPathInExplorer(projectPath).catch(function (error) {
                env.setStatus((error && error.message) || '打开资源管理器失败', 'error');
            });
        });
    }
    if (refs.gBtnAddWaveVideo) {
        refs.gBtnAddWaveVideo.addEventListener('click', function () {
            var level = getGlobalCutsceneTargetLevel(env);
            var cutscenes = ensureCutscenesForLevel(level);
            if (!cutscenes) return;
            if (!Array.isArray(cutscenes.waveVideos)) cutscenes.waveVideos = [];
            var usedWaves = cutscenes.waveVideos.map(function (wave) {
                return wave.afterWave;
            });
            var nextWave = 1;
            while (usedWaves.indexOf(nextWave) !== -1) nextWave++;
            cutscenes.waveVideos.push({ afterWave: nextWave, url: '' });
            env.markDirty('已新增波次视频槽（全局过场页）');
            renderGlobalCutsceneEditor(refs, env);
            renderGlobalCutsceneOverview(refs, env);
        });
    }
    if (refs.gWaveVideoList) {
        refs.gWaveVideoList.addEventListener('change', function (event) {
            var target = event.target;
            var idx = parseInt(target.getAttribute('data-wv-idx') || '', 10);
            if (isNaN(idx)) return;
            var level = getGlobalCutsceneTargetLevel(env);
            var cutscenes = ensureCutscenesForLevel(level);
            if (!cutscenes || !Array.isArray(cutscenes.waveVideos) || !cutscenes.waveVideos[idx]) return;
            if (target.classList.contains('g-wv-wave-input')) {
                cutscenes.waveVideos[idx].afterWave = Math.max(1, parseInt(target.value, 10) || 1);
                env.markDirty('已更新波次');
            } else if (target.classList.contains('g-wv-title-input')) {
                var title = target.value.trim();
                if (title) cutscenes.waveVideos[idx].title = title;
                else delete cutscenes.waveVideos[idx].title;
                env.markDirty('已更新波次视频标题');
            } else if (target.classList.contains('g-wv-file-input') && target.files && target.files[0]) {
                var fileInner = target.files[0];
                var idxInner = parseInt(target.getAttribute('data-wv-idx') || '', 10);
                void (async function () {
                    try {
                        env.setStatus('正在上传波次视频 ' + fileInner.name + '…', 'idle');
                        var uploaded = await env.uploadVideoFile(fileInner, level);
                        var nextCutscenes = ensureCutscenesForLevel(getGlobalCutsceneTargetLevel(env));
                        if (nextCutscenes && Array.isArray(nextCutscenes.waveVideos) && nextCutscenes.waveVideos[idxInner]) {
                            nextCutscenes.waveVideos[idxInner].url = uploaded.url;
                            if (uploaded.projectPath) nextCutscenes.waveVideos[idxInner].projectPath = uploaded.projectPath;
                            else delete nextCutscenes.waveVideos[idxInner].projectPath;
                            env.markDirty('已上传波次视频');
                            renderGlobalCutsceneEditor(refs, env);
                            renderGlobalCutsceneOverview(refs, env);
                            env.setStatus('波次视频已上传', 'idle');
                        }
                        target.value = '';
                    } catch (error) {
                        target.value = '';
                        env.setStatus('波次视频上传失败: ' + (error && error.message), 'error');
                    }
                })();
            }
        });
        refs.gWaveVideoList.addEventListener('click', function (event) {
            var button = event.target.closest('.g-wv-remove-btn');
            if (!button) return;
            var idx = parseInt(button.getAttribute('data-wv-idx') || '', 10);
            if (isNaN(idx)) return;
            var level = getGlobalCutsceneTargetLevel(env);
            var cutscenes = ensureCutscenesForLevel(level);
            if (!cutscenes || !Array.isArray(cutscenes.waveVideos)) return;
            cutscenes.waveVideos.splice(idx, 1);
            if (cutscenes.waveVideos.length === 0) delete cutscenes.waveVideos;
            env.markDirty('已删除波次视频');
            renderGlobalCutsceneEditor(refs, env);
            renderGlobalCutsceneOverview(refs, env);
        });
    }
}

export function bindGlobalSettingsChrome(refs, env) {
    if (refs.globalSettingsSubTabs && refs.globalSettingsSubTabs.dataset.bound !== '1') {
        refs.globalSettingsSubTabs.dataset.bound = '1';
        refs.globalSettingsSubTabs.addEventListener('click', function (event) {
            var button = event.target.closest('[data-global-tab]');
            if (!button) return;
            setGlobalSettingsTab(refs, env, button.getAttribute('data-global-tab') || 'levels');
        });
    }
    if (refs.btnGlobalOpenCreateLevel && refs.btnGlobalOpenCreateLevel.dataset.bound !== '1') {
        refs.btnGlobalOpenCreateLevel.dataset.bound = '1';
        refs.btnGlobalOpenCreateLevel.addEventListener('click', function () {
            env.createManualLevel();
        });
    }
    if (refs.globalLevelsManageList && refs.globalLevelsManageList.dataset.bound !== '1') {
        refs.globalLevelsManageList.dataset.bound = '1';
        refs.globalLevelsManageList.addEventListener('click', function (event) {
            var deleteButton = event.target.closest('[data-level-delete]');
            if (deleteButton) {
                env.deleteLevelById(deleteButton.getAttribute('data-level-delete') || '');
                return;
            }
            var openButton = event.target.closest('[data-level-open]');
            if (openButton) env.focusLevelInEditor(openButton.getAttribute('data-level-open') || '');
        });
    }
    if (refs.globalCutsceneLevelSelect && refs.globalCutsceneLevelSelect.dataset.bound !== '1') {
        refs.globalCutsceneLevelSelect.dataset.bound = '1';
        refs.globalCutsceneLevelSelect.addEventListener('change', function () {
            setGlobalCutsceneEditLevelId(env, refs.globalCutsceneLevelSelect.value || '');
            renderGlobalCutsceneEditor(refs, env);
        });
    }
    if (refs.globalSettingsWorkbench && refs.globalSettingsWorkbench.dataset.cutsceneDelegateBound !== '1') {
        refs.globalSettingsWorkbench.dataset.cutsceneDelegateBound = '1';
        refs.globalSettingsWorkbench.addEventListener('click', function (event) {
            var button = event.target.closest('[data-cutscene-edit]');
            if (!button) return;
            var id = button.getAttribute('data-cutscene-edit') || '';
            var state = getState(env);
            if (!id || !state || !findLevelById(state.levels, id)) return;
            setGlobalCutsceneEditLevelId(env, id);
            setActiveGlobalSettingsTab(env, 'cutscenes');
            if (env.getActiveWorkbench() !== 'globalSettings') {
                env.setActiveWorkbench('globalSettings');
                env.renderAll();
            } else {
                setGlobalSettingsTab(refs, env, 'cutscenes');
            }
            if (refs.globalCutsceneLevelSelect) refs.globalCutsceneLevelSelect.value = id;
            renderGlobalCutsceneEditor(refs, env);
            var select = refs.globalCutsceneLevelSelect;
            if (select && typeof select.scrollIntoView === 'function') {
                select.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        });
    }
}