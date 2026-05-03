/** 胜负与失败后共享重置：从宿主注入依赖，避免循环引用 */

export interface GameOverPresenterDeps {
  getGameOverActive: () => boolean;
  setGameOverActive: (v: boolean) => void;
  gameOverReasonElement: HTMLElement;
  gameOverPanel: HTMLElement;
  mode: "defense" | "explore";
}

export function presentGameOverScreen(deps: GameOverPresenterDeps): void {
  if (deps.getGameOverActive()) return;
  deps.setGameOverActive(true);
  const reason =
    deps.mode === "defense"
      ? "\u57fa\u5730\u5df2\u88ab\u6467\u6bc1"
      : "\u89d2\u8272\u5df2\u5012\u5730";
  deps.gameOverReasonElement.textContent = reason;
  deps.gameOverPanel.setAttribute("aria-hidden", "false");
}

export interface SharedRunFailureCleanupDeps {
  getGachaOpen: () => boolean;
  closeGacha: () => void;
  economyResetForNewRun: () => void;
  exploreProgressReset: () => void;
  exploreInventoryReset: () => void;
  exploreCombatResetAfterRunFailure: () => void;
  setInventoryOpen: (open: boolean) => void;
  inventoryPanelHide: () => void;
  setExploreWalkMode: (walking: boolean) => void;
  setElapsedZero: () => void;
  resetUid: () => void;
  clearSelectedBuilding: () => void;
  setDropTimerInitial: () => void;
  setSafeZoneFalse: () => void;
  safeZoneShopHide: () => void;
  renderInventoryGrid: () => void;
}

export function applySharedRunFailureCleanup(deps: SharedRunFailureCleanupDeps): void {
  if (deps.getGachaOpen()) {
    deps.closeGacha();
  }
  deps.economyResetForNewRun();
  deps.exploreProgressReset();
  deps.exploreInventoryReset();
  deps.exploreCombatResetAfterRunFailure();
  deps.setInventoryOpen(false);
  deps.inventoryPanelHide();
  deps.setExploreWalkMode(false);
  deps.setElapsedZero();
  deps.resetUid();
  deps.clearSelectedBuilding();
  deps.setDropTimerInitial();
  deps.setSafeZoneFalse();
  deps.safeZoneShopHide();
  deps.renderInventoryGrid();
}
