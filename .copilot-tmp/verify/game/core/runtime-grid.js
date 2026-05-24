import * as THREE from "three";
export const GRID_COLS = 28;
export const GRID_ROWS = 18;
export const TILE_SIZE = 2;
let activeGridCols = GRID_COLS;
let activeGridRows = GRID_ROWS;
export function getActiveGridCols() {
    return activeGridCols;
}
export function getActiveGridRows() {
    return activeGridRows;
}
export function rect(col, row, width, height) {
    const cells = [];
    for (let y = row; y < row + height; y += 1) {
        for (let x = col; x < col + width; x += 1) {
            cells.push({ col: x, row: y });
        }
    }
    return cells;
}
export function expandPath(points) {
    return new Set(expandPathToOrderedCells(points).map((cell) => cellKey(cell)));
}
/**
 * 与棋盘路径高光使用相同的曼哈顿展开（先横再纵），一格一格有序排列。
 * 敌人寻路必须与之一致；若仅用 `map.path` 稀疏顶点连线，会像切蛋糕一样斜穿格子。
 */
export function expandPathToOrderedCells(points) {
    if (points.length === 0) {
        return [];
    }
    if (points.length === 1) {
        return [{ ...points[0] }];
    }
    const ordered = [];
    for (let index = 0; index < points.length - 1; index += 1) {
        const segment = walkOrthogonalSegment(points[index], points[index + 1]);
        const startAt = index > 0 ? 1 : 0;
        for (let i = startAt; i < segment.length; i += 1) {
            ordered.push(segment[i]);
        }
    }
    return ordered;
}
/**
 * 仅在「已绘制的格子」集合内用 BFS 连接出生点与终点，避免对乱序/分叉的格子数组做
 * expandPathToOrderedCells 时在未绘制格子上插值穿墙。
 */
export function traceDefensePathAlongPaintedCells(paintedCells, spawn, goal, cols, rows) {
    const normalized = uniqueCells([...paintedCells], cols, rows);
    if (!normalized.length) {
        return null;
    }
    const allowed = new Set(normalized.map((c) => cellKey(c)));
    const spawnN = {
        col: clamp(Math.round(spawn.col), 0, cols - 1),
        row: clamp(Math.round(spawn.row), 0, rows - 1),
    };
    const goalN = {
        col: clamp(Math.round(goal.col), 0, cols - 1),
        row: clamp(Math.round(goal.row), 0, rows - 1),
    };
    if (sameCell(spawnN, goalN)) {
        return [spawnN];
    }
    const goalK = cellKey(goalN);
    const canEnter = (c) => allowed.has(cellKey(c)) || cellKey(c) === goalK;
    const q = [spawnN];
    const seen = new Set([cellKey(spawnN)]);
    const parent = new Map();
    const deltas = [
        { col: 1, row: 0 },
        { col: -1, row: 0 },
        { col: 0, row: 1 },
        { col: 0, row: -1 },
    ];
    while (q.length) {
        const cur = q.shift();
        const curK = cellKey(cur);
        if (curK === goalK) {
            const path = [];
            let trace = goalK;
            while (trace) {
                path.push(keyToCell(trace));
                if (trace === cellKey(spawnN))
                    break;
                trace = parent.get(trace);
            }
            path.reverse();
            return path;
        }
        for (const d of deltas) {
            const nb = { col: cur.col + d.col, row: cur.row + d.row };
            if (nb.col < 0 || nb.col >= cols || nb.row < 0 || nb.row >= rows)
                continue;
            const nk = cellKey(nb);
            if (seen.has(nk))
                continue;
            if (!canEnter(nb))
                continue;
            seen.add(nk);
            parent.set(nk, curK);
            q.push(nb);
        }
    }
    return null;
}
function walkOrthogonalSegment(start, end) {
    const out = [];
    let current = { ...start };
    out.push(current);
    while (current.col !== end.col) {
        current = { col: current.col + Math.sign(end.col - current.col), row: current.row };
        out.push(current);
    }
    while (current.row !== end.row) {
        current = { col: current.col, row: current.row + Math.sign(end.row - current.row) };
        out.push(current);
    }
    return out;
}
export function mapCols(map) {
    return map.cols ?? GRID_COLS;
}
export function mapRows(map) {
    return map.rows ?? GRID_ROWS;
}
export function setActiveRuntimeGrid(map) {
    activeGridCols = mapCols(map);
    activeGridRows = mapRows(map);
}
export function cellToWorld(cell) {
    return new THREE.Vector3((cell.col - activeGridCols / 2 + 0.5) * TILE_SIZE, 0, (cell.row - activeGridRows / 2 + 0.5) * TILE_SIZE);
}
export function worldToCell(world) {
    return {
        col: Math.floor(world.x / TILE_SIZE + activeGridCols / 2),
        row: Math.floor(world.z / TILE_SIZE + activeGridRows / 2),
    };
}
export function cellKey(cell) {
    return `${cell.col},${cell.row}`;
}
export function keyToCell(key) {
    const [col, row] = key.split(",").map(Number);
    return { col, row };
}
export function uniqueCells(cells, cols = GRID_COLS, rows = GRID_ROWS) {
    const seen = new Set();
    const result = [];
    for (const cell of cells) {
        const normalized = {
            col: clamp(Math.round(cell.col), 0, cols - 1),
            row: clamp(Math.round(cell.row), 0, rows - 1),
        };
        const key = cellKey(normalized);
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        result.push(normalized);
    }
    return result;
}
export function orderEditorPathCells(cells, start, end, cols = GRID_COLS, rows = GRID_ROWS) {
    const remaining = uniqueCells(cells, cols, rows);
    const ordered = [];
    let current = start;
    if (!remaining.some((cell) => sameCell(cell, start))) {
        ordered.push(start);
    }
    while (remaining.length > 0) {
        let nextIndex = remaining.findIndex((cell) => manhattanDistance(cell, current) === 1);
        if (nextIndex < 0) {
            nextIndex = remaining.reduce((bestIndex, cell, index) => {
                return manhattanDistance(cell, current) < manhattanDistance(remaining[bestIndex], current) ? index : bestIndex;
            }, 0);
        }
        const next = remaining.splice(nextIndex, 1)[0];
        ordered.push(next);
        current = next;
    }
    if (!ordered.some((cell) => sameCell(cell, end))) {
        ordered.push(end);
    }
    return uniqueCells(ordered, cols, rows);
}
export function manhattanDistance(a, b) {
    return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}
export function sameCell(a, b) {
    return !!b && a.col === b.col && a.row === b.row;
}
export function distanceXZ(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z);
}
export function distancePointToSegmentXZ(point, start, end) {
    const vx = end.x - start.x;
    const vz = end.z - start.z;
    const wx = point.x - start.x;
    const wz = point.z - start.z;
    const lengthSq = vx * vx + vz * vz;
    const t = lengthSq === 0 ? 0 : clamp((wx * vx + wz * vz) / lengthSq, 0, 1);
    const projection = new THREE.Vector3(start.x + vx * t, 0, start.z + vz * t);
    return distanceXZ(point, projection);
}
export function randomWeightedAmount() {
    const roll = Math.random();
    if (roll < 0.5)
        return 25;
    if (roll < 0.78)
        return 50;
    if (roll < 0.93)
        return 100;
    if (roll < 0.985)
        return 200;
    return 500;
}
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
