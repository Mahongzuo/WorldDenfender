import * as THREE from "three";

import { DEFENSE_STANDARD_WAVE_COUNT } from "../core/game-config";
import {
  clampDefenseDifficulty,
  getDefenseDifficultyRuntimeParams,
} from "./defense-difficulty";
import { createEnemyForWave } from "./defense-runtime";
import { getDefaultEnemyGlbUrl } from "../assets/enemy-default-models";
import { MAPS } from "../data/maps";
import { cellToWorld, expandPathToOrderedCells, mapCols, mapRows, sameCell, traceDefensePathAlongPaintedCells } from "../core/runtime-grid";
import type { DefenseEnemyPath, DefenseEnemyRuntimeConfig, DefenseWaveRule, Enemy, EnemyType, GridCell, MapDefinition } from "../core/types";

/** 塔防刷怪节拍：波次结算、起手延迟、单次刷怪时点 */

export interface DefenseSpawnWaveTimers {
  wave: number;
  waveActive: boolean;
  nextWaveDelay: number;
  spawnRemaining: number;
  spawnCooldown: number;
  currentWaveSpawned?: number;
  authoredSpawnStates?: DefenseAuthoredSpawnState[];
}

export interface DefenseAuthoredSpawnState {
  waveRuleId?: string;
  remaining: number;
  cooldown: number;
  interval: number;
}

export type DefenseSpawnSideEffect =
  | { kind: "economyGrant"; amount: number }
  | { kind: "toastWaveClearReward"; reward: number; completedWave: number }
  | { kind: "toastWaveBegins"; wave: number }
  | { kind: "spawnEnemy"; spawnOrdinal?: number; waveRuleId?: string }
  /** 清完标准 20 波：已发奖励，需在宿主侧弹出无尽/结算抉择并冻结节拍 */
  | { kind: "defenseStandardVictoryAwaitChoice"; completedWave: number };

