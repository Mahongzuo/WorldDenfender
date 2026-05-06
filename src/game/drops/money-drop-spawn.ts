import * as THREE from "three";

import { createDefenseMoneyDrop, createExploreMoneyDrop, getAvailableMoneyDropCells } from "./drops-runtime";
import { cellToWorld, randomWeightedAmount } from "../core/runtime-grid";
import type { Building, ExplorePickupPlacement, GridCell, MoneyDrop } from "../core/types";

export interface ExploreMoneyDropSpawnContext {
  buildings: Building[];
  obstacleCells: Set<string>;
  drops: MoneyDrop[];
  dropGroup: THREE.Group;
  allocateUid(): number;
  createMesh(amount: number): THREE.Group;
}

export interface PlacedExplorePickupSpawnContext {
  drops: MoneyDrop[];
  dropGroup: THREE.Group;
  allocateUid(): number;
  createMesh(pickup: ExplorePickupPlacement): THREE.Group;
}

export interface DefenseMoneyDropSpawnContext {
  drops: MoneyDrop[];
  dropGroup: THREE.Group;
  allocateUid(): number;
  createMesh(amount: number): THREE.Group;
}

/** @returns 生成成功时掉落金额；无可用格时 false */
export function spawnExploreMoneyDropOnGrid(context: ExploreMoneyDropSpawnContext): number | false {
  const candidates = getAvailableMoneyDropCells({
    buildings: context.buildings,
    obstacleCells: context.obstacleCells,
  });
  if (candidates.length === 0) {
    return false;
  }

  const cell: GridCell = candidates[Math.floor(Math.random() * candidates.length)];
  const amount = randomWeightedAmount();
  const drop = createExploreMoneyDrop({
    uid: context.allocateUid(),
    amount,
    cell,
    mesh: context.createMesh(amount),
  });

  const position = cellToWorld(cell);
  drop.mesh.position.set(position.x, 0.25, position.z);
  context.drops.push(drop);
  context.dropGroup.add(drop.mesh);
  return amount;
}

export function spawnDefenseMoneyDropAtWorld(
  context: DefenseMoneyDropSpawnContext,
  position: THREE.Vector3,
  amount: number,
  autoCollect: boolean,
): void {
  const drop = createDefenseMoneyDrop({
    uid: context.allocateUid(),
    amount,
    mesh: context.createMesh(amount),
    autoCollect,
  });
  drop.mesh.position.set(position.x, 0.28, position.z);
  context.drops.push(drop);
  context.dropGroup.add(drop.mesh);
}

export function spawnPlacedExplorePickup(
  context: PlacedExplorePickupSpawnContext,
  pickup: ExplorePickupPlacement,
): boolean {
  const amount = pickup.type === "money" ? Math.max(0, Math.round(pickup.moneyAmount ?? 0)) : 0;
  const drop = createExploreMoneyDrop({
    uid: context.allocateUid(),
    amount,
    cell: { col: pickup.col, row: pickup.row },
    mesh: context.createMesh(pickup),
  });
  drop.pickup = pickup;

  const position = cellToWorld(pickup);
  drop.mesh.position.set(position.x, 0.25, position.z);
  context.drops.push(drop);
  context.dropGroup.add(drop.mesh);
  return true;
}
