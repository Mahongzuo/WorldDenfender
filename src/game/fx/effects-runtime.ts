import * as THREE from "three";

import { setObjectOpacity } from "../core/browser-utils";
import { distanceXZ } from "../core/runtime-grid";
import type { BuildId, TimedEffect } from "../core/types";
import { unwindFxSquashFromPlayfieldParent, worldPointToFxGroupLocal } from "./fx-coordinate-space";

function blendTowardWhite(hex: number, t: number): number {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color(0xffffff), THREE.MathUtils.clamp(t, 0, 1));
  return c.getHex();
}

function towerFlightSpeed(id: BuildId): number {
  switch (id) {
    case "machine":
      return 72;
    case "cannon":
      return 40;
    case "frost":
      return 56;
    case "stellar":
      return 50;
    case "liqingzhao":
      return 44;
    default:
      return 54;
  }
}

function makeProjectileMesh(buildId: BuildId, color: number, fxGroup: THREE.Group): THREE.Mesh {
  const tint = new THREE.Color(color).multiplyScalar(0.88);
  let geometry: THREE.BufferGeometry;
  switch (buildId) {
    case "cannon":
      geometry = new THREE.SphereGeometry(0.32, 14, 10);
      break;
    case "frost":
      geometry = new THREE.OctahedronGeometry(0.26, 0);
      break;
    case "stellar":
      geometry = new THREE.IcosahedronGeometry(0.3, 0);
      break;
    case "liqingzhao":
      geometry = new THREE.SphereGeometry(0.28, 12, 8);
      break;
    case "machine":
    default:
      geometry = new THREE.SphereGeometry(0.18, 10, 8);
      break;
  }
  const mat = new THREE.MeshStandardMaterial({
    color: tint.getHex(),
    metalness: 0.42,
    roughness: 0.38,
    emissive: tint.clone().multiplyScalar(0.78),
    emissiveIntensity: 1.05,
    fog: false,
  });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.castShadow = false;
  unwindFxSquashFromPlayfieldParent(mesh, fxGroup);
  return mesh;
}

