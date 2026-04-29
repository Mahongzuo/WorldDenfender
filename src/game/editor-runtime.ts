import { GRID_COLS, GRID_ROWS, TILE_SIZE } from "./runtime-grid";
import type { EditorExplorationLayout, EditorLevel, EditorLevelMap, GridCell, MapDefinition, MapTheme } from "./types";

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

export function runtimeThemeToEditorTheme(theme: MapTheme): Record<"ground" | "groundAlt" | "road" | "path" | "obstacle" | "accent" | "fog", string> {
  return {
    ground: numberToHexColor(theme.ground),
    groundAlt: numberToHexColor(theme.groundAlt),
    road: numberToHexColor(theme.path),
    path: numberToHexColor(theme.path),
    obstacle: numberToHexColor(theme.obstacle),
    accent: numberToHexColor(theme.accent),
    fog: numberToHexColor(theme.fog),
  };
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