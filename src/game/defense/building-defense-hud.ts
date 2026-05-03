import * as THREE from "three";

import { clamp } from "../core/runtime-grid";
import type { Building } from "../core/types";

export interface BuildingDefenseHudDeps {
  buildGroupScaleX: () => number;
  playfieldVisualScale: () => number;
  elapsed: () => number;
  selectedBuilding: () => Building | null;
  orientHudToCamera: (hudRoot: THREE.Object3D) => void;
  /** 用于新挂技能标牌后校正全场面板锚缩放 */
  allBuildings: () => Building[];
}

/** Canvas 血量条与技能就绪浮层的创建、布局与每帧朝向 */
export class BuildingDefenseHud {
  constructor(private readonly deps: BuildingDefenseHudDeps) {}

  syncSkillHudScaleCorrection(buildings: Building[]): void {
    const sx = this.deps.buildGroupScaleX();
    const inv = sx > 1e-9 ? 1 / sx : 1;
    const ax = sx === 1 ? 1 : inv;
    for (const b of buildings) {
      const anchor = b.skillHudAnchor;
      if (!anchor) {
        continue;
      }
      anchor.scale.set(ax, 1, ax);
    }
  }

  hudScale(): number {
    const s = this.deps.playfieldVisualScale();
    if (s <= 1) {
      return 1;
    }
    return THREE.MathUtils.clamp(Math.sqrt(s) * 2.3, 1, 10.5);
  }

