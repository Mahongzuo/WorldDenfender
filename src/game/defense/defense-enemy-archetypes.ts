import type { EnemyType } from "../core/types";
import type { DefenseElement, DefenseResistanceProfile } from "../core/defense-types";
import { sanitizeDefenseElement, sanitizeDefenseResistanceProfile } from "./defense-taxonomy";

export interface DefenseEnemyArchetypeSpec {
  type: EnemyType;
  element: DefenseElement;
  resistances?: DefenseResistanceProfile;
  displayName?: string;
  modelPath?: string;
  modelScale?: number;
  hp?: number;
  speed?: number;
  reward?: number;
  towerSiegeDps?: number;
}

const DEFAULT_ENEMY_ARCHETYPES: Record<EnemyType, DefenseEnemyArchetypeSpec> = {
  basic: { type: "basic", element: "force" },
  scout: { type: "scout", element: "electric", resistances: { electric: 0.9, sound: 1.1 } },
  hacker: { type: "hacker", element: "sound", resistances: { electric: 0.9, light: 1.1 } },
  tank: { type: "tank", element: "thermal", resistances: { force: 0.9, light: 1.1 } },
  swarm: { type: "swarm", element: "light", resistances: { thermal: 0.9, electric: 1.1 } },
};

let enemyOverrides: Partial<Record<EnemyType, Partial<DefenseEnemyArchetypeSpec>>> = {};

export function resetDefenseEnemyArchetypeOverrides(): void {
  enemyOverrides = {};
}

export function setDefenseEnemyArchetypeOverrides(overrides: Partial<Record<EnemyType, Partial<DefenseEnemyArchetypeSpec>>>): void {
  enemyOverrides = { ...overrides };
}

export function getDefenseEnemyArchetypeSpec(type: EnemyType): DefenseEnemyArchetypeSpec {
  const base = DEFAULT_ENEMY_ARCHETYPES[type];
  const override = enemyOverrides[type] ?? {};
  return {
    ...base,
    ...override,
    type,
    element: override.element ?? base.element,
    resistances: {
      ...(base.resistances ?? {}),
      ...(override.resistances ?? {}),
    },
  };
}

export function parseEnemyArchetypeOverride(raw: unknown): Partial<DefenseEnemyArchetypeSpec> | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const item = raw as Record<string, unknown>;
  const element = sanitizeDefenseElement(item.element);
  const resistances = sanitizeDefenseResistanceProfile(item.resistances);
  const stats = item.stats && typeof item.stats === "object" ? (item.stats as Record<string, unknown>) : {};
  const displayName = typeof item.name === "string" ? item.name.trim() : "";
  const assetRefs = item.assetRefs && typeof item.assetRefs === "object"
    ? (item.assetRefs as Record<string, unknown>)
    : {};
  const modelPath = typeof assetRefs.modelPath === "string" ? assetRefs.modelPath.trim() : "";
  const rawModelScale = Number(assetRefs.modelScale);
  const modelScale = Number.isFinite(rawModelScale) && rawModelScale > 0 ? rawModelScale : undefined;
  const hp = Number(stats.hp);
  const speed = Number(stats.speed);
  const reward = Number(stats.reward);
  const towerSiegeDps = Number(stats.attack);
  if (
    !element &&
    Object.keys(resistances).length === 0 &&
    !displayName &&
    !modelPath &&
    !modelScale &&
    !Number.isFinite(hp) &&
    !Number.isFinite(speed) &&
    !Number.isFinite(reward) &&
    !Number.isFinite(towerSiegeDps)
  ) {
    return null;
  }
  return {
    ...(element ? { element } : {}),
    ...(Object.keys(resistances).length ? { resistances } : {}),
    ...(displayName ? { displayName } : {}),
    ...(modelPath ? { modelPath } : {}),
    ...(modelScale ? { modelScale } : {}),
    ...(Number.isFinite(hp) && hp > 0 ? { hp } : {}),
    ...(Number.isFinite(speed) && speed > 0 ? { speed } : {}),
    ...(Number.isFinite(reward) && reward >= 0 ? { reward } : {}),
    ...(Number.isFinite(towerSiegeDps) && towerSiegeDps >= 0 ? { towerSiegeDps } : {}),
  };
}