/** Machine gun: tight sparks, no ring — fires too often for rings not to pile up */
function addMachineHitFx(
  effects: TimedEffect[],
  fxGroup: THREE.Group,
  center: THREE.Vector3,
  color: number,
): void {
  const count = 18;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = center.x;
    positions[i * 3 + 1] = center.y + 0.1;
    positions[i * 3 + 2] = center.z;
    const angle = (i / count) * Math.PI * 2;
    const speed = 1.8 + Math.random() * 2.2;
    velocities[i * 3] = Math.cos(angle) * speed;
    velocities[i * 3 + 1] = Math.random() * 2.5 + 0.8;
    velocities[i * 3 + 2] = Math.sin(angle) * speed;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const pts = new THREE.Points(
    geom,
    new THREE.PointsMaterial({
      color: blendTowardWhite(color, 0.1),
      size: 0.1,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  fxGroup.add(pts);
  effects.push({
    object: pts,
    ttl: 0.22,
    maxTtl: 0.22,
    grow: 0,
    baseOpacity: 0.88,
    tick: (dt: number) => {
      const pos = geom.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        pos[i * 3] += velocities[i * 3] * dt;
        pos[i * 3 + 1] += velocities[i * 3 + 1] * dt;
        pos[i * 3 + 2] += velocities[i * 3 + 2] * dt;
        velocities[i * 3 + 1] -= 14 * dt;
      }
      geom.attributes.position.needsUpdate = true;
    },
  });
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 6, 4),
    new THREE.MeshBasicMaterial({
      color: blendTowardWhite(color, 0.3),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  flash.position.copy(center);
  unwindFxSquashFromPlayfieldParent(flash, fxGroup);
  fxGroup.add(flash);
  effects.push({ object: flash, ttl: 0.07, maxTtl: 0.07, grow: 5, baseOpacity: 0.72 });
}

/** Frost: ice shard scatter + small pulse ring */
function addFrostHitFx(
  effects: TimedEffect[],
  fxGroup: THREE.Group,
  center: THREE.Vector3,
  color: number,
): void {
  const count = 24;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = center.x + (Math.random() - 0.5) * 0.08;
    positions[i * 3 + 1] = center.y + 0.08;
    positions[i * 3 + 2] = center.z + (Math.random() - 0.5) * 0.08;
    const angle = (i / count) * Math.PI * 2;
    const speed = 1.5 + Math.random() * 2.0;
    velocities[i * 3] = Math.cos(angle) * speed * (0.7 + Math.random() * 0.6);
    velocities[i * 3 + 1] = Math.random() * 1.8 + 0.3;
    velocities[i * 3 + 2] = Math.sin(angle) * speed * (0.7 + Math.random() * 0.6);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const pts = new THREE.Points(
    geom,
    new THREE.PointsMaterial({
      color: blendTowardWhite(color, 0.22),
      size: 0.14,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  fxGroup.add(pts);
  effects.push({
    object: pts,
    ttl: 0.45,
    maxTtl: 0.45,
    grow: 0,
    baseOpacity: 0.85,
    tick: (dt: number) => {
      const pos = geom.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        pos[i * 3] += velocities[i * 3] * dt;
        pos[i * 3 + 1] += velocities[i * 3 + 1] * dt;
        pos[i * 3 + 2] += velocities[i * 3 + 2] * dt;
        velocities[i * 3 + 1] -= 8 * dt;
        velocities[i * 3] *= (1 - 0.08 * dt * 60);
        velocities[i * 3 + 2] *= (1 - 0.08 * dt * 60);
      }
      geom.attributes.position.needsUpdate = true;
    },
  });
  // No ring — frost fires often enough that rings stack and blowout
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 6),
    new THREE.MeshBasicMaterial({
      color: 0xaaeeff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  flash.position.copy(center);
  unwindFxSquashFromPlayfieldParent(flash, fxGroup);
  fxGroup.add(flash);
  effects.push({ object: flash, ttl: 0.1, maxTtl: 0.1, grow: 6, baseOpacity: 0.48 });
}

/** Stellar: 8-point starburst + golden stardust */
function addStellarHitFx(
  effects: TimedEffect[],
  fxGroup: THREE.Group,
  center: THREE.Vector3,
  color: number,
): void {
  const starPts = 8;
  const baseY = center.y + 0.06;
  for (let i = 0; i < starPts; i++) {
    const angle = (i / starPts) * Math.PI * 2;
    const length = 0.55 + Math.random() * 0.4;
    const endPt = new THREE.Vector3(
      center.x + Math.cos(angle) * length,
      baseY,
      center.z + Math.sin(angle) * length,
    );
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(center.x, baseY, center.z), endPt]);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: blendTowardWhite(color, 0.15), transparent: true, blending: THREE.AdditiveBlending }),
    );
    fxGroup.add(line);
    effects.push({ object: line, ttl: 0.24, maxTtl: 0.24, grow: 0, baseOpacity: 0.82 });
  }
  const count = 28;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = center.x + (Math.random() - 0.5) * 0.06;
    positions[i * 3 + 1] = center.y + 0.12;
    positions[i * 3 + 2] = center.z + (Math.random() - 0.5) * 0.06;
    const angle = Math.random() * Math.PI * 2;
    const speed = 2.5 + Math.random() * 3.5;
    velocities[i * 3] = Math.cos(angle) * speed;
    velocities[i * 3 + 1] = Math.random() * 3.5 + 1.0;
    velocities[i * 3 + 2] = Math.sin(angle) * speed;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const pts = new THREE.Points(
    geom,
    new THREE.PointsMaterial({
      color: 0xffd700,
      size: 0.13,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  fxGroup.add(pts);
  effects.push({
    object: pts,
    ttl: 0.52,
    maxTtl: 0.52,
    grow: 0,
    baseOpacity: 0.9,
    tick: (dt: number) => {
      const pos = geom.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        pos[i * 3] += velocities[i * 3] * dt;
        pos[i * 3 + 1] += velocities[i * 3 + 1] * dt;
        pos[i * 3 + 2] += velocities[i * 3 + 2] * dt;
        velocities[i * 3 + 1] -= 12 * dt;
      }
      geom.attributes.position.needsUpdate = true;
    },
  });
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 8, 6),
    new THREE.MeshBasicMaterial({
      color: blendTowardWhite(color, 0.35),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  flash.position.copy(center);
  unwindFxSquashFromPlayfieldParent(flash, fxGroup);
  fxGroup.add(flash);
  effects.push({ object: flash, ttl: 0.11, maxTtl: 0.11, grow: 10, baseOpacity: 0.62 });
}

/** LiqingZhao: ink-brush streaks + droplet particles */
function addLiqingzhaoHitFx(
  effects: TimedEffect[],
  fxGroup: THREE.Group,
  center: THREE.Vector3,
  color: number,
): void {
  const lineCount = 5;
  for (let i = 0; i < lineCount; i++) {
    const angle = (i / lineCount) * Math.PI * 2 + Math.random() * 0.6;
    const len = 0.45 + Math.random() * 0.65;
    const endPt = new THREE.Vector3(
      center.x + Math.cos(angle) * len,
      center.y + Math.random() * 0.3,
      center.z + Math.sin(angle) * len,
    );
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(center.x, center.y + 0.15, center.z),
      endPt,
    ]);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: blendTowardWhite(color, 0.12), transparent: true, blending: THREE.AdditiveBlending }),
    );
    fxGroup.add(line);
    const ttl = 0.3 + Math.random() * 0.15;
    effects.push({ object: line, ttl, maxTtl: ttl, grow: 0, baseOpacity: 0.72 });
  }
  const count = 20;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = center.x + (Math.random() - 0.5) * 0.1;
    positions[i * 3 + 1] = center.y + 0.1;
    positions[i * 3 + 2] = center.z + (Math.random() - 0.5) * 0.1;
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.2 + Math.random() * 2.4;
    velocities[i * 3] = Math.cos(angle) * speed;
    velocities[i * 3 + 1] = Math.random() * 2.2 + 0.5;
    velocities[i * 3 + 2] = Math.sin(angle) * speed;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const pts = new THREE.Points(
    geom,
    new THREE.PointsMaterial({
      color,
      size: 0.12,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  fxGroup.add(pts);
  effects.push({
    object: pts,
    ttl: 0.45,
    maxTtl: 0.45,
    grow: 0,
    baseOpacity: 0.8,
    tick: (dt: number) => {
      const pos = geom.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        pos[i * 3] += velocities[i * 3] * dt;
        pos[i * 3 + 1] += velocities[i * 3 + 1] * dt;
        pos[i * 3 + 2] += velocities[i * 3 + 2] * dt;
        velocities[i * 3 + 1] -= 10 * dt;
      }
      geom.attributes.position.needsUpdate = true;
    },
  });
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 8, 6),
    new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  flash.position.copy(center);
  unwindFxSquashFromPlayfieldParent(flash, fxGroup);
  fxGroup.add(flash);
  effects.push({ object: flash, ttl: 0.1, maxTtl: 0.1, grow: 7, baseOpacity: 0.52 });
}

