import * as THREE from "three";

import type { ExploreInventory } from "./explore-inventory";
import type { ExplorePlayerProgress } from "./explore-player-progress";
import { cellKey, distanceXZ, worldToCell } from "../core/runtime-grid";
import type {
  ExploreBossPlacement,
  ExploreElement,
  ExploreEnemy,
  ExploreGameplaySettings,
  ExploreProjectile,
  ExploreRewardSpec,
  ExploreSpawnerPlacement,
  GridCell,
  InventoryItem,
} from "../core/types";
import { computeElementMultiplier } from "../defense/defense-taxonomy";
import {
  DEFAULT_EXPLORE_BOSSES,
  EXPLORE_ELEMENT_COLORS,
  EXPLORE_ELEMENT_LABELS,
  EXPLORE_PLAYER_ELEMENTS,
  getDefaultExploreBoss,
} from "./explore-rpg-content";
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
  grantExploreMoney(amount: number): void;
  onExploreBasicAttackFired?(): void;
  onExploreEnemyKilled?(): void;
  /** 异步加载关卡里配置的 GLB；失败返回 null（会保留程序化占位体）。 */
  loadExploreGltfScene?(url: string): Promise<THREE.Object3D | null>;
}

interface RuntimeSpawnerState {
  placement: ExploreSpawnerPlacement;
  timer: number;
  spawnedTotal: number;
}

export class ExploreCombatRuntime {
  private readonly enemyGroup: THREE.Group;
  private readonly projectileGroup: THREE.Group;
  private readonly inventory: ExploreInventory;
  private readonly progress: ExplorePlayerProgress;
  private readonly host: ExploreCombatHost;

  private readonly enemies: ExploreEnemy[] = [];
  private readonly projectiles: ExploreProjectile[] = [];
  private bossPlacements: ExploreBossPlacement[] = [];
  private spawnerStates: RuntimeSpawnerState[] = [];
  private defeatedBossIds = new Set<string>();
  private playerElement: ExploreElement = "electric";

  private attackCooldown = 0;
  private skillECooldown = 0;
  private skillRCooldown = 0;
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

  syncMapContent(options: {
    bosses?: ExploreBossPlacement[];
    spawners?: ExploreSpawnerPlacement[];
  }): void {
    this.bossPlacements = [...(options.bosses ?? [])];
    this.defeatedBossIds.clear();
    this.spawnerStates = (options.spawners ?? []).map((placement) => ({
      placement,
      timer: Math.max(0.2, placement.spawnIntervalSec * 0.35),
      spawnedTotal: 0,
    }));
  }

  getPlayerElement(): ExploreElement {
    return this.playerElement;
  }

  getPlayerElementLabel(): string {
    return EXPLORE_ELEMENT_LABELS[this.playerElement];
  }

  setPlayerElement(element: ExploreElement): void {
    this.playerElement = element;
    this.host.showToast(`玩家属性切换：${EXPLORE_ELEMENT_LABELS[element]} · ${this.playerKit().label}`);
  }

  cyclePlayerElement(step: number): void {
    const current = EXPLORE_PLAYER_ELEMENTS.indexOf(this.playerElement);
    const next = (current + step + EXPLORE_PLAYER_ELEMENTS.length) % EXPLORE_PLAYER_ELEMENTS.length;
    this.setPlayerElement(EXPLORE_PLAYER_ELEMENTS[next]);
  }

  private playerKit(): {
    label: string;
    attackCooldownMult: number;
    basicDamageMult: number;
    orbDamageMult: number;
    burstDamageMult: number;
    burstRadiusMult: number;
  } {
    switch (this.playerElement) {
      case "force":
        return { label: "近战破甲", attackCooldownMult: 1.08, basicDamageMult: 1.18, orbDamageMult: 0.9, burstDamageMult: 1.25, burstRadiusMult: 0.9 };
      case "thermal":
        return { label: "范围灼烧", attackCooldownMult: 1, basicDamageMult: 1, orbDamageMult: 1.08, burstDamageMult: 1.15, burstRadiusMult: 1.18 };
      case "light":
        return { label: "远程爆发", attackCooldownMult: 1.05, basicDamageMult: 1.08, orbDamageMult: 1.24, burstDamageMult: 0.95, burstRadiusMult: 1 };
      case "electric":
        return { label: "高频机动", attackCooldownMult: 0.78, basicDamageMult: 0.88, orbDamageMult: 1, burstDamageMult: 1, burstRadiusMult: 0.95 };
      case "sound":
        return { label: "控场易伤", attackCooldownMult: 0.95, basicDamageMult: 0.95, orbDamageMult: 1.05, burstDamageMult: 1.05, burstRadiusMult: 1.28 };
      default:
        return { label: "均衡", attackCooldownMult: 1, basicDamageMult: 1, orbDamageMult: 1, burstDamageMult: 1, burstRadiusMult: 1 };
    }
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
    for (const spawner of this.spawnerStates) {
      spawner.timer = Math.max(0.2, spawner.placement.spawnIntervalSec * 0.35);
      spawner.spawnedTotal = 0;
    }
    this.spawnPlacedBosses();
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
    this.tickSpawners(dt);
  }

