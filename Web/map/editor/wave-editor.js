import { clamp, escapeAttr, escapeHtml, uid } from './utils.js';
import { modelBindShortLabel } from './display-utils.js';

var STANDARD_WAVE_COUNT = 20;

function rerenderWaveUi(refs, env) {
    if (env && typeof env.renderWaveManager === 'function') {
        env.renderWaveManager();
        return;
    }
    renderWaveList(refs, env);
}

function sortedUniqueWaveNumbers(value) {
    var raw = Array.isArray(value) ? value : value != null ? [value] : [];
    var seen = {};
    return raw
        .map(function (item) {
            return Math.max(1, Math.round(Number(item) || 0));
        })
        .filter(function (item) {
            if (!item || seen[item]) return false;
            seen[item] = true;
            return true;
        })
        .sort(function (a, b) {
            return a - b;
        });
}

function ensureWaveRulesArray(level) {
    if (!level) return [];
    if (!Array.isArray(level.waveRules)) level.waveRules = [];
    return level.waveRules;
}

function stripLegacySpawnWaveFields(level) {
    var points = level && level.map && Array.isArray(level.map.spawnPoints) ? level.map.spawnPoints : [];
    points.forEach(function (spawn) {
        delete spawn.enemyTypeId;
        delete spawn.waveNumber;
        delete spawn.waveNumbers;
        delete spawn.count;
        delete spawn.interval;
    });
}

export function createWaveRulesFromLegacySpawnPoints(level) {
    var points = level && level.map && Array.isArray(level.map.spawnPoints) ? level.map.spawnPoints : [];
    return points.flatMap(function (spawn, index) {
        var hasWaveConfig = !!(
            spawn &&
            (spawn.enemyTypeId || Array.isArray(spawn.waveNumbers) || spawn.waveNumber != null || spawn.count != null || spawn.interval != null)
        );
        if (!hasWaveConfig) return [];
        var waves = sortedUniqueWaveNumbers(spawn.waveNumbers && spawn.waveNumbers.length ? spawn.waveNumbers : spawn.waveNumber != null ? [spawn.waveNumber] : []);
        return waves.map(function (waveNumber) {
            return {
                id: String(spawn.id || ('spawn-' + (index + 1))) + '-wave-' + String(waveNumber) + '-rule',
                waveNumber: waveNumber,
                enemyTypeId: String(spawn.enemyTypeId || 'basic'),
                count: Math.max(1, Math.round(Number(spawn.count) || 12)),
                interval: Math.max(0.1, Number(spawn.interval) || 1.2),
                spawnPointId: String(spawn.id || ''),
                pathId: String(spawn.pathId || ('path-' + (index + 1))),
                reward: 50,
                overrideModelPath: '',
                overrideModelScale: 1
            };
        });
    });
}

function ensureWaveRulesHydrated(refs, env, level) {
    var rules = ensureWaveRulesArray(level);
    if (rules.length) return rules;
    var migrated = createWaveRulesFromLegacySpawnPoints(level);
    if (!migrated.length) return rules;
    level.waveRules = migrated;
    stripLegacySpawnWaveFields(level);
    if (env && typeof env.markDirty === 'function') env.markDirty('已将出生点旧版刷怪配置迁移到波次管理器');
    if (env && typeof env.setStatus === 'function') env.setStatus('已将旧版出生点刷怪配置迁移到波次管理器', 'success');
    if (env && typeof env.renderOverview === 'function') env.renderOverview();
    return level.waveRules;
}

function sortWaveRules(level) {
    ensureWaveRulesArray(level).sort(function (a, b) {
        var waveDiff = Math.max(1, Math.round(Number(a.waveNumber) || 1)) - Math.max(1, Math.round(Number(b.waveNumber) || 1));
        if (waveDiff) return waveDiff;
        var spawnA = String(a.spawnPointId || '');
        var spawnB = String(b.spawnPointId || '');
        if (spawnA !== spawnB) return spawnA.localeCompare(spawnB, 'zh-Hans-CN');
        return String(a.id || '').localeCompare(String(b.id || ''), 'zh-Hans-CN');
    });
}

