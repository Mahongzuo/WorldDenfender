import * as THREE from "three";

/**
 * fxGroup 与地面、塔、敌人的父级缩放一致时常带 (sx,1,sz) 与抬高。
 * 来自 getWorldPosition / localToWorld 的「场景世界」分量不能直接当作 fxGroup.local，否则 GEO 缩放后弹道/飘字会偏离棋盘甚至出视锥。
 */
export function worldPointToFxGroupLocal(fxGroup: THREE.Group, world: THREE.Vector3): THREE.Vector3 {
  const v = world.clone();
  fxGroup.updateMatrixWorld(true);
  fxGroup.worldToLocal(v);
  return v;
}

/**
 * fxGroup 在地理模式下常为 (sx,1,sz) 且 sx≈sz>1：子物体的 XZ 会先被拉大，观感像「压在棋盘面上压扁」。
 * 在子层级上按比例缩小 local X/Z，可把球/圆柱横截面拉回与关闭地理底板时相近的圆度。
 */
export function unwindFxSquashFromPlayfieldParent(obj: THREE.Object3D, fxGroup: THREE.Group): void {
  const sx = fxGroup.scale.x;
  const sz = fxGroup.scale.z;
  const sy = fxGroup.scale.y;
  if (!(sx > 1.001) || Math.abs(sx - sz) >= 0.02 || sy > 1.05 || sy <= 1e-6) {
    return;
  }
  const ix = 1 / sx;
  obj.scale.x *= ix;
  obj.scale.z *= ix;
}