function addPointHitBurst(
  effects: TimedEffect[],
  fxGroup: THREE.Group,
  center: THREE.Vector3,
  color: number,
  towerId: BuildId,
): void {
  const localHit = worldPointToFxGroupLocal(fxGroup, center);
  switch (towerId) {
    case "machine":
      addMachineHitFx(effects, fxGroup, localHit, color);
      break;
    case "frost":
      addFrostHitFx(effects, fxGroup, localHit, color);
      break;
    case "stellar":
      addStellarHitFx(effects, fxGroup, localHit, color);
      break;
    case "liqingzhao":
      addLiqingzhaoHitFx(effects, fxGroup, localHit, color);
      break;
    default:
      addSparkBurstImpact(effects, fxGroup, center, color, towerId === "cannon" ? 0.85 : 0.9);
  }
}

/**
 * 塔攻击：从塔口飞向目标的实体炮弹，命中后再爆炸；与伤害结算仍同步在 fireAt 内。
 * @param splashImpactRadiusWorld 有溅射时传入世界半径，否则为点目标爆炸。
 */
export function addTowerProjectileImpactFx(
  effects: TimedEffect[],
  fxGroup: THREE.Group,
  from: THREE.Vector3,
  to: THREE.Vector3,
  towerColor: number,
  towerId: BuildId,
  splashImpactRadiusWorld?: number,
): void {
  const fromL = worldPointToFxGroupLocal(fxGroup, from);
  const toL = worldPointToFxGroupLocal(fxGroup, to);
  const dir = new THREE.Vector3().subVectors(toL, fromL);
  const dist = dir.length();
  if (dist < 0.025) {
    if (splashImpactRadiusWorld !== undefined && splashImpactRadiusWorld > 0) {
      addExplosionEffect(effects, fxGroup, to.clone(), splashImpactRadiusWorld, towerColor);
    } else {
      addPointHitBurst(effects, fxGroup, to.clone(), towerColor, towerId);
    }
    return;
  }

  const speed = towerFlightSpeed(towerId);
  const travel = THREE.MathUtils.clamp(dist / speed, 0.07, 0.36);
  const nd = dir.clone().divideScalar(dist);
  const arcLift = THREE.MathUtils.clamp(0.34 + dist * 0.072, 0.3, 2.35);

  const group = new THREE.Group();
  const core = makeProjectileMesh(towerId, towerColor, fxGroup);
  group.add(core);

  const trail = new THREE.Points(
    new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3),
    ),
    new THREE.PointsMaterial({
      color: blendTowardWhite(towerColor, 0.12),
      size: 0.24,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }),
  );
  trail.position.set(0, 0, 0);
  group.add(trail);

  group.position.copy(fromL.clone().addScaledVector(nd, 0.05));
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nd);
  fxGroup.add(group);

  let age = 0;
  let impactDone = false;
  const fromC = fromL.clone();
  const toC = toL.clone();

  const flightEffect: TimedEffect = {
    object: group,
    ttl: travel + 0.04,
    maxTtl: travel + 0.04,
    grow: 0,
    suppressOpacityFade: true,
    tick: (dt: number) => {
      if (flightEffect.runtimeDisposed) {
        return;
      }
      age += dt;
      const p = Math.min(age / travel, 1);
      const wp = Math.min(p + Math.max(0.028, travel * 0.02), 1);
      const yArc = Math.sin(Math.PI * p) * arcLift;
      const yArcN = Math.sin(Math.PI * wp) * arcLift;
      group.position.set(
        THREE.MathUtils.lerp(fromC.x, toC.x, p),
        fromC.y + (toC.y - fromC.y) * p + yArc,
        THREE.MathUtils.lerp(fromC.z, toC.z, p),
      );
      const nextX = THREE.MathUtils.lerp(fromC.x, toC.x, wp);
      const nextY = fromC.y + (toC.y - fromC.y) * wp + yArcN;
      const nextZ = THREE.MathUtils.lerp(fromC.z, toC.z, wp);
      const tang = new THREE.Vector3().set(nextX - group.position.x, nextY - group.position.y, nextZ - group.position.z);
      if (tang.lengthSq() > 1e-8) {
        group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tang.normalize());
      }
      if (p >= 1 && !impactDone) {
        impactDone = true;
        if (splashImpactRadiusWorld !== undefined && splashImpactRadiusWorld > 0) {
          addExplosionEffect(effects, fxGroup, to.clone(), splashImpactRadiusWorld, towerColor);
        } else {
          addPointHitBurst(effects, fxGroup, to.clone(), towerColor, towerId);
        }
      }
      if (p >= 1 && impactDone) {
        flightEffect.runtimeDisposed = true;
        fxGroup.remove(group);
        disposeObject3D(group);
      }
    },
  };
  effects.push(flightEffect);
}

