import * as THREE from "three";
import { cellKey, distanceXZ, worldToCell } from "../core/runtime-grid";
import { computeElementMultiplier } from "../defense/defense-taxonomy";
import { DEFAULT_EXPLORE_BOSSES, EXPLORE_ELEMENT_COLORS, EXPLORE_ELEMENT_LABELS, EXPLORE_PLAYER_ELEMENTS, getDefaultExploreBoss, } from "./explore-rpg-content";
import { resolveExploreGameplay } from "./explore-gameplay-settings";
import { createInitialExploreWaveTimers, advanceExploreWaveState, } from "./explore-wave-spawner";
import { aggregateSlotModules, getPassiveCritChance, getPassiveDamageReduction, } from "./explore-skill-modules";
export class ExploreCombatRuntime {
    constructor(options) {
        Object.defineProperty(this, "enemyGroup", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "projectileGroup", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "inventory", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "progress", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "host", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "enemies", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "projectiles", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "bossPlacements", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "spawnerStates", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "defeatedBossIds", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "playerElement", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "electric"
        });
        Object.defineProperty(this, "attackCooldown", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "skillECooldown", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "skillRCooldown", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        /** 由关卡 explorationLayout.gameplay / MapDefinition.exploreGameplay 同步 */
        Object.defineProperty(this, "gameplay", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: resolveExploreGameplay(undefined)
        });
        /* ── 肉鸽波次 ── */
        Object.defineProperty(this, "waveTimers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: createInitialExploreWaveTimers(4)
        });
        Object.defineProperty(this, "waveRules", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "bossPhaseActive", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "shieldTimer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        this.enemyGroup = options.enemyGroup;
        this.projectileGroup = options.projectileGroup;
        this.inventory = options.inventory;
        this.progress = options.progress;
        this.host = options.host;
    }
    /** 载入或切换地图时由宿主调用；仅更新玩法参数，不重置波次（波次重置由 resetEncounter 负责） */
    syncGameplay(settings) {
        this.gameplay = resolveExploreGameplay(settings ?? undefined);
    }
    /**
     * 探索胜利判定：地图上存在至少一个非重生首领，且这些首领均已击倒。
     * 无主 Boss 或未配置占位时不视为自动胜利。
     */
    allPermanentBossesCleared() {
        const required = this.bossPlacements.filter((p) => !p.respawn);
        if (required.length === 0) {
            return false;
        }
        return required.every((p) => this.defeatedBossIds.has(p.id));
    }
    getDefeatedBossIds() {
        return [...this.defeatedBossIds];
    }
    restoreDefeatedBossIds(ids) {
        const validPlacementIds = new Set(this.bossPlacements.map((placement) => placement.id));
        this.defeatedBossIds = new Set([...ids].filter((id) => validPlacementIds.has(id)));
    }
    syncMapContent(options) {
        this.bossPlacements = [...(options.bosses ?? [])];
        this.defeatedBossIds.clear();
        this.spawnerStates = (options.spawners ?? []).map((placement) => ({
            placement,
            timer: Math.max(0.2, placement.spawnIntervalSec * 0.35),
            spawnedTotal: 0,
        }));
        this.waveRules = [...(options.waveRules ?? [])];
    }
    /* ───── 肉鸽波次对外接口 ───── */
    getWaveTimers() { return this.waveTimers; }
    getWaveNumber() { return this.waveTimers.wave; }
    isWaveMode() { return this.gameplay.roguelikeWaveMode; }
    isUpgradePending() { return this.waveTimers.upgradePending; }
    isBossPhaseActive() { return this.bossPhaseActive; }
    isAllWavesCleared() { return this.waveTimers.allWavesCleared; }
    getAliveEnemyCount() { return this.enemies.filter(e => !e.dead).length; }
    /** 玩家在 UI 中选择升级后调用 */
    confirmUpgradeChoice(moduleId) {
        const toast = this.progress.applyUpgradeChoice(moduleId);
        if (toast)
            this.host.showToast(toast, true);
        this.waveTimers = { ...this.waveTimers, upgradePending: false };
    }
    /** 全部波次清完后开启 Boss 战 */
    startBossPhase() {
        this.bossPhaseActive = true;
        this.spawnPlacedBosses();
        this.host.showToast("☠️ 最终 Boss 出现了！", true);
        this.host.onExploreBossPhaseBegin?.();
    }
    /** 恢复波次进度（读档用） */
    restoreWave(wave) {
        this.waveTimers.wave = wave;
    }
    getPlayerElement() {
        return this.playerElement;
    }
    getPlayerElementLabel() {
        return EXPLORE_ELEMENT_LABELS[this.playerElement];
    }
    setPlayerElement(element) {
        this.playerElement = element;
        this.host.showToast(`玩家属性切换：${EXPLORE_ELEMENT_LABELS[element]} · ${this.playerKit().label}`);
    }
    cyclePlayerElement(step) {
        const current = EXPLORE_PLAYER_ELEMENTS.indexOf(this.playerElement);
        const next = (current + step + EXPLORE_PLAYER_ELEMENTS.length) % EXPLORE_PLAYER_ELEMENTS.length;
        this.setPlayerElement(EXPLORE_PLAYER_ELEMENTS[next]);
    }
    playerKit() {
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
    getAttackCooldown() {
        return this.attackCooldown;
    }
    getAttackMaxCooldown() {
        return this.gameplay.attackCooldownSec;
    }
    getSkillECooldown() {
        return this.skillECooldown;
    }
    getSkillEMaxCooldown() {
        return this.gameplay.skillECooldownSec;
    }
    getSkillRCooldown() {
        return this.skillRCooldown;
    }
    getSkillRMaxCooldown() {
        return this.gameplay.skillRCooldownSec;
    }
    /** Begin exploration reset: clear units, timers; full HP restore is handled by host if needed. */
    resetEncounter() {
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
        // 肉鸽模式：重置波次状态，不立即生 Boss
        if (this.gameplay.roguelikeWaveMode) {
            this.waveTimers = createInitialExploreWaveTimers(this.gameplay.firstWaveDelaySec);
            this.bossPhaseActive = false;
        }
        else {
            this.spawnPlacedBosses();
        }
        this.attackCooldown = 0;
        this.skillECooldown = 0;
        this.skillRCooldown = 0;
        this.shieldTimer = 0;
    }
    /** When leaving explore mode mid-fight — drop short-lived VFX meshes. */
    clearEphemeralProjectiles() {
        for (const proj of this.projectiles) {
            this.projectileGroup.remove(proj.mesh);
        }
        this.projectiles.length = 0;
    }
    resetAfterRunFailure() {
        this.attackCooldown = 0;
        this.skillECooldown = 0;
        this.skillRCooldown = 0;
    }
    tick(dt) {
        this.attackCooldown = Math.max(0, this.attackCooldown - dt);
        this.skillECooldown = Math.max(0, this.skillECooldown - dt);
        this.skillRCooldown = Math.max(0, this.skillRCooldown - dt);
        this.shieldTimer = Math.max(0, this.shieldTimer - dt);
        // 被动回血
        this.progress.tickPassiveRegen(dt);
        this.updateProjectiles(dt);
        this.updateEnemies(dt);
        // 肉鸽波次模式
        if (this.gameplay.roguelikeWaveMode) {
            this.tickWaveSpawner(dt);
        }
        else {
            this.tickSpawners(dt);
        }
    }
    /** 肉鸽波次状态机每帧推进 */
    tickWaveSpawner(dt) {
        // Boss 战期间不再出普通怪
        if (this.bossPhaseActive)
            return;
        const aliveNonBoss = this.enemies.filter((e) => !e.dead && !e.boss).length;
        const result = advanceExploreWaveState({
            dt,
            timers: this.waveTimers,
            aliveEnemyCount: aliveNonBoss,
            totalWaves: this.gameplay.totalWaves,
            firstWaveDelay: this.gameplay.firstWaveDelaySec,
            wavePauseSec: this.gameplay.wavePauseSec,
            bossUnlockWave: this.gameplay.bossUnlockWave,
            waveRules: this.waveRules,
            upgradePending: this.waveTimers.upgradePending,
        });
        this.waveTimers = result.timers;
        for (const effect of result.effects) {
            this.handleWaveEffect(effect);
        }
    }
    handleWaveEffect(effect) {
        switch (effect.kind) {
            case "toastWaveBegins":
                this.host.showToast(`⚔️ 第 ${effect.wave} 波开始！`, true);
                this.host.onExploreWaveBegin?.(effect.wave);
                break;
            case "toastWaveClear":
                this.host.showToast(`✅ 第 ${effect.wave} 波清除！奖励 $${effect.reward}`, true);
                this.host.onExploreWaveClear?.(effect.wave);
                break;
            case "grantMoney":
                this.host.grantExploreMoney(effect.amount);
                break;
            case "grantXp": {
                const toasts = this.progress.addXp(effect.amount);
                for (const t of toasts)
                    this.host.showToast(t, true);
                break;
            }
            case "spawnEnemy":
                this.spawnWaveEnemy(effect.spawnerId);
                break;
            case "showUpgradeChoice":
                this.waveTimers = { ...this.waveTimers, upgradePending: true };
                this.progress.generateUpgradeChoices();
                this.host.onExploreUpgradeChoice?.(effect.wave);
                break;
            case "allWavesCleared":
                this.host.showToast(`🏆 全部 ${effect.wave} 波已清除！准备迎战 Boss！`, true);
                this.host.onExploreAllWavesCleared?.();
                // 自动开启 Boss 战
                this.startBossPhase();
                break;
            case "bossPhaseBegin":
                break;
        }
    }
    /** 肉鸽波次：从刷怪点生成一只怪 */
    spawnWaveEnemy(spawnerId) {
        const obstacleKeys = this.host.getObstacleCellKeys();
        // 找到活跃的刷怪点
        const candidates = spawnerId
            ? this.spawnerStates.filter((s) => s.placement.id === spawnerId)
            : this.spawnerStates.filter((s) => {
                const p = s.placement;
                // 若刷怪点配置了 activeOnWaves，检查当前波次是否匹配
                if (p.activeOnWaves?.length) {
                    return p.activeOnWaves.includes(this.waveTimers.wave);
                }
                return true;
            });
        if (!candidates.length && this.spawnerStates.length) {
            // 回退：用任意刷怪点
            const fallback = this.spawnerStates[Math.floor(Math.random() * this.spawnerStates.length)];
            this.spawnSpawnerEnemy(fallback, obstacleKeys);
            return;
        }
        if (!candidates.length)
            return;
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        this.spawnSpawnerEnemy(chosen, obstacleKeys);
    }
    fireBasicAttack() {
        if (this.attackCooldown > 0) {
            return;
        }
        const kit = this.playerKit();
        const basicMods = aggregateSlotModules(this.progress.equippedModules, "basic");
        this.attackCooldown = this.gameplay.attackCooldownSec * kit.attackCooldownMult * basicMods.cooldownMult;
        const playerPos = this.host.getPlayerPosition();
        const HOMING_RANGE = 10;
        let nearestEnemy = null;
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
        let velocity;
        if (nearestEnemy) {
            const toEnemy = nearestEnemy.mesh.position.clone().sub(playerPos).setY(0).normalize();
            velocity = toEnemy.multiplyScalar(18);
        }
        else {
            const forward = this.host.getExploreAttackForward().clone();
            velocity = forward.multiplyScalar(18);
        }
        const baseDamage = (20 + this.progress.level * 4) * kit.basicDamageMult * basicMods.damageMult * this.progress.getLevelDamageMult();
        // 暗击判定
        const critChance = getPassiveCritChance(this.progress.equippedModules);
        const isCrit = Math.random() < critChance;
        const damage = isCrit ? baseDamage * 2 : baseDamage;
        const color = EXPLORE_ELEMENT_COLORS[this.playerElement];
        const geo = new THREE.SphereGeometry(0.15, 8, 6);
        const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: isCrit ? 2.0 : 1.2 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(playerPos);
        mesh.position.y = 0.75;
        // 分裂弹幕模组
        const splitCount = basicMods.effectTags.includes("split3") ? 3 : 1;
        for (let i = 0; i < splitCount; i++) {
            const spreadAngle = splitCount > 1 ? ((i - (splitCount - 1) / 2) * 0.3) : 0;
            const cos = Math.cos(spreadAngle);
            const sin = Math.sin(spreadAngle);
            const v = velocity.clone();
            const vx = v.x * cos - v.z * sin;
            const vz = v.x * sin + v.z * cos;
            v.x = vx;
            v.z = vz;
            const projMesh = i === 0 ? mesh : mesh.clone();
            if (i > 0)
                projMesh.position.copy(mesh.position);
            this.projectileGroup.add(projMesh);
            this.projectiles.push({
                mesh: projMesh,
                velocity: v,
                damage: damage / splitCount,
                lifetime: 2.2,
                type: "basic",
                target: i === 0 ? nearestEnemy : null,
                element: this.playerElement,
            });
        }
        this.host.onExploreBasicAttackFired?.();
    }
    castOrbSkill() {
        if (this.skillECooldown > 0) {
            this.host.showToast(`E \u6280\u80fd CD: ${Math.ceil(this.skillECooldown)}s`);
            return;
        }
        const playerPos = this.host.getPlayerPosition();
        let nearestEnemy = null;
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
        const eMods = aggregateSlotModules(this.progress.equippedModules, "skillE");
        this.skillECooldown = this.gameplay.skillECooldownSec * eMods.cooldownMult;
        this.host.onExploreSkillEUsed?.();
        const targetPos = nearestEnemy.mesh.position.clone();
        const damage = this.resolveDamageAgainstEnemy(nearestEnemy, (100 + this.progress.level * 18) * this.playerKit().orbDamageMult * eMods.damageMult * this.progress.getLevelDamageMult(), this.playerElement);
        this.damageEnemy(nearestEnemy, damage);
        const push = (mesh, velocity, lifetime, type) => {
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
            push(spark, new THREE.Vector3(Math.cos(angle) * speed, 2.5 + Math.random() * 4, Math.sin(angle) * speed), 0.55 + Math.random() * 0.35, "spark");
        }
        this.host.showToast("\u5929\u964d\u95ea\u7535\uff01");
        this.pruneDeadEnemies();
    }
    castRSkill() {
        if (this.skillRCooldown > 0) {
            this.host.showToast(`R \u6280\u80fd CD: ${Math.ceil(this.skillRCooldown)}s`);
            return;
        }
        const rMods = aggregateSlotModules(this.progress.equippedModules, "skillR");
        this.skillRCooldown = this.gameplay.skillRCooldownSec * rMods.cooldownMult;
        this.host.onExploreSkillRUsed?.();
        // 护盾模组
        if (rMods.effectTags.includes("shield-on-cast")) {
            this.shieldTimer = 3;
        }
        const playerPos = this.host.getPlayerPosition();
        const kit = this.playerKit();
        const blastRadius = 5 * kit.burstRadiusMult * rMods.radiusMult;
        let hitCount = 0;
        for (const enemy of this.enemies) {
            if (enemy.dead) {
                continue;
            }
            if (playerPos.distanceTo(enemy.mesh.position) <= blastRadius) {
                const isLowHp = enemy.hp / enemy.maxHp < 0.3;
                const executeMult = isLowHp && rMods.effectTags.includes("execute") ? 2 : 1;
                this.damageEnemy(enemy, this.resolveDamageAgainstEnemy(enemy, (150 + this.progress.level * 22) * kit.burstDamageMult * rMods.damageMult * executeMult * this.progress.getLevelDamageMult(), this.playerElement));
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
    spawnPlacedBosses() {
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
            void this.trySwapProceduralForGltf(visual.group, visual.proceduralRoot, placement.modelPath?.trim() || bossDef.modelPath?.trim(), true);
            this.enemies.push({
                id: `boss-${placement.id}`,
                name: placement.name || bossDef.name,
                mesh: visual.group,
                hpBillboard: visual.hpBillboard,
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
    createEnemyVisual(element, boss, scale) {
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
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.035, 8, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 }));
            ring.rotation.x = Math.PI / 2;
            ring.position.y = 1.0;
            proceduralRoot.add(ring);
        }
        group.add(proceduralRoot);
        const barWidth = boss ? 1.7 : 1;
        const hpBillboard = new THREE.Group();
        hpBillboard.position.y = boss ? 2.35 : 1.9;
        hpBillboard.visible = !boss;
        group.add(hpBillboard);
        const hpBarBg = new THREE.Mesh(new THREE.PlaneGeometry(barWidth, 0.1), new THREE.MeshBasicMaterial({ color: 0x333333, depthTest: false }));
        hpBillboard.add(hpBarBg);
        const hpBar = new THREE.Mesh(new THREE.PlaneGeometry(barWidth, 0.1), new THREE.MeshBasicMaterial({ color: 0x44cc44, depthTest: false }));
        hpBar.position.z = 0.005;
        hpBillboard.add(hpBar);
        group.scale.setScalar(scale);
        return { group, hpBillboard, hpBar, proceduralRoot };
    }
    /** 将模型缩放到与程序化体相近的屏幕占比，足底对齐本地 y=0，并居中 XZ。 */
    fitExploreImportedModel(root, boss) {
        // 先将 root 自身变换重置为单位，确保测量准确
        root.position.set(0, 0, 0);
        root.rotation.set(0, 0, 0);
        root.scale.set(1, 1, 1);
        root.updateMatrixWorld(true);
        // 手动遍历所有几何体顶点来精确计算 bounding box，
        // 避免 SkinnedMesh clone 后 setFromObject 返回极小值导致 scale 爆炸
        const box = new THREE.Box3();
        let hasGeo = false;
        const _pos = new THREE.Vector3();
        root.traverse((child) => {
            const mesh = child;
            if (!mesh.isMesh || !mesh.geometry)
                return;
            const geo = mesh.geometry;
            geo.computeBoundingBox();
            if (geo.boundingBox) {
                mesh.updateMatrixWorld(true);
                const localBox = geo.boundingBox.clone();
                localBox.applyMatrix4(mesh.matrixWorld);
                box.union(localBox);
                hasGeo = true;
            }
        });
        if (!hasGeo) {
            box.setFromObject(root);
        }
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 0.001);
        const target = boss ? 4.2 : 2.9;
        let scaleFactor = target / maxDim;
        // 安全上限：如果 scale 超过 10，说明 bounding box 测量可能有误
        if (scaleFactor > 10) {
            console.warn("[ExploreCombat] fitModel: scaleFactor 过大 (", scaleFactor.toFixed(2), "), 限制为 0.02。maxDim=", maxDim.toFixed(4), "size=", size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2));
            scaleFactor = 0.02;
        }
        root.scale.setScalar(scaleFactor);
        root.updateMatrixWorld(true);
        // 重新计算缩放后的 bounding box 用于居中和底部对齐
        const b2 = new THREE.Box3();
        let hasGeo2 = false;
        root.traverse((child) => {
            const mesh = child;
            if (!mesh.isMesh || !mesh.geometry)
                return;
            const geo = mesh.geometry;
            if (geo.boundingBox) {
                mesh.updateMatrixWorld(true);
                const localBox = geo.boundingBox.clone();
                localBox.applyMatrix4(mesh.matrixWorld);
                b2.union(localBox);
                hasGeo2 = true;
            }
        });
        if (!hasGeo2) {
            b2.setFromObject(root);
        }
        const cx = (b2.min.x + b2.max.x) / 2;
        const cz = (b2.min.z + b2.max.z) / 2;
        root.position.x = -cx;
        root.position.z = -cz;
        root.position.y = -b2.min.y;
        root.traverse((child) => {
            const mesh = child;
            if (mesh.isMesh) {
                mesh.castShadow = true;
            }
        });
    }
    async trySwapProceduralForGltf(enemyGroup, proceduralRoot, url, boss) {
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
        }
        catch (e) {
            console.warn("[ExploreCombat] GLTF 加载失败:", trimmed, e);
        }
    }
    killEnemy(enemy) {
        enemy.dead = true;
        this.enemyGroup.remove(enemy.mesh);
        this.host.onExploreEnemyKilled?.();
        this.progress.totalKills += 1;
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
        if (enemy.boss && enemy.placementId) {
            this.host.onExploreBossDefeated?.({
                placementId: enemy.placementId,
                name: enemy.name,
            });
        }
    }
    grantRewardItem(reward) {
        if (!reward.itemName) {
            return;
        }
        const loot = {
            id: reward.itemId || `item-${this.host.allocateUid()}`,
            name: reward.itemName,
            quantity: Math.max(1, Math.round(reward.quantity ?? 1)),
            type: reward.itemType ?? "material",
            icon: reward.itemIcon || "AI",
            collectedAt: Date.now(),
        };
        this.inventory.mergeAdd(loot);
    }
    tickSpawners(dt) {
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
    spawnSpawnerEnemy(state, obstacleKeys) {
        if (this.enemies.length >= this.gameplay.enemyMaxConcurrent + this.bossPlacements.length) {
            return false;
        }
        const p = state.placement;
        let spawnCell = null;
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
        // 肉鸽模式：敌人属性同时按波次和等级缩放
        const waveScale = this.gameplay.roguelikeWaveMode ? 1 + this.waveTimers.wave * 0.12 : 1;
        const maxHp = Math.round((this.gameplay.enemyBaseHp + this.progress.level * this.gameplay.enemyHpPerLevel) * waveScale);
        const enemySpeed = Math.min(5, (this.gameplay.enemyBaseSpeed + this.progress.level * this.gameplay.enemySpeedPerLevel) * (1 + this.waveTimers.wave * 0.015));
        const enemyDmg = Math.round((this.gameplay.enemyBaseDamage + this.progress.level * this.gameplay.enemyDamagePerLevel) * waveScale);
        const baseRewardMoney = p.rewards?.[0]?.money ?? 12;
        const baseRewardXp = p.rewards?.[0]?.xp ?? 10;
        this.enemies.push({
            id: `ee-${this.host.allocateUid()}`,
            name: p.name,
            mesh: visual.group,
            hpBillboard: visual.hpBillboard,
            hpBar: visual.hpBar,
            hp: maxHp,
            maxHp,
            element,
            sourceSpawnerId: p.id,
            rewardMoney: Math.round(baseRewardMoney * (1 + this.waveTimers.wave * 0.05)),
            rewardXp: Math.round(baseRewardXp * (1 + this.waveTimers.wave * 0.08)),
            rewardItems: p.rewards?.filter((reward) => reward.itemName),
            speed: enemySpeed,
            attackDamage: enemyDmg,
            aggroRange: this.gameplay.enemyAggroRange,
            attackCooldown: this.gameplay.enemyAttackCooldown,
            attackTimer: 0,
            visualRadius: 0.9,
            dead: false,
        });
        return true;
    }
    resolveDamageAgainstEnemy(enemy, baseDamage, element) {
        return Math.max(0, baseDamage * computeElementMultiplier(element, enemy.element, enemy.resistances));
    }
    resolveDamageAgainstPlayer(baseDamage, element) {
        let damage = Math.max(0, baseDamage * computeElementMultiplier(element, this.playerElement));
        // 被动减伤模组
        damage *= getPassiveDamageReduction(this.progress.equippedModules);
        // R 技能护盾
        if (this.shieldTimer > 0) {
            damage *= 0.5;
        }
        return damage;
    }
    damageEnemy(enemy, damage) {
        const amount = Math.max(0, damage);
        if (amount > 0) {
            const w = new THREE.Vector3();
            enemy.mesh.getWorldPosition(w);
            this.host.showExploreEnemyDamageFloat?.(w, amount);
        }
        enemy.hp -= amount;
        if (enemy.hp <= 0) {
            this.killEnemy(enemy);
        }
    }
    updateEnemies(dt) {
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
            }
            else {
                enemy.attackTimer = Math.max(0, enemy.attackTimer - dt);
            }
            const ratio = Math.max(0, enemy.hp / enemy.maxHp);
            const showHpBillboard = !enemy.boss || dist <= enemy.aggroRange;
            enemy.hpBillboard.visible = showHpBillboard;
            if (showHpBillboard) {
                this.host.orientHudToCamera?.(enemy.hpBillboard);
            }
            enemy.hpBar.scale.x = ratio;
            enemy.hpBar.position.x = (ratio - 1) * 0.5;
            enemy.hpBar.material.color.setHex(ratio > 0.5 ? 0x44cc44 : ratio > 0.25 ? 0xffaa00 : 0xee3333);
        }
        this.pruneDeadEnemies();
    }
    castBossSkill(enemy, distToPlayer) {
        const element = (enemy.element ?? "electric");
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
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.25, Math.max(0.8, radius), 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.68, side: THREE.DoubleSide }));
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
    updateProjectiles(dt) {
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
                proj.mesh.material.opacity = 0.65 * (1 - progress);
            }
            else if (proj.type === "lightning") {
                const mat = proj.mesh.material;
                mat.opacity = Math.max(0, mat.opacity - (1.0 / 0.25) * dt);
            }
            else if (proj.type === "spark") {
                proj.velocity.y -= 10 * dt;
                proj.mesh.position.addScaledVector(proj.velocity, dt);
                proj.mesh.material.opacity = Math.max(0, proj.lifetime / 0.9);
            }
            else {
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
    pruneDeadEnemies() {
        const alive = this.enemies.filter((e) => !e.dead);
        this.enemies.length = 0;
        this.enemies.push(...alive);
    }
}
