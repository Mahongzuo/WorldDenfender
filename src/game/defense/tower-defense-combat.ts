import * as THREE from "three";

import { findNearestEnemyTarget, getTowerBuffMultiplier } from "./defense-runtime";
import {
  addStatusOutlineEffect,
  addTowerProjectileImpactFx,
} from "../fx/effects-runtime";
import { TILE_SIZE, cellToWorld, distanceXZ } from "../core/runtime-grid";
import type { BuildId, Building, Enemy, TimedEffect } from "../core/types";
import type { DefenseDamageSource } from "../core/defense-types";
import { buildDefenseDamageSource } from "./defense-damage";
import { applyBuildingEffectsToEnemy } from "./defense-status";

/** 与各塔 procedural 网格大致匹配的炮口局部偏移 */
const PRESET_TOWER_MUZZLE_LOCAL: Partial<Record<BuildId, THREE.Vector3>> = {
  machine: new THREE.Vector3(0, 0.9, -0.78),
  cannon: new THREE.Vector3(0, 0.96, -1.08),
  frost: new THREE.Vector3(0, 1.05, -0.88),
  stellar: new THREE.Vector3(0, 1.15, -0.98),
  liqingzhao: new THREE.Vector3(0, 1.08, -0.92),
};
const DEFAULT_PRESET_MUZZLE_LOCAL = new THREE.Vector3(0, 0.88, -0.82);

export interface TowerDefenseCombatTickDeps {
  buildings: Building[];
  enemies: Enemy[];
  effects: TimedEffect[];
  fxGroup: THREE.Group;
  elapsed: number;
  aimWorldCenter: (enemy: Enemy) => THREE.Vector3;
  damageEnemy(enemy: Enemy, damage: number, source?: DefenseDamageSource): void;
  addBeam(from: THREE.Vector3, to: THREE.Vector3, color: number): void;
  onTowerFired?(building: Building): void;
}

function towerProjectileMuzzleWorld(building: Building): THREE.Vector3 {
  building.mesh.updateMatrixWorld(true);
  const local =
    PRESET_TOWER_MUZZLE_LOCAL[building.spec.id]?.clone() ?? DEFAULT_PRESET_MUZZLE_LOCAL.clone();
  return building.mesh.localToWorld(local);
}

function applyTowerEffects(
  deps: Pick<TowerDefenseCombatTickDeps, "effects" | "fxGroup" | "elapsed">,
  building: Building,
  enemy: Enemy,
): void {
  applyBuildingEffectsToEnemy(building, enemy, deps.elapsed);

  if (building.spec.id === "frost" || building.spec.id === "liqingzhao") {
    addStatusOutlineEffect(deps.effects, deps.fxGroup, enemy.mesh, 0x00e5ff, 0.4);
  }
}

function fireAt(deps: TowerDefenseCombatTickDeps, building: Building, target: Enemy): void {
  const origin = towerProjectileMuzzleWorld(building);
  const destination = deps.aimWorldCenter(target);
  const splashRadiusWorld =
    building.spec.splash !== undefined && building.spec.splash > 0
      ? building.spec.splash * TILE_SIZE
      : undefined;

  addTowerProjectileImpactFx(
    deps.effects,
    deps.fxGroup,
    origin,
    destination,
    building.spec.color,
    building.spec.id,
    splashRadiusWorld,
  );

  deps.onTowerFired?.(building);
  const damageSource = buildDefenseDamageSource(building.spec);
  if (splashRadiusWorld) {
    const anchor = target.mesh.position;
    for (const enemy of [...deps.enemies]) {
      if (distanceXZ(anchor, enemy.mesh.position) <= splashRadiusWorld) {
        applyTowerEffects(deps, building, enemy);
        deps.damageEnemy(enemy, building.spec.damage ?? 0, damageSource);
      }
    }
    return;
  }

  applyTowerEffects(deps, building, target);
  deps.damageEnemy(target, building.spec.damage ?? 0, damageSource);
}

export function tickTowerDefenseCombat(dt: number, deps: TowerDefenseCombatTickDeps): void {
  for (const building of deps.buildings) {
    if (building.skillCooldownTimer > 0) {
      building.skillCooldownTimer -= dt;
    }

    if (building.spec.role === "melee") {
      building.cooldown -= dt;
      if (building.cooldown <= 0 && building.blockingEnemies.length > 0) {
        building.blockingEnemies = building.blockingEnemies.filter((e) => e.hp > 0);
        let dealt = false;
        const damageSource = buildDefenseDamageSource(building.spec);
        for (const e of building.blockingEnemies) {
          applyBuildingEffectsToEnemy(building, e, deps.elapsed);
          deps.damageEnemy(e, building.spec.damage ?? 0, damageSource);
          dealt = true;
        }
        if (dealt) {
          deps.onTowerFired?.(building);
        }
        building.cooldown = 1 / (building.spec.fireRate ?? 1);
      }
      continue;
    }

    if (building.spec.role === "healer") {
      building.cooldown -= dt;
      if (building.cooldown <= 0) {
        const origin = cellToWorld(building.cell);
        const range = (building.spec.healRange ?? 0) * TILE_SIZE;
        let healed = false;
        for (const target of deps.buildings) {
          if (target.hp < (target.spec.maxHp ?? 1) && distanceXZ(origin, cellToWorld(target.cell)) <= range) {
            target.hp = Math.min(target.hp + (building.spec.healAmount ?? 0), target.spec.maxHp ?? 1);
            deps.addBeam(origin, cellToWorld(target.cell), 0x4caf50);
            healed = true;
          }
        }
        if (healed) {
          building.cooldown = 1 / (building.spec.fireRate ?? 1);
        }
      }
      continue;
    }

    if (building.spec.category !== "tower" || building.spec.role === "device") {
      continue;
    }

    const buff = getTowerBuffMultiplier(building, deps.buildings);
    if (buff > 1 && Math.random() < 0.05) {
      addStatusOutlineEffect(deps.effects, deps.fxGroup, building.mesh, 0xffd700, 0.3);
    }
    building.cooldown -= dt;
    if (building.cooldown > 0) {
      continue;
    }

    const target = findNearestEnemyTarget(building, deps.enemies);
    if (!target) {
      continue;
    }

    fireAt(deps, building, target);
    building.cooldown = 1 / ((building.spec.fireRate ?? 1) * buff);
  }
}
