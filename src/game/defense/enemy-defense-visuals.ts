import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";

import {
  getDefaultEnemyGlbUrl,
  getEnemyTargetBodyDiameter,
} from "../assets/enemy-default-models";
import { clamp } from "../core/runtime-grid";
import type { Enemy } from "../core/types";

export interface EnemyDefenseVisualsDeps {
  hudScale: () => number;
  applyGeoPlayfieldSquashCompensation: (mesh: THREE.Object3D) => void;
  gltfLoader: GLTFLoader;
  /** 宿主持有的按 URL 的 GLB 模板缓存（原地共享） */
  templateByUrl: Map<string, THREE.Object3D>;
  /** 仍在战场上的敌人列表引用，用于异步加载完成时校验 */
  enemies: () => readonly Enemy[];
  orientHudToCamera: (obj: THREE.Object3D) => void;
}

export class EnemyDefenseVisuals {
  constructor(private readonly deps: EnemyDefenseVisualsDeps) {}

  private healthBarHalfWidth(enemy: Enemy): number {
    enemy.healthBar.geometry.computeBoundingBox();
    const box = enemy.healthBar.geometry.boundingBox;
    return box ? Math.max(0.01, (box.max.x - box.min.x) * 0.5) : 0.59;
  }

  applyHealthBarScale(enemy: Enemy): void {
    const scale = this.deps.hudScale();
    const ratio = clamp(enemy.hp / enemy.maxHp, 0, 1);
    const halfWidth = this.healthBarHalfWidth(enemy);
    const barRoot = enemy.mesh.children.find((ch) => ch.userData.isEnemyHealthBarRoot);
    const healthBarBack =
      barRoot?.children.find((ch) => ch !== enemy.healthBar && ch.userData.isEnemyHealthBar) ??
      enemy.mesh.children.find((ch) => ch !== enemy.healthBar && ch.userData.isEnemyHealthBar && !ch.userData.isEnemyHealthBarRoot);

    healthBarBack?.scale.set(scale, scale, 1);
    enemy.healthBar.scale.set(scale * Math.max(0.02, ratio), scale, 1);
    enemy.healthBar.position.x = -(1 - ratio) * halfWidth * scale;
    enemy.healthBar.position.z = 0.02;
  }

  /** 根据除血条外的子物体包围盒，将血条移到模型顶缘上方 */
  syncHealthBarVertical(enemy: Enemy): void {
    enemy.mesh.updateMatrixWorld(true);
    const bar = enemy.healthBar;
    const box = new THREE.Box3();
    for (const ch of enemy.mesh.children) {
      if (!ch.userData.isEnemyHealthBar) {
        box.expandByObject(ch);
      }
    }
    if (box.isEmpty()) {
      return;
    }
    const cx = (box.min.x + box.max.x) * 0.5;
    const cz = (box.min.z + box.max.z) * 0.5;
    const worldTop = new THREE.Vector3(cx, box.max.y + 0.24 * this.deps.hudScale(), cz);
    const localTop = enemy.mesh.worldToLocal(worldTop.clone());
    const barRoot = enemy.mesh.children.find((ch) => ch.userData.isEnemyHealthBarRoot);
    if (barRoot) {
      barRoot.position.set(0, localTop.y, 0);
      bar.position.y = 0;
    } else {
      bar.position.y = localTop.y;
    }
    for (const ch of enemy.mesh.children) {
      if (ch.userData.isEnemyHealthBar && ch !== bar && !ch.userData.isEnemyHealthBarRoot) {
        ch.position.set(0, localTop.y, 0);
      }
    }
    this.applyHealthBarScale(enemy);
  }

  /** 塔开火瞄准：敌人包围盒中心 */
  aimWorldCenter(enemy: Enemy): THREE.Vector3 {
    enemy.mesh.updateMatrixWorld(true);
    const box = new THREE.Box3();
    for (const ch of enemy.mesh.children) {
      if (!ch.userData.isEnemyHealthBar) {
        box.expandByObject(ch);
      }
    }
    if (box.isEmpty()) {
      const p = enemy.mesh.position.clone();
      p.y += 0.72;
      return p;
    }
    return new THREE.Vector3(
      (box.min.x + box.max.x) * 0.5,
      (box.min.y + box.max.y) * 0.52,
      (box.min.z + box.max.z) * 0.5,
    );
  }

  async replaceBodyWithDefaultGltf(enemy: Enemy): Promise<void> {
    const url = getDefaultEnemyGlbUrl(enemy.type);
    if (!url) {
      return;
    }

    try {
      let template = this.deps.templateByUrl.get(url);
      if (!template) {
        const gltf = await new Promise<{ scene: THREE.Object3D }>((resolve, reject) => {
          this.deps.gltfLoader.load(url!, resolve, undefined, reject);
        });
        template = gltf.scene;
        this.deps.templateByUrl.set(url, template);
      }

      if (!this.deps.enemies().includes(enemy)) {
        return;
      }

      const root = skeletonClone(template);
      root.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });

      for (const ch of [...enemy.mesh.children]) {
        if (!ch.userData.isEnemyHealthBar) {
          enemy.mesh.remove(ch);
        }
      }

      const targetDiameter = getEnemyTargetBodyDiameter(enemy);
      const boxBefore = new THREE.Box3().setFromObject(root);
      const sizeBefore = boxBefore.getSize(new THREE.Vector3());
      const horizontal = Math.max(sizeBefore.x, sizeBefore.z, 0.001);
      const uniform = targetDiameter / horizontal;
      root.scale.setScalar(uniform);

      const boxAfter = new THREE.Box3().setFromObject(root);
      root.position.y = -boxAfter.min.y;

      enemy.mesh.add(root);
      this.deps.applyGeoPlayfieldSquashCompensation(enemy.mesh);
      this.syncHealthBarVertical(enemy);
    } catch (error) {
      console.warn("[EnemyModel] failed to load default GLB:", url, error);
      if (this.deps.enemies().includes(enemy)) {
        this.deps.applyGeoPlayfieldSquashCompensation(enemy.mesh);
        this.syncHealthBarVertical(enemy);
      }
    }
  }

  tickEnemyHuds(enemies: readonly Enemy[]): void {
    const orient = this.deps.orientHudToCamera;
    for (const enemy of enemies) {
      this.applyHealthBarScale(enemy);
      let rotatedRoot = false;
      for (const child of enemy.mesh.children) {
        if (child.userData.isEnemyHealthBarRoot) {
          orient(child);
          rotatedRoot = true;
        }
      }
      if (!rotatedRoot) {
        for (const child of enemy.mesh.children) {
          if (child.userData.isEnemyHealthBar) {
            orient(child);
          }
        }
      }
    }
  }
}
