import { applyModuleChoice, getPassiveRegenRatio, getPassiveXpMult, rollUpgradeChoices, } from "./explore-skill-modules";
/** Explore mode HP / level / XP / skill modules (decoupled from scene & UI). */
export class ExplorePlayerProgress {
    constructor() {
        Object.defineProperty(this, "hp", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 120
        });
        Object.defineProperty(this, "maxHp", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 120
        });
        Object.defineProperty(this, "level", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        });
        Object.defineProperty(this, "xp", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "xpToNext", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 40
        });
        /** 已装备的技能模组（肉鸽升级积累） */
        Object.defineProperty(this, "equippedModules", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        /** 当前升级待选模组（非空时处于选择暂停状态） */
        Object.defineProperty(this, "pendingUpgradeChoices", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        /** 累计击杀数（用于统计） */
        Object.defineProperty(this, "totalKills", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
    }
    reset() {
        this.hp = 120;
        this.maxHp = 120;
        this.level = 1;
        this.xp = 0;
        this.xpToNext = 40;
        this.equippedModules = [];
        this.pendingUpgradeChoices = [];
        this.totalKills = 0;
    }
    /**
     * Grants XP using the explore kill curve; returns one toast message per level gained.
     */
    addXpFromKillContribution(playerLevelUsed) {
        const amount = 15 + playerLevelUsed * 5;
        return this.addXp(amount);
    }
    addXp(amount) {
        const xpMult = getPassiveXpMult(this.equippedModules);
        const toasts = [];
        this.xp += Math.round(amount * xpMult);
        while (this.xp >= this.xpToNext) {
            this.xp -= this.xpToNext;
            this.level += 1;
            // 肉鸽升级：HP 按等级递增
            const hpGain = 15 + Math.floor(this.level * 1.5);
            this.maxHp += hpGain;
            this.hp = Math.min(this.hp + hpGain, this.maxHp);
            // 经验曲线：前期快后期慢，让玩家在 20 波内升到约 12-18 级
            this.xpToNext = Math.floor(40 + 18 * (this.level - 1) + Math.pow(this.level, 1.6) * 2);
            toasts.push(`等级提升！Lv.${this.level}`);
        }
        return toasts;
    }
    clampHeal(amount) {
        this.hp = Math.min(this.hp + amount, this.maxHp);
    }
    /** 每帧调用：被动回血 */
    tickPassiveRegen(dt) {
        const ratio = getPassiveRegenRatio(this.equippedModules);
        if (ratio > 0 && this.hp < this.maxHp) {
            this.hp = Math.min(this.maxHp, this.hp + this.maxHp * ratio * dt);
        }
    }
    /** 波间暂停时：生成三选一升级 */
    generateUpgradeChoices() {
        this.pendingUpgradeChoices = rollUpgradeChoices(this.equippedModules, 3);
        return this.pendingUpgradeChoices;
    }
    /** 玩家选择模组后执行 */
    applyUpgradeChoice(moduleId) {
        const result = applyModuleChoice(this.equippedModules, moduleId);
        this.equippedModules = result.equipped;
        this.pendingUpgradeChoices = [];
        // 选择后恢复一些 HP
        const healAmount = Math.round(this.maxHp * 0.15);
        this.clampHeal(healAmount);
        return result.toast;
    }
    /** 当前伤害倍率（等级加成） */
    getLevelDamageMult() {
        return 1 + (this.level - 1) * 0.06;
    }
    /** 获取存档用的模组快照 */
    getModuleSnapshot() {
        return this.equippedModules.map((m) => ({ ...m }));
    }
    /** 从存档恢复模组 */
    restoreModules(modules) {
        this.equippedModules = modules.map((m) => ({ ...m }));
    }
}
