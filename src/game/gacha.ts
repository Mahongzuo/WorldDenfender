import type { BuildId, GachaFocusBanner, GachaPool } from "./types";

export interface GachaState {
  freePulls: number;
  pityCounter: number;
  sTowerUnlocked: boolean;
}

export interface GachaDisplayModel {
  title: string;
  description: string;
  featuredName: string;
  featuredImg: string;
  pityRemaining: number;
}

export interface GachaDrawResult {
  count: number;
  results: string[];
  hitS: boolean;
  unlockedNow: boolean;
  /** 首次解锁 S 时对应的塔 id（多 UP 卡池用） */
  unlockedBuildId?: BuildId;
  nextState: GachaState;
  depleted: boolean;
}

export interface PerformGachaDrawOptions {
  random?: () => number;
  /** 济南等多 UP 池：仅产出该条 sPool 对应的 S */
  focusedSRollLabel?: string | null;
}

export function getAvailableGachaPools(pools: GachaPool[], currentCity: string): GachaPool[] {
  return pools.filter((pool) => !pool.city || pool.city === currentCity);
}

export function resolveSelectedGachaPoolId(pools: GachaPool[], selectedPoolId: string): string {
  return pools.find((pool) => pool.id === selectedPoolId)?.id ?? pools[0]?.id ?? "standard";
}

export function getGachaPoolDisplayModel(
  pool: GachaPool,
  pityCounter: number,
  focusPick: GachaFocusBanner | null = null,
): GachaDisplayModel {
  return {
    title: `${pool.name} · 特派干员补给`,
    description: pool.description,
    featuredName: focusPick ? focusPick.name : pool.featured.name,
    featuredImg: focusPick ? focusPick.featuredImg : pool.featuredImg,
    pityRemaining: Math.max(pool.hardPity - pityCounter, 0),
  };
}

export function performGachaDraw(
  requestedCount: number,
  pool: GachaPool,
  state: GachaState,
  options: PerformGachaDrawOptions = {},
): GachaDrawResult {
  const random = options.random ?? Math.random;
  const focusedSRollLabel = options.focusedSRollLabel ?? null;
  if (state.freePulls <= 0) {
    return {
      count: 0,
      results: [],
      hitS: false,
      unlockedNow: false,
      nextState: state,
      depleted: true,
    };
  }

  const count = Math.min(requestedCount, state.freePulls);
  const results: string[] = [];
  let hitS = false;
  let unlockedNow = false;
  let unlockedBuildId: BuildId | undefined;
  let nextState = { ...state };

  for (let index = 0; index < count; index += 1) {
    const rolled = rollGachaOnce(pool, nextState, random, focusedSRollLabel);
    nextState = rolled.nextState;
    results.push(rolled.label);
    if (rolled.label.startsWith("S")) {
      hitS = true;
    }
    if (rolled.unlockedNow) {
      unlockedNow = true;
      if (rolled.buildId !== undefined) {
        unlockedBuildId = rolled.buildId;
      }
    }
  }

  return {
    count,
    results,
    hitS,
    unlockedNow,
    unlockedBuildId,
    nextState,
    depleted: false,
  };
}

function resolveSUnlockBuildId(pool: GachaPool, sLabel: string): BuildId {
  const fromBanner = pool.focusBanners?.find((b) => b.sRollLabel === sLabel);
  if (fromBanner) {
    return fromBanner.buildId;
  }
  return pool.featured.id;
}

function rollGachaOnce(
  pool: GachaPool,
  state: GachaState,
  random: () => number,
  focusedSRollLabel: string | null,
): { label: string; unlockedNow: boolean; nextState: GachaState; buildId?: BuildId } {
  const nextState: GachaState = {
    freePulls: state.freePulls - 1,
    pityCounter: state.pityCounter + 1,
    sTowerUnlocked: state.sTowerUnlocked,
  };

  const baseS = 0.3;
  const hardPity = pool.hardPity || 20;
  const sChance = nextState.pityCounter >= hardPity ? 1 : baseS;

  if (random() < sChance) {
    const unlockedNow = !nextState.sTowerUnlocked;
    nextState.sTowerUnlocked = true;
    nextState.pityCounter = 0;
    const sPick =
      focusedSRollLabel && pool.sPool.includes(focusedSRollLabel)
        ? focusedSRollLabel
        : pool.sPool[Math.floor(random() * pool.sPool.length)]!;
    const buildId = resolveSUnlockBuildId(pool, sPick);
    return { label: sPick, unlockedNow, nextState, buildId };
  }

  const aRank = random() < 0.4;
  return {
    label: aRank ? "A 强化模块" : "B 作战素材",
    unlockedNow: false,
    nextState,
  };
}