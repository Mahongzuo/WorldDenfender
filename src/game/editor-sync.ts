import { hasEditorDefenseLayout, hasEditorExploreLayout, parseEditorColor, runtimeMapToEditorExplorationLayout, runtimeMapToEditorMap } from "./editor-runtime";
import { CITY_GEO_CONFIG } from "./content";
import { clamp, orderEditorPathCells, sameCell, uniqueCells, GRID_COLS, GRID_ROWS } from "./runtime-grid";
import type { EditorCell, EditorLevel, EditorLevelMap, GameMode, GeoMapConfig, GridCell, MapActorDef, MapDefinition } from "./types";

export interface CityRuntimeMapInfo {
  label: string;
  defenseIndex: number;
  exploreIndex: number;
  geo?: GeoMapConfig;
}

interface SyncEditorLevelsOptions {
  levels: EditorLevel[];
  requestedLevelId?: string | null;
  maps: MapDefinition[];
  exploreMaps: MapDefinition[];
  cityMap: Record<string, CityRuntimeMapInfo>;
  cityAliases: Record<string, string[]>;
}

interface SyncEditorLevelsResult {
  importedCount: number;
  requestedDefIdx: number;
  requestedExpIdx: number;
}

export function syncEditorLevelsToRuntime(options: SyncEditorLevelsOptions): SyncEditorLevelsResult {
  const { levels, requestedLevelId, maps, exploreMaps, cityMap, cityAliases } = options;
  let importedCount = 0;
  let requestedDefIdx = -1;
  let requestedExpIdx = -1;
  const importedPriority = new Map<string, number>();

  for (const level of levels) {
    if (!level.map) {
      continue;
    }

    const cityCode = matchEditorLevelCity(level, cityAliases);
    const isRequested = sameLevelId(level.id, requestedLevelId);
    if (!cityCode && !isRequested) {
      continue;
    }

    const effectiveCityCode = cityCode || `__requested__${level.id}`;
    const priority = editorLevelRuntimePriority(level);
    if (priority < (importedPriority.get(effectiveCityCode) ?? -1)) {
      continue;
    }

    const syncedLevel = cityCode ? levelWithBuiltInLayouts(level, cityCode, cityMap, maps, exploreMaps) : level;
    const levelGeo = cityCode ? resolveEditorLevelGeo(syncedLevel, cityMap[cityCode]?.geo) : resolveEditorLevelGeo(syncedLevel);
    const runtimeLevel = levelGeo ? { ...syncedLevel, map: { ...syncedLevel.map, geo: levelGeo } } : syncedLevel;
    const defenseMap = editorLevelToRuntimeMap(runtimeLevel, "defense");
    const exploreMap = editorLevelToRuntimeMap(runtimeLevel, "explore");
    const defenseIndex = maps.push(defenseMap) - 1;
    const exploreIndex = exploreMaps.push(exploreMap) - 1;

    if (cityCode) {
      cityMap[cityCode] = {
        label: syncedLevel.location?.cityName || syncedLevel.location?.regionLabel || cityMap[cityCode]?.label || level.name || cityCode,
        defenseIndex,
        exploreIndex,
        geo: levelGeo,
      };
    }

    importedPriority.set(effectiveCityCode, priority);
    importedCount += 1;

    if (sameLevelId(level.id, requestedLevelId)) {
      requestedDefIdx = defenseIndex;
      requestedExpIdx = exploreIndex;
    }
  }

  return { importedCount, requestedDefIdx, requestedExpIdx };
}

function sameLevelId(left: unknown, right: unknown): boolean {
  const a = String(left || "").trim().toLowerCase();
  const b = String(right || "").trim().toLowerCase();
  return !!a && !!b && a === b;
}

export function matchEditorLevelCity(level: EditorLevel, cityAliases: Record<string, string[]>): string {
  const haystack = [
    level.name,
    level.id,
    level.location?.cityName,
    level.location?.regionLabel,
    level.location?.cityCode,
    level.location?.countryName,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, "");

  for (const [cityCode, aliases] of Object.entries(cityAliases)) {
    if (aliases.some((alias) => haystack.includes(alias.replace(/\s+/g, "")))) {
      return cityCode;
    }
  }

  return "";
}

