import { GRID_COLS, GRID_ROWS, TILE_SIZE } from "../core/runtime-grid";
export function parseEditorOpacity(value, fallback) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return Math.max(0, Math.min(1, value));
    }
    if (typeof value !== "string") {
        return fallback;
    }
    const n = Number(value.trim());
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
}
export function parseEditorColor(value, fallback) {
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
export function hasEditorDefenseLayout(map) {
    const pathCellCount = map.enemyPaths?.reduce((sum, path) => sum + (path.cells?.length ?? 0), 0) ?? 0;
    return (map.roads?.length ?? 0) > 0 || pathCellCount > 0 || (map.obstacles?.length ?? 0) > 0;
}
export function hasEditorExploreLayout(map) {
    const layout = map.explorationLayout;
    const gameplayKeys = layout?.gameplay ? Object.keys(layout.gameplay).filter((key) => layout.gameplay?.[key] != null) : [];
    return !!layout && ((layout.path?.length ?? 0) > 0 ||
        (layout.obstacles?.length ?? 0) > 0 ||
        (layout.safeZones?.length ?? 0) > 0 ||
        !!layout.startPoint ||
        !!layout.exitPoint ||
        gameplayKeys.length > 0 ||
        (map.explorationPoints?.length ?? 0) > 0 ||
        (map.exploreBosses?.length ?? 0) > 0 ||
        (map.exploreSpawners?.length ?? 0) > 0 ||
        (map.explorePickups?.length ?? 0) > 0);
}
export function runtimeMapToEditorMap(map, current) {
    const path = cloneCells(map.path);
    const enemyPaths = map.enemyPaths?.length
        ? map.enemyPaths.map((item, index) => ({
            id: item.id || `path-${index + 1}`,
            name: item.name || `敌人路径 ${index + 1}`,
            cells: cloneCells(item.cells),
        }))
        : [{ id: "path-main", name: "主敌人路径", cells: path }];
    const spawnPoints = map.spawnPoints?.length
        ? map.spawnPoints.map((point, index) => ({ id: point.id || `spawn-${index + 1}`, name: point.name || `敌人入口 ${index + 1}`, ...point }))
        : [{ id: "spawn-main", name: "敌人入口", ...path[0] }];
    return {
        ...current,
        grid: { cols: map.cols ?? GRID_COLS, rows: map.rows ?? GRID_ROWS, tileSize: TILE_SIZE },
        theme: runtimeThemeToEditorTheme(map.theme),
        roads: path,
        enemyPaths,
        obstacles: cloneCells(map.obstacles),
        spawnPoints,
        objectivePoint: { id: "objective-main", name: "防守核心", ...path[path.length - 1] },
        ...(map.defenseFlavor ? { defenseFlavor: JSON.parse(JSON.stringify(map.defenseFlavor)) } : {}),
        ...(map.levelAudio ? { levelAudio: map.levelAudio } : {}),
    };
}
export function runtimeMapToEditorExplorationLayout(map) {
    const path = cloneCells(map.path);
    const layout = {
        grid: { cols: map.cols ?? GRID_COLS, rows: map.rows ?? GRID_ROWS, tileSize: TILE_SIZE },
        theme: runtimeThemeToEditorTheme(map.theme),
        path,
        obstacles: cloneCells(map.obstacles),
        startPoint: { id: "explore-start", name: "探索起点", ...path[0] },
        exitPoint: { id: "explore-exit", name: "探索终点", ...path[path.length - 1] },
    };
    const gp = map.exploreGameplay;
    if (gp && typeof gp === "object") {
        const keys = Object.keys(gp).filter((k) => gp[k] != null);
        if (keys.length) {
            layout.gameplay = { ...gp };
        }
    }
    return layout;
}
export function runtimeThemeToEditorTheme(theme) {
    const out = {
        ground: numberToHexColor(theme.ground),
        groundAlt: numberToHexColor(theme.groundAlt),
        road: numberToHexColor(theme.path),
        path: numberToHexColor(theme.path),
        obstacle: numberToHexColor(theme.obstacle),
        accent: numberToHexColor(theme.accent),
        fog: numberToHexColor(theme.fog),
    };
    if (theme.boardTextureUrl)
        out.boardTextureUrl = theme.boardTextureUrl;
    if (theme.geoTileOpacity != null)
        out.geoTileOpacity = theme.geoTileOpacity;
    if (theme.geoPathOpacity != null)
        out.geoPathOpacity = theme.geoPathOpacity;
    if (theme.boardBaseOpacity != null)
        out.boardBaseOpacity = theme.boardBaseOpacity;
    if (theme.gridLineOpacity != null)
        out.gridLineOpacity = theme.gridLineOpacity;
    if (theme.rimOpacity != null)
        out.rimOpacity = theme.rimOpacity;
    if (theme.pathGlowOpacity != null)
        out.pathGlowOpacity = theme.pathGlowOpacity;
    if (theme.pathDetailOpacity != null)
        out.pathDetailOpacity = theme.pathDetailOpacity;
    if (theme.hoverCellOpacity != null)
        out.hoverCellOpacity = theme.hoverCellOpacity;
    if (theme.hoverColorOk != null)
        out.hoverColorOk = numberToHexColor(theme.hoverColorOk);
    if (theme.hoverColorBad != null)
        out.hoverColorBad = numberToHexColor(theme.hoverColorBad);
    return out;
}
export function cloneCells(cells) {
    return cells.map((cell) => ({ col: cell.col, row: cell.row }));
}
export function numberToHexColor(value) {
    return `#${value.toString(16).padStart(6, "0")}`;
}
export function editorLevelRuntimePriority(level) {
    const map = level.map;
    const designScore = (map?.roads?.length ?? 0) +
        (map?.enemyPaths?.reduce((sum, path) => sum + (path.cells?.length ?? 0), 0) ?? 0) +
        (map?.obstacles?.length ?? 0) +
        (map?.spawnPoints?.length ?? 0) +
        (map?.explorationPoints?.length ?? 0) +
        (map?.exploreBosses?.length ?? 0) +
        (map?.exploreSpawners?.length ?? 0) +
        (map?.explorePickups?.length ?? 0);
    const statusScore = level.status === "designed" ? 30 : level.status === "needs-work" ? 20 : 10;
    return statusScore + Math.min(designScore, 9);
}
