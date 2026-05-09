import * as THREE from "three";

import { DEFENSE_STANDARD_WAVE_COUNT } from "../core/game-config";
import {
  clampDefenseDifficulty,
  getDefenseDifficultyRuntimeParams,
} from "./defense-difficulty";
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
  | { kind: "toastWaveClearReward"; reward: number; completedWave: number }
  | { kind: "toastWaveBegins"; wave: number }
  | { kind: "spawnEnemy" }
  /** 清完标准 20 波：已发奖励，需在宿主侧弹出无尽/结算抉择并冻结节拍 */
  | { kind: "defenseStandardVictoryAwaitChoice"; completedWave: number };

export interface DefenseSpawnStepInput {
  dt: number;
  timers: DefenseSpawnWaveTimers;
  enemiesLength: number;
  defenseEndless: boolean;
  /** 塔防难度 1–5 */
  defenseDifficulty: number;
  /** 已清第 20 波且玩家尚未选无尽/结算时不推进节拍 */
  defenseVictoryAwaitingChoice: boolean;
}

export interface DefenseSpawnStepOutput {
  timers: DefenseSpawnWaveTimers;
  effects: DefenseSpawnSideEffect[];
}

export function advanceDefenseSpawnState(input: DefenseSpawnStepInput): DefenseSpawnStepOutput {
  if (input.defenseVictoryAwaitingChoice) {
    return { timers: input.timers, effects: [] };
  }

  let t = { ...input.timers };
  const effects: DefenseSpawnSideEffect[] = [];
  const tier = clampDefenseDifficulty(input.defenseDifficulty);
  const diff = getDefenseDifficultyRuntimeParams(tier);
  const { dt, enemiesLength, defenseEndless } = input;

  if (t.waveActive && t.spawnRemaining === 0 && enemiesLength === 0) {
    const completedWave = t.wave;
    const reward = Math.round((70 + completedWave * 12) * diff.waveEconomyMult);
    effects.push({ kind: "economyGrant", amount: reward });
    effects.push({ kind: "toastWaveClearReward", reward, completedWave });

    const standardClearedWithoutEndless = !defenseEndless && completedWave === DEFENSE_STANDARD_WAVE_COUNT;
    if (standardClearedWithoutEndless) {
      effects.push({ kind: "defenseStandardVictoryAwaitChoice", completedWave });
      t.waveActive = false;
      return { timers: t, effects };
    }

    t.wave += 1;
    t.nextWaveDelay = 5;
    t.waveActive = false;
    return { timers: t, effects };
  }

  if (!t.waveActive) {
    t.nextWaveDelay -= dt;
    if (t.nextWaveDelay <= 0) {
      t.waveActive = true;
      let count = (5 + t.wave * 2) * diff.spawnCountMult;
      let cdBase = Math.max(0.42, 1.05 - t.wave * 0.025);

      if (defenseEndless && t.wave > DEFENSE_STANDARD_WAVE_COUNT) {
        const over = t.wave - DEFENSE_STANDARD_WAVE_COUNT;
        count += Math.floor(8 + over * 5 + over * over * 0.35);
        cdBase = Math.max(0.1, cdBase - (0.048 + over * 0.038));
      }

      cdBase *= diff.spawnIntervalMult;
      t.spawnRemaining = Math.min(160, Math.max(1, Math.round(count)));
      t.spawnCooldown = cdBase;
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

    let nextCd = Math.max(0.42, 1.05 - t.wave * 0.025);
    if (defenseEndless && t.wave > DEFENSE_STANDARD_WAVE_COUNT) {
      const over = t.wave - DEFENSE_STANDARD_WAVE_COUNT;
      nextCd = Math.max(0.085, nextCd - (0.04 + over * 0.03));
    } else if (defenseEndless) {
      nextCd *= 0.92;
    }
    nextCd *= diff.spawnIntervalMult;
    t.spawnCooldown = nextCd;
  }

  return { timers: t, effects };
}

export interface SpawnDefenseEnemyDeps {
  defenseMapIndex: number;
  wave: number;
  defenseEndless: boolean;
  defenseDifficulty: number;
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
    flavor: map.defenseFlavor,
    defenseEndless: deps.defenseEndless,
    defenseDifficulty: deps.defenseDifficulty,
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
