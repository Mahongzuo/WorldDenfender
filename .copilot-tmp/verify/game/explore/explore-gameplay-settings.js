/** 与动画剪辑无关的移动线速度默认（压低以减轻眩晕感） */
export const DEFAULT_MOVE_SPEED_WALK = 5.5;
export const DEFAULT_MOVE_SPEED_RUN = 10;
const BASE = {
    moveSpeedWalk: DEFAULT_MOVE_SPEED_WALK,
    moveSpeedRun: DEFAULT_MOVE_SPEED_RUN,
    attackCooldownSec: 0.35,
    skillECooldownSec: 8,
    skillRCooldownSec: 16,
    moneyDropRespawnIntervalSec: 5,
    exploreEnemySpawnIntervalSec: 8,
    enemyMaxConcurrent: 15,
    enemyBaseHp: 40,
    enemyHpPerLevel: 12,
    enemyBaseSpeed: 2.0,
    enemySpeedPerLevel: 0.08,
    enemyBaseDamage: 5,
    enemyDamagePerLevel: 1.5,
    enemyAggroRange: 9,
    enemyAttackCooldown: 1.6,
    /* ── 肉鸽波次默认 ── */
    roguelikeWaveMode: true,
    wavePauseSec: 6,
    firstWaveDelaySec: 4,
    totalWaves: 20,
    bossUnlockWave: 15,
};
function finiteOr(def, v) {
    return typeof v === "number" && Number.isFinite(v) ? v : def;
}
function clampPositive(def, v, max = 1e6) {
    const n = finiteOr(def, v);
    return Math.min(max, Math.max(1e-3, n));
}
/** 把关卡 JSON（部分字段）解析为运行时使用的完整快照 */
export function resolveExploreGameplay(raw) {
    const r = raw ?? {};
    return {
        moveSpeedWalk: clampPositive(BASE.moveSpeedWalk, r.moveSpeedWalk, 80),
        moveSpeedRun: clampPositive(BASE.moveSpeedRun, r.moveSpeedRun, 120),
        attackCooldownSec: clampPositive(BASE.attackCooldownSec, r.attackCooldownSec, 30),
        skillECooldownSec: clampPositive(BASE.skillECooldownSec, r.skillECooldownSec, 300),
        skillRCooldownSec: clampPositive(BASE.skillRCooldownSec, r.skillRCooldownSec, 600),
        moneyDropRespawnIntervalSec: clampPositive(BASE.moneyDropRespawnIntervalSec, r.moneyDropRespawnIntervalSec, 3600),
        exploreEnemySpawnIntervalSec: clampPositive(BASE.exploreEnemySpawnIntervalSec, r.exploreEnemySpawnIntervalSec, 3600),
        enemyMaxConcurrent: Math.min(120, Math.max(1, Math.round(finiteOr(BASE.enemyMaxConcurrent, r.enemyMaxConcurrent)))),
        enemyBaseHp: clampPositive(BASE.enemyBaseHp, r.enemyBaseHp, 1e9),
        enemyHpPerLevel: clampPositive(BASE.enemyHpPerLevel, r.enemyHpPerLevel, 1e9),
        enemyBaseSpeed: clampPositive(BASE.enemyBaseSpeed, r.enemyBaseSpeed, 50),
        enemySpeedPerLevel: Math.max(0, finiteOr(BASE.enemySpeedPerLevel, r.enemySpeedPerLevel)),
        enemyBaseDamage: clampPositive(BASE.enemyBaseDamage, r.enemyBaseDamage, 1e6),
        enemyDamagePerLevel: Math.max(0, finiteOr(BASE.enemyDamagePerLevel, r.enemyDamagePerLevel)),
        enemyAggroRange: clampPositive(BASE.enemyAggroRange, r.enemyAggroRange, 200),
        enemyAttackCooldown: clampPositive(BASE.enemyAttackCooldown, r.enemyAttackCooldown, 60),
        /* ── 肉鸽波次 ── */
        roguelikeWaveMode: typeof r.roguelikeWaveMode === "boolean" ? r.roguelikeWaveMode : BASE.roguelikeWaveMode,
        wavePauseSec: clampPositive(BASE.wavePauseSec, r.wavePauseSec, 60),
        firstWaveDelaySec: clampPositive(BASE.firstWaveDelaySec, r.firstWaveDelaySec, 30),
        totalWaves: Math.min(100, Math.max(1, Math.round(finiteOr(BASE.totalWaves, r.totalWaves)))),
        bossUnlockWave: Math.min(100, Math.max(1, Math.round(finiteOr(BASE.bossUnlockWave, r.bossUnlockWave)))),
    };
}
