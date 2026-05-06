import * as THREE from "three";

import { TILE_SIZE, cellToWorld, distanceXZ } from "../core/runtime-grid";
import type { Building, Enemy } from "../core/types";
import type { DefenseDamageSource } from "../core/defense-types";
import { buildDefenseDamageSource } from "./defense-damage";

export interface DefenseMinesTickDeps {
  buildings: Building[];
  enemies: readonly Enemy[];
  buildGroup: THREE.Group;
  addExplosion(center: THREE.Vector3, radius: number, color: number): void;
  damageEnemy(enemy: Enemy, damage: number, source?: DefenseDamageSource): void;
  onMineExploded?(mine: Building): void;
}

/** 每帧检测已武装地雷与敌人距离，触发爆炸、伤害与移除建筑 */
export function tickDefenseMines(deps: DefenseMinesTickDeps): void {
  const mines = deps.buildings.filter((building) => building.spec.id === "mine" && building.armed);
  for (const mine of mines) {
    const minePosition = cellToWorld(mine.cell);
    const triggerRadius = (mine.spec.triggerRadius ?? 0.7) * TILE_SIZE;
    const triggered = deps.enemies.some(
      (enemy) => distanceXZ(minePosition, enemy.mesh.position) <= triggerRadius,
    );

    if (!triggered) {
      continue;
    }

    mine.armed = false;
    const splash = (mine.spec.splash ?? 1.3) * TILE_SIZE;
    const damageSource = buildDefenseDamageSource(mine.spec);
    deps.addExplosion(minePosition, splash, mine.spec.color);
    deps.onMineExploded?.(mine);
    for (const enemy of [...deps.enemies]) {
      if (distanceXZ(minePosition, enemy.mesh.position) <= splash) {
        deps.damageEnemy(enemy, mine.spec.damage ?? 0, damageSource);
      }
    }
    deps.buildGroup.remove(mine.mesh);
    const idx = deps.buildings.indexOf(mine);
    if (idx !== -1) {
      deps.buildings.splice(idx, 1);
    }
  }
}
