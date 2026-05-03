import * as THREE from "three";

import type { CameraMode, GameMode } from "../core/types";

/**
 * HUD 告示牌面朝相机：
 * - 战术俯视：沿用相机自身 up；
 * - 斜视巡航（塔防自由相机）：世界 Y 为牌面向上，避免顶视躺着。
 */
export class HudBillboardOrient {
  private readonly camWPos = new THREE.Vector3();
  private readonly hudWPos = new THREE.Vector3();
  private readonly axisZ = new THREE.Vector3();
  private readonly axisX = new THREE.Vector3();
  private readonly axisY = new THREE.Vector3();
  private readonly camUpW = new THREE.Vector3();
  private readonly basisM = new THREE.Matrix4();
  private readonly worldM = new THREE.Matrix4();
  private readonly parentInvM = new THREE.Matrix4();
  private readonly localM = new THREE.Matrix4();
  private readonly camQuat = new THREE.Quaternion();

  orient(camera: THREE.Camera, mode: GameMode, cameraMode: CameraMode, hudRoot: THREE.Object3D): void {
    const parentObj = hudRoot.parent;
    if (!parentObj) {
      hudRoot.lookAt(camera.getWorldPosition(this.camWPos));
      return;
    }

    parentObj.updateWorldMatrix(true, false);
    camera.updateMatrixWorld(false);
    this.hudWPos.copy(hudRoot.position).applyMatrix4(parentObj.matrixWorld);
    camera.getWorldPosition(this.camWPos);

    this.axisZ.copy(this.camWPos).sub(this.hudWPos);
    if (this.axisZ.lengthSq() < 1e-12) {
      return;
    }
    this.axisZ.normalize();

    if (mode === "defense" && cameraMode === "free") {
      this.camUpW.set(0, 1, 0);
    } else {
      camera.getWorldQuaternion(this.camQuat);
      this.camUpW.copy(camera.up).applyQuaternion(this.camQuat).normalize();
    }

    this.axisX.copy(this.camUpW).cross(this.axisZ);
    if (this.axisX.lengthSq() < 1e-12) {
      this.axisX.set(1, 0, 0).cross(this.axisZ);
      if (this.axisX.lengthSq() < 1e-12) {
        this.axisX.set(0, 1, 0).cross(this.axisZ);
      }
    }
    this.axisX.normalize();
    this.axisY.copy(this.axisZ).cross(this.axisX).normalize();

    this.basisM.makeBasis(this.axisX, this.axisY, this.axisZ);
    this.worldM.copy(this.basisM).setPosition(this.hudWPos);
    this.parentInvM.copy(parentObj.matrixWorld).invert();
    this.localM.multiplyMatrices(this.parentInvM, this.worldM);

    hudRoot.matrixAutoUpdate = false;
    hudRoot.matrix.copy(this.localM);
    hudRoot.matrixWorldNeedsUpdate = true;
  }
}
