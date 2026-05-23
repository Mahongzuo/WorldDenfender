import type { ExploreSkillModuleDef, ExploreSkillSlot, ExploreEquippedModule } from "../core/types";

/* ───── 全部技能模组定义（土豆兄弟式肉鸽升级池） ───── */

export const EXPLORE_SKILL_MODULES: readonly ExploreSkillModuleDef[] = [
  // ── 普攻 slot ──
  {
    id: "basic-rapid",
    name: "高频脉冲",
    description: "普攻射速 +35%",
    slot: "basic",
    rarity: 1,
    icon: "⚡",
    cooldownMult: 0.65,
    levelScaling: 0.06,
  },
  {
    id: "basic-power",
    name: "强化弹头",
    description: "普攻伤害 +40%",
    slot: "basic",
    rarity: 1,
    icon: "💥",
    damageMult: 1.4,
    levelScaling: 0.08,
  },
  {
    id: "basic-pierce",
    name: "穿透射线",
    description: "普攻伤害 +25%，弹道穿透",
    slot: "basic",
    rarity: 2,
    icon: "🔫",
    damageMult: 1.25,
    effectTags: ["pierce"],
    levelScaling: 0.06,
  },
  {
    id: "basic-split",
    name: "分裂弹幕",
    description: "普攻发射 3 颗弹丸，单发伤害 -20%",
    slot: "basic",
    rarity: 3,
    icon: "🌀",
    damageMult: 0.8,
    effectTags: ["split3"],
    levelScaling: 0.05,
  },
  {
    id: "basic-homing",
    name: "智能追踪",
    description: "普攻追踪范围 +80%，伤害 +15%",
    slot: "basic",
    rarity: 2,
    icon: "🎯",
    damageMult: 1.15,
    effectTags: ["homing-boost"],
    levelScaling: 0.04,
  },

  // ── E 技能 slot ──
  {
    id: "skillE-chain",
    name: "链式闪电",
    description: "E 技能额外弹射 2 个目标",
    slot: "skillE",
    rarity: 2,
    icon: "⛓️",
    damageMult: 1.1,
    effectTags: ["chain2"],
    levelScaling: 0.06,
  },
  {
    id: "skillE-overload",
    name: "过载核心",
    description: "E 技能伤害 +60%，CD +20%",
    slot: "skillE",
    rarity: 2,
    icon: "🔥",
    damageMult: 1.6,
    cooldownMult: 1.2,
    levelScaling: 0.1,
  },
  {
    id: "skillE-quick",
    name: "快速充能",
    description: "E 技能 CD -40%",
    slot: "skillE",
    rarity: 1,
    icon: "⏩",
    cooldownMult: 0.6,
    levelScaling: 0.05,
  },
  {
    id: "skillE-aoe",
    name: "范围扩散",
    description: "E 技能范围 +50%，伤害 +20%",
    slot: "skillE",
    rarity: 3,
    icon: "💫",
    damageMult: 1.2,
    radiusMult: 1.5,
    levelScaling: 0.07,
  },

  // ── R 技能 slot ──
  {
    id: "skillR-nova",
    name: "新星爆发",
    description: "R 技能伤害 +50%，范围 +30%",
    slot: "skillR",
    rarity: 2,
    icon: "☀️",
    damageMult: 1.5,
    radiusMult: 1.3,
    levelScaling: 0.08,
  },
  {
    id: "skillR-quick",
    name: "战术冷却",
    description: "R 技能 CD -35%",
    slot: "skillR",
    rarity: 1,
    icon: "🕐",
    cooldownMult: 0.65,
    levelScaling: 0.05,
  },
  {
    id: "skillR-execute",
    name: "斩杀协议",
    description: "R 技能对低血量敌人伤害 ×2",
    slot: "skillR",
    rarity: 3,
    icon: "⚔️",
    damageMult: 1.2,
    effectTags: ["execute"],
    levelScaling: 0.06,
  },
  {
    id: "skillR-shield",
    name: "能量护盾",
    description: "释放 R 后获得 3 秒 50% 减伤",
    slot: "skillR",
    rarity: 2,
    icon: "🛡️",
    effectTags: ["shield-on-cast"],
    levelScaling: 0.04,
  },

  // ── 被动 slot ──
  {
    id: "passive-regen",
    name: "纳米修复",
    description: "每秒恢复 1% 最大 HP",
    slot: "passive",
    rarity: 1,
    icon: "💚",
    effectTags: ["regen"],
    levelScaling: 0.15,
  },
  {
    id: "passive-armor",
    name: "合金装甲",
    description: "受到伤害 -20%",
    slot: "passive",
    rarity: 2,
    icon: "🔰",
    effectTags: ["damage-reduction"],
    levelScaling: 0.04,
  },
  {
    id: "passive-xpboost",
    name: "数据加速",
    description: "经验获取 +30%",
    slot: "passive",
    rarity: 1,
    icon: "📊",
    effectTags: ["xp-boost"],
    levelScaling: 0.06,
  },
  {
    id: "passive-crit",
    name: "精密瞄准",
    description: "15% 概率暴击（×2 伤害）",
    slot: "passive",
    rarity: 2,
    icon: "🎯",
    effectTags: ["crit"],
    levelScaling: 0.03,
  },
  {
    id: "passive-speed",
    name: "加速引擎",
    description: "移动速度 +25%",
    slot: "passive",
    rarity: 1,
    icon: "👟",
    effectTags: ["move-speed"],
    levelScaling: 0.05,
  },
  {
    id: "passive-magnet",
    name: "资源磁铁",
    description: "拾取范围 +100%，金钱 +20%",
    slot: "passive",
    rarity: 2,
    icon: "🧲",
    effectTags: ["magnet"],
    levelScaling: 0.04,
  },
];

