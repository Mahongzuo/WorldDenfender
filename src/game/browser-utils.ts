import * as THREE from "three";

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return window.btoa(binary);
}

export function setObjectOpacity(object: THREE.Object3D, opacity: number): void {
  const mats = (object as THREE.Mesh | THREE.Line | THREE.LineSegments | THREE.Points | THREE.Sprite).material;
  if (mats) {
    const list = Array.isArray(mats) ? mats : [mats];
    for (const item of list) {
      item.transparent = true;
      item.opacity = opacity;
    }
  }

  for (const child of object.children) {
    setObjectOpacity(child, opacity);
  }
}