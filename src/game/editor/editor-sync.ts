import { hasEditorDefenseLayout, hasEditorExploreLayout, parseEditorColor, parseEditorOpacity, runtimeMapToEditorExplorationLayout, runtimeMapToEditorMap } from "./editor-runtime";
import { sanitizeLevelMapAudioFromEditor } from "../audio/game-audio";
import { CITY_GEO_CONFIG, BUILD_SPECS } from "../data/content";
import { clamp, orderEditorPathCells, sameCell, uniqueCells, GRID_COLS, GRID_ROWS } from "../core/runtime-grid";
import type {
  EditorCell,
  EditorLevel,
  EditorLevelMap,
  ExploreBossPlacement,
  ExploreGameplaySettings,
  ExplorePickupPlacement,
  ExploreSpawnerPlacement,
  GameMode,
  GeoMapConfig,
  GridCell,
  LevelCutsceneConfig,
  MapActorDef,
  MapBoardImageLayer,
  MapDefinition,
  BuildId,
} from "../core/types";
import { sanitizeDefenseElement } from "../defense/defense-taxonomy";

function sanitizeBoardImageLayers(raw: unknown): MapBoardImageLayer[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const out: MapBoardImageLayer[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const item = raw[i];
    if (!item || typeof item !== "object") {
      continue;
    }
    const o = item as Record<string, unknown>;
    const src = typeof o.src === "string" ? o.src.trim() : "";
    if (!src) {
      continue;
    }
    const clampPct = (n: unknown, fallback: number) => {
      const v = Number(n);
      if (!Number.isFinite(v)) return fallback;
      return Math.max(0, Math.min(100, v));
    };
    const widthPct = Number(o.widthPct);
    const wp = Number.isFinite(widthPct) ? Math.max(5, Math.min(500, widthPct)) : 40;
    const aspectRaw = Number(o.aspect);
    const aspectOk = Number.isFinite(aspectRaw) && aspectRaw > 0 ? Math.min(24, Math.max(0.04, aspectRaw)) : undefined;
    const opacityRaw = Number(o.opacity);
    const opacity = Number.isFinite(opacityRaw) ? Math.max(0, Math.min(1, opacityRaw)) : 1;
    const orderRaw = Number(o.order);
    const ord = Number.isFinite(orderRaw) ? Math.round(orderRaw) : i;

    out.push({
      id: typeof o.id === "string" && o.id.trim() ? o.id.trim() : `bil-${i + 1}`,
      src,
      centerX: clampPct(o.centerX, 0),
      centerY: clampPct(o.centerY, 0),
      widthPct: wp,
      ...(opacity !== 1 ? { opacity } : {}),
      ...(aspectOk !== undefined ? { aspect: aspectOk } : {}),
      order: ord,
    });
  }
  return out.length ? out.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : undefined;
}

function sanitizeLevelCutscenes(raw: unknown): LevelCutsceneConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;

  const introRaw = r.introVideo;
  let introVideo: LevelCutsceneConfig["introVideo"];
  if (introRaw && typeof introRaw === "object") {
    const iv = introRaw as Record<string, unknown>;
    const url = typeof iv.url === "string" ? iv.url.trim() : "";
    if (url) {
      introVideo = { url, ...(typeof iv.title === "string" && iv.title ? { title: iv.title } : {}) };
    }
  }

  let waveVideos: LevelCutsceneConfig["waveVideos"];
  if (Array.isArray(r.waveVideos)) {
    const parsed = r.waveVideos.flatMap((item: unknown) => {
      if (!item || typeof item !== "object") return [];
      const wv = item as Record<string, unknown>;
      const afterWave = Math.round(Number(wv.afterWave));
      const url = typeof wv.url === "string" ? wv.url.trim() : "";
      if (!Number.isFinite(afterWave) || afterWave < 1 || !url) return [];
      return [{ afterWave, url, ...(typeof wv.title === "string" && wv.title ? { title: wv.title } : {}) }];
    });
    if (parsed.length) waveVideos = parsed;
  }

  if (!introVideo && !waveVideos) return undefined;
  return { ...(introVideo ? { introVideo } : {}), ...(waveVideos ? { waveVideos } : {}) };
}

