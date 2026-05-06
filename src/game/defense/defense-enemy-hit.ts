import * as THREE from "three";

import type { EnemyDefenseVisuals } from "./enemy-defense-visuals";
import { TILE_SIZE, distanceXZ } from "../core/runtime-grid";
import type { Building, Enemy } from "../core/types";
import { getDefenseEnemyArchetypeSpec } from "./defense-enemy-archetypes";
import { applyDefenseEffectToBuilding } from "./defense-status";

/** 塔防杀敌、黑客僵直、蜂群分裂与掉落的一体化入口 */
export interface DefenseEnemyDamagePipelineContext {
  buildings: Building[];
  enemies: Enemy[];
  enemyGroup: THREE.Group;
  elapsed: number;
  allocateEnemyUid(): number;
  spawnMoneyDropAt(position: THREE.Vector3, amount: number, autoCollect: boolean): void;
  addExplosion(center: THREE.Vector3, radius: number, color: number): void;
  showToast(message: string, critical?: boolean): void;
  visuals: EnemyDefenseVisuals;
  onEnemyKilled?(enemy: Enemy): void;
}

export function applyDefenseEnemyDamage(ctx: DefenseEnemyDamagePipelineContext, enemy: Enemy, damage: number): void {
  if (enemy.hp <= 0) {
    return;
  }

  enemy.hp -= damage;
  const ratio = Math.max(enemy.hp / enemy.maxHp, 0);
  ctx.visuals.applyHealthBarScale(enemy);
  const healthMaterial = enemy.healthBar.material as THREE.MeshBasicMaterial;
  healthMaterial.color.set(ratio > 0.55 ? 0x34ff6a : ratio > 0.25 ? 0xffd84a : 0xff3d5e);

  if (enemy.hp > 0) {
    return;
  }

  ctx.onEnemyKilled?.(enemy);

  if (enemy.blockedBy) {
    enemy.blockedBy.blockingEnemies = enemy.blockedBy.blockingEnemies.filter((e) => e !== enemy);
    enemy.blockedBy = null;
  }

  if (enemy.type === "hacker") {
    ctx.addExplosion(enemy.mesh.position, 4 * TILE_SIZE, 0x9d5cff);
    for (const b of ctx.buildings) {
      if (b.spec.role === "ranged" || b.spec.role === "mage" || b.spec.role === "support") {
        if (distanceXZ(b.mesh.position, enemy.mesh.position) <= 4 * TILE_SIZE) {
          applyDefenseEffectToBuilding(
            b,
            { statusId: "electromagneticInterference", duration: 3, magnitude: 3, element: "electric" },
            ctx.elapsed,
          );
          ctx.showToast(`[\u9ed1\u5ba2] \u5df2\u7628\u75ea ${b.spec.name}`);
        }
      }
    }
  }

  if (enemy.type === "swarm") {
    for (let i = 0; i < 3; i++) {
      const archetype = getDefenseEnemyArchetypeSpec("basic");
      const healthBar = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.12, 0.1),
        new THREE.MeshBasicMaterial({ color: 0x34ff6a, depthTest: false, depthWrite: false }),
      );
      healthBar.renderOrder = 30;
      healthBar.userData.isEnemyHealthBar = true;
      const healthBarBack = new THREE.Mesh(
        new THREE.BoxGeometry(1.02, 0.18, 0.11),
        new THREE.MeshBasicMaterial({ color: 0x10131a, depthTest: false, depthWrite: false }),
      );
      healthBarBack.renderOrder = 29;
      healthBarBack.userData.isEnemyHealthBar = true;
      const healthBarGroup = new THREE.Group();
      healthBarGroup.userData.isEnemyHealthBar = true;
      healthBarGroup.userData.isEnemyHealthBarRoot = true;
      healthBarGroup.add(healthBarBack, healthBar);
      const spawnEnemy: Enemy = {
        uid: ctx.allocateEnemyUid(),
        type: "basic",
        bodyRadius: 0.3,
        mesh: new THREE.Group(),
        healthBar,
        hp: 60,
        maxHp: 60,
        element: archetype.element,
        resistances: archetype.resistances,
        speed: 2.2,
        reward: 5,
        segment: enemy.segment,
        slowUntil: 0,
        slowFactor: 1,
        blockedBy: null,
        stunUntil: 0,
      };
      const bMat = new THREE.MeshStandardMaterial({
        color: 0x24a317,
        roughness: 0.45,
        emissive: 0x24a317,
        emissiveIntensity: 0.18,
      });
      const bMesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), bMat);
      bMesh.position.y = 0.3;
      bMesh.castShadow = true;
      healthBar.position.set(0, 0, 0.02);
      healthBarBack.position.set(0, 0, 0);
      healthBarGroup.position.set(0, 0.82, 0);
      spawnEnemy.mesh.add(bMesh, healthBarGroup);
      ctx.visuals.syncHealthBarVertical(spawnEnemy);

      const offset = new THREE.Vector3((Math.random() - 0.5) * TILE_SIZE, 0, (Math.random() - 0.5) * TILE_SIZE);
      spawnEnemy.mesh.position.copy(enemy.mesh.position).add(offset);
      ctx.enemies.push(spawnEnemy);
      ctx.enemyGroup.add(spawnEnemy.mesh);
      void ctx.visuals.replaceBodyWithDefaultGltf(spawnEnemy);
    }
  }

  ctx.spawnMoneyDropAt(enemy.mesh.position.clone(), enemy.reward, true);
  ctx.enemyGroup.remove(enemy.mesh);
  const idx = ctx.enemies.indexOf(enemy);
  if (idx !== -1) {
    ctx.enemies.splice(idx, 1);
  }
}
