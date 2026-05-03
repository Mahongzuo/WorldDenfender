import { cellKey, worldToCell } from "../core/runtime-grid";
import * as THREE from "three";

/** Seconds between batches of explore money drops（可被关卡 gameplay.moneyDropRespawnIntervalSec 覆盖） */
export const EXPLORE_DROP_RESPAWN_INTERVAL = 5;

export function advanceExploreDropTimer(
  current: number,
  dt: number,
  respawnIntervalSec: number,
  onSpawnBatch: () => void,
): number {
  let next = current - dt;
  if (next <= 0) {
    onSpawnBatch();
    next = respawnIntervalSec;
  }
  return next;
}

export function tickExploreSafeZone(options: {
  playerPosition: THREE.Vector3;
  safeZoneCells: ReadonlySet<string>;
  wasInSafeZone: boolean;
  shopPanelEl: HTMLElement;
  showToast: (message: string) => void;
}): boolean {
  const nowInSafe =
    options.safeZoneCells.size > 0 &&
    options.safeZoneCells.has(cellKey(worldToCell(options.playerPosition)));
  if (nowInSafe !== options.wasInSafeZone) {
    if (nowInSafe) {
      options.shopPanelEl.setAttribute("aria-hidden", "false");
      options.showToast(
        "\u8fdb\u5165\u5b89\u5168\u533a \u2014 \u53ef\u5728\u5de6\u4e0b\u89d2\u5546\u5e97\u8d2d\u4e70\u8865\u7ed9",
      );
    } else {
      options.shopPanelEl.setAttribute("aria-hidden", "true");
    }
  }
  return nowInSafe;
}
