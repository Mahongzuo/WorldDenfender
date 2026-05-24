/** 胜负与失败后共享重置：从宿主注入依赖，避免循环引用 */
export function presentGameOverScreen(deps) {
    if (deps.getGameOverActive())
        return;
    deps.setGameOverActive(true);
    const reason = deps.mode === "defense"
        ? "\u57fa\u5730\u5df2\u88ab\u6467\u6bc1"
        : "\u89d2\u8272\u5df2\u5012\u5730";
    deps.gameOverReasonElement.textContent = reason;
    deps.gameOverPanel.setAttribute("aria-hidden", "false");
}
export function presentVictoryScreen(deps, reason) {
    if (deps.getVictoryActive())
        return;
    deps.setVictoryActive(true);
    deps.victoryTitleElement.textContent = "\u80dc\u5229"; // 胜利
    deps.victoryReasonElement.textContent = reason;
    deps.victoryPanel.setAttribute("aria-hidden", "false");
}
export function applySharedRunFailureCleanup(deps) {
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