export interface DefenseSpawnStepInput {
  dt: number;
  timers: DefenseSpawnWaveTimers;
  enemiesLength: number;
  defenseEndless: boolean;
  /** 塔防难度 1–5 */
  defenseDifficulty: number;
  waveRules?: readonly DefenseWaveRule[];
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
      t.currentWaveSpawned = 0;
      return { timers: t, effects };
    }

    t.wave += 1;
    t.nextWaveDelay = 5;
    t.waveActive = false;
    t.currentWaveSpawned = 0;
    return { timers: t, effects };
  }

  if (!t.waveActive) {
    t.nextWaveDelay -= dt;
    if (t.nextWaveDelay <= 0) {
      t.waveActive = true;
      const authoredRules = getDefenseWaveRulesForWave(input.waveRules, t.wave);
      let count = authoredRules.length
        ? authoredRules.reduce((sum, rule) => sum + rule.count, 0)
        : (5 + t.wave * 2) * diff.spawnCountMult;
      let cdBase = authoredRules[0]?.interval ?? Math.max(0.42, 1.05 - t.wave * 0.025);

      if (!authoredRules.length && defenseEndless && t.wave > DEFENSE_STANDARD_WAVE_COUNT) {
        const over = t.wave - DEFENSE_STANDARD_WAVE_COUNT;
        count += Math.floor(8 + over * 5 + over * over * 0.35);
        cdBase = Math.max(0.1, cdBase - (0.048 + over * 0.038));
      }

      cdBase *= authoredRules.length ? 1 : diff.spawnIntervalMult;
      t.spawnRemaining = Math.min(160, Math.max(1, Math.round(count)));
      t.spawnCooldown = cdBase;
      t.currentWaveSpawned = 0;
      t.authoredSpawnStates = authoredRules.length
        ? authoredRules.map((rule) => ({
            waveRuleId: rule.id,
            remaining: Math.max(1, Math.round(Number(rule.count) || 1)),
            cooldown: Math.max(0.1, Number(rule.interval) || 1),
            interval: Math.max(0.1, Number(rule.interval) || 1),
          }))
        : [];
      effects.push({ kind: "toastWaveBegins", wave: t.wave });
    }
    return { timers: t, effects };
  }

  if (t.spawnRemaining <= 0) {
    return { timers: t, effects };
  }

  if (t.authoredSpawnStates?.length) {
    for (const lane of t.authoredSpawnStates) {
      if (lane.remaining <= 0) {
        continue;
      }
      lane.cooldown -= dt;
      while (lane.remaining > 0 && lane.cooldown <= 0) {
        effects.push({ kind: "spawnEnemy", waveRuleId: lane.waveRuleId });
        lane.remaining -= 1;
        t.spawnRemaining = Math.max(0, t.spawnRemaining - 1);
        lane.cooldown += lane.interval;
      }
    }
    t.authoredSpawnStates = t.authoredSpawnStates.filter((lane) => lane.remaining > 0);
    if (!t.authoredSpawnStates.length) {
      t.spawnCooldown = 0;
    }
    return { timers: t, effects };
  }


  t.spawnCooldown -= dt;
  if (t.spawnCooldown <= 0) {
    const authoredRules = getDefenseWaveRulesForWave(input.waveRules, t.wave);
    const spawnOrdinal = t.currentWaveSpawned ?? 0;
    const activeRule = selectDefenseWaveRuleForOrdinal(authoredRules, spawnOrdinal);
    effects.push({ kind: "spawnEnemy", spawnOrdinal, waveRuleId: activeRule?.id });
    t.spawnRemaining -= 1;
    t.currentWaveSpawned = spawnOrdinal + 1;

    const nextRule = selectDefenseWaveRuleForOrdinal(authoredRules, spawnOrdinal + 1);
    let nextCd = nextRule?.interval ?? Math.max(0.42, 1.05 - t.wave * 0.025);
    if (!authoredRules.length && defenseEndless && t.wave > DEFENSE_STANDARD_WAVE_COUNT) {
      const over = t.wave - DEFENSE_STANDARD_WAVE_COUNT;
      nextCd = Math.max(0.085, nextCd - (0.04 + over * 0.03));
    } else if (!authoredRules.length && defenseEndless) {
      nextCd *= 0.92;
    }
    nextCd *= authoredRules.length ? 1 : diff.spawnIntervalMult;
    t.spawnCooldown = nextCd;
  }

  return { timers: t, effects };
}

export interface SpawnDefenseEnemyDeps {
  defenseMapIndex: number;
  wave: number;
  spawnOrdinal?: number;
  waveRuleId?: string;
  defenseEndless: boolean;
  defenseDifficulty: number;
  enemies: Enemy[];
  enemyGroup: THREE.Group;
  allocateUid(): number;
  applyGeoSquash(mesh: THREE.Object3D): void;
  syncEnemyHealthBars(enemy: Enemy): void;
  replaceEnemyVisualMaybe(enemy: Enemy): void;
}

function sanitizeEnemyTypeId(value: string | undefined): EnemyType | undefined {
  if (!value) return undefined;
  switch (value) {
    case "basic":
    case "scout":
    case "hacker":
    case "tank":
    case "swarm":
      return value;
    case "enemy-heavy":
      return "tank";
    case "enemy-drone":
      return "basic";
  }
  // Fallback: map custom editor enemy type ids to runtime archetypes
  const lower = value.toLowerCase();
  if (lower.includes("scout") || lower.includes("fast") || lower.includes("fly") || lower.includes("drone-fast")) return "scout";
  if (lower.includes("jammer") || lower.includes("hack") || lower.includes("signal") || lower.includes("caster")) return "hacker";
  if (lower.includes("heavy") || lower.includes("tank") || lower.includes("shield") || lower.includes("wall")) return "tank";
  if (lower.includes("swarm") || lower.includes("horde") || lower.includes("group") || lower.includes("cluster")) return "swarm";
  if (lower.includes("drone") || lower.includes("basic") || lower.includes("grunt") || lower.includes("soldier")) return "basic";
  return undefined;
}