export function getModuleDef(id: string): ExploreSkillModuleDef | undefined {
  return EXPLORE_SKILL_MODULES.find((m) => m.id === id);
}

/** 根据模组等级计算实际数值倍率 */
export function resolveModuleStats(mod: ExploreEquippedModule): {
  damageMult: number;
  cooldownMult: number;
  radiusMult: number;
  effectTags: string[];
} {
  const def = getModuleDef(mod.moduleId);
  if (!def) {
    return { damageMult: 1, cooldownMult: 1, radiusMult: 1, effectTags: [] };
  }
  const scaling = 1 + (def.levelScaling ?? 0) * (mod.level - 1);
  return {
    damageMult: (def.damageMult ?? 1) * scaling,
    cooldownMult: def.cooldownMult ?? 1,
    radiusMult: (def.radiusMult ?? 1) * (1 + (def.levelScaling ?? 0) * 0.3 * (mod.level - 1)),
    effectTags: def.effectTags ?? [],
  };
}

/** 获取某个 slot 的全部已装备模组聚合数值 */
export function aggregateSlotModules(
  equipped: readonly ExploreEquippedModule[],
  slot: ExploreSkillSlot,
): { damageMult: number; cooldownMult: number; radiusMult: number; effectTags: string[] } {
  let damageMult = 1;
  let cooldownMult = 1;
  let radiusMult = 1;
  const effectTags: string[] = [];
  for (const eq of equipped) {
    const def = getModuleDef(eq.moduleId);
    if (!def || def.slot !== slot) continue;
    const stats = resolveModuleStats(eq);
    damageMult *= stats.damageMult;
    cooldownMult *= stats.cooldownMult;
    radiusMult *= stats.radiusMult;
    effectTags.push(...stats.effectTags);
  }
  return { damageMult, cooldownMult, radiusMult, effectTags };
}

/** 升级时随机选出 3 个模组供玩家挑选（肉鸽经典三选一） */
export function rollUpgradeChoices(
  equipped: readonly ExploreEquippedModule[],
  count = 3,
): ExploreSkillModuleDef[] {
  const pool = [...EXPLORE_SKILL_MODULES];
  // 按稀有度和是否已拥有排权重
  const equippedIds = new Set(equipped.map((e) => e.moduleId));
  const weighted = pool.map((mod) => ({
    mod,
    weight: equippedIds.has(mod.id)
      ? 1.5   // 已有的可以升级，权重略高
      : mod.rarity === 1 ? 3 : mod.rarity === 2 ? 2 : 1,
  }));
  const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);
  const chosen: ExploreSkillModuleDef[] = [];
  const used = new Set<string>();
  for (let i = 0; i < count && weighted.length > 0; i++) {
    let r = Math.random() * totalWeight;
    let picked: ExploreSkillModuleDef | null = null;
    for (const w of weighted) {
      if (used.has(w.mod.id)) continue;
      r -= w.weight;
      if (r <= 0) {
        picked = w.mod;
        break;
      }
    }
    if (!picked) {
      picked = weighted.find((w) => !used.has(w.mod.id))?.mod ?? null;
    }
    if (picked) {
      chosen.push(picked);
      used.add(picked.id);
    }
  }
  return chosen;
}

