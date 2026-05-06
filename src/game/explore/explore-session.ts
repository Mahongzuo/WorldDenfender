import * as THREE from "three";

import { tickExploreSafeZone } from "./explore-ambient-loop";
import { collectExploreDrops } from "./explore-runtime";
import type { MoneyDrop } from "../core/types";

export interface ExploreSessionTickDeps {
  dt: number;
  movePlayer: (dt: number) => void;
  drops: MoneyDrop[];
  setDrops: (d: MoneyDrop[]) => void;
  playerPosition: THREE.Vector3;
  dropGroup: THREE.Group;
  onExploreDropCollect: (drop: MoneyDrop) => void;
  exploreCombatTick: (dt: number) => void;
  updateExploreHud: () => void;
  exploreSafeZoneCells: Set<string>;
  wasInSafeZone: boolean;
  setInSafeZone: (v: boolean) => void;
  safeZoneShopPanel: HTMLElement;
  showToast: (message: string, critical?: boolean) => void;
}

/** 组装探索模式每帧逻辑（位移、掉落、收集、战斗、HUD、安全区） */
export function tickExploreSession(deps: ExploreSessionTickDeps): void {
  deps.movePlayer(deps.dt);

  deps.setDrops(
    collectExploreDrops({
      drops: deps.drops,
      playerPosition: deps.playerPosition,
      dropGroup: deps.dropGroup,
      onCollect: deps.onExploreDropCollect,
    }),
  );

  deps.exploreCombatTick(deps.dt);
  deps.updateExploreHud();

  deps.setInSafeZone(
    tickExploreSafeZone({
      playerPosition: deps.playerPosition,
      safeZoneCells: deps.exploreSafeZoneCells,
      wasInSafeZone: deps.wasInSafeZone,
      shopPanelEl: deps.safeZoneShopPanel,
      showToast: (message) => deps.showToast(message),
    }),
  );
}
