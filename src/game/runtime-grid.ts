import * as THREE from "three";

import type { GridCell, MapDefinition } from "./types";

export const GRID_COLS = 28;
export const GRID_ROWS = 18;
export const TILE_SIZE = 2;

let activeGridCols = GRID_COLS;
let activeGridRows = GRID_ROWS;

export function getActiveGridCols(): number {
  return activeGridCols;
}

export function getActiveGridRows(): number {
  return activeGridRows;
}

export function rect(col: number, row: number, width: number, height: number): GridCell[] {
  const cells: GridCell[] = [];
  for (let y = row; y < row + height; y += 1) {
    for (let x = col; x < col + width; x += 1) {
      cells.push({ col: x, row: y });
    }
  }
  return cells;
}

export function expandPath(points: GridCell[]): Set<string> {
  return new Set(expandPathToOrderedCells(points).map((cell) => cellKey(cell)));
}

/**
 * 与棋盘路径高光使用相同的曼哈顿展开（先横再纵），一格一格有序排列。
 * 敌人寻路必须与之一致；若仅用 `map.path` 稀疏顶点连线，会像切蛋糕一样斜穿格子。
 */
export function expandPathToOrderedCells(points: GridCell[]): GridCell[] {
  if (points.length === 0) {
    return [];
  }
  if (points.length === 1) {
    return [{ ...points[0] }];
  }
  const ordered: GridCell[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const segment = walkOrthogonalSegment(points[index], points[index + 1]);
    const startAt = index > 0 ? 1 : 0;
    for (let i = startAt; i < segment.length; i += 1) {
      ordered.push(segment[i]);
    }
  }
  return ordered;
}

function walkOrthogonalSegment(start: GridCell, end: GridCell): GridCell[] {
  const out: GridCell[] = [];
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

export function mapCols(map: MapDefinition): number {
  return map.cols ?? GRID_COLS;
}

export function mapRows(map: MapDefinition): number {
  return map.rows ?? GRID_ROWS;
}

export function setActiveRuntimeGrid(map: MapDefinition): void {
  activeGridCols = mapCols(map);
  activeGridRows = mapRows(map);
}

export function cellToWorld(cell: GridCell): THREE.Vector3 {
  return new THREE.Vector3(
    (cell.col - activeGridCols / 2 + 0.5) * TILE_SIZE,
    0,
    (cell.row - activeGridRows / 2 + 0.5) * TILE_SIZE,
  );
}

export function worldToCell(world: THREE.Vector3): GridCell {
  return {
    col: Math.floor(world.x / TILE_SIZE + activeGridCols / 2),
    row: Math.floor(world.z / TILE_SIZE + activeGridRows / 2),
  };
}

export function cellKey(cell: GridCell): string {
  return `${cell.col},${cell.row}`;
}

export function keyToCell(key: string): GridCell {
  const [col, row] = key.split(",").map(Number);
  return { col, row };
}

export function uniqueCells(cells: GridCell[], cols = GRID_COLS, rows = GRID_ROWS): GridCell[] {
  const seen = new Set<string>();
  const result: GridCell[] = [];
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

export function orderEditorPathCells(cells: GridCell[], start: GridCell, end: GridCell, cols = GRID_COLS, rows = GRID_ROWS): GridCell[] {
  const remaining = uniqueCells(cells, cols, rows);
  const ordered: GridCell[] = [];
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

export function manhattanDistance(a: GridCell, b: GridCell): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

export function sameCell(a: GridCell, b: GridCell | null): boolean {
  return !!b && a.col === b.col && a.row === b.row;
}

export function distanceXZ(a: THREE.Vector3, b: THREE.Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function distancePointToSegmentXZ(point: THREE.Vector3, start: THREE.Vector3, end: THREE.Vector3): number {
  const vx = end.x - start.x;
  const vz = end.z - start.z;
  const wx = point.x - start.x;
  const wz = point.z - start.z;
  const lengthSq = vx * vx + vz * vz;
  const t = lengthSq === 0 ? 0 : clamp((wx * vx + wz * vz) / lengthSq, 0, 1);
  const projection = new THREE.Vector3(start.x + vx * t, 0, start.z + vz * t);
  return distanceXZ(point, projection);
}

export function randomWeightedAmount(): number {
  const roll = Math.random();
  if (roll < 0.5) return 25;
  if (roll < 0.78) return 50;
  if (roll < 0.93) return 100;
  if (roll < 0.985) return 200;
  return 500;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}