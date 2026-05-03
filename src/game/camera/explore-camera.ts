import * as THREE from "three";

const targetTmp = new THREE.Vector3();
const offsetTmp = new THREE.Vector3();
const positionTmp = new THREE.Vector3();

export interface ExploreFollowCameraDeps {
  camera: THREE.PerspectiveCamera;
  playerPosition: THREE.Vector3;
  playfieldVisualScale: number;
  exploreCameraYaw: number;
  exploreCameraPitch: number;
  exploreCameraDistance: number;
  /** 世界空间跟随锚点（与 targetTmp 同坐标系）；每帧阻尼向角色，减轻移动时视点抖动 */
  smoothedPivot: THREE.Vector3;
}

/** Teleport阈值：传送/切换地图后与目标差过大时直接对齐阻尼状态，避免长拖尾 */
const PIVOT_SNAP_DISTANCE_SQ = 40 * 40;

/** 第三人称跟随玩家（探索模式）；指针轨道拖拽仍在宿主 + input-controls。 */
export function tickExploreFollowCamera(deps: ExploreFollowCameraDeps, dt: number): void {
  const smoothingCam = 1 - Math.exp(-8.5 * dt);
  const smoothingPivot = 1 - Math.exp(-11 * dt);

  deps.camera.up.set(0, 1, 0);

  targetTmp.copy(deps.playerPosition);
  targetTmp.x *= deps.playfieldVisualScale;
  targetTmp.z *= deps.playfieldVisualScale;
  targetTmp.y = 1.35;

  if (deps.smoothedPivot.distanceToSquared(targetTmp) > PIVOT_SNAP_DISTANCE_SQ) {
    deps.smoothedPivot.copy(targetTmp);
  } else {
    deps.smoothedPivot.lerp(targetTmp, smoothingPivot);
  }

  offsetTmp.set(
    Math.sin(deps.exploreCameraYaw) * deps.exploreCameraDistance,
    Math.sin(deps.exploreCameraPitch) * deps.exploreCameraDistance,
    Math.cos(deps.exploreCameraYaw) * deps.exploreCameraDistance,
  );
  positionTmp.copy(deps.smoothedPivot).add(offsetTmp);
  deps.camera.position.lerp(positionTmp, smoothingCam);
  deps.camera.lookAt(deps.smoothedPivot);
}
