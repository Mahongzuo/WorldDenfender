import * as THREE from "three";

import type { ExploreInventory } from "./explore-inventory";
import type { ExplorePlayerProgress } from "./explore-player-progress";
import { cellKey, distanceXZ, worldToCell } from "../core/runtime-grid";
import type {
  ExploreEnemy,
  ExploreGameplaySettings,
  ExploreProjectile,
  GridCell,
  InventoryItem,
} from "../core/types";
import { resolveExploreGameplay } from "./explore-gameplay-settings";

export interface ExploreCombatHost {
  getPlayerPosition(): THREE.Vector3;
  /** XZ planar forward for basic attack when no homing target (camera-relative facing). */
  getExploreAttackForward(): THREE.Vector3;
  worldCellToWorld(cell: GridCell): THREE.Vector3;
  getObstacleCellKeys(): ReadonlySet<string>;
  getSafeZoneCellKeys(): ReadonlySet<string>;
  getMapGridSize(): { cols: number; rows: number };
  isInsideGrid(cell: GridCell): boolean;
  allocateUid(): number;
  showToast(text: string, important?: boolean): void;
  damageExplorePlayer(amount: number): void;
}

export class ExploreCombatRuntime {
  private readonly enemyGroup: THREE.Group;
  private readonly projectileGroup: THREE.Group;
  private readonly inventory: ExploreInventory;
  private readonly progress: ExplorePlayerProgress;
  private readonly host: ExploreCombatHost;

  private readonly enemies: ExploreEnemy[] = [];
  private readonly projectiles: ExploreProjectile[] = [];

  private attackCooldown = 0;
  private skillECooldown = 0;
  private skillRCooldown = 0;
  private enemySpawnTimer = 0;
  /** 由关卡 explorationLayout.gameplay / MapDefinition.exploreGameplay 同步 */
  private gameplay = resolveExploreGameplay(undefined);

  constructor(options: {
    enemyGroup: THREE.Group;
    projectileGroup: THREE.Group;
    inventory: ExploreInventory;
    progress: ExplorePlayerProgress;
    host: ExploreCombatHost;
  }) {
    this.enemyGroup = options.enemyGroup;
    this.projectileGroup = options.projectileGroup;
    this.inventory = options.inventory;
    this.progress = options.progress;
    this.host = options.host;
  }

  /** 载入或切换地图时由宿主调用 */
  syncGameplay(settings?: ExploreGameplaySettings | undefined): void {
    this.gameplay = resolveExploreGameplay(settings ?? undefined);
  }

  getAttackCooldown(): number {
    return this.attackCooldown;
  }

  getAttackMaxCooldown(): number {
    return this.gameplay.attackCooldownSec;
  }

  getSkillECooldown(): number {
    return this.skillECooldown;
  }

  getSkillEMaxCooldown(): number {
    return this.gameplay.skillECooldownSec;
  }

  getSkillRCooldown(): number {
    return this.skillRCooldown;
  }

  getSkillRMaxCooldown(): number {
    return this.gameplay.skillRCooldownSec;
  }

  /** Begin exploration reset: clear units, timers; full HP restore is handled by host if needed. */
  resetEncounter(): void {
    for (const enemy of this.enemies) {
      this.enemyGroup.remove(enemy.mesh);
    }
    this.enemies.length = 0;
    for (const proj of this.projectiles) {
      this.projectileGroup.remove(proj.mesh);
    }
    this.projectiles.length = 0;
    this.enemySpawnTimer = this.gameplay.exploreEnemySpawnIntervalSec;
    this.attackCooldown = 0;
    this.skillECooldown = 0;
    this.skillRCooldown = 0;
  }

  /** When leaving explore mode mid-fight — drop short-lived VFX meshes. */
  clearEphemeralProjectiles(): void {
    for (const proj of this.projectiles) {
      this.projectileGroup.remove(proj.mesh);
    }
    this.projectiles.length = 0;
  }

  resetAfterRunFailure(): void {
    this.attackCooldown = 0;
    this.skillECooldown = 0;
    this.skillRCooldown = 0;
  }