function buildEnemyLookup(env, level) {
    var list = env && typeof env.getAvailableEnemyTypes === 'function' ? env.getAvailableEnemyTypes(level) : [];
    var lookup = {};
    list.forEach(function (enemy) {
        if (!enemy || !enemy.id) return;
        lookup[enemy.id] = enemy;
    });
    return lookup;
}

function getSpawnLookup(level) {
    var points = level && level.map && Array.isArray(level.map.spawnPoints) ? level.map.spawnPoints : [];
    var lookup = {};
    points.forEach(function (spawn, index) {
        var id = String(spawn.id || ('spawn-' + (index + 1)));
        lookup[id] = spawn;
    });
    return lookup;
}

function buildEnemyOptions(env, level, selectedId) {
    var enemies = env && typeof env.getAvailableEnemyTypes === 'function' ? env.getAvailableEnemyTypes(level) : [];
    if (!enemies.length) {
        return '<option value="basic"' + (selectedId === 'basic' ? ' selected' : '') + '>标准敌人</option>';
    }
    return enemies.map(function (enemy) {
        return '<option value="' + escapeAttr(enemy.id) + '"' + (enemy.id === selectedId ? ' selected' : '') + '>' + escapeHtml(enemy.name || enemy.id) + '</option>';
    }).join('');
}