  fireBasicAttack(): void {
    if (this.attackCooldown > 0) {
      return;
    }
    const kit = this.playerKit();
    this.attackCooldown = this.gameplay.attackCooldownSec * kit.attackCooldownMult;

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

    const color = EXPLORE_ELEMENT_COLORS[this.playerElement];
    const geo = new THREE.SphereGeometry(0.15, 8, 6);
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(playerPos);
    mesh.position.y = 0.75;

    this.projectileGroup.add(mesh);
    this.projectiles.push({
      mesh,
      velocity,
      damage: (25 + this.progress.level * 3) * kit.basicDamageMult,
      lifetime: 2.2,
      type: "basic",
      target: nearestEnemy,
      element: this.playerElement,
    });
    this.host.onExploreBasicAttackFired?.();
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
    const damage = this.resolveDamageAgainstEnemy(nearestEnemy, (120 + this.progress.level * 15) * this.playerKit().orbDamageMult, this.playerElement);
    this.damageEnemy(nearestEnemy, damage);

    const push = (mesh: THREE.Mesh, velocity: THREE.Vector3, lifetime: number, type: "lightning" | "spark" | "blast") => {
      this.projectileGroup.add(mesh);
      this.projectiles.push({ mesh, velocity, damage: 0, lifetime, type, target: null, element: this.playerElement });
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
    const kit = this.playerKit();
    const blastRadius = 5 * kit.burstRadiusMult;
    let hitCount = 0;
    for (const enemy of this.enemies) {
      if (enemy.dead) {
        continue;
      }
      if (playerPos.distanceTo(enemy.mesh.position) <= blastRadius) {
        this.damageEnemy(enemy, this.resolveDamageAgainstEnemy(enemy, (180 + this.progress.level * 20) * kit.burstDamageMult, this.playerElement));
        hitCount++;
      }
    }

    const ringGeo = new THREE.RingGeometry(0.2, blastRadius, 36);
    const ringMat = new THREE.MeshBasicMaterial({
      color: EXPLORE_ELEMENT_COLORS[this.playerElement],
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
      element: this.playerElement,
    });

    this.host.showToast(`\u51b2\u51fb\u7206\u53d1\uff01\u547d\u4e2d ${hitCount} \u4e2a\u654c\u4eba`);
    this.pruneDeadEnemies();
  }

  private spawnPlacedBosses(): void {
    for (const placement of this.bossPlacements) {
      if (!placement.respawn && this.defeatedBossIds.has(placement.id)) {
        continue;
      }
      const bossDef = getDefaultExploreBoss(placement.bossId);
      const element = placement.element ?? bossDef.element;
      const level = Math.max(1, placement.level ?? 1);
      const maxHp = placement.overrideStats?.maxHp && placement.overrideStats.maxHp > 0
        ? placement.overrideStats.maxHp
        : bossDef.maxHp + (level - 1) * 140;
      const attack = placement.overrideStats?.attack && placement.overrideStats.attack > 0
        ? placement.overrideStats.attack
        : bossDef.attack + (level - 1) * 4;
      const speed = placement.overrideStats?.speed && placement.overrideStats.speed > 0
        ? placement.overrideStats.speed
        : bossDef.speed ?? 1.5;
      const rewardMoney = placement.overrideStats?.rewardMoney && placement.overrideStats.rewardMoney > 0
        ? placement.overrideStats.rewardMoney
        : bossDef.rewards?.[0]?.money ?? 200;
      const rewardXp = placement.overrideStats?.rewardXp && placement.overrideStats.rewardXp > 0
        ? placement.overrideStats.rewardXp
        : bossDef.rewards?.[0]?.xp ?? 80;

      const outerScale = placement.modelScale ?? bossDef.modelScale ?? 1.8;
      const visual = this.createEnemyVisual(element, true, outerScale);
      visual.group.position.copy(this.host.worldCellToWorld(placement));
      this.enemyGroup.add(visual.group);
      void this.trySwapProceduralForGltf(
        visual.group,
        visual.proceduralRoot,
        placement.modelPath?.trim() || bossDef.modelPath?.trim(),
        true,
      );
      this.enemies.push({
        id: `boss-${placement.id}`,
        name: placement.name || bossDef.name,
        mesh: visual.group,
        hpBar: visual.hpBar,
        hp: maxHp,
        maxHp,
        element,
        resistances: bossDef.resistances,
        boss: true,
        placementId: placement.id,
        rewardMoney,
        rewardXp,
        rewardItems: bossDef.rewards,
        speed,
        attackDamage: attack,
        aggroRange: placement.triggerRadius ?? bossDef.aggroRange ?? 11,
        attackCooldown: bossDef.attackCooldown ?? 1.5,
        attackTimer: 0,
        skillTimer: bossDef.skills[0]?.cooldownSec ?? 6,
        visualRadius: 1.55,
        dead: false,
      });
      if (bossDef.dialogueHint) {
        this.host.showToast(`${bossDef.name}：${bossDef.dialogueHint}`, true);
      }
    }
  }

  private createEnemyVisual(
    element: ExploreElement,
    boss: boolean,
    scale: number,
  ): { group: THREE.Group; hpBar: THREE.Mesh; proceduralRoot: THREE.Group } {
    const color = EXPLORE_ELEMENT_COLORS[element];
    const group = new THREE.Group();
    const proceduralRoot = new THREE.Group();
    proceduralRoot.name = "explore-procedural-body";
    const bodyGeo = boss ? new THREE.IcosahedronGeometry(0.85, 1) : new THREE.BoxGeometry(0.72, 1.35, 0.72);
    const bodyMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: boss ? 0.32 : 0.12 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = boss ? 1.0 : 0.68;
    proceduralRoot.add(body);
    if (boss) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.92, 0.035, 8, 28),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 1.0;
      proceduralRoot.add(ring);
    }
    group.add(proceduralRoot);

