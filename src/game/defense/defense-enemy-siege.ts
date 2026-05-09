import { cellToWorld } from "../core/runtime-grid";
import type { Building, Enemy } from "../core/types";

function damageDefenseBuilding(
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

/** 沿路站桩 / 近战阻挡 /  hacker 等对射程内建筑：持续扣塔血；可选打击特效（宿主侧节流）。 */
export function applyEnemySiegeAgainstBuildings(
  enemy: Enemy,
  buildings: Building[],
  dt: number,
  elapsed: number,
  onDemolish: (building: Building) => void,
  spawnSiegeStrikeFx?: (enemy: Enemy, building: Building) => void,
): void {
  const dps = enemy.towerSiegeDps ?? 0;
  const radius = enemy.towerSiegeRadiusWorld ?? 0;
  if (!(dps > 0) || !(radius > 0)) {
    return;
  }
  const cut = Math.max(0, dps * dt);
  if (!(cut > 0)) {
    return;
  }
  const ex = enemy.mesh.position.x;
  const ez = enemy.mesh.position.z;
  const radiusSq = radius * radius;

  for (const b of buildings) {
    if (b.hp <= 0 || !Number.isFinite(b.hp)) {
      continue;
    }
    const cw = cellToWorld(b.cell);
    const dx = cw.x - ex;
    const dz = cw.z - ez;
    if (dx * dx + dz * dz <= radiusSq) {
      damageDefenseBuilding(b, cut, elapsed, onDemolish);
      if (spawnSiegeStrikeFx) {
        spawnSiegeStrikeFx(enemy, b);
      }
    }
  }
}