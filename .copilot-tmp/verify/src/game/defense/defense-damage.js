import { computeElementMultiplier } from "./defense-taxonomy";
export function buildDefenseDamageSource(spec) {
    return {
        label: spec.name,
        element: spec.element,
        functionTags: spec.functionTags,
    };
}
export function resolveDefenseDamage(enemy, baseDamage, source) {
    if (!Number.isFinite(baseDamage) || baseDamage <= 0) {
        return 0;
    }
    const multiplier = computeElementMultiplier(source?.element, enemy.element, enemy.resistances);
    return Math.max(0, baseDamage * multiplier);
}
