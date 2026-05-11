import * as THREE from "three";

import { TILE_SIZE, cellToWorld, distanceXZ } from "../core/runtime-grid";
import { DEFENSE_STANDARD_WAVE_COUNT } from "../core/game-config";
import {
  clampDefenseDifficulty,
  getDefenseDifficultyRuntimeParams,
} from "./defense-difficulty";
import type { Building, DefenseMapFlavor, Enemy, EnemyType } from "../core/types";
import { getDefenseEnemyArchetypeSpec } from "./defense-enemy-archetypes";

interface DefenseEnemyWaveBaseStats {
  hp: number;
  speed: number;
  reward: number;
  color: number;
  scale: number;
  towerSiegeDps: number;
  towerSiegeRadiusWorld: number;
}

function buildDefenseEnemyWaveBaseStats(
  type: EnemyType,
  wave: number,
  diff: ReturnType<typeof getDefenseDifficultyRuntimeParams>,
  defenseEndless: boolean,
): DefenseEnemyWaveBaseStats {
  let towerSiegeDps = 11;
  let towerSiegeRadiusWorld = TILE_SIZE * 0.94;

  let hp = Math.round((78 + wave * 23) * 1.06 * diff.hpMult);
  let speed = (2.02 + wave * 0.055) * diff.speedMult;
  let reward = Math.round((12 + wave * 2) * diff.waveEconomyMult);
  let color = 0xff5c75;
  let scale = 1;

  switch (type) {
    case "scout":
      hp *= 0.4;
      speed *= 1.8;
      color = 0x5c8fff;
      scale = 0.8;
      towerSiegeDps = 7;
      towerSiegeRadiusWorld = TILE_SIZE * 0.86;
      break;
    case "hacker":
      hp *= 1.2;
      color = 0x9d5cff;
      reward *= 1.5;
      towerSiegeDps = 32;
      towerSiegeRadiusWorld = TILE_SIZE * 2.58;
      break;
    case "tank":
      hp *= 3.5;
      speed *= 0.5;
      color = 0xff8c00;
      scale = 1.3;
      reward *= 2;
      towerSiegeDps = 15;
      towerSiegeRadiusWorld = TILE_SIZE * 1.04;
      break;
    case "swarm":
      hp *= 1.5;
      color = 0x24a317;
      reward *= 1.8;
      scale = 1.1;
      towerSiegeDps = 9;
      towerSiegeRadiusWorld = TILE_SIZE * 0.92;
      break;
  }

  towerSiegeDps *= diff.siegeMult;
  towerSiegeRadiusWorld *= 1 + (diff.siegeMult - 1) * 0.52;

  if (defenseEndless && wave > DEFENSE_STANDARD_WAVE_COUNT) {
    const over = wave - DEFENSE_STANDARD_WAVE_COUNT;
    const ramp = 1 + over * 0.15 + over * over * 0.014;
    hp = Math.round(hp * ramp);
    towerSiegeDps *= ramp;
    speed *= 1 + Math.min(0.48, over * 0.028);
    reward *= 1 + over * 0.07;
    towerSiegeRadiusWorld *= 1 + Math.min(0.22, over * 0.016);
  }

  return {
    hp,
    speed,
    reward: Math.round(reward),
    color,
    scale,
    towerSiegeDps,
    towerSiegeRadiusWorld,
  };
}

function scaleAgainstWaveOneBaseline(current: number, waveOne: number, override: number | undefined, round = false): number {
  const overrideValue = Number(override);
  if (!Number.isFinite(overrideValue) || !Number.isFinite(current) || !Number.isFinite(waveOne) || waveOne <= 0) {
    return current;
  }
  const next = current * (overrideValue / waveOne);
  return round ? Math.round(next) : next;
}

