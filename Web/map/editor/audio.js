import { TOWER_MODEL_SPECS } from './content.js';
import { normalizeGlobalAudio, normalizeLevelAudioSource } from './normalizers.js';
import { escapeAttr, escapeHtml, editorPctFromVol01 } from './utils.js';

function applyVolSliderDisp(sliderId, dispId, vol01, fallbackPct) {
    var slider = document.getElementById(sliderId);
    var display = document.getElementById(dispId);
    var pct = editorPctFromVol01(vol01, fallbackPct);
    if (slider) slider.value = String(pct);
    if (display) display.textContent = pct + '%';
}

function bindAudioVolumeSlider(sliderId, dispId, readTarget, applyVol, dirtyLabel, env) {
    var slider = document.getElementById(sliderId);
    if (!slider) return;
    slider.addEventListener('input', function () {
        var pct = Math.max(0, Math.min(100, Math.round(Number(slider.value)) || 0));
        var display = document.getElementById(dispId);
        if (display) display.textContent = pct + '%';
        var target = readTarget();
        if (!target) return;
        applyVol(target, pct / 100);
        env.markDirty(dirtyLabel);
    });
}

function ensureLevelMapAudio(map) {
    if (!map.levelAudio || typeof map.levelAudio !== 'object') {
        map.levelAudio = normalizeLevelAudioSource(null);
    } else {
        map.levelAudio = normalizeLevelAudioSource(map.levelAudio);
    }
    return map.levelAudio;
}

export function renderLevelAudioFields(refs, level) {
    if (!refs.levelAudioTowerRows || !level || !level.map) return;
    var levelAudio = ensureLevelMapAudio(level.map);
    var defenseInput = document.getElementById('levelAudioDefenseBgmUrl');
    var exploreInput = document.getElementById('levelAudioExploreBgmUrl');
    if (defenseInput) defenseInput.value = levelAudio.defenseBgmUrl || '';
    if (exploreInput) exploreInput.value = levelAudio.exploreBgmUrl || '';
    refs.levelAudioTowerRows.innerHTML = TOWER_MODEL_SPECS.map(function (spec) {
        var url = (levelAudio.towerAttackSfxByBuildId && levelAudio.towerAttackSfxByBuildId[spec.id]) || '';
        return [
            '<div class="game-asset-tower-row level-audio-tower-row">',
            '  <div class="game-asset-tower-title">' + escapeHtml(spec.key + ' · ' + spec.name + ' 开火') + '</div>',
            '  <input type="text" class="field-inline level-audio-tower-url" data-level-tower-sfx-id="' +
                escapeAttr(spec.id) +
                '" placeholder="URL" value="' +
                escapeAttr(url) +
                '" />',
            '  <label class="game-asset-upload tight">上传<input type="file" data-level-tower-sfx-file="' +
                escapeAttr(spec.id) +
                '" accept=".mp3,.wav,.ogg,.m4a,audio/*" /></label>',
            '</div>'
        ].join('');
    }).join('');
    applyVolSliderDisp('levelAudioDefenseBgmVol', 'levelAudioDefenseBgmVolDisp', levelAudio.defenseBgmVolume, 55);
    applyVolSliderDisp('levelAudioExploreBgmVol', 'levelAudioExploreBgmVolDisp', levelAudio.exploreBgmVolume, 55);
    applyVolSliderDisp('levelAudioTowerVol', 'levelAudioTowerVolDisp', levelAudio.towerAttackSfxVolume, 62);
}