function positiveNumber(raw: unknown, fallback: number, max = 1e9): number {
  const v = Number(raw);
  return Number.isFinite(v) && v > 0 ? Math.min(v, max) : fallback;
}

function nonNegativeNumber(raw: unknown, fallback: number, max = 1e9): number {
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 ? Math.min(v, max) : fallback;
}

function sanitizeExploreBosses(raw: unknown, project: (cell: EditorCell) => GridCell): ExploreBossPlacement[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ExploreBossPlacement[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const item = raw[i];
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const override = r.overrideStats && typeof r.overrideStats === "object" ? r.overrideStats as Record<string, unknown> : {};
    out.push({
      id: String(r.id || `explore-boss-${i + 1}`),
      bossId: String(r.bossId || "ai-atlas"),
      ...(typeof r.name === "string" && r.name.trim() ? { name: r.name.trim() } : {}),
      ...project({ col: Number(r.col), row: Number(r.row) }),
      ...(typeof r.modelId === "string" && r.modelId ? { modelId: r.modelId } : {}),
      ...(typeof r.modelPath === "string" && r.modelPath ? { modelPath: r.modelPath } : {}),
      modelScale: positiveNumber(r.modelScale, 1.8, 12),
      ...(sanitizeDefenseElement(r.element) ? { element: sanitizeDefenseElement(r.element) } : {}),
      level: Math.max(1, Math.round(Number(r.level) || 1)),
      triggerRadius: positiveNumber(r.triggerRadius, 9, 80),
      respawn: !!r.respawn,
      overrideStats: {
        maxHp: nonNegativeNumber(override.maxHp, 0),
        attack: nonNegativeNumber(override.attack, 0),
        defense: nonNegativeNumber(override.defense, 0),
        speed: nonNegativeNumber(override.speed, 0),
        rewardMoney: nonNegativeNumber(override.rewardMoney, 0),
        rewardXp: nonNegativeNumber(override.rewardXp, 0),
      },
    });
  }
  return out.length ? out : undefined;
}

function sanitizeExploreSpawners(raw: unknown, project: (cell: EditorCell) => GridCell): ExploreSpawnerPlacement[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ExploreSpawnerPlacement[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const item = raw[i];
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    out.push({
      id: String(r.id || `explore-spawner-${i + 1}`),
      name: String(r.name || `AI 刷怪点 ${i + 1}`),
      ...project({ col: Number(r.col), row: Number(r.row) }),
      enemyTypeId: String(r.enemyTypeId || "ai-drone"),
      ...(sanitizeDefenseElement(r.element) ? { element: sanitizeDefenseElement(r.element) } : {}),
      ...(typeof r.modelId === "string" && r.modelId ? { modelId: r.modelId } : {}),
      ...(typeof r.modelPath === "string" && r.modelPath ? { modelPath: r.modelPath } : {}),
      modelScale: positiveNumber(r.modelScale, 1, 10),
      maxConcurrent: Math.max(1, Math.round(Number(r.maxConcurrent) || 3)),
      spawnIntervalSec: positiveNumber(r.spawnIntervalSec, 6, 3600),
      spawnCount: Math.max(1, Math.round(Number(r.spawnCount) || 1)),
      triggerRadius: positiveNumber(r.triggerRadius, 12, 120),
      activeRadius: positiveNumber(r.activeRadius, 18, 180),
      totalLimit: Math.max(0, Math.round(Number(r.totalLimit) || 0)),
      disableWhenBossDefeated: !!r.disableWhenBossDefeated,
      rewards: Array.isArray(r.rewards)
        ? r.rewards.flatMap((reward): NonNullable<ExploreSpawnerPlacement["rewards"]> => {
            if (!reward || typeof reward !== "object") return [];
            const rr = reward as Record<string, unknown>;
            return [{
              money: nonNegativeNumber(rr.money, 12),
              xp: nonNegativeNumber(rr.xp, 10),
              ...(typeof rr.itemName === "string" && rr.itemName ? { itemName: rr.itemName } : {}),
              ...(typeof rr.itemIcon === "string" && rr.itemIcon ? { itemIcon: rr.itemIcon.slice(0, 2) } : {}),
              quantity: Math.max(1, Math.round(Number(rr.quantity) || 1)),
            }];
          })
        : [{ money: 12, xp: 10 }],
    });
  }
  return out.length ? out : undefined;
}