export function addBeamEffect(
  effects: TimedEffect[],
  fxGroup: THREE.Group,
  from: THREE.Vector3,
  to: THREE.Vector3,
  color: number,
  lineOpacity = 0.82,
  ttl = 0.12,
): void {
  const fromL = worldPointToFxGroupLocal(fxGroup, from);
  const toL = worldPointToFxGroupLocal(fxGroup, to);
  const geometry = new THREE.BufferGeometry().setFromPoints([fromL, toL]);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: lineOpacity,
  });
  const line = new THREE.Line(geometry, material);
  const group = new THREE.Group();
  group.add(line);

  const dir = new THREE.Vector3().subVectors(toL, fromL);
  const length = dir.length();
  if (length > 0.001) {
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, length, 8),
      new THREE.MeshBasicMaterial({
        color: blendTowardWhite(color, 0.18),
        transparent: true,
        opacity: Math.min(0.62, lineOpacity),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    tube.position.copy(fromL).addScaledVector(dir, 0.5);
    tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    unwindFxSquashFromPlayfieldParent(tube, fxGroup);
    group.add(tube);
  }

  fxGroup.add(group);
  effects.push({ object: group, ttl, maxTtl: ttl, grow: 0, baseOpacity: 0.82 });
}

function addSparkBurstImpact(
  effects: TimedEffect[],
  fxGroup: THREE.Group,
  center: THREE.Vector3,
  color: number,
  impactScale = 1,
): void {
  const c = worldPointToFxGroupLocal(fxGroup, center);
  const sc = THREE.MathUtils.clamp(impactScale, 0.45, 4);
  const count = Math.floor(42 + sc * 18);
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = c.x + (Math.random() - 0.5) * 0.05;
    positions[i * 3 + 1] = c.y + (Math.random() - 0.5) * 0.12;
    positions[i * 3 + 2] = c.z + (Math.random() - 0.5) * 0.05;
    const vx = (Math.random() - 0.5) * 5.5 * sc;
    const vy = Math.random() * 4.2 + 1.2 * sc;
    const vz = (Math.random() - 0.5) * 5.5 * sc;
    velocities[i * 3] = vx;
    velocities[i * 3 + 1] = vy;
    velocities[i * 3 + 2] = vz;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: blendTowardWhite(color, 0.08),
    size: Math.min(0.065, 0.025 + sc * 0.012),
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geom, mat);
  fxGroup.add(points);

  const maxTtl = 0.68;
  effects.push({
    object: points,
    ttl: maxTtl,
    maxTtl,
    grow: 0,
    baseOpacity: 0.92,
    tick: (dt: number) => {
      const pos = geom.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i += 1) {
        pos[i * 3] += velocities[i * 3] * dt;
        pos[i * 3 + 1] += velocities[i * 3 + 1] * dt;
        pos[i * 3 + 2] += velocities[i * 3 + 2] * dt;
        velocities[i * 3 + 1] -= 16 * dt;
      }
      geom.attributes.position.needsUpdate = true;
    },
  });

  // Flash burst — no flat ring here to avoid white blowout from stacking
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.14 * sc, 8, 6),
    new THREE.MeshBasicMaterial({
      color: blendTowardWhite(color, 0.22),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  flash.position.copy(c.clone().add(new THREE.Vector3(0, 0.1, 0)));
  unwindFxSquashFromPlayfieldParent(flash, fxGroup);
  fxGroup.add(flash);
  effects.push({ object: flash, ttl: 0.1, maxTtl: 0.1, grow: 9, baseOpacity: 0.68 });
}

export function addAuroraLaserEffect(
  effects: TimedEffect[],
  fxGroup: THREE.Group,
  from: THREE.Vector3,
  to: THREE.Vector3,
): void {
  const fromL = worldPointToFxGroupLocal(fxGroup, from);
  const toL = worldPointToFxGroupLocal(fxGroup, to);
  const group = new THREE.Group();
  const colors = [0x7ff8ff, 0xff4fd8, 0xd9ff00];
  colors.forEach((color, index) => {
    const offset = (index - 1) * 0.12;
    const o = new THREE.Vector3(offset, 0, -offset);
    const p0 = worldPointToFxGroupLocal(fxGroup, from.clone().add(o));
    const p1 = worldPointToFxGroupLocal(fxGroup, to.clone().add(o));
    const geometry = new THREE.BufferGeometry().setFromPoints([p0, p1]);
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: index === 0 ? 1 : 0.72,
    });
    group.add(new THREE.Line(geometry, material));
  });

  const beamDir = new THREE.Vector3().subVectors(toL, fromL);
  const beamLen = beamDir.length();
  const length = distanceXZ(fromL, toL);
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.18, length > 1e-5 ? length : 0.01),
    new THREE.MeshBasicMaterial({ color: 0x7ff8ff, transparent: true, opacity: 0.42 }),
  );
  unwindFxSquashFromPlayfieldParent(core, fxGroup);
  core.position.copy(new THREE.Vector3().lerpVectors(fromL, toL, 0.5));
  if (beamLen > 1e-6) {
    core.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), beamDir.clone().normalize());
  }
  group.add(core);

  fxGroup.add(group);
  effects.push({ object: group, ttl: 0.55, maxTtl: 0.55, grow: 0.04, baseOpacity: 0.82 });
}