function clampWaveRule(raw: DefenseWaveRule): DefenseWaveRule {
  return {
    ...raw,
    waveNumber: Math.max(1, Math.round(Number(raw.waveNumber) || 1)),
    count: Math.max(1, Math.round(Number(raw.count) || 1)),
    interval: Math.max(0.1, Number(raw.interval) || 1),
  };
}

export function getDefenseWaveRulesForWave(
  rules: readonly DefenseWaveRule[] | undefined,
  wave: number,
): DefenseWaveRule[] {
  if (!rules?.length) return [];
  return rules
    .map(clampWaveRule)
    .filter((rule) => rule.waveNumber === wave)
    .sort((a, b) => String(a.spawnPointId || a.id || "").localeCompare(String(b.spawnPointId || b.id || "")));
}

function selectDefenseWaveRuleForOrdinal(
  rules: readonly DefenseWaveRule[],
  ordinal: number,
): DefenseWaveRule | undefined {
  let seen = 0;
  for (const rule of rules) {
    const count = Math.max(1, Math.round(Number(rule.count) || 1));
    if (ordinal < seen + count) return rule;
    seen += count;
  }
  return rules[rules.length - 1];
}

function sameGridCell(a: GridCell | undefined, b: GridCell | undefined): boolean {
  return !!a && !!b && a.col === b.col && a.row === b.row;
}