  getVisualTopLocal(building: Building, fallback: number): number {
    const visual = building.mesh.children[0];
    if (!visual) {
      return fallback;
    }

    const mesh = building.mesh;
    mesh.updateWorldMatrix(true, true);
    const worldBox = new THREE.Box3().setFromObject(visual);
    if (worldBox.isEmpty()) {
      return fallback;
    }

    const corner = new THREE.Vector3();
    let maxLocalY = -Infinity;
    const b = worldBox;
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z);
      mesh.worldToLocal(corner);
      maxLocalY = Math.max(maxLocalY, corner.y);
    }
    return Number.isFinite(maxLocalY) ? maxLocalY : fallback;
  }

  layoutAll(buildings: Building[]): void {
    for (const building of buildings) {
      this.layoutHealthForBuilding(building);
      this.layoutSkillBillboardForBuilding(building);
    }
  }

  layoutHealthForBuilding(building: Building): void {
    if (!building.healthBarGroup) {
      return;
    }

    const hudScale = this.hudScale();
    const top = this.getVisualTopLocal(building, 2.05);
    building.healthBarGroup.position.set(0, Math.max(top + 0.22 * hudScale, 2.05), 0);
  }

  attachToBuilding(building: Building): void {
    building.healthBarGroup = undefined;
    building.healthBarFill = undefined;
    building.skillHudBillboard = undefined;
    building.skillHudPlane = undefined;
    building.skillHudText = undefined;
    building.skillHudAnchor = undefined;

    const barGroup = new THREE.Group();
    barGroup.position.y = 2.05;
    barGroup.visible = false;
    const background = new THREE.Mesh(
      new THREE.PlaneGeometry(1.34, 0.16),
      new THREE.MeshBasicMaterial({ color: 0x111827, depthTest: false, depthWrite: false }),
    );
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(1.18, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x52ff7f, depthTest: false, depthWrite: false }),
    );
    fill.position.z = 0.01;
    background.renderOrder = 998;
    fill.renderOrder = 999;
    barGroup.add(background, fill);
    building.mesh.add(barGroup);
    building.healthBarGroup = barGroup;
    building.healthBarFill = fill;
    this.layoutHealthForBuilding(building);

    if (building.spec.activeSkill) {
      const hudAnchor = new THREE.Group();
      building.skillHudAnchor = hudAnchor;

      const skillBillboard = new THREE.Group();
      building.skillHudBillboard = skillBillboard;

      const planeMat = new THREE.MeshBasicMaterial({
        map: this.createHudTexture("\u6280\u80fd\u51c6\u5907\u4e2d", false),
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      planeMat.depthFunc = THREE.AlwaysDepth;
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), planeMat);
      plane.frustumCulled = false;
      plane.renderOrder = 999;
      building.skillHudPlane = plane;

      skillBillboard.visible = false;
      skillBillboard.add(plane);
      hudAnchor.add(skillBillboard);
      building.mesh.add(hudAnchor);
      building.skillHudText = "";

      this.syncSkillHudScaleCorrection(this.deps.allBuildings());
      this.layoutSkillBillboardForBuilding(building);
    }
  }

  layoutSkillBillboardForBuilding(building: Building): void {
    const billboard = building.skillHudBillboard;
    const plane = building.skillHudPlane;
    if (!billboard || !plane) {
      return;
    }

    const setPlaneSize = (sx: number, sy: number): void => {
      plane.scale.set(sx, sy, 1);
      plane.position.set(0, sy * 0.5, 0);
    };

    const scale = this.hudScale();
    if (!building.mesh.children[0]) {
      billboard.position.set(0, 3.55 * scale, 0);
      const sx = 3.85 * scale;
      const sy = sx * (152 / 448) * 1.05;
      setPlaneSize(sx, sy);
      return;
    }
    const mesh = building.mesh;
    const visual = mesh.children[0];
    mesh.updateWorldMatrix(true, true);
    const worldBox = new THREE.Box3().setFromObject(visual);
    if (worldBox.isEmpty()) {
      billboard.position.set(0, 3.55 * scale, 0);
      const sx = 3.85 * scale;
      const sy = sx * (152 / 448) * 1.05;
      setPlaneSize(sx, sy);
      return;
    }
    const corner = new THREE.Vector3();
    let maxLocalY = -Infinity;
    const b = worldBox;
    for (let i = 0; i < 8; i++) {
      corner.set(
        i & 1 ? b.max.x : b.min.x,
        i & 2 ? b.max.y : b.min.y,
        i & 4 ? b.max.z : b.min.z,
      );
      mesh.worldToLocal(corner);
      maxLocalY = Math.max(maxLocalY, corner.y);
    }
    const top = Number.isFinite(maxLocalY) ? Math.max(maxLocalY + 0.62 * scale, 2.85 * scale) : 3.55 * scale;
    billboard.position.set(0, top, 0);
    const silhouette = Number.isFinite(maxLocalY) ? Math.max(maxLocalY + 2.55, 3.95) : 4.85;
    const sx = THREE.MathUtils.clamp(1.95 + silhouette * 0.22, 3.5, 6.25) * scale;
    const sy = sx * (152 / 448) * 1.05;
    setPlaneSize(sx, sy);
  }

  createHudTexture(text: string, ready: boolean): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 448;
    canvas.height = 152;
    const context = canvas.getContext("2d");
    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = ready ? "rgba(255, 214, 102, 0.96)" : "rgba(15, 23, 42, 0.9)";
      context.strokeStyle = ready ? "rgba(120, 53, 15, 0.55)" : "rgba(226, 232, 240, 0.92)";
      context.lineWidth = 5;
      context.fillRect(10, 16, canvas.width - 20, canvas.height - 32);
      context.strokeRect(10, 16, canvas.width - 20, canvas.height - 32);
      const lines = text.split("\n");
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = '800 31px "Microsoft YaHei", ui-sans-serif, system-ui, sans-serif';
      lines.forEach((line, index) => {
        const y = 58 + index * 38;
        context.strokeStyle = ready ? "rgba(255, 255, 255, 0.55)" : "rgba(0, 0, 0, 0.92)";
        context.lineWidth = 6;
        context.lineJoin = "round";
        context.strokeText(line, canvas.width / 2, y);
        context.fillStyle = ready ? "#1a0f00" : "#f8fafc";
        context.fillText(line, canvas.width / 2, y);
      });
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  updateSkillHudForBuilding(building: Building): void {
    if (!building.skillHudBillboard || !building.skillHudPlane || !building.spec.activeSkill) {
      return;
    }
    const selected = this.deps.selectedBuilding() === building;
    building.skillHudBillboard.visible = selected;
    if (!selected) {
      return;
    }

    const cooldown = Math.max(0, building.skillCooldownTimer);
    const ready = cooldown <= 0;
    const text = ready ? `\u70b9\u51fb/F \u91ca\u653e\n${building.spec.activeSkill.name}` : `\u51b7\u5374 ${Math.ceil(cooldown)}s\n${building.spec.activeSkill.name}`;
    if (building.skillHudText === text) {
      return;
    }
    building.skillHudText = text;
    const material = building.skillHudPlane.material as THREE.MeshBasicMaterial;
    material.map?.dispose();
    material.map = this.createHudTexture(text, ready);
    material.needsUpdate = true;
  }

  updatePerFrame(buildings: Building[]): void {
    const elapsed = this.deps.elapsed();
    const orient = this.deps.orientHudToCamera;
    for (const building of buildings) {
      const maxHp = building.spec.maxHp ?? 1;
      const ratio = clamp(building.hp / maxHp, 0, 1);
      const isSelected = this.deps.selectedBuilding() === building;
      const showHealth =
        isSelected ||
        ratio < 0.999 ||
        building.blockingEnemies.length > 0 ||
        (building.damageReductionUntil ?? 0) > elapsed;

      if (building.healthBarGroup && building.healthBarFill) {
        building.healthBarGroup.visible = showHealth;
        if (showHealth) {
          orient(building.healthBarGroup);
          const hudScale = this.hudScale();
          const healthBarBack = building.healthBarGroup.children[0];
          healthBarBack?.scale.set(hudScale, hudScale, 1);
          building.healthBarFill.scale.set(hudScale * Math.max(0.02, ratio), hudScale, 1);
          building.healthBarFill.position.x = -(1 - ratio) * 0.59 * hudScale;
          const material = building.healthBarFill.material as THREE.MeshBasicMaterial;
          material.color.set(ratio > 0.55 ? 0x52ff7f : ratio > 0.25 ? 0xffd166 : 0xff5e73);
        }
      }

      building.mesh.traverse((child) => {
        if (child.userData.isRangeRing) {
          child.visible = isSelected;
        }
      });

      this.updateSkillHudForBuilding(building);

      if (building.skillHudBillboard?.visible) {
        orient(building.skillHudBillboard);
      }
    }
  }
}
