import * as THREE from "three";
const targetTmp = new THREE.Vector3();
const offsetTmp = new THREE.Vector3();
const positionTmp = new THREE.Vector3();
/** Teleport阈值：传送/切换地图后与目标差过大时直接对齐阻尼状态，避免长拖尾 */
const PIVOT_SNAP_DISTANCE_SQ = 40 * 40;
/** 第三人称跟随玩家（探索模式）；指针轨道拖拽仍在宿主 + input-controls。 */
export function tickExploreFollowCamera(deps, dt) {
    const smoothingCam = 1 - Math.exp(-8.5 * dt);
    const smoothingPivot = 1 - Math.exp(-11 * dt);
    deps.camera.up.set(0, 1, 0);
    targetTmp.copy(deps.playerPosition);
    targetTmp.x *= deps.playfieldVisualScale;
    targetTmp.z *= deps.playfieldVisualScale;
    targetTmp.y = 1.35;
    if (deps.smoothedPivot.distanceToSquared(targetTmp) > PIVOT_SNAP_DISTANCE_SQ) {
        deps.smoothedPivot.copy(targetTmp);
    }
    else {
        deps.smoothedPivot.lerp(targetTmp, smoothingPivot);
    }
    offsetTmp.set(Math.sin(deps.exploreCameraYaw) * deps.exploreCameraDistance, Math.sin(deps.exploreCameraPitch) * deps.exploreCameraDistance, Math.cos(deps.exploreCameraYaw) * deps.exploreCameraDistance);
    positionTmp.copy(deps.smoothedPivot).add(offsetTmp);
    deps.camera.position.lerp(positionTmp, smoothingCam);
    deps.camera.lookAt(deps.smoothedPivot);
}
