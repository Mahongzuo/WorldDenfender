import { clamp, escapeAttr, escapeHtml, uid } from './utils.js';
import { modelBindShortLabel } from './display-utils.js';

function bindWaveAppearanceControls(refs, env, level) {
    if (!refs.waveList || !level || !level.waveRules) return;
    refs.waveList.querySelectorAll('[data-wave-override-scale]').forEach(function (input) {
        input.addEventListener('input', function () {
            var waveIndex = Number(input.getAttribute('data-wave-override-scale'));
            var wave = level.waveRules[waveIndex];
            if (!wave) return;
            wave.overrideModelScale = clamp(Number(input.value) || 1, 0.1, 8);
            env.markDirty('已更新波次模型缩放');
        });
    });
    refs.waveList.querySelectorAll('[data-wave-model-file]').forEach(function (input) {
        input.addEventListener('change', function () {
            var waveIndex = Number(input.getAttribute('data-wave-model-file'));
            var wave = level.waveRules[waveIndex];
            if (!wave || !input.files || !input.files[0]) return;
            applyWaveOverrideModel(refs, env, level, waveIndex, input.files[0]);
            input.value = '';
        });
    });
    refs.waveList.querySelectorAll('[data-wave-model-drop]').forEach(function (zone) {
        zone.addEventListener('dragover', function (event) {
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
        });
        zone.addEventListener('drop', function (event) {
            event.preventDefault();
            var waveIndex = Number(zone.getAttribute('data-wave-model-drop'));
            var wave = level.waveRules[waveIndex];
            if (!wave || !event.dataTransfer.files || !event.dataTransfer.files[0]) return;
            applyWaveOverrideModel(refs, env, level, waveIndex, event.dataTransfer.files[0]);
        });
    });
}

async function applyWaveOverrideModel(refs, env, level, waveIndex, file) {
    try {
        env.setStatus('正在上传「' + file.name + '」…', 'idle');
        var url = await env.uploadFileToProjectUrl(file, { gameModelsUpload: true, gameModelsSubdir: 'Waves' });
        var wave = level.waveRules[waveIndex];
        if (!wave) {
            env.setStatus('找不到对应波次', 'error');
            return;
        }
        if (!url) {
            env.setStatus('上传成功但未返回 publicUrl', 'error');
            return;
        }
        wave.overrideModelPath = url;
        env.markDirty('已绑定波次模型');
        renderWaveList(refs, env);
        env.setStatus('波次 #' + String(wave.waveNumber || waveIndex + 1) + ' 已绑定「' + file.name + '」 · ' + modelBindShortLabel(url), 'success');
    } catch (error) {
        env.setStatus('上传失败：' + ((error && error.message) || String(error)), 'error');
    }
}

export function addWaveRule(refs, env) {
    var level = env.getLevel();
    if (!level) return;
    var enemies = env.getAvailableEnemyTypes(level);
    var enemy = enemies[0] || env.createEnemyTypeFromTemplates(level);
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
    env.markDirty('已新增波次');
    renderWaveList(refs, env);
    env.renderOverview();
}

function editWaveRule(refs, env, index) {
    var level = env.getLevel();
    if (!level) return;
    var wave = level.waveRules[index];
    if (!wave) return;
    var enemies = env.getAvailableEnemyTypes(level);
    var enemyPrompt = enemies.map(function (enemy) {
        return enemy.id + ':' + enemy.name;
    }).join('\n');
    if (enemyPrompt) {
        var defaultEnemyId = String(wave.enemyTypeId || (enemies[0] && enemies[0].id) || '');
        var enemyTypeId = window.prompt('敌人 ID（可用候选）\n' + enemyPrompt, defaultEnemyId);
        if (enemyTypeId !== null) wave.enemyTypeId = String(enemyTypeId || defaultEnemyId);
    }
    var count = window.prompt('敌人数量', String(wave.count));
    if (count !== null) wave.count = Math.max(1, Number(count) || wave.count);
    var interval = window.prompt('刷新间隔（秒）', String(wave.interval));
    if (interval !== null) wave.interval = Math.max(0.1, Number(interval) || wave.interval);
    env.markDirty('已更新波次');
    renderWaveList(refs, env);
}

function removeWaveRule(refs, env, index) {
    var level = env.getLevel();
    if (!level) return;
    level.waveRules.splice(index, 1);
    level.waveRules.forEach(function (wave, waveIndex) {
        wave.waveNumber = waveIndex + 1;
    });
    env.markDirty('已删除波次');
    renderWaveList(refs, env);
    env.renderOverview();
}

export function renderWaveList(refs, env) {
    var level = env.getLevel();
    var enemyLookup = env.getEnemyTypeLookup(level);
    if (!refs.waveList) return;
    if (!level) {
        refs.waveList.innerHTML = '';
        return;
    }
    if (!level.waveRules.length) {
        refs.waveList.innerHTML = '<div class="empty-state">暂无波次。点击新增波次开始配置。</div>';
        return;
    }
    refs.waveList.innerHTML = level.waveRules.map(function (wave, index) {
        var enemyName = enemyLookup[wave.enemyTypeId] ? enemyLookup[wave.enemyTypeId].name : wave.enemyTypeId || '未指定敌人';
        var overridePath = String(wave.overrideModelPath || '');
        var overrideScale = wave.overrideModelScale != null && wave.overrideModelScale > 0 ? wave.overrideModelScale : 1;
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
            '      <input type="number" data-wave-override-scale="' + index + '" min="0.1" max="8" step="0.1" value="' + String(overrideScale) + '" />',
            '    </label>',
            '    <div class="asset-url-hint" title="' + escapeAttr(overridePath || '若留空则沿用敌人条目的模型路径') + '">',
            escapeHtml(overridePath ? modelBindShortLabel(overridePath) : '沿用敌人'),
            '    </div>',
            '  </div>',
            '</div>'
        ].join('');
    }).join('');
    refs.waveList.querySelectorAll('[data-wave-action]').forEach(function (button) {
        button.addEventListener('click', function () {
            var index = Number(button.getAttribute('data-wave-index'));
            if (button.getAttribute('data-wave-action') === 'remove') removeWaveRule(refs, env, index);
            else editWaveRule(refs, env, index);
        });
    });
    bindWaveAppearanceControls(refs, env, level);
}

export function bindWaveEditorUi(refs, env) {
    if (!refs.btnAddWave || refs.btnAddWave.dataset.bound === '1') return;
    refs.btnAddWave.dataset.bound = '1';
    refs.btnAddWave.addEventListener('click', function () {
        addWaveRule(refs, env);
    });
}