export function addExplosionEffect(
  effects: TimedEffect[],
  fxGroup: THREE.Group,
  center: THREE.Vector3,
  radius: number,
  color: number,
): void {
  // No torus ring — addExplosionEffect is called for splash towers that fire rapidly;
  // a ring would stack and blowout to white. Sparks are sufficient.
  addSparkBurstImpact(effects, fxGroup, center, color, Math.min(3.2, radius * 0.52));
}

export function addMuzzleFlashEffect(
  effects: TimedEffect[],
  fxGroup: THREE.Group,
  position: THREE.Vector3,
  color: number = 0xffaa00
): void {
  const spriteMap = new THREE.TextureLoader().load('/Arts/Effects/muzzle_flash.png');
  const spriteMaterial = new THREE.SpriteMaterial({ 
    map: spriteMap, 
    color, 
    transparent: true, 
    blending: THREE.AdditiveBlending 
  });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.position.copy(worldPointToFxGroupLocal(fxGroup, position));
  const sfx = fxGroup.scale.x;
  const sfxOk =
    sfx > 1.001 && Math.abs(sfx - fxGroup.scale.z) < 0.02 && fxGroup.scale.y <= 1.05;
  sprite.scale.set(0.8 * (sfxOk ? 1 / sfx : 1), 0.8, 1);
  fxGroup.add(sprite);
  effects.push({ object: sprite, ttl: 0.08, maxTtl: 0.08, grow: 1.5 });
}

