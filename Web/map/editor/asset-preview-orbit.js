import * as THREE from 'three';

/** 与关卡编辑器三维预览一致的 OrbitControls 交互：左键旋转、滚轮缩放、右键平移。 */
export function configureLevelStyleOrbitControls(controls, camera) {
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.autoRotate = false;
  controls.minDistance = 0.05;
  controls.maxDistance = 5200;
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  };
  if (camera) {
    camera.near = 0.05;
    camera.far = 10000;
    camera.updateProjectionMatrix();
  }
}

export function computePreviewObjectBounds(object) {
  var box = new THREE.Box3();
  var meshBox = new THREE.Box3();
  var hasMesh = false;
  object.updateMatrixWorld(true);
  object.traverse(function (child) {
    if (!child.isMesh || !child.geometry) return;
    var geometry = child.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox || geometry.boundingBox.isEmpty()) return;
    meshBox.copy(geometry.boundingBox).applyMatrix4(child.matrixWorld);
    if (!hasMesh) {
      box.copy(meshBox);
      hasMesh = true;
    } else {
      box.union(meshBox);
    }
  });
  if (!hasMesh) box.setFromObject(object);
  return box;
}

/**
 * 将模型居中到底座，并返回包围球半径（世界单位，未乘 autoFitScale）。
 */
export function centerPreviewObjectOnGround(object) {
  var box = computePreviewObjectBounds(object);
  var size = box.getSize(new THREE.Vector3());
  var center = box.getCenter(new THREE.Vector3());
  object.position.sub(center);
  object.position.y -= box.min.y;
  var maxSide = Math.max(size.x, size.y, size.z) || 1;
  return { maxSide: maxSide, box: box };
}

/**
 * 按关卡预览 focusSelection 逻辑设置相机与缩放距离限制。
 * @param {THREE.Object3D} object
 * @param {THREE.PerspectiveCamera} camera
 * @param {import('three/addons/controls/OrbitControls.js').OrbitControls} controls
 * @param {{ displayScale?: number }} [opts]
 */
export function framePreviewCameraToObject(object, camera, controls, opts) {
  var displayScale =
    opts && opts.displayScale != null && Number.isFinite(Number(opts.displayScale)) && Number(opts.displayScale) > 0
      ? Number(opts.displayScale)
      : 1;
  var box = computePreviewObjectBounds(object);
  if (box.isEmpty()) return;
  var sphere = box.getBoundingSphere(new THREE.Sphere());
  var center = box.getCenter(new THREE.Vector3());
  var radius = Math.max(sphere.radius * displayScale, 0.01);

  controls.target.copy(center);
  var dist = Math.max(radius * 3.2, 2.5);
  controls.minDistance = Math.max(0.05, radius * 0.06);
  controls.maxDistance = Math.max(500, radius * 120);

  var dir = new THREE.Vector3(1.1, 0.72, 1.05).normalize();
  camera.position.copy(center.clone().add(dir.multiplyScalar(dist)));
  controls.update();
}