/** 选择模组后执行装备/升级 */
export function applyModuleChoice(
  equipped: ExploreEquippedModule[],
  moduleId: string,
): { equipped: ExploreEquippedModule[]; toast: string } {
  const def = getModuleDef(moduleId);
  if (!def) {
    return { equipped, toast: "" };
  }
  const existing = equipped.find((e) => e.moduleId === moduleId);
  if (existing) {
    existing.level += 1;
    return {
      equipped,
      toast: `${def.icon} ${def.name} 升级到 Lv.${existing.level}！`,
    };
  }
  equipped.push({ moduleId, level: 1 });
  return {
    equipped,
    toast: `获得新模组 ${def.icon} ${def.name}！`,
  };
}

/** 检查被动效果是否存在 */
export function hasPassiveEffect(equipped: readonly ExploreEquippedModule[], tag: string): boolean {
  for (const eq of equipped) {
    const def = getModuleDef(eq.moduleId);
    if (def?.slot === "passive" && def.effectTags?.includes(tag)) return true;
  }
  return false;
}

/** 获取被动减伤系数（0-1 之间，1 表示无减伤） */
export function getPassiveDamageReduction(equipped: readonly ExploreEquippedModule[]): number {
  let reduction = 1;
  for (const eq of equipped) {
    const def = getModuleDef(eq.moduleId);
    if (!def || def.slot !== "passive" || !def.effectTags?.includes("damage-reduction")) continue;
    const scaling = 1 + (def.levelScaling ?? 0) * (eq.level - 1);
    reduction *= 1 - 0.2 * scaling;
  }
  return Math.max(0.2, reduction);
}

/** 获取被动经验加成倍率 */
export function getPassiveXpMult(equipped: readonly ExploreEquippedModule[]): number {
  let mult = 1;
  for (const eq of equipped) {
    const def = getModuleDef(eq.moduleId);
    if (!def || def.slot !== "passive" || !def.effectTags?.includes("xp-boost")) continue;
    const scaling = 1 + (def.levelScaling ?? 0) * (eq.level - 1);
    mult *= 1 + 0.3 * scaling;
  }
  return mult;
}

/** 获取被动暴击率 */
export function getPassiveCritChance(equipped: readonly ExploreEquippedModule[]): number {
  let chance = 0;
  for (const eq of equipped) {
    const def = getModuleDef(eq.moduleId);
    if (!def || def.slot !== "passive" || !def.effectTags?.includes("crit")) continue;
    const scaling = 1 + (def.levelScaling ?? 0) * (eq.level - 1);
    chance += 0.15 * scaling;
  }
  return Math.min(0.75, chance);
}

/** 获取被动移速加成倍率 */
export function getPassiveSpeedMult(equipped: readonly ExploreEquippedModule[]): number {
  let mult = 1;
  for (const eq of equipped) {
    const def = getModuleDef(eq.moduleId);
    if (!def || def.slot !== "passive" || !def.effectTags?.includes("move-speed")) continue;
    const scaling = 1 + (def.levelScaling ?? 0) * (eq.level - 1);
    mult *= 1 + 0.25 * scaling;
  }
  return mult;
}

/** 获取被动回血（每秒回复占最大 HP 的比例） */
export function getPassiveRegenRatio(equipped: readonly ExploreEquippedModule[]): number {
  let ratio = 0;
  for (const eq of equipped) {
    const def = getModuleDef(eq.moduleId);
    if (!def || def.slot !== "passive" || !def.effectTags?.includes("regen")) continue;
    const scaling = 1 + (def.levelScaling ?? 0) * (eq.level - 1);
    ratio += 0.01 * scaling;
  }
  return ratio;
}
