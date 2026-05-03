/** Explore mode HP / level / XP (decoupled from scene & UI). */
export class ExplorePlayerProgress {
  hp = 100;
  maxHp = 100;
  level = 1;
  xp = 0;
  xpToNext = 50;

  reset(): void {
    this.hp = 100;
    this.maxHp = 100;
    this.level = 1;
    this.xp = 0;
    this.xpToNext = 50;
  }

  /**
   * Grants XP using the explore kill curve; returns one toast message per level gained.
   */
  addXpFromKillContribution(playerLevelUsed: number): string[] {
    const amount = 15 + playerLevelUsed * 5;
    return this.addXp(amount);
  }

  addXp(amount: number): string[] {
    const toasts: string[] = [];
    this.xp += amount;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level += 1;
      this.maxHp += 20;
      this.hp = Math.min(this.hp + 20, this.maxHp);
      this.xpToNext = Math.floor(50 * Math.pow(1.3, this.level - 1));
      toasts.push(`\u7b49\u7ea7\u63d0\u5347\uff01Lv.${this.level}`);
    }
    return toasts;
  }

  clampHeal(amount: number): void {
    this.hp = Math.min(this.hp + amount, this.maxHp);
  }
}