  tick(dt: number): void {
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.skillECooldown = Math.max(0, this.skillECooldown - dt);
    this.skillRCooldown = Math.max(0, this.skillRCooldown - dt);

    this.updateProjectiles(dt);
    this.updateEnemies(dt);

    this.enemySpawnTimer -= dt;
    if (this.enemySpawnTimer <= 0) {
      this.spawnEnemy();
      this.enemySpawnTimer = this.gameplay.exploreEnemySpawnIntervalSec;
    }
  }

  fireBasicAttack(): void {
    if (this.attackCooldown > 0) {
      return;
    }
    this.attackCooldown = this.gameplay.attackCooldownSec;

    const playerPos = this.host.getPlayerPosition();
    const HOMING_RANGE = 10;
    let nearestEnemy: ExploreEnemy | null = null;
    let nearestDist = HOMING_RANGE;
    for (const enemy of this.enemies) {
      if (enemy.dead) {
        continue;
      }
      const d = distanceXZ(playerPos, enemy.mesh.position);
      if (d < nearestDist) {
        nearestDist = d;
        nearestEnemy = enemy;
      }
    }

    let velocity: THREE.Vector3;
    if (nearestEnemy) {
      const toEnemy = nearestEnemy.mesh.position.clone().sub(playerPos).setY(0).normalize();
      velocity = toEnemy.multiplyScalar(18);
    } else {
      const forward = this.host.getExploreAttackForward().clone();
      velocity = forward.multiplyScalar(18);
    }

    const geo = new THREE.SphereGeometry(0.15, 8, 6);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffec6e, emissive: 0xffaa00, emissiveIntensity: 1.2 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(playerPos);
    mesh.position.y = 0.75;

    this.projectileGroup.add(mesh);
    this.projectiles.push({
      mesh,
      velocity,
      damage: 25 + this.progress.level * 3,
      lifetime: 2.2,
      type: "basic",
      target: nearestEnemy,
    });
  }