export function renderGlobalAudioPanel(state) {
    if (!state || !state.gameAssetConfig) return;
    state.gameAssetConfig.globalAudio = normalizeGlobalAudio(state.gameAssetConfig.globalAudio);
    var globalAudio = state.gameAssetConfig.globalAudio;
    function setValue(id, value) {
        var el = document.getElementById(id);
        if (el) el.value = value || '';
    }
    setValue('gaGlobalMenuBgmUrl', globalAudio.menuBgmUrl);
    setValue('gaGlobalTowerBuildUrl', globalAudio.towerBuildSfxUrl);
    setValue('gaGlobalTowerAttackDefaultUrl', globalAudio.towerAttackDefaultSfxUrl);
    setValue('gaGlobalDefenseKillUrl', globalAudio.defenseEnemyDeathSfxUrl);
    setValue('gaGlobalExploreAttackUrl', globalAudio.exploreBasicAttackSfxUrl);
    setValue('gaGlobalExploreEnemyDeathUrl', globalAudio.exploreEnemyDeathSfxUrl);
    setValue('gaGlobalExplorePlayerHitUrl', globalAudio.explorePlayerHitSfxUrl);
    applyVolSliderDisp('gaGlobalMenuBgmVol', 'gaGlobalMenuBgmVolDisp', globalAudio.menuBgmVolume, 55);
    applyVolSliderDisp('gaGlobalTowerBuildVol', 'gaGlobalTowerBuildVolDisp', globalAudio.towerBuildSfxVolume, 55);
    applyVolSliderDisp('gaGlobalTowerAttackVol', 'gaGlobalTowerAttackVolDisp', globalAudio.towerAttackSfxVolume, 62);
    applyVolSliderDisp('gaGlobalDefenseKillVol', 'gaGlobalDefenseKillVolDisp', globalAudio.defenseEnemyDeathSfxVolume, 50);
    applyVolSliderDisp('gaGlobalExploreAttackVol', 'gaGlobalExploreAttackVolDisp', globalAudio.exploreBasicAttackSfxVolume, 45);
    applyVolSliderDisp('gaGlobalExploreEnemyDeathVol', 'gaGlobalExploreEnemyDeathVolDisp', globalAudio.exploreEnemyDeathSfxVolume, 50);
    applyVolSliderDisp('gaGlobalExplorePlayerHitVol', 'gaGlobalExplorePlayerHitVolDisp', globalAudio.explorePlayerHitSfxVolume, 55);
    var mount = document.getElementById('gaGlobalTowerAttackRows');
    if (mount) {
        mount.innerHTML = TOWER_MODEL_SPECS.map(function (spec) {
            var url = (globalAudio.towerAttackSfxByBuildId && globalAudio.towerAttackSfxByBuildId[spec.id]) || '';
            return [
                '<div class="game-asset-tower-row level-audio-tower-row">',
                '  <div class="game-asset-tower-title">' + escapeHtml(spec.key + ' · ' + spec.name + '（全局）') + '</div>',
                '  <input type="text" class="field-inline global-tower-sfx-url" data-global-tower-sfx-id="' +
                    escapeAttr(spec.id) +
                    '" placeholder="URL" value="' +
                    escapeAttr(url) +
                    '" />',
                '  <label class="game-asset-upload tight">上传<input type="file" data-global-tower-sfx-file="' +
                    escapeAttr(spec.id) +
                    '" accept=".mp3,.wav,.ogg,.m4a,audio/*" /></label>',
                '</div>'
            ].join('');
        }).join('');
    }
}

