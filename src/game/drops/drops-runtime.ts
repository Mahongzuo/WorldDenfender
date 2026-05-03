import * as THREE from "three";

import {
  cellKey,
  getActiveGridCols,
  getActiveGridRows,
  sameCell,
} from "../core/runtime-grid";
import type { Building, GameMode, GridCell, MoneyDrop } from "../core/types";

export function getAvailableMoneyDropCells(options: {
  buildings: Building[];
  obstacleCells: Set<string>;
}): GridCell[] {
  const { buildings, obstacleCells } = options;
  const candidates: GridCell[] = [];
  for (let row = 0; row < getActiveGridRows(); row += 1) {
    for (let col = 0; col < getActiveGridCols(); col += 1) {
      const cell = { col, row };
      const key = cellKey(cell);
      const occupied = buildings.some((building) => sameCell(building.cell, cell));
      if (!obstacleCells.has(key) && !occupied) {
        candidates.push(cell);
      }
    }
  }
  return candidates;
}

export function createExploreMoneyDrop(options: {
  uid: number;
  amount: number;
  cell: GridCell;
  mesh: THREE.Group;
}): MoneyDrop {
  return {
    uid: options.uid,
    amount: options.amount,
    cell: options.cell,
    mesh: options.mesh,
    autoCollect: false,
    collectTimer: 0,
    source: "explore",
  };
}

export function createDefenseMoneyDrop(options: {
  uid: number;
  amount: number;
  mesh: THREE.Group;
  autoCollect: boolean;
}): MoneyDrop {
  return {
    uid: options.uid,
    amount: options.amount,
    cell: null,
    mesh: options.mesh,
    autoCollect: options.autoCollect,
    collectTimer: options.autoCollect ? 0.75 : 0,
    source: "defense",
  };
}

export function updateMoneyDropVisibility(drops: MoneyDrop[], mode: GameMode): void {
  for (const drop of drops) {
    drop.mesh.visible = drop.source === mode;
  }
}

export function updateAutoCollectDrops(options: {
  drops: MoneyDrop[];
  mode: GameMode;
  elapsed: number;
  dt: number;
  dropGroup: THREE.Group;
  onCollect: (amount: number) => void;
}): MoneyDrop[] {
  const { drops, mode, elapsed, dt, dropGroup, onCollect } = options;
  const nextDrops: MoneyDrop[] = [];
  for (const drop of drops) {
    drop.mesh.visible = drop.source === mode;
    drop.mesh.rotation.y += dt * 1.7;
    drop.mesh.position.y = 0.24 + Math.sin(elapsed * 3 + drop.uid) * 0.08;
    if (!drop.autoCollect) {
      nextDrops.push(drop);
      continue;
    }

    drop.collectTimer -= dt;
    const scale = 1 + Math.max(0, 0.75 - drop.collectTimer) * 0.24;
    drop.mesh.scale.setScalar(scale);
    if (drop.collectTimer <= 0) {
      onCollect(drop.amount);
      dropGroup.remove(drop.mesh);
    } else {
      nextDrops.push(drop);
    }
  }
  return nextDrops;
}
