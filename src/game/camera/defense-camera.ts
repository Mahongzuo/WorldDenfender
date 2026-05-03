import * as THREE from "three";

import type { CameraMode, GameMode } from "../core/types";
import { clamp, getActiveGridCols, getActiveGridRows } from "../core/runtime-grid";

export interface DefenseKeyboardPanState {
  readonly keys: ReadonlySet<string>;
  freeCameraYaw: number;
  cameraPan: THREE.Vector3;
}

/** 塔防模式：WASD 棋盘平移（与自由相机 yaw 对齐） */
export function tickDefenseKeyboardCameraPan(dt: number, state: DefenseKeyboardPanState): void {
  if (state.keys.has("KeyJ")) state.freeCameraYaw += dt * 1.3;
  if (state.keys.has("KeyL")) state.freeCameraYaw -= dt * 1.3;

  const input = new THREE.Vector3();
  if (state.keys.has("KeyW") || state.keys.has("ArrowUp")) input.z += 1;
  if (state.keys.has("KeyS") || state.keys.has("ArrowDown")) input.z -= 1;
  if (state.keys.has("KeyA") || state.keys.has("ArrowLeft")) input.x -= 1;
  if (state.keys.has("KeyD") || state.keys.has("ArrowRight")) input.x += 1;
  if (input.lengthSq() === 0) {
    return;
  }

  input.normalize();
  const screenForward = new THREE.Vector3(-Math.sin(state.freeCameraYaw), 0, -Math.cos(state.freeCameraYaw));
  const screenRight = new THREE.Vector3(Math.cos(state.freeCameraYaw), 0, -Math.sin(state.freeCameraYaw));
  const worldDirection = screenRight
    .multiplyScalar(input.x)
    .add(screenForward.multiplyScalar(input.z))
    .normalize();
  const speed = state.keys.has("ShiftLeft") || state.keys.has("ShiftRight") ? 24 : 14;
  state.cameraPan.x = clamp(
    state.cameraPan.x + worldDirection.x * speed * dt,
    -getActiveGridCols(),
    getActiveGridCols(),
  );
  state.cameraPan.z = clamp(
    state.cameraPan.z + worldDirection.z * speed * dt,
    -getActiveGridRows(),
    getActiveGridRows(),
  );
}

export interface DefenseSceneCameraRig {
  camera: THREE.PerspectiveCamera;
  mode: GameMode;
  cameraMode: CameraMode;
  cameraPan: THREE.Vector3;
  playfieldVisualScale: number;
  playfieldYOffset: number;
  topdownDistance: number;
  freeCameraYaw: number;
  freeCameraPitch: number;
  freeCameraDistance: number;
}

const targetTmp = new THREE.Vector3();
const positionTmp = new THREE.Vector3();

/** 塔防棋盘镜头：俯视 / 斜视跟随 `cameraPan`（非 explore 时使用） */
export function tickDefenseSceneCamera(rig: DefenseSceneCameraRig, dt: number): void {
  if (rig.mode === "explore") {
    return;
  }
  const smoothing = 1 - Math.pow(0.001, dt);
  targetTmp.set(
    rig.cameraPan.x * rig.playfieldVisualScale,
    rig.playfieldYOffset,
    rig.cameraPan.z * rig.playfieldVisualScale,
  );
  if (rig.cameraMode === "topdown") {
    positionTmp.set(targetTmp.x, rig.playfieldYOffset + rig.topdownDistance, targetTmp.z + 0.01);
    rig.camera.up.set(Math.sin(rig.freeCameraYaw), 0, Math.cos(rig.freeCameraYaw));
    rig.camera.position.lerp(positionTmp, smoothing);
    rig.camera.lookAt(targetTmp);
    return;
  }

  rig.camera.up.set(0, 1, 0);
  const horizontalDistance = Math.cos(rig.freeCameraPitch) * rig.freeCameraDistance;
  const cameraHeight = Math.sin(rig.freeCameraPitch) * rig.freeCameraDistance;
  positionTmp.set(
    targetTmp.x + Math.sin(rig.freeCameraYaw) * horizontalDistance,
    rig.playfieldYOffset + cameraHeight,
    targetTmp.z + Math.cos(rig.freeCameraYaw) * horizontalDistance,
  );
  rig.camera.position.lerp(positionTmp, smoothing);
  rig.camera.lookAt(targetTmp);
}