    const barWidth = boss ? 1.7 : 1;
    const hpBarBg = new THREE.Mesh(
      new THREE.PlaneGeometry(barWidth, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x333333, depthTest: false }),
    );
    hpBarBg.position.y = boss ? 2.35 : 1.9;
    hpBarBg.rotation.x = -Math.PI / 8;
    group.add(hpBarBg);

    const hpBar = new THREE.Mesh(
      new THREE.PlaneGeometry(barWidth, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x44cc44, depthTest: false }),
    );
    hpBar.position.y = hpBarBg.position.y;
    hpBar.position.z = 0.005;
    hpBar.rotation.x = -Math.PI / 8;
    group.add(hpBar);

    group.scale.setScalar(scale);
    return { group, hpBar, proceduralRoot };
  }

  /** 将模型缩放到与程序化体相近的屏幕占比，足底对齐本地 y=0，并居中 XZ。 */
  private fitExploreImportedModel(root: THREE.Object3D, boss: boolean): void {
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const target = boss ? 2.1 : 1.45;
    root.scale.multiplyScalar(target / maxDim);
    root.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(root);
    const cx = (b2.min.x + b2.max.x) / 2;
    const cz = (b2.min.z + b2.max.z) / 2;
    root.position.x -= cx;
    root.position.z -= cz;
    root.position.y -= b2.min.y;
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
      }
    });
  }

  private async trySwapProceduralForGltf(
    enemyGroup: THREE.Group,
    proceduralRoot: THREE.Group,
    url: string | undefined,
    boss: boolean,
  ): Promise<void> {
    const trimmed = url?.trim();
    const loader = this.host.loadExploreGltfScene;
    if (!trimmed || !loader) {
      return;
    }
    try {
      const model = await loader(trimmed);
      if (!model || enemyGroup.parent !== this.enemyGroup) {
        return;
      }
      proceduralRoot.removeFromParent();
      this.fitExploreImportedModel(model, boss);
      model.name = "explore-gltf-body";
      enemyGroup.add(model);
    } catch (e) {
      console.warn("[ExploreCombat] GLTF 加载失败:", trimmed, e);
    }
  }

  private killEnemy(enemy: ExploreEnemy): void {
    enemy.dead = true;
    this.enemyGroup.remove(enemy.mesh);
    this.host.onExploreEnemyKilled?.();

    if (enemy.placementId) {
      this.defeatedBossIds.add(enemy.placementId);
    }
    if (enemy.rewardMoney && enemy.rewardMoney > 0) {
      this.host.grantExploreMoney(Math.round(enemy.rewardMoney));
    }
    for (const reward of enemy.rewardItems ?? []) {
      this.grantRewardItem(reward);
    }
    const xp = enemy.rewardXp && enemy.rewardXp > 0 ? enemy.rewardXp : 15 + this.progress.level * 5;
    const toasts = this.progress.addXp(xp);
    for (const t of toasts) {
      this.host.showToast(t, true);
    }
    this.host.showToast(enemy.boss ? `AI 化身已回收：${enemy.name || enemy.id}` : `已清理 ${enemy.name || "低阶 AI"}`);
  }

  private grantRewardItem(reward: ExploreRewardSpec): void {
    if (!reward.itemName) {
      return;
    }
    const loot: InventoryItem = {
      id: reward.itemId || `item-${this.host.allocateUid()}`,
      name: reward.itemName,
      quantity: Math.max(1, Math.round(reward.quantity ?? 1)),
      type: reward.itemType ?? "material",
      icon: reward.itemIcon || "AI",
      collectedAt: Date.now(),
    };
    this.inventory.mergeAdd(loot);
  }

  private tickSpawners(dt: number): void {
    const playerPos = this.host.getPlayerPosition();
    const obstacleKeys = this.host.getObstacleCellKeys();
    for (const state of this.spawnerStates) {
      const p = state.placement;
      if (p.disableWhenBossDefeated && this.defeatedBossIds.size > 0) {
        continue;
      }
      if (p.totalLimit && state.spawnedTotal >= p.totalLimit) {
        continue;
      }
      const origin = this.host.worldCellToWorld(p);
      const dist = distanceXZ(playerPos, origin);
      if (dist > p.triggerRadius) {
        state.timer = Math.min(state.timer, p.spawnIntervalSec);
        continue;
      }
      state.timer -= dt;
      if (state.timer > 0) {
        continue;
      }
      state.timer = p.spawnIntervalSec;
      const activeCount = this.enemies.filter((enemy) => !enemy.dead && enemy.sourceSpawnerId === p.id).length;
      const budget = Math.max(0, p.maxConcurrent - activeCount);
      const count = Math.min(budget, p.spawnCount, p.totalLimit ? p.totalLimit - state.spawnedTotal : p.spawnCount);
      for (let i = 0; i < count; i += 1) {
        if (this.spawnSpawnerEnemy(state, obstacleKeys)) {
          state.spawnedTotal += 1;
        }
      }
    }
  }

  private spawnSpawnerEnemy(state: RuntimeSpawnerState, obstacleKeys: ReadonlySet<string>): boolean {
    if (this.enemies.length >= this.gameplay.enemyMaxConcurrent + this.bossPlacements.length) {
      return false;
    }
    const p = state.placement;
    let spawnCell: GridCell | null = null;
    for (let attempt = 0; attempt < 18 && !spawnCell; attempt += 1) {
      const range = Math.max(1, Math.ceil(Math.min(5, p.activeRadius / 3)));
      const col = p.col + Math.floor(Math.random() * (range * 2 + 1)) - range;
      const row = p.row + Math.floor(Math.random() * (range * 2 + 1)) - range;
      const cell = { col, row };
      if (this.host.isInsideGrid(cell) && !obstacleKeys.has(cellKey(cell))) {
        spawnCell = cell;
      }
    }
    if (!spawnCell) {
      return false;
    }
    const element = p.element ?? "electric";
    const visual = this.createEnemyVisual(element, false, p.modelScale ?? 1);
    visual.group.position.copy(this.host.worldCellToWorld(spawnCell));
    this.enemyGroup.add(visual.group);
    void this.trySwapProceduralForGltf(visual.group, visual.proceduralRoot, p.modelPath?.trim(), false);
    const maxHp = this.gameplay.enemyBaseHp + this.progress.level * this.gameplay.enemyHpPerLevel;
    this.enemies.push({
      id: `ee-${this.host.allocateUid()}`,
      name: p.name,
      mesh: visual.group,
      hpBar: visual.hpBar,
      hp: maxHp,
      maxHp,
      element,
      sourceSpawnerId: p.id,
      rewardMoney: p.rewards?.[0]?.money ?? 12,
      rewardXp: p.rewards?.[0]?.xp ?? 10,
      rewardItems: p.rewards?.filter((reward) => reward.itemName),
      speed: this.gameplay.enemyBaseSpeed + this.progress.level * this.gameplay.enemySpeedPerLevel,
      attackDamage: this.gameplay.enemyBaseDamage + this.progress.level * this.gameplay.enemyDamagePerLevel,
      aggroRange: this.gameplay.enemyAggroRange,
      attackCooldown: this.gameplay.enemyAttackCooldown,
      attackTimer: 0,
      visualRadius: 0.9,
      dead: false,
    });
    return true;
  }

  private resolveDamageAgainstEnemy(enemy: ExploreEnemy, baseDamage: number, element?: ExploreElement): number {
    return Math.max(0, baseDamage * computeElementMultiplier(element, enemy.element, enemy.resistances));
  }

  private resolveDamageAgainstPlayer(baseDamage: number, element?: ExploreElement): number {
    return Math.max(0, baseDamage * computeElementMultiplier(element, this.playerElement));
  }

  private damageEnemy(enemy: ExploreEnemy, damage: number): void {
    enemy.hp -= damage;
    if (enemy.hp <= 0) {
      this.killEnemy(enemy);
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
        if (enemy.boss) {
          enemy.skillTimer = Math.max(0, (enemy.skillTimer ?? 0) - dt);
          if (enemy.skillTimer <= 0) {
            this.castBossSkill(enemy, dist);
            enemy.skillTimer = Math.max(4, getDefaultExploreBoss(enemy.placementId ? this.bossPlacements.find((p) => p.id === enemy.placementId)?.bossId ?? "" : "").skills[0]?.cooldownSec ?? 6);
          }
        }
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

        if (dist < (enemy.visualRadius ?? 0.9) + 0.55) {
          enemy.attackTimer -= dt;
          if (enemy.attackTimer <= 0) {
            enemy.attackTimer = enemy.attackCooldown;
            this.host.damageExplorePlayer(this.resolveDamageAgainstPlayer(enemy.attackDamage, enemy.element));
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

  private castBossSkill(enemy: ExploreEnemy, distToPlayer: number): void {
    const element = (enemy.element ?? "electric") as ExploreElement;
    const bossDef = enemy.placementId
      ? getDefaultExploreBoss(this.bossPlacements.find((p) => p.id === enemy.placementId)?.bossId ?? "")
      : DEFAULT_EXPLORE_BOSSES.find((boss) => boss.element === element) ?? DEFAULT_EXPLORE_BOSSES[0];
    const skill = bossDef.skills[Math.floor(Math.random() * Math.max(1, bossDef.skills.length))];
    const radius = skill.radius ?? 3.5;
    const range = skill.range ?? radius;
    const baseDamage = skill.damage ?? enemy.attackDamage * 1.6;
    const color = EXPLORE_ELEMENT_COLORS[element];

    if (distToPlayer <= Math.max(radius, range)) {
      this.host.damageExplorePlayer(this.resolveDamageAgainstPlayer(baseDamage, element));
    }

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.25, Math.max(0.8, radius), 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.68, side: THREE.DoubleSide }),
    );
    ring.position.copy(enemy.mesh.position);
    ring.position.y = 0.14;
    ring.rotation.x = -Math.PI / 2;
    this.projectileGroup.add(ring);
    this.projectiles.push({
      mesh: ring,
      velocity: new THREE.Vector3(),
      damage: 0,
      lifetime: 0.55,
      type: "blast",
      target: null,
      element,
    });
    this.host.showToast(`${enemy.name || bossDef.name} 释放 ${skill.name}`);
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
            this.damageEnemy(enemy, this.resolveDamageAgainstEnemy(enemy, proj.damage, proj.element));
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