function sanitizeExplorePickups(raw: unknown, project: (cell: EditorCell) => GridCell): ExplorePickupPlacement[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ExplorePickupPlacement[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const item = raw[i];
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const type = r.type === "item" ? "item" : "money";
    out.push({
      id: String(r.id || `explore-pickup-${i + 1}`),
      type,
      name: String(r.name || (type === "money" ? "城市算力资金" : "AI 道具")),
      ...project({ col: Number(r.col), row: Number(r.row) }),
      moneyAmount: nonNegativeNumber(r.moneyAmount, type === "money" ? 50 : 0),
      ...(typeof r.itemId === "string" && r.itemId ? { itemId: r.itemId } : {}),
      itemName: String(r.itemName || r.name || "AI 记忆碎片"),
      itemType: r.itemType === "consumable" ? "consumable" : "material",
      itemIcon: String(r.itemIcon || (type === "money" ? "$" : "AI")).slice(0, 2),
      quantity: Math.max(1, Math.round(Number(r.quantity) || 1)),
      ...(typeof r.modelId === "string" && r.modelId ? { modelId: r.modelId } : {}),
      ...(typeof r.modelPath === "string" && r.modelPath ? { modelPath: r.modelPath } : {}),
      modelScale: positiveNumber(r.modelScale, 1, 8),
      collectRadius: positiveNumber(r.collectRadius, 1.25, 20),
    });
  }
  return out.length ? out : undefined;
}

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
  /** 城市玩法库（用于把各城市的防御塔模型绑定同步到对应关卡的运行时地图） */
  cityGameplayConfigs?: Record<string, unknown>;
}

interface SyncEditorLevelsResult {
  importedCount: number;
  requestedDefIdx: number;
  requestedExpIdx: number;
}

export function syncEditorLevelsToRuntime(options: SyncEditorLevelsOptions): SyncEditorLevelsResult {
  const { levels, requestedLevelId, maps, exploreMaps, cityMap, cityAliases, cityGameplayConfigs } = options;
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
    const defenseTowerModels = extractTowerModelUrlsFromCityConfigs(runtimeLevel, cityGameplayConfigs);
    const defenseMap = editorLevelToRuntimeMap(runtimeLevel, "defense", defenseTowerModels);
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

function normalizeCityConfigIdentity(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[·\s]/g, "")
    .replace(/市$/g, "");
}

function levelCityIdentities(level: EditorLevel): Set<string> {
  const loc = level.location ?? {};
  const ids = [
    level.id,
    loc.cityCode,
    loc.cityName,
    loc.regionLabel,
    loc.countryName,
  ]
    .map(normalizeCityConfigIdentity)
    .filter(Boolean);
  return new Set(ids);
}

