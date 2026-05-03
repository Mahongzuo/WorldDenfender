import type { ExploreGameplaySettings } from "../core/types";

/** 与动画剪辑无关的移动线速度默认（压低以减轻眩晕感） */
export const DEFAULT_MOVE_SPEED_WALK = 5.5;
export const DEFAULT_MOVE_SPEED_RUN = 10;

/** 运行时合并后的完整探索玩法参数（每关可调） */
export interface ResolvedExploreGameplay {
  moveSpeedWalk: number;
  moveSpeedRun: number;
  attackCooldownSec: number;
  skillECooldownSec: number;
  skillRCooldownSec: number;
  moneyDropRespawnIntervalSec: number;
  exploreEnemySpawnIntervalSec: number;
  enemyMaxConcurrent: number;
  enemyBaseHp: number;
  enemyHpPerLevel: number;
  enemyBaseSpeed: number;
  enemySpeedPerLevel: number;
  enemyBaseDamage: number;
  enemyDamagePerLevel: number;
  enemyAggroRange: number;
  enemyAttackCooldown: number;
}

const BASE: ResolvedExploreGameplay = {
  moveSpeedWalk: DEFAULT_MOVE_SPEED_WALK,
  moveSpeedRun: DEFAULT_MOVE_SPEED_RUN,
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
  enemyAttackCooldown: 1.5,
};

function finiteOr(def: number, v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : def;
}

function clampPositive(def: number, v: unknown, max = 1e6): number {
  const n = finiteOr(def, v);
  return Math.min(max, Math.max(1e-3, n));
}

/** 把关卡 JSON（部分字段）解析为运行时使用的完整快照 */
export function resolveExploreGameplay(raw?: ExploreGameplaySettings | null): ResolvedExploreGameplay {
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
  };
}
