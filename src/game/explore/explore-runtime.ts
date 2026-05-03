import * as THREE from "three";

import { distanceXZ } from "../core/runtime-grid";
import type { MoneyDrop, PlayerExploreTransform } from "../core/types";
import { DEFAULT_MOVE_SPEED_RUN, DEFAULT_MOVE_SPEED_WALK } from "./explore-gameplay-settings";

export interface ExploreMoveIntent {
  isMoving: boolean;
  isRunning: boolean;
  worldDirection: THREE.Vector3;
  speed: number;
}

/** @param walkMode 为 true 时慢走；为 false 时奔跑（默认） */
export function getExploreMoveIntent(
  keys: Set<string>,
  exploreCameraYaw: number,
  walkMode: boolean,
  speeds?: { walk: number; run: number },
): ExploreMoveIntent {
  const walkSpeed = speeds?.walk ?? DEFAULT_MOVE_SPEED_WALK;
  const runSpeed = speeds?.run ?? DEFAULT_MOVE_SPEED_RUN;

  const direction = new THREE.Vector3();
  if (keys.has("KeyW") || keys.has("ArrowUp")) direction.z -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) direction.z += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) direction.x -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) direction.x += 1;

  const isMoving = direction.lengthSq() > 0;
  const isRunning = !walkMode;
  if (!isMoving) {
    return {
      isMoving,
      isRunning,
      worldDirection: new THREE.Vector3(),
      speed: isRunning ? runSpeed : walkSpeed,
    };
  }

  direction.normalize();
  const cameraForward = new THREE.Vector3(-Math.sin(exploreCameraYaw), 0, -Math.cos(exploreCameraYaw));
  const cameraRight = new THREE.Vector3(Math.cos(exploreCameraYaw), 0, -Math.sin(exploreCameraYaw));
  const worldDirection = new THREE.Vector3()
    .addScaledVector(cameraRight, -direction.x)
    .addScaledVector(cameraForward, direction.z)
    .normalize();

  return {
    isMoving,
    isRunning,
    worldDirection,
    speed: isRunning ? runSpeed : walkSpeed,
  };
}

export function orientPlayerToMovement(
  player: THREE.Group,
  worldDirection: THREE.Vector3,
  transform: PlayerExploreTransform,
): void {
  const lookTarget = new THREE.Vector3(
    player.position.x + worldDirection.x,
    player.position.y,
    player.position.z + worldDirection.z,
  );
  player.lookAt(lookTarget);
  const eOff = new THREE.Euler(
    THREE.MathUtils.degToRad(transform.rotationDeg.x),
    THREE.MathUtils.degToRad(transform.rotationDeg.y),
    THREE.MathUtils.degToRad(transform.rotationDeg.z),
    "YXZ",
  );
  player.quaternion.multiply(new THREE.Quaternion().setFromEuler(eOff));
}

export function collectExploreDrops(options: {
  drops: MoneyDrop[];
  playerPosition: THREE.Vector3;
  dropGroup: THREE.Group;
  onCollect: (drop: MoneyDrop) => void;
}): MoneyDrop[] {
  const { drops, playerPosition, dropGroup, onCollect } = options;
  const nextDrops: MoneyDrop[] = [];
  for (const drop of drops) {
    if (drop.source === "explore" && distanceXZ(playerPosition, drop.mesh.position) <= 1.25) {
      onCollect(drop);
      dropGroup.remove(drop.mesh);
    } else {
      nextDrops.push(drop);
    }
  }
  return nextDrops;
}