function extractTowerModelUrlsFromCityConfigs(
  level: EditorLevel,
  rawConfigs: Record<string, unknown> | undefined,
): Partial<Record<BuildId, string>> | undefined {
  if (!rawConfigs || typeof rawConfigs !== "object") {
    return undefined;
  }
  const levelIds = levelCityIdentities(level);
  for (const [configKey, rawCfg] of Object.entries(rawConfigs)) {
    if (!rawCfg || typeof rawCfg !== "object") {
      continue;
    }
    const cfg = rawCfg as {
      cityCode?: string;
      cityName?: string;
      aliases?: string[];
      towers?: Array<{ id?: string; assetRefs?: { modelPath?: unknown } }>;
    };
    const cfgIds = [
      configKey,
      cfg.cityCode,
      cfg.cityName,
      ...(Array.isArray(cfg.aliases) ? cfg.aliases : []),
    ]
      .map(normalizeCityConfigIdentity)
      .filter(Boolean);
    let match = false;
    for (const cid of cfgIds) {
      if (levelIds.has(cid)) {
        match = true;
        break;
      }
    }
    if (!match) {
      continue;
    }
    const out: Partial<Record<BuildId, string>> = {};
    for (const t of cfg.towers ?? []) {
      const tid = String(t.id ?? "").trim() as BuildId;
      const path = String(t.assetRefs?.modelPath ?? "").trim();
      if (!path || !Object.prototype.hasOwnProperty.call(BUILD_SPECS, tid)) {
        continue;
      }
      out[tid] = path;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
}

export function editorLevelToRuntimeMap(
  level: EditorLevel,
  mode: GameMode,
  defenseTowerModelUrls?: Partial<Record<BuildId, string>>,
): MapDefinition {
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
  const boardImageLayers = sanitizeBoardImageLayers(editorMap.boardImageLayers);
  const levelAudio = sanitizeLevelMapAudioFromEditor(editorMap.levelAudio);
  const exploreBosses = mode === "explore" ? sanitizeExploreBosses(editorMap.exploreBosses, project) : undefined;
  const exploreSpawners = mode === "explore" ? sanitizeExploreSpawners(editorMap.exploreSpawners, project) : undefined;
  const explorePickups = mode === "explore" ? sanitizeExplorePickups(editorMap.explorePickups, project) : undefined;

  const levelGeo = resolveEditorLevelGeo(level);

  const boardUrlRaw = typeof theme.boardTextureUrl === "string" ? theme.boardTextureUrl.trim() : "";
  const boardTextureUrl = boardUrlRaw ? boardUrlRaw : undefined;

  return {
    id: `${level.id || "editor-level"}-${mode}`,
    name: `${level.name || "编辑器关卡"}${mode === "explore" ? " · 探索" : ""}`,
    description: level.description || "由关卡编辑器同步生成的运行时地图。",
    cols: sourceCols,
    rows: sourceRows,
    geo: levelGeo,
    theme: {
      ground: parseEditorColor(theme.ground, mode === "explore" ? 0x4e7578 : 0x5a7d82),
      groundAlt: parseEditorColor(theme.groundAlt, mode === "explore" ? 0x44686c : 0x4f7178),
      path: parseEditorColor(theme.path ?? theme.road, mode === "explore" ? 0x689892 : 0x6f9288),
      obstacle: parseEditorColor(theme.obstacle, mode === "explore" ? 0x505a62 : 0x5d6870),
      accent: parseEditorColor(theme.accent, mode === "explore" ? 0x7cad9e : 0x8fb8ae),
      fog: parseEditorColor(theme.fog, mode === "explore" ? 0x3a5054 : 0x445c60),
      ...(boardTextureUrl ? { boardTextureUrl } : {}),
      geoTileOpacity: parseEditorOpacity(theme.geoTileOpacity, 0.48),
      geoPathOpacity: parseEditorOpacity(theme.geoPathOpacity, 0.92),
      boardBaseOpacity: parseEditorOpacity(theme.boardBaseOpacity, 0.42),
      gridLineOpacity: parseEditorOpacity(theme.gridLineOpacity, 0.42),
      rimOpacity: parseEditorOpacity(theme.rimOpacity, 0.32),
      pathGlowOpacity: parseEditorOpacity(theme.pathGlowOpacity, 0.46),
      pathDetailOpacity: parseEditorOpacity(theme.pathDetailOpacity, 0.82),
      hoverCellOpacity: parseEditorOpacity(theme.hoverCellOpacity, 0.42),
      hoverColorOk: parseEditorColor(theme.hoverColorOk, 0x6a988c),
      hoverColorBad: parseEditorColor(theme.hoverColorBad, 0xd87880),
    },
    path,
    obstacles,
    actors: extractEditorActors(editorMap),
    safeZones: mode === "explore"
      ? uniqueCells((exploreLayout?.safeZones ?? []).map(project), sourceCols, sourceRows)
      : [],
    ...(mode === "explore"
      ? {
          exploreGameplay: { ...(exploreLayout?.gameplay ?? {}) } as ExploreGameplaySettings,
          ...(exploreBosses?.length ? { exploreBosses } : {}),
          ...(exploreSpawners?.length ? { exploreSpawners } : {}),
          ...(explorePickups?.length ? { explorePickups } : {}),
        }
      : {}),
    ...(mode === "defense"
      ? {
          cutscenes: sanitizeLevelCutscenes(editorMap.cutscenes),
          ...(defenseTowerModelUrls && Object.keys(defenseTowerModelUrls).length ? { towerModelUrls: defenseTowerModelUrls } : {}),
        }
      : {}),
    ...(levelAudio ? { levelAudio } : {}),
    ...(boardImageLayers?.length ? { boardImageLayers } : {}),
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