export function bindLevelAudioUi(refs, env) {
    var section = document.getElementById('levelAudioSection');
    if (!section || section.dataset.bound === '1') return;
    section.dataset.bound = '1';
    function currentLevelAudio() {
        var level = env.getLevel();
        if (!level || !level.map) return null;
        return ensureLevelMapAudio(level.map);
    }
    var defenseInput = document.getElementById('levelAudioDefenseBgmUrl');
    var exploreInput = document.getElementById('levelAudioExploreBgmUrl');
    if (defenseInput) {
        defenseInput.addEventListener('input', function () {
            var levelAudio = currentLevelAudio();
            if (!levelAudio) return;
            levelAudio.defenseBgmUrl = defenseInput.value.trim();
            env.markDirty('已更新关卡塔防 BGM');
        });
    }
    if (exploreInput) {
        exploreInput.addEventListener('input', function () {
            var levelAudio = currentLevelAudio();
            if (!levelAudio) return;
            levelAudio.exploreBgmUrl = exploreInput.value.trim();
            env.markDirty('已更新关卡探索 BGM');
        });
    }
    function bindBgmFile(inputId, field) {
        var input = document.getElementById(inputId);
        if (!input) return;
        input.addEventListener('change', function () {
            var file = input.files && input.files[0];
            input.value = '';
            if (!file) return;
            (async function () {
                try {
                    env.setStatus('正在上传「' + file.name + '」…', 'idle');
                    var url = await env.uploadFileToProjectUrl(file, { gameModelsUpload: true, gameModelsSubdir: 'Audio' });
                    var levelAudio = currentLevelAudio();
                    if (!levelAudio) return;
                    levelAudio[field] = url;
                    if (field === 'defenseBgmUrl' && defenseInput) defenseInput.value = url;
                    if (field === 'exploreBgmUrl' && exploreInput) exploreInput.value = url;
                    env.markDirty('已上传关卡 BGM');
                    env.setStatus('已上传「' + file.name + '」', 'success');
                } catch (error) {
                    env.setStatus((error && error.message) || '上传失败', 'error');
                }
            })();
        });
    }
    bindBgmFile('levelAudioDefenseBgmFile', 'defenseBgmUrl');
    bindBgmFile('levelAudioExploreBgmFile', 'exploreBgmUrl');
    bindAudioVolumeSlider('levelAudioDefenseBgmVol', 'levelAudioDefenseBgmVolDisp', currentLevelAudio, function (levelAudio, value) {
        levelAudio.defenseBgmVolume = value;
    }, '已更新关卡塔防 BGM 音量', env);
    bindAudioVolumeSlider('levelAudioExploreBgmVol', 'levelAudioExploreBgmVolDisp', currentLevelAudio, function (levelAudio, value) {
        levelAudio.exploreBgmVolume = value;
    }, '已更新关卡探索 BGM 音量', env);
    bindAudioVolumeSlider('levelAudioTowerVol', 'levelAudioTowerVolDisp', currentLevelAudio, function (levelAudio, value) {
        levelAudio.towerAttackSfxVolume = value;
    }, '已更新本关塔开火音效音量', env);
    section.addEventListener('input', function (event) {
        var target = event.target;
        if (!target || !target.classList || !target.classList.contains('level-audio-tower-url')) return;
        var id = target.getAttribute('data-level-tower-sfx-id');
        var levelAudio = currentLevelAudio();
        if (!levelAudio || !id) return;
        if (!levelAudio.towerAttackSfxByBuildId) levelAudio.towerAttackSfxByBuildId = {};
        var value = target.value.trim();
        if (value) levelAudio.towerAttackSfxByBuildId[id] = value;
        else delete levelAudio.towerAttackSfxByBuildId[id];
        env.markDirty('已更新关卡塔开火音效');
    });
    section.addEventListener('change', function (event) {
        var target = event.target;
        if (!target || !target.getAttribute('data-level-tower-sfx-file')) return;
        var id = target.getAttribute('data-level-tower-sfx-file');
        var file = target.files && target.files[0];
        target.value = '';
        if (!file || !id) return;
        (async function () {
            try {
                env.setStatus('正在上传「' + file.name + '」…', 'idle');
                var url = await env.uploadFileToProjectUrl(file, { gameModelsUpload: true, gameModelsSubdir: 'Audio' });
                var levelAudio = currentLevelAudio();
                if (!levelAudio) return;
                if (!levelAudio.towerAttackSfxByBuildId) levelAudio.towerAttackSfxByBuildId = {};
                levelAudio.towerAttackSfxByBuildId[id] = url;
                var input = section.querySelector('.level-audio-tower-url[data-level-tower-sfx-id="' + id + '"]');
                if (input) input.value = url;
                env.markDirty('已上传关卡塔开火音效');
                env.setStatus('已绑定「' + file.name + '」', 'success');
            } catch (error) {
                env.setStatus((error && error.message) || '上传失败', 'error');
            }
        })();
    });
}

