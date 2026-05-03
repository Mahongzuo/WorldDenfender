import * as THREE from "three";

import { TILE_SIZE, cellToWorld, distanceXZ } from "../core/runtime-grid";
import type { Building, Enemy } from "../core/types";

export interface DefenseActiveSkillHost {
  getSelectedBuilding(): Building | null;
  getElapsed(): number;
  /** 宿主当前敌军列表（可原地修改敌军状态）；技能内会按需复制迭代 */
  getEnemies(): Enemy[];
  /** 当前场上建筑列表 */
  getBuildings(): Building[];
  addExplosion(center: THREE.Vector3, radius: number, color: number): void;
  addBeam(from: THREE.Vector3, to: THREE.Vector3, color: number): void;
  damageEnemy(enemy: Enemy, damage: number): void;
  showToast(message: string, critical?: boolean): void;
  refreshUi(): void;
}

/** 对已选中建筑释放主动技能（冷却、校验与宿主 UI 写在调用方语义内） */
export function tryCastDefenseActiveSkill(host: DefenseActiveSkillHost): void {
  const selected = host.getSelectedBuilding();
  if (!selected || !selected.spec.activeSkill) {
    return;
  }

  if (selected.skillCooldownTimer > 0) {
    host.showToast(
      `${selected.spec.activeSkill.name} \u51b7\u5374\u4e2d\uff1a${Math.ceil(selected.skillCooldownTimer)}s`,
    );
    return;
  }

  const b = selected;
  const elapsed = host.getElapsed();
  const enemies = host.getEnemies();
  const buildings = host.getBuildings();
  const origin = cellToWorld(b.cell);

  if (b.spec.id === "stellar") {
    host.addExplosion(origin, 7 * TILE_SIZE, 0xff4fd8);
    let hits = 0;
    for (const enemy of [...enemies]) {
      hits += 1;
      host.addBeam(origin, enemy.mesh.position.clone(), 0xff4fd8);
      enemy.slowUntil = elapsed + 4.5;
      enemy.slowFactor = 0.22;
      host.damageEnemy(enemy, 420);
    }
    host.showToast(`\u5929\u6cb3\u5ba1\u5224\u9501\u5b9a\u5168\u573a\uff0c\u547d\u4e2d ${hits} \u4e2a\u654c\u4eba`);
  } else if (b.spec.id === "qinqiong") {
    b.hp = b.spec.maxHp ?? b.hp;
    b.damageReductionUntil = elapsed + 8;
    b.damageReductionFactor = 0.18;
    b.bonusBlockUntil = elapsed + 8;
    host.addExplosion(origin, 3 * TILE_SIZE, 0xd4af37);
    let hits = 0;
    for (const enemy of [...enemies]) {
      if (distanceXZ(origin, enemy.mesh.position) <= 3 * TILE_SIZE) {
        hits += 1;
        enemy.stunUntil = elapsed + 2.5;
        host.damageEnemy(enemy, 220);
      }
    }
    host.showToast(`\u4e0d\u52a8\u5982\u5c71\uff1a\u79e6\u743c\u6ee1\u8840\u51cf\u4f24\uff0c\u9707\u6151 ${hits} \u4e2a\u654c\u4eba`);
  } else if (b.spec.id === "liqingzhao") {
    host.addExplosion(origin, 9 * TILE_SIZE, 0x98ff98);
    let hits = 0;
    for (const enemy of [...enemies]) {
      if (distanceXZ(origin, enemy.mesh.position) <= 9 * TILE_SIZE) {
        hits += 1;
        host.damageEnemy(enemy, 340);
        enemy.slowUntil = elapsed + 5.0;
        enemy.slowFactor = 0.16;
      }
    }
    host.showToast(`\u6f31\u7389\u5929\u6f6e\u547d\u4e2d ${hits} \u4e2a\u654c\u4eba\uff0c\u51b0\u5c01\u884c\u519b\u901f\u5ea6`);
  } else if (b.spec.id === "bianque") {
    host.addExplosion(origin, 7 * TILE_SIZE, 0x4caf50);
    for (const target of buildings) {
      target.hp = target.spec.maxHp ?? target.hp;
      target.damageReductionUntil = elapsed + 6;
      target.damageReductionFactor = 0.45;
    }
    let hits = 0;
    for (const enemy of [...enemies]) {
      if (distanceXZ(origin, enemy.mesh.position) <= 7 * TILE_SIZE) {
        hits += 1;
        host.damageEnemy(enemy, 180);
      }
    }
    host.showToast(`\u9752\u56ca\u6d4e\u4e16\uff1a\u5168\u4f53\u53cb\u519b\u56de\u6ee1\u5e76\u51cf\u4f24\uff0c\u836f\u6bd2\u53cd\u566c ${hits} \u4e2a\u654c\u4eba`);
  }

  b.skillCooldownTimer = b.spec.activeSkill!.cooldown;
  host.refreshUi();
}