  castOrbSkill(): void {
    if (this.skillECooldown > 0) {
      this.host.showToast(`E \u6280\u80fd CD: ${Math.ceil(this.skillECooldown)}s`);
      return;
    }
    const playerPos = this.host.getPlayerPosition();
    let nearestEnemy: ExploreEnemy | null = null;
    let nearestDist = Infinity;
    for (const enemy of this.enemies) {
      if (enemy.dead) {
        continue;
      }
      const dist = playerPos.distanceTo(enemy.mesh.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestEnemy = enemy;
      }
    }
    if (!nearestEnemy) {
      this.host.showToast("\u9644\u8fd1\u6ca1\u6709\u654c\u4eba\u53ef\u9501\u5b9a\uff01");
      return;
    }
    this.skillECooldown = this.gameplay.skillECooldownSec;

    const targetPos = nearestEnemy.mesh.position.clone();
    const damage = 120 + this.progress.level * 15;
    nearestEnemy.hp -= damage;
    if (nearestEnemy.hp <= 0) {
      this.killEnemy(nearestEnemy);
    }

    const push = (mesh: THREE.Mesh, velocity: THREE.Vector3, lifetime: number, type: "lightning" | "spark" | "blast") => {
      this.projectileGroup.add(mesh);
      this.projectiles.push({ mesh, velocity, damage: 0, lifetime, type, target: null });
    };

    const boltHeight = 22;
    const boltGeo = new THREE.CylinderGeometry(0.06, 0.22, boltHeight, 6);
    const boltMat = new THREE.MeshBasicMaterial({ color: 0xddeeff, transparent: true, opacity: 0.95 });
    const bolt = new THREE.Mesh(boltGeo, boltMat);
    bolt.position.set(targetPos.x, targetPos.y + boltHeight / 2, targetPos.z);
    push(bolt, new THREE.Vector3(), 0.25, "lightning");

    const coreGeo = new THREE.CylinderGeometry(0.02, 0.07, boltHeight, 4);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.copy(bolt.position);
    push(core, new THREE.Vector3(), 0.18, "lightning");

    const flashGeo = new THREE.SphereGeometry(0.55, 12, 8);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0x99eeff, transparent: true, opacity: 0.9 });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.set(targetPos.x, targetPos.y + 0.5, targetPos.z);
    push(flash, new THREE.Vector3(), 0.55, "blast");

    const ringGeo = new THREE.RingGeometry(0.1, 3.2, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x55ddff, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(targetPos.x, targetPos.y + 0.13, targetPos.z);
    push(ring, new THREE.Vector3(), 0.55, "blast");

    const outerGeo = new THREE.RingGeometry(0.1, 5.5, 32);
    const outerMat = new THREE.MeshBasicMaterial({ color: 0x2299ee, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
    const outer = new THREE.Mesh(outerGeo, outerMat);
    outer.rotation.x = -Math.PI / 2;
    outer.position.set(targetPos.x, targetPos.y + 0.1, targetPos.z);
    push(outer, new THREE.Vector3(), 0.35, "blast");

    const sparkGeo = new THREE.SphereGeometry(0.09, 6, 4);
    const sparkColors = [0xffffff, 0x88ddff, 0x44aaff, 0xaaddff];
    const sparkCount = 14;
    for (let i = 0; i < sparkCount; i++) {
      const angle = (i / sparkCount) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 3.5 + Math.random() * 5;
      const sparkMat = new THREE.MeshBasicMaterial({
        color: sparkColors[i % sparkColors.length],
        transparent: true,
        opacity: 1.0,
      });
      const spark = new THREE.Mesh(sparkGeo, sparkMat);
      spark.position.set(targetPos.x, targetPos.y + 0.4, targetPos.z);
      push(
        spark,
        new THREE.Vector3(Math.cos(angle) * speed, 2.5 + Math.random() * 4, Math.sin(angle) * speed),
        0.55 + Math.random() * 0.35,
        "spark",
      );
    }

    this.host.showToast("\u5929\u964d\u95ea\u7535\uff01");
    this.pruneDeadEnemies();
  }

  castRSkill(): void {
    if (this.skillRCooldown > 0) {
      this.host.showToast(`R \u6280\u80fd CD: ${Math.ceil(this.skillRCooldown)}s`);
      return;
    }
    this.skillRCooldown = this.gameplay.skillRCooldownSec;

    const playerPos = this.host.getPlayerPosition();
    const blastRadius = 5;
    let hitCount = 0;
    for (const enemy of this.enemies) {
      if (enemy.dead) {
        continue;
      }
      if (playerPos.distanceTo(enemy.mesh.position) <= blastRadius) {
        enemy.hp -= 180 + this.progress.level * 20;
        hitCount++;
        if (enemy.hp <= 0) {
          this.killEnemy(enemy);
        }
      }
    }

    const ringGeo = new THREE.RingGeometry(0.2, blastRadius, 36);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff6b9d,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(playerPos);
    ring.position.y = 0.12;
    ring.rotation.x = -Math.PI / 2;
    this.projectileGroup.add(ring);
    this.projectiles.push({
      mesh: ring,
      velocity: new THREE.Vector3(),
      damage: 0,
      lifetime: 0.55,
      type: "blast",
      target: null,
    });

    this.host.showToast(`\u51b2\u51fb\u7206\u53d1\uff01\u547d\u4e2d ${hitCount} \u4e2a\u654c\u4eba`);
    this.pruneDeadEnemies();
  }

  private spawnEnemy(): void {
    if (this.enemies.length >= this.gameplay.enemyMaxConcurrent) {
      return;
    }
    const { cols, rows } = this.host.getMapGridSize();
    const obstacleKeys = this.host.getObstacleCellKeys();
    const playerPos = this.host.getPlayerPosition();
    let attempts = 0;
    let spawnPos: THREE.Vector3 | null = null;
    while (attempts < 25 && !spawnPos) {
      const col = Math.floor(Math.random() * cols);
      const row = Math.floor(Math.random() * rows);
      const pos = this.host.worldCellToWorld({ col, row });
      if (!obstacleKeys.has(cellKey({ col, row })) && pos.distanceTo(playerPos) >= 6) {
        spawnPos = pos;
      }
      attempts++;
    }
    if (!spawnPos) {
      return;
    }

    const group = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(0.75, 1.5, 0.75);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe55c5c });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.75;
    group.add(body);

    const hpBarBgGeo = new THREE.PlaneGeometry(1, 0.1);
    const hpBarBgMat = new THREE.MeshBasicMaterial({ color: 0x333333, depthTest: false });
    const hpBarBg = new THREE.Mesh(hpBarBgGeo, hpBarBgMat);
    hpBarBg.position.y = 1.9;
    hpBarBg.rotation.x = -Math.PI / 8;
    group.add(hpBarBg);

    const hpBarGeo = new THREE.PlaneGeometry(1, 0.1);
    const hpBarMat = new THREE.MeshBasicMaterial({ color: 0x44cc44, depthTest: false });
    const hpBar = new THREE.Mesh(hpBarGeo, hpBarMat);
    hpBar.position.y = 1.9;
    hpBar.position.z = 0.005;
    hpBar.rotation.x = -Math.PI / 8;
    group.add(hpBar);

    group.position.copy(spawnPos);
    this.enemyGroup.add(group);

    const maxHp =
      this.gameplay.enemyBaseHp +
      this.progress.level * this.gameplay.enemyHpPerLevel;
    this.enemies.push({
      id: `ee-${this.host.allocateUid()}`,
      mesh: group,
      hpBar,
      hp: maxHp,
      maxHp,
      speed:
        this.gameplay.enemyBaseSpeed +
        this.progress.level * this.gameplay.enemySpeedPerLevel,
      attackDamage:
        this.gameplay.enemyBaseDamage +
        this.progress.level * this.gameplay.enemyDamagePerLevel,
      aggroRange: this.gameplay.enemyAggroRange,
      attackCooldown: this.gameplay.enemyAttackCooldown,
      attackTimer: 0,
      dead: false,
    });
  }

  private killEnemy(enemy: ExploreEnemy): void {
    enemy.dead = true;
    this.enemyGroup.remove(enemy.mesh);

    const itemPool = [
      { name: "\u91d1\u5c5e\u788e\u7247", icon: "\ud83d\udd29" },
      { name: "\u80fd\u91cf\u6676\u4f53", icon: "\ud83d\udc8e" },
      { name: "\u6570\u636e\u82af\u7247", icon: "\ud83d\udcbe" },
      { name: "\u5408\u91d1\u9f7f\u8f6e", icon: "\u2699\ufe0f" },
      { name: "AI\u6838\u5fc3", icon: "\ud83e\udd16" },
    ];
    const pick = itemPool[Math.floor(Math.random() * itemPool.length)];
    const loot: InventoryItem = {
      id: `item-${this.host.allocateUid()}`,
      name: pick.name,
      quantity: 1 + Math.floor(Math.random() * 3),
      type: "material",
      icon: pick.icon,
      collectedAt: Date.now(),
    };
    this.inventory.mergeAdd(loot);

    const toasts = this.progress.addXpFromKillContribution(this.progress.level);
    for (const t of toasts) {
      this.host.showToast(t, true);
    }
  }

  private updateEnemies(dt: number): void {
    const playerPos = this.host.getPlayerPosition();
    const playerCell = worldToCell(playerPos);
    const safeKeys = this.host.getSafeZoneCellKeys();
    const playerInSafeZone = safeKeys.has(cellKey(playerCell));
    const obstacleKeys = this.host.getObstacleCellKeys();

    for (const enemy of this.enemies) {
      if (enemy.dead) {
        continue;
      }
      const dist = playerPos.distanceTo(enemy.mesh.position);

      if (!playerInSafeZone && dist < enemy.aggroRange) {
        const dir = playerPos.clone().sub(enemy.mesh.position).setY(0);
        if (dir.lengthSq() > 0.001) {
          dir.normalize();
          const newPos = enemy.mesh.position.clone().addScaledVector(dir, enemy.speed * dt);
          const cell = worldToCell(newPos);
          if (!obstacleKeys.has(cellKey(cell)) && this.host.isInsideGrid(cell)) {
            enemy.mesh.position.copy(newPos);
            enemy.mesh.lookAt(playerPos.x, enemy.mesh.position.y, playerPos.z);
          }
        }
        const sep = playerPos.distanceTo(enemy.mesh.position);
        if (sep < 1.1) {
          const away = enemy.mesh.position.clone().sub(playerPos).setY(0);
          if (away.lengthSq() < 0.0001) {
            const a = Math.random() * Math.PI * 2;
            away.set(Math.cos(a), 0, Math.sin(a));
          }
          away.normalize();
          enemy.mesh.position.x = playerPos.x + away.x * 1.1;
          enemy.mesh.position.z = playerPos.z + away.z * 1.1;
        }

        if (dist < 1.4) {
          enemy.attackTimer -= dt;
          if (enemy.attackTimer <= 0) {
            enemy.attackTimer = enemy.attackCooldown;
            this.host.damageExplorePlayer(enemy.attackDamage);
          }
        }
      } else {
        enemy.attackTimer = Math.max(0, enemy.attackTimer - dt);
      }

      const ratio = Math.max(0, enemy.hp / enemy.maxHp);
      enemy.hpBar.scale.x = ratio;
      enemy.hpBar.position.x = (ratio - 1) * 0.5;
      (enemy.hpBar.material as THREE.MeshBasicMaterial).color.setHex(
        ratio > 0.5 ? 0x44cc44 : ratio > 0.25 ? 0xffaa00 : 0xee3333,
      );
    }
    this.pruneDeadEnemies();
  }

  private updateProjectiles(dt: number): void {
    for (const proj of this.projectiles) {
      proj.lifetime -= dt;

      if (proj.type === "orb" && proj.target && !proj.target.dead) {
        const tPos = proj.target.mesh.position;
        const dx = tPos.x - proj.mesh.position.x;
        const dz = tPos.z - proj.mesh.position.z;
        const hLen = Math.sqrt(dx * dx + dz * dz);
        if (hLen > 0.1) {
          proj.velocity.x += (dx / hLen) * 12 * dt;
          proj.velocity.z += (dz / hLen) * 12 * dt;
        }
      }

      if (proj.type === "blast") {
        const progress = 1 - proj.lifetime / 0.55;
        proj.mesh.scale.set(0.5 + progress * 1.5, 1, 0.5 + progress * 1.5);
        (proj.mesh.material as THREE.MeshBasicMaterial).opacity = 0.65 * (1 - progress);
      } else if (proj.type === "lightning") {
        const mat = proj.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, mat.opacity - (1.0 / 0.25) * dt);
      } else if (proj.type === "spark") {
        proj.velocity.y -= 10 * dt;
        proj.mesh.position.addScaledVector(proj.velocity, dt);
        (proj.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, proj.lifetime / 0.9);
      } else {
        proj.mesh.position.addScaledVector(proj.velocity, dt);
      }

      if (proj.damage > 0 && proj.type !== "blast" && proj.type !== "lightning" && proj.type !== "spark") {
        for (const enemy of this.enemies) {
          if (enemy.dead) {
            continue;
          }
          const hitRadius = proj.type === "orb" ? 1.6 : 0.9;
          if (distanceXZ(proj.mesh.position, enemy.mesh.position) < hitRadius) {
            enemy.hp -= proj.damage;
            if (enemy.hp <= 0) {
              this.killEnemy(enemy);
            }
            proj.lifetime = 0;
            break;
          }
        }
      }
    }

    for (const proj of this.projectiles) {
      if (proj.lifetime <= 0) {
        this.projectileGroup.remove(proj.mesh);
      }
    }
    const next = this.projectiles.filter((p) => p.lifetime > 0);
    this.projectiles.length = 0;
    this.projectiles.push(...next);
    this.pruneDeadEnemies();
  }

  private pruneDeadEnemies(): void {
    const alive = this.enemies.filter((e) => !e.dead);
    this.enemies.length = 0;
    this.enemies.push(...alive);
  }
}