export function levelWithBuiltInLayouts(
  level: EditorLevel,
  cityCode: string,
  cityMap: Record<string, CityRuntimeMapInfo>,
  maps: MapDefinition[],
  exploreMaps: MapDefinition[],
): EditorLevel {
  const cityInfo = cityMap[cityCode];
  if (!cityInfo || !level.map) {
    return level;
  }

  const needsDefenseLayout = !hasEditorDefenseLayout(level.map);
  const needsExploreLayout = !hasEditorExploreLayout(level.map);
  if (!needsDefenseLayout && !needsExploreLayout) {
    return level;
  }

  const map: EditorLevelMap = { ...level.map };
  if (needsDefenseLayout) {
    const builtInMap = maps[cityInfo.defenseIndex];
    Object.assign(map, runtimeMapToEditorMap(builtInMap, map));
  }

  if (needsExploreLayout) {
    const builtInExploreMap = exploreMaps[cityInfo.exploreIndex];
    map.explorationLayout = runtimeMapToEditorExplorationLayout(builtInExploreMap);
    if (!map.explorationPoints?.length) {
      map.explorationPoints = builtInExploreMap.path.map((cell, index) => ({
        id: `explore-point-${index + 1}`,
        name: index === 0 ? "探索起点" : `探索点 ${index + 1}`,
        ...cell,
      }));
    }
  }

  return { ...level, map };
}

export function editorLevelToRuntimeMap(level: EditorLevel, mode: GameMode): MapDefinition {
  const editorMap = level.map ?? {};
  const exploreLayout = mode === "explore" ? editorMap.explorationLayout : undefined;
  const grid = exploreLayout?.grid ?? editorMap.grid ?? {};
  const sourceCols = clamp(Math.floor(grid.cols ?? GRID_COLS), 4, 80);
  const sourceRows = clamp(Math.floor(grid.rows ?? GRID_ROWS), 4, 80);
  const project = (cell: EditorCell): GridCell => ({
    col: clamp(Math.round(Number(cell.col) || 0), 0, sourceCols - 1),
    row: clamp(Math.round(Number(cell.row) || 0), 0, sourceRows - 1),
  });

  const objective = mode === "explore" && exploreLayout?.exitPoint
    ? project(exploreLayout.exitPoint)
    : editorMap.objectivePoint
      ? project(editorMap.objectivePoint)
      : { col: sourceCols - 1, row: Math.floor(sourceRows / 2) };
  const spawn = editorMap.spawnPoints?.[0] ? project(editorMap.spawnPoints[0]) : { col: 0, row: objective.row };
  const exploreStart = exploreLayout?.startPoint
    ? project(exploreLayout.startPoint)
    : editorMap.explorationPoints?.[0]
      ? project(editorMap.explorationPoints[0])
      : spawn;
  const pathSource = mode === "explore"
    ? exploreLayout?.path ?? editorMap.explorationPoints ?? []
    : editorMap.enemyPaths?.find((path) => path.cells?.length)?.cells
      ?? editorMap.roads
      ?? [];
  const projectedPath = orderEditorPathCells(
    uniqueCells(pathSource.map(project), sourceCols, sourceRows),
    mode === "explore" ? exploreStart : spawn,
    objective,
    sourceCols,
    sourceRows,
  );
  const fallbackPath = mode === "explore"
    ? buildFallbackPath(exploreStart, objective, sourceCols, sourceRows)
    : buildFallbackPath(spawn, objective, sourceCols, sourceRows);
  const path = projectedPath.length >= 2 ? projectedPath : fallbackPath;
  const obstacleSource = mode === "explore" ? exploreLayout?.obstacles ?? editorMap.obstacles ?? [] : editorMap.obstacles ?? [];
  const obstacles = uniqueCells(obstacleSource.map(project), sourceCols, sourceRows).filter((cell) => !path.some((pathCell) => sameCell(pathCell, cell)));
  const theme = exploreLayout?.theme ?? editorMap.theme ?? {};

  const presetGeo = resolvePresetGeoForLevel(level);

  return {
    id: `${level.id || "editor-level"}-${mode}`,
    name: `${level.name || "编辑器关卡"}${mode === "explore" ? " · 探索" : ""}`,
    description: level.description || "由关卡编辑器同步生成的运行时地图。",
    cols: sourceCols,
    rows: sourceRows,
    geo: level.map?.geo ?? presetGeo ?? resolveEditorLevelGeo(level),
    theme: {
      ground: parseEditorColor(theme.ground, mode === "explore" ? 0x55748a : 0x5a9aae),
      groundAlt: parseEditorColor(theme.groundAlt, mode === "explore" ? 0x496a80 : 0x5090a4),
      path: parseEditorColor(theme.path ?? theme.road, mode === "explore" ? 0x93b7c9 : 0xccab7e),
      obstacle: parseEditorColor(theme.obstacle, mode === "explore" ? 0x354c5c : 0x3e6e80),
      accent: parseEditorColor(theme.accent, 0x9eeeff),
      fog: parseEditorColor(theme.fog, mode === "explore" ? 0x6d8798 : 0x7ab4c8),
    },
    path,
    obstacles,
    actors: extractEditorActors(editorMap),
  };
}

