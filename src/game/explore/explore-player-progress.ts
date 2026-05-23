import type { ExploreEquippedModule } from "../core/types";
import {
  applyModuleChoice,
  getPassiveRegenRatio,
  getPassiveXpMult,
  rollUpgradeChoices,
} from "./explore-skill-modules";
import type { ExploreSkillModuleDef } from "../core/types";

/** Explore mode HP / level / XP / skill modules (decoupled from scene & UI). */
export class ExplorePlayerProgress {
  hp = 120;
  maxHp = 120;
  level = 1;
  xp = 0;
  xpToNext = 40;

  /** 已装备的技能模组（肉鸽升级积累） */
  equippedModules: ExploreEquippedModule[] = [];

  /** 当前升级待选模组（非空时处于选择暂停状态） */
  pendingUpgradeChoices: ExploreSkillModuleDef[] = [];

  /** 累计击杀数（用于统计） */
  totalKills = 0;

  reset(): void {
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
  addXpFromKillContribution(playerLevelUsed: number): string[] {
    const amount = 15 + playerLevelUsed * 5;
    return this.addXp(amount);
  }

  addXp(amount: number): string[] {
    const xpMult = getPassiveXpMult(this.equippedModules);
    const toasts: string[] = [];
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

  clampHeal(amount: number): void {
    this.hp = Math.min(this.hp + amount, this.maxHp);
  }

  /** 每帧调用：被动回血 */
  tickPassiveRegen(dt: number): void {
    const ratio = getPassiveRegenRatio(this.equippedModules);
    if (ratio > 0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * ratio * dt);
    }
  }

  /** 波间暂停时：生成三选一升级 */
  generateUpgradeChoices(): ExploreSkillModuleDef[] {
    this.pendingUpgradeChoices = rollUpgradeChoices(this.equippedModules, 3);
    return this.pendingUpgradeChoices;
  }

  /** 玩家选择模组后执行 */
  applyUpgradeChoice(moduleId: string): string {
    const result = applyModuleChoice(this.equippedModules, moduleId);
    this.equippedModules = result.equipped;
    this.pendingUpgradeChoices = [];
    // 选择后恢复一些 HP
    const healAmount = Math.round(this.maxHp * 0.15);
    this.clampHeal(healAmount);
    return result.toast;
  }

  /** 当前伤害倍率（等级加成） */
  getLevelDamageMult(): number {
    return 1 + (this.level - 1) * 0.06;
  }

  /** 获取存档用的模组快照 */
  getModuleSnapshot(): ExploreEquippedModule[] {
    return this.equippedModules.map((m) => ({ ...m }));
  }

  /** 从存档恢复模组 */
  restoreModules(modules: ExploreEquippedModule[]): void {
    this.equippedModules = modules.map((m) => ({ ...m }));
  }
}
