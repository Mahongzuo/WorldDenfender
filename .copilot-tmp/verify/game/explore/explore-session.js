import { tickExploreSafeZone } from "./explore-ambient-loop";
import { collectExploreDrops } from "./explore-runtime";
/** 组装探索模式每帧逻辑（位移、掉落、收集、战斗、HUD、安全区） */
export function tickExploreSession(deps) {
    deps.movePlayer(deps.dt);
    deps.setDrops(collectExploreDrops({
        drops: deps.drops,
        playerPosition: deps.playerPosition,
        dropGroup: deps.dropGroup,
        onCollect: deps.onExploreDropCollect,
    }));
    deps.exploreCombatTick(deps.dt);
    deps.updateExploreHud();
    deps.setInSafeZone(tickExploreSafeZone({
        playerPosition: deps.playerPosition,
        safeZoneCells: deps.exploreSafeZoneCells,
        wasInSafeZone: deps.wasInSafeZone,
        shopPanelEl: deps.safeZoneShopPanel,
        showToast: (message) => deps.showToast(message),
    }));
}
