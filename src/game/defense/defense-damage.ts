import type { BuildSpec, Enemy } from "../core/types";
import type { DefenseDamageSource } from "../core/defense-types";
import { computeElementMultiplier } from "./defense-taxonomy";

export function buildDefenseDamageSource(spec: BuildSpec): DefenseDamageSource {
  return {
    label: spec.name,
    element: spec.element,
    functionTags: spec.functionTags,
  };
}

export function resolveDefenseDamage(enemy: Enemy, baseDamage: number, source?: DefenseDamageSource): number {
  if (!Number.isFinite(baseDamage) || baseDamage <= 0) {
    return 0;
  }
  const multiplier = computeElementMultiplier(source?.element, enemy.element, enemy.resistances);
  return Math.max(0, baseDamage * multiplier);
}