export function bindGlobalAudioUi(env) {
    var section = document.getElementById('globalAudioBindRoot');
    if (!section || section.dataset.bound === '1') return;
    section.dataset.bound = '1';
    function currentGlobalAudio() {
        var state = env.getState();
        if (!state || !state.gameAssetConfig) return null;
        state.gameAssetConfig.globalAudio = normalizeGlobalAudio(state.gameAssetConfig.globalAudio);
        return state.gameAssetConfig.globalAudio;
    }
    [
        ['gaGlobalMenuBgmUrl', 'menuBgmUrl'],
        ['gaGlobalTowerBuildUrl', 'towerBuildSfxUrl'],
        ['gaGlobalTowerAttackDefaultUrl', 'towerAttackDefaultSfxUrl'],
        ['gaGlobalDefenseKillUrl', 'defenseEnemyDeathSfxUrl'],
        ['gaGlobalExploreAttackUrl', 'exploreBasicAttackSfxUrl'],
        ['gaGlobalExploreEnemyDeathUrl', 'exploreEnemyDeathSfxUrl'],
        ['gaGlobalExplorePlayerHitUrl', 'explorePlayerHitSfxUrl']
    ].forEach(function (pair) {
        var el = document.getElementById(pair[0]);
        if (!el) return;
        el.addEventListener('input', function () {
            var globalAudio = currentGlobalAudio();
            if (!globalAudio) return;
            globalAudio[pair[1]] = el.value.trim();
            env.markDirty('已更新全局音效');
        });
    });
    [
        ['gaGlobalMenuBgmFile', 'menuBgmUrl', 'gaGlobalMenuBgmUrl'],
        ['gaGlobalTowerBuildFile', 'towerBuildSfxUrl', 'gaGlobalTowerBuildUrl'],
        ['gaGlobalTowerAttackDefaultFile', 'towerAttackDefaultSfxUrl', 'gaGlobalTowerAttackDefaultUrl'],
        ['gaGlobalDefenseKillFile', 'defenseEnemyDeathSfxUrl', 'gaGlobalDefenseKillUrl'],
        ['gaGlobalExploreAttackFile', 'exploreBasicAttackSfxUrl', 'gaGlobalExploreAttackUrl'],
        ['gaGlobalExploreEnemyDeathFile', 'exploreEnemyDeathSfxUrl', 'gaGlobalExploreEnemyDeathUrl'],
        ['gaGlobalExplorePlayerHitFile', 'explorePlayerHitSfxUrl', 'gaGlobalExplorePlayerHitUrl']
    ].forEach(function (triple) {
        var input = document.getElementById(triple[0]);
        if (!input) return;
        input.addEventListener('change', function () {
            var file = input.files && input.files[0];
            input.value = '';
            if (!file) return;
            (async function () {
                try {
                    env.setStatus('正在上传「' + file.name + '」…', 'idle');
                    var url = await env.uploadFileToProjectUrl(file, { gameModelsUpload: true, gameModelsSubdir: 'Audio' });
                    var globalAudio = currentGlobalAudio();
                    if (!globalAudio) return;
                    globalAudio[triple[1]] = url;
                    var urlEl = document.getElementById(triple[2]);
                    if (urlEl) urlEl.value = url;
                    env.markDirty('已上传全局音效');
                    env.setStatus('已绑定「' + file.name + '」', 'success');
                } catch (error) {
                    env.setStatus((error && error.message) || '上传失败', 'error');
                }
            })();
        });
    });
    bindAudioVolumeSlider('gaGlobalMenuBgmVol', 'gaGlobalMenuBgmVolDisp', currentGlobalAudio, function (globalAudio, value) {
        globalAudio.menuBgmVolume = value;
    }, '已更新全局菜单 BGM 音量', env);
    bindAudioVolumeSlider('gaGlobalTowerBuildVol', 'gaGlobalTowerBuildVolDisp', currentGlobalAudio, function (globalAudio, value) {
        globalAudio.towerBuildSfxVolume = value;
    }, '已更新全局建造音效音量', env);
    bindAudioVolumeSlider('gaGlobalTowerAttackVol', 'gaGlobalTowerAttackVolDisp', currentGlobalAudio, function (globalAudio, value) {
        globalAudio.towerAttackSfxVolume = value;
    }, '已更新全局塔开火默认音量', env);
    bindAudioVolumeSlider('gaGlobalDefenseKillVol', 'gaGlobalDefenseKillVolDisp', currentGlobalAudio, function (globalAudio, value) {
        globalAudio.defenseEnemyDeathSfxVolume = value;
    }, '已更新全局塔防击杀音量', env);
    bindAudioVolumeSlider('gaGlobalExploreAttackVol', 'gaGlobalExploreAttackVolDisp', currentGlobalAudio, function (globalAudio, value) {
        globalAudio.exploreBasicAttackSfxVolume = value;
    }, '已更新全局探索普攻音量', env);
    bindAudioVolumeSlider('gaGlobalExploreEnemyDeathVol', 'gaGlobalExploreEnemyDeathVolDisp', currentGlobalAudio, function (globalAudio, value) {
        globalAudio.exploreEnemyDeathSfxVolume = value;
    }, '已更新全局探索敌杀音量', env);
    bindAudioVolumeSlider('gaGlobalExplorePlayerHitVol', 'gaGlobalExplorePlayerHitVolDisp', currentGlobalAudio, function (globalAudio, value) {
        globalAudio.explorePlayerHitSfxVolume = value;
    }, '已更新全局探索受击音量', env);
    section.addEventListener('input', function (event) {
        var target = event.target;
        if (!target || !target.classList || !target.classList.contains('global-tower-sfx-url')) return;
        var id = target.getAttribute('data-global-tower-sfx-id');
        var globalAudio = currentGlobalAudio();
        if (!globalAudio || !id) return;
        if (!globalAudio.towerAttackSfxByBuildId) globalAudio.towerAttackSfxByBuildId = {};
        var value = target.value.trim();
        if (value) globalAudio.towerAttackSfxByBuildId[id] = value;
        else delete globalAudio.towerAttackSfxByBuildId[id];
        env.markDirty('已更新全局塔开火音效');
    });
    section.addEventListener('change', function (event) {
        var target = event.target;
        if (!target || !target.getAttribute('data-global-tower-sfx-file')) return;
        var id = target.getAttribute('data-global-tower-sfx-file');
        var file = target.files && target.files[0];
        target.value = '';
        if (!file || !id) return;
        (async function () {
            try {
                env.setStatus('正在上传「' + file.name + '」…', 'idle');
                var url = await env.uploadFileToProjectUrl(file, { gameModelsUpload: true, gameModelsSubdir: 'Audio' });
                var globalAudio = currentGlobalAudio();
                if (!globalAudio) return;
                if (!globalAudio.towerAttackSfxByBuildId) globalAudio.towerAttackSfxByBuildId = {};
                globalAudio.towerAttackSfxByBuildId[id] = url;
                var input = section.querySelector('.global-tower-sfx-url[data-global-tower-sfx-id="' + id + '"]');
                if (input) input.value = url;
                env.markDirty('已上传全局塔开火音效');
                env.setStatus('已绑定「' + file.name + '」', 'success');
            } catch (error) {
                env.setStatus((error && error.message) || '上传失败', 'error');
            }
        })();
    });
}