/**
 * editor/explore-gameplay-defaults.js
 * 探索玩法数值默认值与显示合并工具函数（纯计算，无全局状态依赖）。
 */

import { normalizeExploreGameplayNormalized } from './normalizers.js';

/**
 * 将原始玩法 rawGp 对象（可能部分缺失）合并到默认基准值，
 * 并对每个字段做范围夹取，返回完整的展示用数值对象。
 *
 * 与 resolveExploreGameplay（src 端）保持一致。
 * @param {object|null} rawGp
 * @returns {object}
 */
export function mergeExploreGameplayDisplay(rawGp) {
    var r = rawGp && typeof rawGp === 'object' ? rawGp : {};
    function finiteOr(def, val) {
        return typeof val === 'number' && Number.isFinite(val) ? val : def;
    }
    function clampPos(def, key, max) {
        var n = finiteOr(def, Number(r[key]));
        return Math.min(max, Math.max(1e-3, n));
    }
    function clampNonNeg(def, key, max) {
        var v = finiteOr(def, Number(r[key]));
        return Math.min(max, Math.max(0, v));
    }
    var B = {
        moveSpeedWalk: 5.5,
        moveSpeedRun: 10,
        attackCooldownSec: 0.42,
        skillECooldownSec: 10,
        skillRCooldownSec: 20,
        moneyDropRespawnIntervalSec: 5,
        exploreEnemySpawnIntervalSec: 8,
        enemyMaxConcurrent: 10,
        enemyBaseHp: 55,
        enemyHpPerLevel: 18,
        enemyBaseSpeed: 2.2,
        enemySpeedPerLevel: 0.15,
        enemyBaseDamage: 7,
        enemyDamagePerLevel: 2,
        enemyAggroRange: 8,
        enemyAttackCooldown: 1.5
    };
    return {
        moveSpeedWalk: clampPos(B.moveSpeedWalk, 'moveSpeedWalk', 80),
        moveSpeedRun: clampPos(B.moveSpeedRun, 'moveSpeedRun', 120),
        attackCooldownSec: clampPos(B.attackCooldownSec, 'attackCooldownSec', 30),
        skillECooldownSec: clampPos(B.skillECooldownSec, 'skillECooldownSec', 300),
        skillRCooldownSec: clampPos(B.skillRCooldownSec, 'skillRCooldownSec', 600),
        moneyDropRespawnIntervalSec: clampPos(B.moneyDropRespawnIntervalSec, 'moneyDropRespawnIntervalSec', 3600),
        exploreEnemySpawnIntervalSec: clampPos(B.exploreEnemySpawnIntervalSec, 'exploreEnemySpawnIntervalSec', 3600),
        enemyMaxConcurrent: Math.min(120, Math.max(1, Math.round(finiteOr(B.enemyMaxConcurrent, Number(r.enemyMaxConcurrent))))),
        enemyBaseHp: clampPos(B.enemyBaseHp, 'enemyBaseHp', 1e9),
        enemyHpPerLevel: clampPos(B.enemyHpPerLevel, 'enemyHpPerLevel', 1e9),
        enemyBaseSpeed: clampPos(B.enemyBaseSpeed, 'enemyBaseSpeed', 50),
        enemySpeedPerLevel: clampNonNeg(B.enemySpeedPerLevel, 'enemySpeedPerLevel', 50),
        enemyBaseDamage: clampPos(B.enemyBaseDamage, 'enemyBaseDamage', 1e6),
        enemyDamagePerLevel: clampNonNeg(B.enemyDamagePerLevel, 'enemyDamagePerLevel', 1e6),
        enemyAggroRange: clampPos(B.enemyAggroRange, 'enemyAggroRange', 200),
        enemyAttackCooldown: clampPos(B.enemyAttackCooldown, 'enemyAttackCooldown', 60)
    };
}

/**
 * 从 DOM section 中读取所有 [data-explore-gp] 输入，规范化为标准格式返回。
 * 注意：sectionEl 需从调用方传入，不依赖全局 refs。
 * @param {Element} sectionEl
 * @returns {object}
 */
export function readExploreGameplayRawFromDomSection(sectionEl) {
    var flat = {};
    if (!sectionEl || !sectionEl.querySelectorAll) return {};
    sectionEl.querySelectorAll('[data-explore-gp]').forEach(function (inp) {
        var key = inp.getAttribute('data-explore-gp');
        if (!key) return;
        var raw = inp.value;
        var n = key === 'enemyMaxConcurrent' ? parseInt(raw, 10) : parseFloat(raw);
        if (!Number.isFinite(n)) return;
        flat[key] = n;
    });
    return normalizeExploreGameplayNormalized(flat);
}
