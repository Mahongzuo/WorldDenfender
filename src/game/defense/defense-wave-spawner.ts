import * as THREE from "three";

import { createEnemyForWave } from "./defense-runtime";
import { getDefaultEnemyGlbUrl } from "../assets/enemy-default-models";
import { MAPS } from "../data/maps";
import { cellToWorld } from "../core/runtime-grid";
import type { Enemy } from "../core/types";

/** 塔防刷怪节拍：波次结算、起手延迟、单次刷怪时点 */

export interface DefenseSpawnWaveTimers {
  wave: number;
  waveActive: boolean;
  nextWaveDelay: number;
  spawnRemaining: number;
  spawnCooldown: number;
}

export type DefenseSpawnSideEffect =
  | { kind: "economyGrant"; amount: number }
  | { kind: "toastWaveClearReward"; reward: number }
  | { kind: "toastWaveBegins"; wave: number }
  | { kind: "spawnEnemy" };

export interface DefenseSpawnStepInput {
  dt: number;
  timers: DefenseSpawnWaveTimers;
  enemiesLength: number;
}

export interface DefenseSpawnStepOutput {
  timers: DefenseSpawnWaveTimers;
  effects: DefenseSpawnSideEffect[];
}

export function advanceDefenseSpawnState(input: DefenseSpawnStepInput): DefenseSpawnStepOutput {
  let t = { ...input.timers };
  const effects: DefenseSpawnSideEffect[] = [];
  const { dt, enemiesLength } = input;

  if (t.waveActive && t.spawnRemaining === 0 && enemiesLength === 0) {
    const reward = 70 + t.wave * 12;
    effects.push({ kind: "economyGrant", amount: reward });
    effects.push({ kind: "toastWaveClearReward", reward });
    t.wave += 1;
    t.nextWaveDelay = 5;
    t.waveActive = false;
    return { timers: t, effects };
  }

  if (!t.waveActive) {
    t.nextWaveDelay -= dt;
    if (t.nextWaveDelay <= 0) {
      t.waveActive = true;
      t.spawnRemaining = 5 + t.wave * 2;
      t.spawnCooldown = 0;
      effects.push({ kind: "toastWaveBegins", wave: t.wave });
    }
    return { timers: t, effects };
  }

  if (t.spawnRemaining <= 0) {
    return { timers: t, effects };
  }

  t.spawnCooldown -= dt;
  if (t.spawnCooldown <= 0) {
    effects.push({ kind: "spawnEnemy" });
    t.spawnRemaining -= 1;
    t.spawnCooldown = Math.max(0.42, 1.05 - t.wave * 0.025);
  }

  return { timers: t, effects };
}

export interface SpawnDefenseEnemyDeps {
  defenseMapIndex: number;
  wave: number;
  enemies: Enemy[];
  enemyGroup: THREE.Group;
  allocateUid(): number;
  applyGeoSquash(mesh: THREE.Object3D): void;
  syncEnemyHealthBars(enemy: Enemy): void;
  replaceEnemyVisualMaybe(enemy: Enemy): void;
}

export function spawnDefenseWaveEnemy(deps: SpawnDefenseEnemyDeps): void {
  const map = MAPS[deps.defenseMapIndex];
  const start = cellToWorld(map.path[0]);
  const enemy = createEnemyForWave({
    uid: deps.allocateUid(),
    wave: deps.wave,
    start,
  });
  const usesDefaultGltf = getDefaultEnemyGlbUrl(enemy.type) !== undefined;
  if (!usesDefaultGltf) {
    deps.applyGeoSquash(enemy.mesh);
    deps.syncEnemyHealthBars(enemy);
  }

  deps.enemies.push(enemy);
  deps.enemyGroup.add(enemy.mesh);
  if (usesDefaultGltf) {
    deps.replaceEnemyVisualMaybe(enemy);
  }
}
