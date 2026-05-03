import type { GachaState } from "./gacha";
import { INITIAL_MONEY } from "../core/game-config";

/** 与存档 `SaveData` 中四个经济字段对齐 */
export interface EconomySaveSlice {
  money: number;
  freePulls: number;
  pityCounter: number;
  sTowerUnlocked: boolean;
}

export const INITIAL_GACHA_FREE_PULLS = 100;

/** 单局经济与抽卡配额、解锁的统一可变源（通过方法修改，便于扩展多货币） */
export class GameEconomy {
  private money: number = INITIAL_MONEY;
  private gacha: GachaState = {
    freePulls: INITIAL_GACHA_FREE_PULLS,
    pityCounter: 0,
    sTowerUnlocked: false,
  };

  constructor(private readonly onDirty?: () => void) {}

  private notifyDirty(): void {
    this.onDirty?.();
  }

  get balance(): number {
    return this.money;
  }

  get pityCounter(): number {
    return this.gacha.pityCounter;
  }

  get freePulls(): number {
    return this.gacha.freePulls;
  }

  get sTowerUnlocked(): boolean {
    return this.gacha.sTowerUnlocked;
  }

  canAfford(cost: number): boolean {
    return this.money >= cost;
  }

  /** cost > 0 且余额不足时返回 false */
  trySpend(cost: number): boolean {
    if (cost <= 0) {
      return true;
    }
    if (this.money < cost) {
      return false;
    }
    this.money -= cost;
    this.notifyDirty();
    return true;
  }

  addMoney(delta: number): void {
    if (delta === 0) return;
    this.money += delta;
    this.notifyDirty();
  }

  /** 探索拾取等资源包：金币 + 抽卡次数增量 */
  grantExploreResourcePickup(moneyRounded: number, extraFreePulls: number): void {
    if (moneyRounded !== 0) {
      this.money += moneyRounded;
    }
    if (extraFreePulls !== 0) {
      this.gacha = { ...this.gacha, freePulls: this.gacha.freePulls + extraFreePulls };
    }
    if (moneyRounded !== 0 || extraFreePulls !== 0) {
      this.notifyDirty();
    }
  }

  getGachaState(): GachaState {
    return { ...this.gacha };
  }

  applyGachaNextState(next: GachaState): void {
    this.gacha = { ...next };
    this.notifyDirty();
  }

  resetForNewRun(): void {
    this.money = INITIAL_MONEY;
    this.gacha = {
      freePulls: INITIAL_GACHA_FREE_PULLS,
      pityCounter: 0,
      sTowerUnlocked: false,
    };
    this.notifyDirty();
  }

  applyFromSave(slice: Partial<EconomySaveSlice>): void {
    this.money = slice.money ?? INITIAL_MONEY;
    this.gacha = {
      freePulls: slice.freePulls ?? INITIAL_GACHA_FREE_PULLS,
      pityCounter: slice.pityCounter ?? 0,
      sTowerUnlocked: !!slice.sTowerUnlocked,
    };
    this.notifyDirty();
  }

  toSaveSlice(): EconomySaveSlice {
    return {
      money: this.money,
      freePulls: this.gacha.freePulls,
      pityCounter: this.gacha.pityCounter,
      sTowerUnlocked: this.gacha.sTowerUnlocked,
    };
  }

  insufficientFundsGap(cost: number): number {
    return Math.max(0, cost - this.money);
  }
}
