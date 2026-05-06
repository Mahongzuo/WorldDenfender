import type { Building, Enemy } from "../core/types";
import type { DefenseEffectSpec, DefenseRuntimeStatus, DefenseStatusId } from "../core/defense-types";

function upsertStatus(list: DefenseRuntimeStatus[] | undefined, status: DefenseRuntimeStatus): DefenseRuntimeStatus[] {
  const next = list ?? [];
  const existing = next.find((item) => item.id === status.id);
  if (existing) {
    existing.until = Math.max(existing.until, status.until);
    existing.magnitude = status.magnitude ?? existing.magnitude;
    existing.tickDamage = status.tickDamage ?? existing.tickDamage;
    existing.element = status.element ?? existing.element;
    existing.nextTickAt = status.nextTickAt ?? existing.nextTickAt;
    return next;
  }
  next.push(status);
  return next;
}

export function applyDefenseEffectToEnemy(enemy: Enemy, effect: DefenseEffectSpec, elapsed: number): void {
  const duration = Math.max(0, Number(effect.duration) || 0);
  if (duration <= 0) {
    return;
  }
  const until = elapsed + duration;
  switch (effect.statusId) {
    case "slow":
      enemy.slowFactor = Math.min(enemy.slowFactor || 1, effect.magnitude ?? 0.5);
      enemy.slowUntil = Math.max(enemy.slowUntil, until);
      break;
    case "stun":
    case "paralysis":
      enemy.stunUntil = Math.max(enemy.stunUntil, until);
      break;
    case "thermalEffect":
    case "damageOverTime":
      enemy.activeStatuses = upsertStatus(enemy.activeStatuses, {
        id: effect.statusId,
        until,
        magnitude: effect.magnitude,
        tickDamage: effect.tickDamage ?? effect.magnitude ?? 0,
        element: effect.element,
        nextTickAt: elapsed + 1,
      });
      break;
    default:
      enemy.activeStatuses = upsertStatus(enemy.activeStatuses, { id: effect.statusId, until, magnitude: effect.magnitude });
      break;
  }
}

export function applyDefenseEffectToBuilding(building: Building, effect: DefenseEffectSpec, elapsed: number): void {
  const duration = Math.max(0, Number(effect.duration) || 0);
  if (duration <= 0) {
    return;
  }
  const until = elapsed + duration;
  building.activeStatuses = upsertStatus(building.activeStatuses, {
    id: effect.statusId,
    until,
    magnitude: effect.magnitude,
    tickDamage: effect.tickDamage,
    element: effect.element,
  });
  if (effect.statusId === "electromagneticInterference" || effect.statusId === "paralysis" || effect.statusId === "stun") {
    building.cooldown = Math.max(building.cooldown, effect.magnitude ?? duration);
  }
}

export function applyBuildingEffectsToEnemy(building: Building, enemy: Enemy, elapsed: number): void {
  if (building.spec.slowFactor && building.spec.slowDuration) {
    applyDefenseEffectToEnemy(enemy, {
      statusId: "slow",
      duration: building.spec.slowDuration,
      magnitude: building.spec.slowFactor,
      element: building.spec.element,
    }, elapsed);
  }
  for (const effect of building.spec.effects ?? []) {
    applyDefenseEffectToEnemy(enemy, { ...effect, element: effect.element ?? building.spec.element }, elapsed);
  }
}

export function tickDefenseEnemyStatuses(options: {
  dt: number;
  elapsed: number;
  enemies: Enemy[];
  damageEnemy(enemy: Enemy, damage: number): void;
}): void {
  for (const enemy of [...options.enemies]) {
    if (!enemy.activeStatuses?.length || enemy.hp <= 0) {
      continue;
    }
    enemy.activeStatuses = enemy.activeStatuses.filter((status) => status.until > options.elapsed);
    for (const status of enemy.activeStatuses) {
      if (!status.tickDamage || status.tickDamage <= 0) {
        continue;
      }
      if ((status.nextTickAt ?? 0) <= options.elapsed) {
        status.nextTickAt = options.elapsed + 1;
        options.damageEnemy(enemy, status.tickDamage);
      }
    }
  }
}

export function cleanseDefenseStatuses(options: {
  enemies: Enemy[];
  buildings: Building[];
  statuses: readonly DefenseStatusId[];
  elapsed: number;
}): number {
  const targets = new Set(options.statuses);
  let cleared = 0;
  for (const enemy of options.enemies) {
    if (targets.has("slow") && enemy.slowUntil > options.elapsed) {
      enemy.slowUntil = 0;
      enemy.slowFactor = 1;
      cleared += 1;
    }
    if ((targets.has("stun") || targets.has("paralysis")) && enemy.stunUntil > options.elapsed) {
      enemy.stunUntil = 0;
      cleared += 1;
    }
    const before = enemy.activeStatuses?.length ?? 0;
    enemy.activeStatuses = enemy.activeStatuses?.filter((status) => !targets.has(status.id)) ?? [];
    cleared += before - enemy.activeStatuses.length;
  }
  for (const building of options.buildings) {
    const before = building.activeStatuses?.length ?? 0;
    building.activeStatuses = building.activeStatuses?.filter((status) => !targets.has(status.id)) ?? [];
    const removed = before - building.activeStatuses.length;
    if (removed > 0) {
      building.cooldown = Math.min(building.cooldown, 0.2);
      cleared += removed;
    }
  }
  return cleared;
}
