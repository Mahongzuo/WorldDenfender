/** 塔防运行时难度 1–5：影响每波敌军数量与刷新节奏，以及兵种投放与耐久/攻城倾向 */

export const DEFENSE_DIFFICULTY_MIN = 1 as const;
export const DEFENSE_DIFFICULTY_MAX = 5 as const;

export type DefenseDifficultyTier = 1 | 2 | 3 | 4 | 5;

/** 与各档位对应的简述（HUD / 主页） */
export const DEFENSE_DIFFICULTY_LABELS_CN: readonly string[] = [
  "\u4f11\u9601", // 休闲
  "\u7b80\u5355", // 简单
  "\u6807\u51c6", // 标准
  "\u56f0\u96be", // 困难
  "\u7edd\u5883", // 绝境
];

export function clampDefenseDifficulty(value: unknown): DefenseDifficultyTier {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 3;
  return Math.min(5, Math.max(1, n)) as DefenseDifficultyTier;
}

export interface DefenseDifficultyRuntimeParams {
  /** 乘以每波敌军数量估算 */
  spawnCountMult: number;
  /** 乘以刷怪间隔（越大越慢 → 更简单） */
  spawnIntervalMult: number;
  /** 乘以生命值 */
  hpMult: number;
  /** 乘以移速 */
  speedMult: number;
  /** 乘以攻城 DPS（及少量半径缩放） */
  siegeMult: number;
  /** 乘以波次清空时的经济奖励 */
  waveEconomyMult: number;
  /** 加在判定兵种类型的「等效波次」上，越高越容易提前出现精英谱系 */
  typeWaveBias: number;
}

export function getDefenseDifficultyRuntimeParams(tier: DefenseDifficultyTier): DefenseDifficultyRuntimeParams {
  const idx = tier - 1;
  return {
    spawnCountMult: [0.76, 0.87, 1, 1.14, 1.3][idx],
    spawnIntervalMult: [1.16, 1.052, 1, 0.92, 0.835][idx],
    hpMult: [0.78, 0.9, 1, 1.12, 1.26][idx],
    speedMult: [0.93, 0.965, 1, 1.035, 1.08][idx],
    siegeMult: [0.76, 0.88, 1, 1.13, 1.27][idx],
    waveEconomyMult: [0.96, 0.982, 1, 1.038, 1.08][idx],
    typeWaveBias: (tier - 3) * 1.42,
  };
}

/** 顶部 HUD 单行展示 */
export function formatDefenseDifficultyHud(tier: DefenseDifficultyTier): string {
  const label = DEFENSE_DIFFICULTY_LABELS_CN[tier - 1];
  return `${tier}\u00b7${label}`;
}