export function createEnemyForWave(options: {
  uid: number;
  wave: number;
  start: THREE.Vector3;
  enemyType?: EnemyType;
  random?: () => number;
  flavor?: DefenseMapFlavor;
  defenseEndless?: boolean;
  defenseDifficulty?: number;
}): Enemy {
  const { uid, wave, start, enemyType, random = Math.random, flavor, defenseEndless, defenseDifficulty } = options;
  let type: EnemyType = enemyType ?? "basic";
  const tier = clampDefenseDifficulty(defenseDifficulty ?? 3);
  const diff = getDefenseDifficultyRuntimeParams(tier);
  const typeWave = wave + diff.typeWaveBias;
  const rand = random();
  if (!enemyType && typeWave >= 10 && rand < 0.15) {
    type = "swarm";
  } else if (!enemyType && typeWave >= 8 && rand < 0.25) {
    type = "tank";
  } else if (!enemyType && typeWave >= 5 && rand < 0.35) {
    type = "hacker";
  } else if (!enemyType && typeWave >= 3 && rand < 0.5) {
    type = "scout";
  }

  const archetype = getDefenseEnemyArchetypeSpec(type);
  const waveStats = buildDefenseEnemyWaveBaseStats(type, wave, diff, !!defenseEndless);
  const waveOneStats = buildDefenseEnemyWaveBaseStats(type, 1, diff, false);
  const hp = Math.max(1, scaleAgainstWaveOneBaseline(waveStats.hp, waveOneStats.hp, archetype.hp, true));
  const speed = scaleAgainstWaveOneBaseline(waveStats.speed, waveOneStats.speed, archetype.speed);
  const reward = Math.max(0, scaleAgainstWaveOneBaseline(waveStats.reward, waveOneStats.reward, archetype.reward, true));
  const towerSiegeDps = Math.max(0, scaleAgainstWaveOneBaseline(waveStats.towerSiegeDps, waveOneStats.towerSiegeDps, archetype.towerSiegeDps));
  const towerSiegeRadiusWorld = waveStats.towerSiegeRadiusWorld;
  const color = waveStats.color;
  const scale = waveStats.scale;

  const healthBar = new THREE.Mesh(
    new THREE.BoxGeometry(1.18 * scale, 0.12, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x34ff6a, transparent: true, opacity: 0.98, depthTest: false, depthWrite: false }),
  );
  healthBar.renderOrder = 30;
  healthBar.userData.isEnemyHealthBar = true;
  const healthBarBack = new THREE.Mesh(
    new THREE.BoxGeometry(1.32 * scale, 0.18, 0.11),
    new THREE.MeshBasicMaterial({ color: 0x10131a, transparent: true, opacity: 0.78, depthTest: false, depthWrite: false }),
  );
  healthBarBack.renderOrder = 29;
  healthBarBack.userData.isEnemyHealthBar = true;
  const healthBarGroup = new THREE.Group();
  healthBarGroup.userData.isEnemyHealthBar = true;
  healthBarGroup.userData.isEnemyHealthBarRoot = true;
  healthBarGroup.add(healthBarBack, healthBar);

  const localized = archetype.displayName?.trim() || flavor?.enemyNames?.[type];

  const enemy: Enemy = {
    uid,
    type,
    mesh: new THREE.Group(),
    healthBar,
    hp,
    maxHp: hp,
    element: archetype.element,
    resistances: archetype.resistances,
    speed,
    reward,
    segment: 0,
    slowUntil: 0,
    slowFactor: 1,
    blockedBy: null,
    stunUntil: 0,
    ...(localized ? { displayName: localized } : {}),
    ...(archetype.modelPath ? { modelPath: archetype.modelPath } : {}),
    ...(archetype.modelScale ? { modelScale: archetype.modelScale } : {}),
    towerSiegeDps,
    towerSiegeRadiusWorld,
  };

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.45,
    emissive: color,
    emissiveIntensity: 0.18,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.45 * scale, 14, 10), bodyMaterial);
  body.position.y = 0.46 * scale;
  body.castShadow = true;
  healthBar.position.set(0, 0, 0.02);
  healthBarBack.position.set(0, 0, 0);
  healthBarGroup.position.set(0, 1.15 * scale, 0);
  enemy.mesh.add(body, healthBarGroup);
  enemy.mesh.position.set(start.x, 0, start.z);

  return enemy;
}

export function getTowerBuffMultiplier(building: Building, buildings: Building[]): number {
  const buildingPosition = cellToWorld(building.cell);
  let multiplier = 1;
  for (const beacon of buildings) {
    if (beacon.spec.id !== "beacon") {
      continue;
    }
    const beaconPosition = cellToWorld(beacon.cell);
    const range = (beacon.spec.buffRange ?? 0) * TILE_SIZE;
    if (distanceXZ(buildingPosition, beaconPosition) <= range) {
      multiplier = Math.max(multiplier, beacon.spec.buffMultiplier ?? 1);
    }
  }
  return multiplier;
}

export function findNearestEnemyTarget(building: Building, enemies: Enemy[]): Enemy | null {
  const position = cellToWorld(building.cell);
  const range = (building.spec.range ?? 0) * TILE_SIZE;
  let best: Enemy | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const enemy of enemies) {
    const distance = distanceXZ(position, enemy.mesh.position);
    if (distance <= range && distance < bestDistance) {
      best = enemy;
      bestDistance = distance;
    }
  }

  return best;
}
