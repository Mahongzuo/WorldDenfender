import { sanitizeDefenseElement, sanitizeDefenseResistanceProfile } from "./defense-taxonomy";
const DEFAULT_ENEMY_ARCHETYPES = {
    basic: { type: "basic", element: "force" },
    scout: { type: "scout", element: "electric", resistances: { electric: 0.9, sound: 1.1 } },
    hacker: { type: "hacker", element: "sound", resistances: { electric: 0.9, light: 1.1 } },
    tank: { type: "tank", element: "thermal", resistances: { force: 0.9, light: 1.1 } },
    swarm: { type: "swarm", element: "light", resistances: { thermal: 0.9, electric: 1.1 } },
};
let enemyOverrides = {};
export function resetDefenseEnemyArchetypeOverrides() {
    enemyOverrides = {};
}
export function setDefenseEnemyArchetypeOverrides(overrides) {
    enemyOverrides = { ...overrides };
}
export function getDefenseEnemyArchetypeSpec(type) {
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
export function parseEnemyArchetypeOverride(raw) {
    if (!raw || typeof raw !== "object") {
        return null;
    }
    const item = raw;
    const element = sanitizeDefenseElement(item.element);
    const resistances = sanitizeDefenseResistanceProfile(item.resistances);
    const stats = item.stats && typeof item.stats === "object" ? item.stats : {};
    const displayName = typeof item.name === "string" ? item.name.trim() : "";
    const assetRefs = item.assetRefs && typeof item.assetRefs === "object"
        ? item.assetRefs
        : {};
    const modelPath = typeof assetRefs.modelPath === "string" ? assetRefs.modelPath.trim() : "";
    const rawModelScale = Number(assetRefs.modelScale);
    const modelScale = Number.isFinite(rawModelScale) && rawModelScale > 0 ? rawModelScale : undefined;
    const hp = Number(stats.hp);
    const speed = Number(stats.speed);
    const reward = Number(stats.reward);
    const towerSiegeDps = Number(stats.attack);
    if (!element &&
        Object.keys(resistances).length === 0 &&
        !displayName &&
        !modelPath &&
        !modelScale &&
        !Number.isFinite(hp) &&
        !Number.isFinite(speed) &&
        !Number.isFinite(reward) &&
        !Number.isFinite(towerSiegeDps)) {
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