function buildSpawnOptions(level, selectedId) {
    var points = level && level.map && Array.isArray(level.map.spawnPoints) ? level.map.spawnPoints : [];
    if (!points.length) {
        return '<option value="">未设置出生点</option>';
    }
    return points.map(function (spawn, index) {
        var id = String(spawn.id || ('spawn-' + (index + 1)));
        var label = String(spawn.name || ('敌人出口 ' + (index + 1)));
        return '<option value="' + escapeAttr(id) + '"' + (id === selectedId ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
    }).join('');
}

function createDefaultWaveRule(level, env, options) {
    var enemies = env && typeof env.getAvailableEnemyTypes === 'function' ? env.getAvailableEnemyTypes(level) : [];
    var enemy = enemies[0] || { id: 'basic' };
    var points = level && level.map && Array.isArray(level.map.spawnPoints) ? level.map.spawnPoints : [];
    var spawn = null;
    if (options && options.spawnPointId) {
        spawn = points.find(function (item) { return item.id === options.spawnPointId; }) || null;
    }
    if (!spawn) spawn = points[0] || null;
    var nextWaveNumber = options && options.waveNumber ? Math.max(1, Math.round(Number(options.waveNumber) || 1)) : Math.max(1, ensureWaveRulesArray(level).reduce(function (maxWave, rule) {
        return Math.max(maxWave, Math.round(Number(rule.waveNumber) || 0));
    }, 0) + 1);
    return {
        id: uid('wave'),
        waveNumber: nextWaveNumber,
        enemyTypeId: String(options && options.enemyTypeId || enemy.id || 'basic'),
        count: Math.max(1, Math.round(Number(options && options.count) || 12)),
        interval: Math.max(0.1, Number(options && options.interval) || 1.2),
        spawnPointId: String(spawn && spawn.id || ''),
        pathId: String(spawn && spawn.pathId || 'path-main'),
        reward: Math.max(0, Number(options && options.reward) || 50),
        overrideModelPath: String(options && options.overrideModelPath || ''),
        overrideModelScale: clamp(Number(options && options.overrideModelScale) || 1, 0.1, 8)
    };
}

function getWaveGroups(level) {
    var groups = {};
    ensureWaveRulesArray(level).forEach(function (rule, index) {
        var waveNumber = Math.max(1, Math.round(Number(rule.waveNumber) || 1));
        if (!groups[waveNumber]) groups[waveNumber] = [];
        groups[waveNumber].push({ rule: rule, index: index });
    });
    return Object.keys(groups).map(function (key) {
        return {
            waveNumber: Number(key),
            rules: groups[key]
        };
    }).sort(function (a, b) {
        return a.waveNumber - b.waveNumber;
    });
}

function getWaveGroupLookup(level) {
    var lookup = {};
    getWaveGroups(level).forEach(function (group) {
        lookup[group.waveNumber] = group;
    });
    return lookup;
}

export function getSpawnPointWaveSummary(level, spawnPointId) {
    var effectiveRules = ensureWaveRulesArray(level).length ? ensureWaveRulesArray(level) : createWaveRulesFromLegacySpawnPoints(level);
    return effectiveRules
        .filter(function (rule) {
            return String(rule.spawnPointId || '') === String(spawnPointId || '');
        })
        .map(function (rule) {
            return {
                id: String(rule.id || ''),
                waveNumber: Math.max(1, Math.round(Number(rule.waveNumber) || 1)),
                enemyTypeId: String(rule.enemyTypeId || ''),
                count: Math.max(1, Math.round(Number(rule.count) || 1)),
                interval: Math.max(0.1, Number(rule.interval) || 0.1),
                reward: Math.max(0, Math.round(Number(rule.reward) || 0)),
                pathId: String(rule.pathId || ''),
                overrideModelPath: String(rule.overrideModelPath || '')
            };
        })
        .sort(function (a, b) {
            return a.waveNumber - b.waveNumber;
        });
}

function setWaveRuleField(level, index, field, value) {
    var wave = ensureWaveRulesArray(level)[index];
    if (!wave) return false;
    if (field === 'enemyTypeId') wave.enemyTypeId = String(value || '');
    if (field === 'spawnPointId') {
        wave.spawnPointId = String(value || '');
        var spawn = level.map && Array.isArray(level.map.spawnPoints)
            ? level.map.spawnPoints.find(function (item) { return item.id === wave.spawnPointId; })
            : null;
        if (spawn && spawn.pathId) wave.pathId = String(spawn.pathId || 'path-main');
    }
    if (field === 'count') wave.count = Math.max(1, Math.round(Number(value) || wave.count || 1));
    if (field === 'interval') wave.interval = Math.max(0.1, Number(value) || wave.interval || 0.1);
    if (field === 'reward') wave.reward = Math.max(0, Math.round(Number(value) || 0));
    if (field === 'overrideModelScale') wave.overrideModelScale = clamp(Number(value) || 1, 0.1, 8);
    return true;
}

async function applyWaveOverrideModel(refs, env, level, waveIndex, file) {
    try {
        env.setStatus('正在上传「' + file.name + '」…', 'idle');
        var url = await env.uploadFileToProjectUrl(file, { gameModelsUpload: true, gameModelsSubdir: 'Waves' });
        var wave = ensureWaveRulesArray(level)[waveIndex];
        if (!wave) {
            env.setStatus('找不到对应波次', 'error');
            return;
        }
        if (!url) {
            env.setStatus('上传成功但未返回 publicUrl', 'error');
            return;
        }
        wave.overrideModelPath = url;
        if (typeof env.markDirty === 'function') env.markDirty('已绑定波次模型');
        rerenderWaveUi(refs, env);
        env.setStatus('波次 #' + String(wave.waveNumber || waveIndex + 1) + ' 已绑定「' + file.name + '」 · ' + modelBindShortLabel(url), 'success');
    } catch (error) {
        env.setStatus('上传失败：' + ((error && error.message) || String(error)), 'error');
    }
}

function duplicateWaveRule(refs, env, index) {
    var level = env.getLevel();
    if (!level) return;
    ensureWaveRulesHydrated(refs, env, level);
    var source = ensureWaveRulesArray(level)[index];
    if (!source) return;
    level.waveRules.push(Object.assign({}, source, { id: uid('wave') }));
    sortWaveRules(level);
    env.markDirty('已复制刷怪规则');
    rerenderWaveUi(refs, env);
    if (typeof env.renderOverview === 'function') env.renderOverview();
}

function removeWaveRule(refs, env, index) {
    var level = env.getLevel();
    if (!level) return;
    ensureWaveRulesHydrated(refs, env, level);
    level.waveRules.splice(index, 1);
    sortWaveRules(level);
    env.markDirty('已删除刷怪规则');
    rerenderWaveUi(refs, env);
    if (typeof env.renderOverview === 'function') env.renderOverview();
}

function removeWaveGroup(refs, env, waveNumber) {
    var level = env.getLevel();
    if (!level) return;
    ensureWaveRulesHydrated(refs, env, level);
    level.waveRules = ensureWaveRulesArray(level).filter(function (rule) {
        return Math.max(1, Math.round(Number(rule.waveNumber) || 1)) !== waveNumber;
    });
    env.markDirty('已删除整波刷怪规则');
    rerenderWaveUi(refs, env);
    if (typeof env.renderOverview === 'function') env.renderOverview();
}

function updateWaveGroupNumber(refs, env, currentWaveNumber, nextWaveNumber) {
    var level = env.getLevel();
    if (!level) return;
    ensureWaveRulesHydrated(refs, env, level);
    var numeric = Math.max(1, Math.round(Number(nextWaveNumber) || currentWaveNumber || 1));
    ensureWaveRulesArray(level).forEach(function (rule) {
        if (Math.max(1, Math.round(Number(rule.waveNumber) || 1)) === currentWaveNumber) {
            rule.waveNumber = numeric;
        }
    });
    sortWaveRules(level);
    env.markDirty('已调整波次编号');
    rerenderWaveUi(refs, env);
    if (typeof env.renderOverview === 'function') env.renderOverview();
}

function bindWaveFieldControls(refs, env, level) {
    if (!refs.waveList) return;
    refs.waveList.querySelectorAll('[data-wave-field]').forEach(function (input) {
        var field = input.getAttribute('data-wave-field') || '';
        var index = Number(input.getAttribute('data-wave-index'));
        var handler = function () {
            if (!setWaveRuleField(level, index, field, input.value)) return;
            env.markDirty('已更新波次刷怪规则');
            if (field === 'spawnPointId') {
                rerenderWaveUi(refs, env);
            } else if (typeof env.renderOverview === 'function') {
                env.renderOverview();
            }
        };
        input.addEventListener('input', handler);
        input.addEventListener('change', handler);
    });
    refs.waveList.querySelectorAll('[data-wave-group-number]').forEach(function (input) {
        input.addEventListener('change', function () {
            updateWaveGroupNumber(refs, env, Number(input.getAttribute('data-wave-group-number') || 1), input.value);
        });
    });
    refs.waveList.querySelectorAll('[data-wave-model-file]').forEach(function (input) {
        input.addEventListener('change', function () {
            var waveIndex = Number(input.getAttribute('data-wave-model-file'));
            var wave = ensureWaveRulesArray(level)[waveIndex];
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
            var wave = ensureWaveRulesArray(level)[waveIndex];
            if (!wave || !event.dataTransfer || !event.dataTransfer.files || !event.dataTransfer.files[0]) return;
            applyWaveOverrideModel(refs, env, level, waveIndex, event.dataTransfer.files[0]);
        });
    });
}

export function addWaveRule(refs, env, options) {
    var level = env.getLevel();
    if (!level) return;
    ensureWaveRulesHydrated(refs, env, level);
    level.waveRules.push(createDefaultWaveRule(level, env, options || null));
    sortWaveRules(level);
    env.markDirty(options && options.waveNumber ? '已为该波新增刷怪规则' : '已新增波次');
    rerenderWaveUi(refs, env);
    if (typeof env.renderOverview === 'function') env.renderOverview();
}

export function renderWaveList(refs, env) {
    var level = env.getLevel();
    if (!refs.waveList) return;
    if (!level) {
        refs.waveList.innerHTML = '';
        return;
    }
    ensureWaveRulesHydrated(refs, env, level);
    sortWaveRules(level);
    var enemyLookup = buildEnemyLookup(env, level);
    var spawnLookup = getSpawnLookup(level);
    var spawnCount = level.map && Array.isArray(level.map.spawnPoints) ? level.map.spawnPoints.length : 0;
    var groupLookup = getWaveGroupLookup(level);
    function renderWaveRuleRow(item) {
        var wave = item.rule;
        var index = item.index;
        var enemy = enemyLookup[wave.enemyTypeId];
        var spawn = spawnLookup[String(wave.spawnPointId || '')];
        var overridePath = String(wave.overrideModelPath || '');
        return [
            '    <div class="wave-rule-row">',
            '      <div class="wave-rule-grid wave-rule-grid--simple">',
            '        <label class="field-block"><span>敌人类型</span><select data-wave-field="enemyTypeId" data-wave-index="' + index + '">' + buildEnemyOptions(env, level, String(wave.enemyTypeId || '')) + '</select></label>',
            '        <label class="field-block"><span>敌人出口</span><select data-wave-field="spawnPointId" data-wave-index="' + index + '">' + buildSpawnOptions(level, String(wave.spawnPointId || '')) + '</select></label>',
            '        <label class="field-block"><span>数量</span><input type="number" min="1" step="1" data-wave-field="count" data-wave-index="' + index + '" value="' + escapeAttr(String(wave.count || 1)) + '"></label>',
            '      </div>',
            '      <div class="wave-rule-meta">',
            '        <span class="gameplay-chip">' + escapeHtml(enemy ? (enemy.name || enemy.id) : (wave.enemyTypeId || '未指定敌人')) + '</span>',
            '        <span class="gameplay-chip">' + escapeHtml(spawn ? (spawn.name || spawn.id) : (wave.spawnPointId || '未绑定出生点')) + '</span>',
            '        <span class="gameplay-chip">路径 ' + escapeHtml(String((spawn && spawn.pathId) || wave.pathId || 'path-main')) + '</span>',
            overridePath ? '        <span class="gameplay-chip" title="' + escapeAttr(overridePath) + '">模型覆盖：' + escapeHtml(modelBindShortLabel(overridePath)) + '</span>' : '',
            '      </div>',
            '      <div class="wave-rule-actions inline-controls">',
            '        <button type="button" class="mini-button" data-wave-action="duplicate" data-wave-index="' + index + '">复制</button>',
            '        <button type="button" class="mini-button danger" data-wave-action="remove" data-wave-index="' + index + '">删除</button>',
            '      </div>',
            '    </div>'
        ].join('');
    }
    function renderWaveCard(waveNumber, group, endless) {
        var ruleCount = group ? group.rules.length : 0;
        var spawnIds = {};
        if (group) {
            group.rules.forEach(function (item) {
                var sid = String(item.rule.spawnPointId || '');
                if (sid) spawnIds[sid] = true;
            });
        }
        return [
            '<section class="wave-group-card' + (endless ? ' wave-group-card--endless' : '') + '">',
            '  <div class="wave-group-head">',
            '    <div>',
            '      <strong>' + (endless ? '无尽' : '标准') + ' 第 <input type="number" class="wave-group-number" data-wave-group-number="' + escapeAttr(String(waveNumber)) + '" min="1" step="1" value="' + escapeAttr(String(waveNumber)) + '"> 波</strong>',
            '      <span>' + (group
                ? (escapeHtml(String(ruleCount)) + ' 条刷怪规则 · ' + escapeHtml(String(Object.keys(spawnIds).length)) + ' 个出口')
                : (endless ? '此无尽波未配置，若进入无尽将回退到程序生成怪物。' : '此标准波未配置，运行时将使用默认刷怪逻辑。')) + '</span>',
            '    </div>',
            '    <div class="inline-controls">',
            '      <button type="button" class="mini-button" data-wave-group-action="add-rule" data-wave-number="' + escapeAttr(String(waveNumber)) + '">添加敌人</button>',
            group ? '      <button type="button" class="mini-button danger" data-wave-group-action="remove-wave" data-wave-number="' + escapeAttr(String(waveNumber)) + '">删除整波</button>' : '',
            '    </div>',
            '  </div>',
            group ? '  <div class="wave-rule-list">' + group.rules.map(renderWaveRuleRow).join('') + '</div>' : '  <div class="wave-group-empty">这一波还没有配置任何出口刷怪。</div>',
            '</section>'
        ].join('');
    }
    var standardCards = [];
    for (var waveNumber = 1; waveNumber <= STANDARD_WAVE_COUNT; waveNumber += 1) {
        standardCards.push(renderWaveCard(waveNumber, groupLookup[waveNumber] || null, false));
    }
    var endlessWaveNumbers = Object.keys(groupLookup)
        .map(function (key) { return Number(key); })
        .filter(function (waveNumber) { return waveNumber > STANDARD_WAVE_COUNT; })
        .sort(function (a, b) { return a - b; });
    refs.waveList.innerHTML = [
        '<section class="wave-section">',
        '  <div class="wave-section-head">',
        '    <div>',
        '      <strong>标准模式 1 - ' + String(STANDARD_WAVE_COUNT) + ' 波</strong>',
        '      <p>清完第 ' + String(STANDARD_WAVE_COUNT) + ' 波后，游戏会让玩家选择结算或进入无尽模式。</p>',
        '    </div>',
        '  </div>',
        spawnCount ? '  <div class="wave-section-list">' + standardCards.join('') + '</div>' : '  <div class="empty-state">当前还没有敌人出生点，请先回到棋盘管理放置出生点。</div>',
        '</section>',
        '<section class="wave-section wave-section--endless">',
        '  <div class="wave-section-head">',
        '    <div>',
        '      <strong>无尽模式 21+ 波</strong>',
        '      <p>这里只会在玩家完成第 20 波并选择“开启无尽模式”后生效。未手写的无尽波会使用程序生成。</p>',
        '    </div>',
        '  </div>',
        endlessWaveNumbers.length
            ? '  <div class="wave-section-list">' + endlessWaveNumbers.map(function (waveNumber) { return renderWaveCard(waveNumber, groupLookup[waveNumber], true); }).join('') + '</div>'
            : '  <div class="wave-group-empty">还没有专门配置无尽波。需要定制时，点击上方“新增无尽第 21 波”。</div>',
        '</section>'
    ].join('');

    refs.waveList.querySelectorAll('[data-wave-action]').forEach(function (button) {
        button.addEventListener('click', function () {
            var index = Number(button.getAttribute('data-wave-index'));
            var action = button.getAttribute('data-wave-action') || '';
            var level = env.getLevel();
            if (!level) return;
            if (action === 'remove') removeWaveRule(refs, env, index);
            if (action === 'duplicate') duplicateWaveRule(refs, env, index);
        });
    });
    refs.waveList.querySelectorAll('[data-wave-group-action]').forEach(function (button) {
        button.addEventListener('click', function () {
            var waveNumber = Math.max(1, Math.round(Number(button.getAttribute('data-wave-number')) || 1));
            var action = button.getAttribute('data-wave-group-action') || '';
            if (action === 'add-rule') addWaveRule(refs, env, { waveNumber: waveNumber });
            if (action === 'remove-wave') removeWaveGroup(refs, env, waveNumber);
        });
    });
    bindWaveFieldControls(refs, env, level);
}

export function bindWaveEditorUi(refs, env) {
    if (!refs.btnAddWave || refs.btnAddWave.dataset.bound === '1') return;
    refs.btnAddWave.dataset.bound = '1';
    refs.btnAddWave.addEventListener('click', function () {
        addWaveRule(refs, env);
    });
}
