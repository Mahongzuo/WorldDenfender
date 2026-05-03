import type { Enemy, EnemyType } from "../core/types";

/** 与 public/GameModels/Enemy 下的两个默认 GLB 对应：basic / scout */
const DEFAULT_ENEMY_GLB: Partial<Record<EnemyType, string>> = {
  basic: "/GameModels/Enemy/monsterA.glb",
  scout: "/GameModels/Enemy/monsterB.glb",
};

export function getDefaultEnemyGlbUrl(type: EnemyType): string | undefined {
  return DEFAULT_ENEMY_GLB[type];
}

/** 与 defense-runtime 球体半径规则一致，用于把 GLB 缩放到与原先占位球相近的占地。 */
export function getDefaultEnemyBodyRadius(type: EnemyType): number {
  let scale = 1;
  switch (type) {
    case "scout":
      scale = 0.8;
      break;
    case "tank":
      scale = 1.3;
      break;
    case "swarm":
      scale = 1.1;
      break;
    default:
      break;
  }
  return 0.45 * scale;
}

export function getEnemyTargetBodyDiameter(enemy: Enemy): number {
  const r = enemy.bodyRadius ?? getDefaultEnemyBodyRadius(enemy.type);
  return r * 2;
}