export function addTrailEffect(
  effects: TimedEffect[],
  fxGroup: THREE.Group,
  from: THREE.Vector3,
  to: THREE.Vector3,
  color: number = 0xffffff,
  lineOpacity = 0.42,
): void {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    worldPointToFxGroupLocal(fxGroup, from.clone()),
    worldPointToFxGroupLocal(fxGroup, to.clone()),
  ]);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: lineOpacity,
    blending: THREE.AdditiveBlending,
  });
  const line = new THREE.Line(geometry, material);
  fxGroup.add(line);
  effects.push({ object: line, ttl: 0.2, maxTtl: 0.2, grow: 0 });
}

export function addStatusOutlineEffect(
  effects: TimedEffect[],
  fxGroup: THREE.Group,
  target: THREE.Object3D,
  color: number,
  ttl: number = 0.5
): void {
  const group = new THREE.Group();
  target.traverse((child) => {
    if (child instanceof THREE.Mesh && child.visible && !child.userData.isRangeRing && !child.userData.isEnemyHealthBar) {
      const geo = child.geometry;
      if (!geo) {
        return;
      }
      const outline = new THREE.Mesh(
        geo.clone(),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.4,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending
        })
      );
      outline.scale.copy(child.scale).multiplyScalar(1.15);
      outline.position.copy(child.position);
      outline.rotation.copy(child.rotation);
      group.add(outline);
    }
  });
  group.position.copy(target.position);
  group.rotation.copy(target.rotation);
  fxGroup.add(group);
  effects.push({ object: group, ttl, maxTtl: ttl, grow: 0.05, baseOpacity: 0.4 });
}

function disposeObject3D(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh | THREE.Line | THREE.Points;
    if ((mesh as THREE.Mesh).geometry) {
      (mesh as THREE.Mesh).geometry.dispose();
    }
    const mats = (mesh as THREE.Mesh).material;
    if (mats) {
      const list = Array.isArray(mats) ? mats : [mats];
      for (const m of list) (m as THREE.Material).dispose();
    }
  });
}

/** 防止特效条目丢失时 fxGroup 里残留网格（会导致“只有切换模式全清才消失”）。 */
function pruneFxGroupOrphans(fxGroup: THREE.Group, effects: TimedEffect[]): void {
  const keep = new Set<THREE.Object3D>();
  for (const e of effects) {
    keep.add(e.object);
  }
  const extras = fxGroup.children.filter((ch) => !keep.has(ch));
  for (const ch of extras) {
    fxGroup.remove(ch);
    disposeObject3D(ch);
  }
}

export function updateTimedEffects(effects: TimedEffect[], fxGroup: THREE.Group, dt: number): TimedEffect[] {
  const nextEffects: TimedEffect[] = [];
  /**
   * 必须用下标遍历：炮弹 tick 内会同步 push 命中火花 / 环等到同一数组；
   * for...of 会漏掉这些新条目，导致 nextEffects 丢失引用、网格永不 dispose（尤其关闭 GEO 底板时更明显）。
   */
  let i = 0;
  while (i < effects.length) {
    const effect = effects[i];
    i += 1;
    effect.tick?.(dt);
    effect.ttl -= dt;
    if (!Number.isFinite(effect.ttl)) {
      effect.ttl = 0;
    }
    const denom = effect.maxTtl > 0 && Number.isFinite(effect.maxTtl) ? effect.maxTtl : 1;
    const alpha = Math.max(effect.ttl / denom, 0);
    if (!effect.suppressOpacityFade) {
      // Use baseOpacity so rings fade from their designed peak opacity, not from 1.0
      const displayOpacity = effect.baseOpacity !== undefined ? effect.baseOpacity * alpha : alpha;
      setObjectOpacity(effect.object, displayOpacity);
    }
    if (effect.grow > 0) {
      const scale = 1 + (1 - alpha) * effect.grow;
      effect.object.scale.setScalar(scale);
    }
    if (effect.ttl <= 0) {
      if (!effect.runtimeDisposed) {
        fxGroup.remove(effect.object);
        disposeObject3D(effect.object);
      }
    } else {
      nextEffects.push(effect);
    }
  }
  pruneFxGroupOrphans(fxGroup, nextEffects);
  return nextEffects;
}
