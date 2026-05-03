import * as THREE from "three";

import { cellToWorld, sameCell, worldToCell } from "../core/runtime-grid";
import type { Building, Enemy } from "../core/types";

export interface DefenseEnemyWaveDeps {
  dt: number;
  elapsed: number;
  enemies: Enemy[];
  buildings: Building[];
  defensePathWorldPoints: readonly THREE.Vector3[];
  enemyGroup: THREE.Group;
  buildGroup: THREE.Group;
  getBaseHp(): number;
  setBaseHp(next: number): void;
  triggerGameOverDefense(): void;
  showToast(message: string, critical?: boolean): void;
}

function defenseBuildingBlockLimit(building: Building, elapsed: number): number {
  const base = building.spec.maxBlockCount ?? 1;
  return (building.bonusBlockUntil ?? 0) > elapsed ? base + 1 : base;
}

function defenseDamageBuilding(
  building: Building,
  damage: number,
  elapsed: number,
  onDemolish: (building: Building) => void,
): void {
  const reductionFactor =
    (building.damageReductionUntil ?? 0) > elapsed ? building.damageReductionFactor ?? 1 : 1;
  building.hp -= damage * reductionFactor;
  if (building.hp <= 0) {
    onDemolish(building);
  }
}

function defenseDemolishBuilding(
  building: Building,
  enemies: Enemy[],
  buildGroup: THREE.Group,
  buildings: Building[],
): void {
  buildGroup.remove(building.mesh);
  const idx = buildings.indexOf(building);
  if (idx >= 0) buildings.splice(idx, 1);
  for (const enemy of enemies) {
    if (enemy.blockedBy === building) {
      enemy.blockedBy = null;
    }
  }
}

/** 近战阻挡寻路、沿路推进、Leak 基地血量 */
export function tickDefenseEnemyWave(deps: DefenseEnemyWaveDeps): void {
  const {
    dt,
    elapsed,
    enemies,
    buildings,
    defensePathWorldPoints,
    enemyGroup,
    buildGroup,
    getBaseHp,
    setBaseHp,
    triggerGameOverDefense,
    showToast,
  } = deps;

  const runDemolish = (b: Building) => defenseDemolishBuilding(b, enemies, buildGroup, buildings);

  const tryBlockEnemy = (enemy: Enemy): boolean => {
    if (enemy.blockedBy) {
      return true;
    }
    const currentCell = worldToCell(enemy.mesh.position);
    const blocker = buildings.find(
      (building) =>
        building.spec.role === "melee" &&
        sameCell(building.cell, currentCell) &&
        building.blockingEnemies.length < defenseBuildingBlockLimit(building, elapsed),
    );
    if (!blocker) {
      return false;
    }
    enemy.blockedBy = blocker;
    blocker.blockingEnemies.push(enemy);
    enemy.mesh.position.copy(cellToWorld(blocker.cell));
    showToast(`${blocker.spec.name} \u963b\u6321\u4e86\u654c\u4eba`);
    return true;
  };

  for (const enemy of [...enemies]) {
    if (enemy.stunUntil > elapsed) {
      continue;
    }

    const speed = enemy.speed * (elapsed < enemy.slowUntil ? enemy.slowFactor : 1);
    let distance = speed * dt;

    if (enemy.blockedBy) {
      if (enemy.blockedBy.hp <= 0) {
        enemy.blockedBy = null;
      } else {
        defenseDamageBuilding(enemy.blockedBy, 20 * dt, elapsed, runDemolish);
        continue;
      }
    }

    if (tryBlockEnemy(enemy)) {
      continue;
    }

    while (distance > 0 && enemy.segment < defensePathWorldPoints.length - 1) {
      const target = defensePathWorldPoints[enemy.segment + 1]!;
      const current = enemy.mesh.position;
      const dx = target.x - current.x;
      const dz = target.z - current.z;
      const segmentDistance = Math.hypot(dx, dz);

      if (segmentDistance <= distance) {
        enemy.mesh.rotation.y = Math.atan2(dx, dz);
        current.set(target.x, 0, target.z);
        enemy.segment += 1;
        distance -= segmentDistance;
      } else {
        enemy.mesh.rotation.y = Math.atan2(dx, dz);
        current.x += (dx / segmentDistance) * distance;
        current.z += (dz / segmentDistance) * distance;
        distance = 0;
      }
    }

    tryBlockEnemy(enemy);

    if (enemy.segment >= defensePathWorldPoints.length - 1) {
      enemyGroup.remove(enemy.mesh);
      const idxLeak = enemies.indexOf(enemy);
      if (idxLeak >= 0) enemies.splice(idxLeak, 1);
      setBaseHp(getBaseHp() - 1);
      showToast("\u654c\u4eba\u7a81\u7834\u9632\u7ebf\uff0c\u57fa\u5730\u751f\u547d -1");
      if (getBaseHp() <= 0) {
        triggerGameOverDefense();
        return;
      }
    }
  }
}
