/** 与关卡编辑器中的 GEO_MAPPING_STORAGE_KEY 分离：游戏内默认关闭真实地理底板 */

export const GAME_GEO_MAPPING_STORAGE_KEY = "earth-guardian.game.geoMappingEnabled";

export function getGameGeoMappingEnabled(): boolean {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }
  const v = window.localStorage.getItem(GAME_GEO_MAPPING_STORAGE_KEY);
  if (v === null) {
    return false;
  }
  return v !== "0" && v !== "false";
}

export function setGameGeoMappingEnabled(value: boolean): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  window.localStorage.setItem(GAME_GEO_MAPPING_STORAGE_KEY, value ? "1" : "0");
}
