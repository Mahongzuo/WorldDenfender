export const DEFENSE_ELEMENTS = ["force", "thermal", "light", "electric", "sound"];
export const DEFENSE_ELEMENT_LABELS = {
    force: "力",
    thermal: "热",
    light: "光",
    electric: "电",
    sound: "声",
};
export const DEFENSE_FUNCTION_LABELS = {
    singleTarget: "单体攻击",
    areaAttack: "群体攻击",
    paralysis: "瘫痪",
    healing: "治疗",
    damageOverTime: "持续 debuff",
};
export const DEFENSE_STATUS_LABELS = {
    slow: "减速",
    stun: "眩晕",
    paralysis: "瘫痪",
    electromagneticInterference: "电磁干扰",
    thermalEffect: "热效应",
    damageOverTime: "持续伤害",
};
const ELEMENT_ADVANTAGE = {
    force: "sound",
    sound: "electric",
    electric: "light",
    light: "thermal",
    thermal: "force",
};
export const DEFAULT_DEFENSE_CONSUMABLES = [
    {
        id: "em-shield",
        name: "电磁屏蔽器",
        description: "解除防御塔的电磁干扰与瘫痪。",
        icon: "EM",
        cost: 45,
        cleanseStatuses: ["electromagneticInterference", "paralysis", "stun"],
        maxCopies: 3,
    },
    {
        id: "thermal-coolant",
        name: "热效应冷却剂",
        description: "解除热效应与持续伤害。",
        icon: "TH",
        cost: 40,
        cleanseStatuses: ["thermalEffect", "damageOverTime"],
        maxCopies: 3,
    },
    {
        id: "stability-purifier",
        name: "稳态净化器",
        description: "解除大多数塔防负面状态。",
        icon: "ST",
        cost: 75,
        cleanseStatuses: ["electromagneticInterference", "thermalEffect", "damageOverTime", "paralysis", "stun", "slow"],
        maxCopies: 2,
    },
];
let consumableOverrides = [];
export function getDefenseConsumables() {
    const byId = new Map();
    for (const item of DEFAULT_DEFENSE_CONSUMABLES) {
        byId.set(item.id, { ...item, cleanseStatuses: [...item.cleanseStatuses] });
    }
    for (const item of consumableOverrides) {
        byId.set(item.id, { ...item, cleanseStatuses: [...item.cleanseStatuses] });
    }
    return [...byId.values()];
}
export function setDefenseConsumableOverrides(items) {
    consumableOverrides = items.map((item) => ({ ...item, cleanseStatuses: [...item.cleanseStatuses] }));
}
export function resetDefenseConsumableOverrides() {
    consumableOverrides = [];
}
export function getDefenseConsumableById(id) {
    return getDefenseConsumables().find((item) => item.id === id) ?? null;
}
export function sanitizeDefenseElement(value, fallback) {
    return DEFENSE_ELEMENTS.includes(value) ? value : fallback;
}
export function sanitizeDefenseFunctionTags(value) {
    const valid = new Set(Object.keys(DEFENSE_FUNCTION_LABELS));
    const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
    return source.filter((tag) => valid.has(String(tag))).map((tag) => tag);
}
export function sanitizeDefenseStatusIds(value) {
    const valid = new Set(Object.keys(DEFENSE_STATUS_LABELS));
    const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
    return source
        .map((item) => String(item).trim())
        .filter((status) => valid.has(status));
}
export function sanitizeDefenseResistanceProfile(value) {
    const source = value && typeof value === "object" ? value : {};
    const out = {};
    for (const element of DEFENSE_ELEMENTS) {
        const raw = Number(source[element]);
        if (Number.isFinite(raw) && raw > 0) {
            out[element] = Math.min(Math.max(raw, 0.05), 5);
        }
    }
    return out;
}
export function computeElementMultiplier(attacker, defender, resistances) {
    const resistance = attacker && resistances?.[attacker] !== undefined ? resistances[attacker] ?? 1 : 1;
    if (!attacker || !defender) {
        return resistance;
    }
    if (ELEMENT_ADVANTAGE[attacker] === defender) {
        return 1.25 * resistance;
    }
    if (ELEMENT_ADVANTAGE[defender] === attacker) {
        return 0.85 * resistance;
    }
    return resistance;
}
