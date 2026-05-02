import { GRID_COLS, GRID_ROWS, TILE_SIZE } from "./runtime-grid";
import type { EditorExplorationLayout, EditorLevel, EditorLevelMap, GridCell, MapDefinition, MapTheme } from "./types";

export function parseEditorOpacity(value: string | number | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(1, value));
  }
  if (typeof value !== "string") {
    return fallback;
  }
  const n = Number(value.trim());
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
}

export function parseEditorColor(value: string | number | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  if (trimmed.startsWith("#")) {
    const parsed = Number.parseInt(trimmed.slice(1), 16);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  if (trimmed.startsWith("0x")) {
    const parsed = Number.parseInt(trimmed.slice(2), 16);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function hasEditorDefenseLayout(map: EditorLevelMap): boolean {
  const pathCellCount = map.enemyPaths?.reduce((sum, path) => sum + (path.cells?.length ?? 0), 0) ?? 0;
  return (map.roads?.length ?? 0) > 0 || pathCellCount > 0 || (map.obstacles?.length ?? 0) > 0;
}

export function hasEditorExploreLayout(map: EditorLevelMap): boolean {
  const layout = map.explorationLayout;
  return !!layout && ((layout.path?.length ?? 0) > 0 || (layout.obstacles?.length ?? 0) > 0);
}

export function runtimeMapToEditorMap(map: MapDefinition, current: EditorLevelMap): EditorLevelMap {
  const path = cloneCells(map.path);
  return {
    ...current,
    grid: { cols: map.cols ?? GRID_COLS, rows: map.rows ?? GRID_ROWS, tileSize: TILE_SIZE },
    theme: runtimeThemeToEditorTheme(map.theme),
    roads: path,
    enemyPaths: [{ id: "path-main", name: "主敌人路径", cells: path }],
    obstacles: cloneCells(map.obstacles),
    spawnPoints: [{ id: "spawn-main", name: "敌人入口", ...path[0] }],
    objectivePoint: { id: "objective-main", name: "防守核心", ...path[path.length - 1] },
  };
}

export function runtimeMapToEditorExplorationLayout(map: MapDefinition): EditorExplorationLayout {
  const path = cloneCells(map.path);
  return {
    grid: { cols: map.cols ?? GRID_COLS, rows: map.rows ?? GRID_ROWS, tileSize: TILE_SIZE },
    theme: runtimeThemeToEditorTheme(map.theme),
    path,
    obstacles: cloneCells(map.obstacles),
    startPoint: { id: "explore-start", name: "探索起点", ...path[0] },
    exitPoint: { id: "explore-exit", name: "探索终点", ...path[path.length - 1] },
  };
}

export function runtimeThemeToEditorTheme(theme: MapTheme): Record<string, string | number> {
  const out: Record<string, string | number> = {
    ground: numberToHexColor(theme.ground),
    groundAlt: numberToHexColor(theme.groundAlt),
    road: numberToHexColor(theme.path),
    path: numberToHexColor(theme.path),
    obstacle: numberToHexColor(theme.obstacle),
    accent: numberToHexColor(theme.accent),
    fog: numberToHexColor(theme.fog),
  };
  if (theme.boardTextureUrl) out.boardTextureUrl = theme.boardTextureUrl;
  if (theme.geoTileOpacity != null) out.geoTileOpacity = theme.geoTileOpacity;
  if (theme.geoPathOpacity != null) out.geoPathOpacity = theme.geoPathOpacity;
  if (theme.boardBaseOpacity != null) out.boardBaseOpacity = theme.boardBaseOpacity;
  if (theme.gridLineOpacity != null) out.gridLineOpacity = theme.gridLineOpacity;
  if (theme.rimOpacity != null) out.rimOpacity = theme.rimOpacity;
  if (theme.pathGlowOpacity != null) out.pathGlowOpacity = theme.pathGlowOpacity;
  if (theme.pathDetailOpacity != null) out.pathDetailOpacity = theme.pathDetailOpacity;
  if (theme.hoverCellOpacity != null) out.hoverCellOpacity = theme.hoverCellOpacity;
  if (theme.hoverColorOk != null) out.hoverColorOk = numberToHexColor(theme.hoverColorOk);
  if (theme.hoverColorBad != null) out.hoverColorBad = numberToHexColor(theme.hoverColorBad);
  return out;
}

export function cloneCells(cells: GridCell[]): GridCell[] {
  return cells.map((cell) => ({ col: cell.col, row: cell.row }));
}

export function numberToHexColor(value: number): string {
  return `#${value.toString(16).padStart(6, "0")}`;
}

export function editorLevelRuntimePriority(level: EditorLevel): number {
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