function extractEditorActors(editorMap: EditorLevelMap): MapActorDef[] {
  const raw = editorMap.actors ?? [];
  const result: MapActorDef[] = [];
  for (const a of raw) {
    const modelPath = String(a.modelPath ?? "");
    if (!modelPath) continue;
    const offset = a.worldOffsetMeters && typeof a.worldOffsetMeters === "object"
      ? (a.worldOffsetMeters as Record<string, unknown>) : {};
    result.push({
      id: String(a.id ?? ""),
      modelPath,
      col: Math.round(Number(a.col) || 0),
      row: Math.round(Number(a.row) || 0),
      worldOffsetMeters: {
        x: Number(offset.x) || 0,
        y: Number(offset.y) || 0,
        z: Number(offset.z) || 0,
      },
      rotation: Number(a.rotation) || 0,
      scale: Number(a.scale) > 0 ? Number(a.scale) : 1,
    });
  }
  return result;
}

function resolvePresetGeoForLevel(level: EditorLevel): GeoMapConfig | undefined {
  const text = [
    level.id,
    level.name,
    level.location?.cityCode,
    level.location?.cityName,
    level.location?.regionLabel,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, "");

  if (/city-cn-370100|中国·济南市|中国·济南|济南市/.test(text)) {
    return CITY_GEO_CONFIG.jinanOlympic;
  }
  if (/CN_shandong_370100|泉城浮生录|山东·济南|山东_370100/i.test(text)) {
    return CITY_GEO_CONFIG.jinan;
  }
  if (/CN_beijing|city-cn-110100|京城|北京|北京市|beijing/i.test(text)) {
    return CITY_GEO_CONFIG.beijing;
  }
  if (/CN_shanghai|city-cn-310100|上海|上海市|shanghai/i.test(text)) {
    return CITY_GEO_CONFIG.shanghai;
  }
  if (/city-cn-440100|广州|广州市|guangzhou/i.test(text)) {
    return CITY_GEO_CONFIG.guangzhou;
  }
  if (/CN_guangdong_440300|city-cn-440300|深圳|深圳市|shenzhen/i.test(text)) {
    return CITY_GEO_CONFIG.shenzhen;
  }
  if (/^FRA$|保卫巴黎|卢浮宫|埃菲尔|巴黎|法国|France|Paris|paris/i.test(text)) {
    return CITY_GEO_CONFIG.paris;
  }
  return undefined;
}

export function buildFallbackPath(start: GridCell, end: GridCell, cols = GRID_COLS, rows = GRID_ROWS): GridCell[] {
  const midA = { col: clamp(Math.floor((start.col + end.col) / 2), 0, cols - 1), row: start.row };
  const midB = { col: midA.col, row: end.row };
  return uniqueCells([start, midA, midB, end], cols, rows);
}

function geoMapConfigIsUsable(geo?: GeoMapConfig): boolean {
  if (!geo?.enabled || !Number.isFinite(geo.center?.lat) || !Number.isFinite(geo.center?.lon)) {
    return false;
  }
  if (geo.center.lat === 0 && geo.center.lon === 0) {
    return false;
  }
  return true;
}

function resolveEditorLevelGeo(level: EditorLevel, fallback?: GeoMapConfig): GeoMapConfig | undefined {
  const preset = resolvePresetGeoForLevel(level);
  const stored = level.map?.geo ?? level.location?.geo;
  let candidate = stored ?? fallback ?? preset;
  if (!geoMapConfigIsUsable(stored)) {
    candidate = preset ?? fallback ?? stored;
  }
  if (!candidate || !geoMapConfigIsUsable(candidate)) {
    return undefined;
  }

  return {
    enabled: true,
    provider: candidate.provider ?? "cesium-ion",
    assetId: candidate.assetId,
    center: {
      lat: Number(candidate.center.lat),
      lon: Number(candidate.center.lon),
      heightMeters: Number(candidate.center.heightMeters) || 0,
    },
    extentMeters: Number(candidate.extentMeters) || undefined,
    rotationDeg: Number(candidate.rotationDeg) || 0,
    yOffsetMeters: Number(candidate.yOffsetMeters) || 0,
    boardHeightMeters: Number(candidate.boardHeightMeters) || undefined,
    scale: Number(candidate.scale) || undefined,
  };
}

function editorLevelRuntimePriority(level: EditorLevel): number {
  const map = level.map;
  const designScore =
    (map?.roads?.length ?? 0) +
    (map?.enemyPaths?.reduce((sum, path) => sum + (path.cells?.length ?? 0), 0) ?? 0) +
    (map?.obstacles?.length ?? 0) +
    (map?.spawnPoints?.length ?? 0) +
    (map?.explorationPoints?.length ?? 0);

  const statusScore = level.status === "designed" ? 30 : level.status === "needs-work" ? 20 : 10;
  return statusScore + Math.min(designScore, 9);
}