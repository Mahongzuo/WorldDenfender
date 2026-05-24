import { INITIAL_MONEY } from "../core/game-config";
export const INITIAL_GACHA_FREE_PULLS = 100;
/** 单局经济与抽卡配额、解锁的统一可变源（通过方法修改，便于扩展多货币） */
export class GameEconomy {
    constructor(onDirty) {
        Object.defineProperty(this, "onDirty", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: onDirty
        });
        Object.defineProperty(this, "money", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: INITIAL_MONEY
        });
        Object.defineProperty(this, "gacha", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {
                freePulls: INITIAL_GACHA_FREE_PULLS,
                pityCounter: 0,
                sTowerUnlocked: false,
            }
        });
    }
    notifyDirty() {
        this.onDirty?.();
    }
    get balance() {
        return this.money;
    }
    get pityCounter() {
        return this.gacha.pityCounter;
    }
    get freePulls() {
        return this.gacha.freePulls;
    }
    get sTowerUnlocked() {
        return this.gacha.sTowerUnlocked;
    }
    canAfford(cost) {
        return this.money >= cost;
    }
    /** cost > 0 且余额不足时返回 false */
    trySpend(cost) {
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
    addMoney(delta) {
        if (delta === 0)
            return;
        this.money += delta;
        this.notifyDirty();
    }
    /** 探索拾取等资源包：金币 + 抽卡次数增量 */
    grantExploreResourcePickup(moneyRounded, extraFreePulls) {
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
    getGachaState() {
        return { ...this.gacha };
    }
    applyGachaNextState(next) {
        this.gacha = { ...next };
        this.notifyDirty();
    }
    resetForNewRun() {
        this.money = INITIAL_MONEY;
        this.gacha = {
            freePulls: INITIAL_GACHA_FREE_PULLS,
            pityCounter: 0,
            sTowerUnlocked: false,
        };
        this.notifyDirty();
    }
    applyFromSave(slice) {
        this.money = slice.money ?? INITIAL_MONEY;
        this.gacha = {
            freePulls: slice.freePulls ?? INITIAL_GACHA_FREE_PULLS,
            pityCounter: slice.pityCounter ?? 0,
            sTowerUnlocked: !!slice.sTowerUnlocked,
        };
        this.notifyDirty();
    }
    toSaveSlice() {
        return {
            money: this.money,
            freePulls: this.gacha.freePulls,
            pityCounter: this.gacha.pityCounter,
            sTowerUnlocked: this.gacha.sTowerUnlocked,
        };
    }
    insufficientFundsGap(cost) {
        return Math.max(0, cost - this.money);
    }
}