function gridCellDistance(a: GridCell | undefined, b: GridCell | undefined): number {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

function orientPathCellsFromSpawn(cells: readonly GridCell[], spawn: GridCell | undefined): GridCell[] {
  if (!cells.length || !spawn) return cells.slice();
  const forwardStartDistance = gridCellDistance(cells[0], spawn);
  const reverseStartDistance = gridCellDistance(cells[cells.length - 1], spawn);
  const oriented = reverseStartDistance < forwardStartDistance ? cells.slice().reverse() : cells.slice();
  return sameGridCell(oriented[0], spawn) ? oriented : [spawn, ...oriented];
}

function orderedPathWorldPoints(
  cells: readonly GridCell[],
  spawn: GridCell | undefined,
  map: MapDefinition,
): THREE.Vector3[] {
  if (!spawn) {
    return expandPathToOrderedCells(orientPathCellsFromSpawn(cells, spawn)).map((c) => cellToWorld(c));
  }
  if (!cells.length) {
    return expandPathToOrderedCells(orientPathCellsFromSpawn(cells, spawn)).map((c) => cellToWorld(c));
  }
  const cols = mapCols(map);
  const rows = mapRows(map);
  const goal =
    map.path?.length >= 1 ? map.path[map.path.length - 1]! : cells[cells.length - 1]!;
  const spawnCell = { col: spawn.col, row: spawn.row };
  if (sameCell(spawnCell, goal)) {
    return [cellToWorld(spawnCell)];
  }
  const traced = traceDefensePathAlongPaintedCells(cells, spawnCell, goal, cols, rows);
  const chain = traced?.length
    ? traced
    : expandPathToOrderedCells(orientPathCellsFromSpawn(cells, spawn));
  return chain.map((c) => cellToWorld(c));
}

function resolveEnemyPath(map: MapDefinition, rule: DefenseWaveRule | undefined): {
  enemyType?: EnemyType;
  enemyTypeId?: string;
  worldPoints: THREE.Vector3[];
} {
  const spawnById = rule?.spawnPointId
    ? map.spawnPoints?.find((point) => point.id === rule.spawnPointId)
    : undefined;
  const pathId = rule?.pathId || spawnById?.pathId;
  const spawn = spawnById
    ?? (pathId ? map.spawnPoints?.find((point) => point.pathId === pathId) : undefined)
    ?? map.spawnPoints?.[0];
  const path = pathId
    ? map.enemyPaths?.find((candidate: DefenseEnemyPath) => candidate.id === pathId && candidate.cells.length)
    : undefined;
  const fallbackPath = map.enemyPaths?.find((candidate) => candidate.cells.length);
  const cells = path?.cells?.length ? path.cells : fallbackPath?.cells?.length ? fallbackPath.cells : map.path;
  const authoredEnemyTypeId = String(rule?.enemyTypeId || spawn?.enemyTypeId || "").trim();
  return {
    enemyTypeId: authoredEnemyTypeId || undefined,
    enemyType: sanitizeEnemyTypeId(authoredEnemyTypeId),
    worldPoints: orderedPathWorldPoints(cells.length ? cells : map.path, spawn, map),
  };
}

function findDefenseEnemyConfig(map: MapDefinition, enemyTypeId: string | undefined): DefenseEnemyRuntimeConfig | undefined {
  const resolvedId = String(enemyTypeId || "").trim();
  if (!resolvedId || !map.defenseEnemyConfigs?.length) {
    return undefined;
  }
  return map.defenseEnemyConfigs.find((entry) => String(entry.id || "").trim() === resolvedId);
}

function applyRuntimeEnemyConfig(enemy: Enemy, config: DefenseEnemyRuntimeConfig | undefined): void {
  if (!config) {
    return;
  }
  if (config.name) {
    enemy.displayName = config.name;
  }
  if (config.modelPath) {
    enemy.modelPath = config.modelPath;
  }
  if (config.modelScale && config.modelScale > 0) {
    enemy.modelScale = config.modelScale;
  }
  if (config.hp && config.hp > 0) {
    enemy.hp = config.hp;
    enemy.maxHp = config.hp;
  }
  if (config.speed && config.speed > 0) {
    enemy.speed = config.speed;
  }
  if (config.reward != null && config.reward >= 0) {
    enemy.reward = config.reward;
  }
  if (config.towerSiegeDps != null && config.towerSiegeDps >= 0) {
    enemy.towerSiegeDps = config.towerSiegeDps;
  }
}

export function spawnDefenseWaveEnemy(deps: SpawnDefenseEnemyDeps): void {
  const map = MAPS[deps.defenseMapIndex];
  const rules = getDefenseWaveRulesForWave(map.waveRules, deps.wave);
  const activeRule = deps.waveRuleId
    ? rules.find((rule) => rule.id === deps.waveRuleId)
    : selectDefenseWaveRuleForOrdinal(rules, deps.spawnOrdinal ?? 0);
  const resolvedPath = resolveEnemyPath(map, activeRule);
  const authoredEnemyConfig = findDefenseEnemyConfig(map, resolvedPath.enemyTypeId);
  const resolvedEnemyType =
    resolvedPath.enemyType || sanitizeEnemyTypeId(authoredEnemyConfig?.id) || sanitizeEnemyTypeId(authoredEnemyConfig?.name) || "basic";
  const start = resolvedPath.worldPoints[0] ?? cellToWorld(map.path[0]);
  const enemy = createEnemyForWave({
    uid: deps.allocateUid(),
    wave: deps.wave,
    start,
    enemyType: resolvedEnemyType,
    flavor: map.defenseFlavor,
    defenseEndless: deps.defenseEndless,
    defenseDifficulty: deps.defenseDifficulty,
  });
  applyRuntimeEnemyConfig(enemy, authoredEnemyConfig);
  if (activeRule?.overrideModelPath) {
    enemy.modelPath = activeRule.overrideModelPath;
  }
  if (activeRule?.overrideModelScale && activeRule.overrideModelScale > 0) {
    enemy.modelScale = activeRule.overrideModelScale;
  }
  enemy.pathWorldPoints = resolvedPath.worldPoints;
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
