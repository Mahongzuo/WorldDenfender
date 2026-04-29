import * as THREE from "three";

import { setObjectOpacity } from "./browser-utils";
import { distanceXZ } from "./runtime-grid";
import type { BuildId, TimedEffect } from "./types";

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

function makeProjectileMesh(buildId: BuildId, color: number): THREE.Mesh {
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
  });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.castShadow = false;
  return mesh;
}

function addPointHitBurst(
  effects: TimedEffect[],
  fxGroup: THREE.Group,
  center: THREE.Vector3,
  color: number,
  towerId: BuildId,
): void {
  const impactScale =
    towerId === "machine"
      ? 0.78
      : towerId === "frost"
        ? 0.95
        : towerId === "stellar"
          ? 1.12
          : towerId === "liqingzhao"
            ? 1.18
            : 0.9;
  addSparkBurstImpact(effects, fxGroup, center, color, impactScale);
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
  const dir = new THREE.Vector3().subVectors(to, from);
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
  const core = makeProjectileMesh(towerId, towerColor);
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

  group.position.copy(from.clone().addScaledVector(nd, 0.05));
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nd);
  fxGroup.add(group);

  let age = 0;
  let impactDone = false;
  const fromC = from.clone();
  const toC = to.clone();

  const muzzle = new THREE.Sprite(
    new THREE.SpriteMaterial({
      color: towerColor,
      transparent: true,
      opacity: 0.66,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  muzzle.scale.set(0.86, 0.86, 1);
  muzzle.position.copy(fromC);
  fxGroup.add(muzzle);
  effects.push({ object: muzzle, ttl: 0.08, maxTtl: 0.08, grow: 2.2 });

  effects.push({
    object: group,
    ttl: travel + 0.04,
    maxTtl: travel + 0.04,
    grow: 0,
    suppressOpacityFade: true,
    tick: (dt: number) => {
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
          addExplosionEffect(effects, fxGroup, toC.clone(), splashImpactRadiusWorld, towerColor);
        } else {
          addPointHitBurst(effects, fxGroup, toC.clone(), towerColor, towerId);
        }
      }
    },
  });
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
  const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: lineOpacity,
  });
  const line = new THREE.Line(geometry, material);
  const group = new THREE.Group();
  group.add(line);

  const dir = new THREE.Vector3().subVectors(to, from);
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
    tube.position.copy(from).addScaledVector(dir, 0.5);
    tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    group.add(tube);
  }

  fxGroup.add(group);
  effects.push({ object: group, ttl, maxTtl: ttl, grow: 0 });
}

function addSparkBurstImpact(
  effects: TimedEffect[],
  fxGroup: THREE.Group,
  center: THREE.Vector3,
  color: number,
  impactScale = 1,
): void {
  const sc = THREE.MathUtils.clamp(impactScale, 0.45, 4);
  const count = Math.floor(42 + sc * 18);
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = center.x + (Math.random() - 0.5) * 0.05;
    positions[i * 3 + 1] = center.y + (Math.random() - 0.5) * 0.12;
    positions[i * 3 + 2] = center.z + (Math.random() - 0.5) * 0.05;
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
    color: blendTowardWhite(color, 0.16),
    size: Math.min(0.32, 0.11 + sc * 0.045),
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

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.12 * sc, 0.44 * sc, 32),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  ring.position.copy(center.clone().add(new THREE.Vector3(0, 0.04, 0)));
  ring.rotation.x = -Math.PI / 2;
  fxGroup.add(ring);
  effects.push({ object: ring, ttl: 0.35, maxTtl: 0.35, grow: 3.4 });

  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.13 * sc, 8, 6),
    new THREE.MeshBasicMaterial({
      color: blendTowardWhite(color, 0.22),
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  flash.position.copy(center.clone().add(new THREE.Vector3(0, 0.1, 0)));
  fxGroup.add(flash);
  effects.push({ object: flash, ttl: 0.09, maxTtl: 0.09, grow: 8 });
}

export function addAuroraLaserEffect(
  effects: TimedEffect[],
  fxGroup: THREE.Group,
  from: THREE.Vector3,
  to: THREE.Vector3,
): void {
  const group = new THREE.Group();
  const colors = [0x7ff8ff, 0xff4fd8, 0xd9ff00];
  colors.forEach((color, index) => {
    const offset = (index - 1) * 0.12;
    const geometry = new THREE.BufferGeometry().setFromPoints([
      from.clone().add(new THREE.Vector3(offset, 0, -offset)),
      to.clone().add(new THREE.Vector3(offset, 0, -offset)),
    ]);
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: index === 0 ? 1 : 0.72,
    });
    group.add(new THREE.Line(geometry, material));
  });

  const center = from.clone().lerp(to, 0.5);
  const length = distanceXZ(from, to);
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.18, length),
    new THREE.MeshBasicMaterial({ color: 0x7ff8ff, transparent: true, opacity: 0.42 }),
  );
  core.position.copy(center);
  core.lookAt(to);
  group.add(core);

  fxGroup.add(group);
  effects.push({ object: group, ttl: 0.55, maxTtl: 0.55, grow: 0.04 });
}

export function addExplosionEffect(
  effects: TimedEffect[],
  fxGroup: THREE.Group,
  center: THREE.Vector3,
  radius: number,
  color: number,
): void {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.06, 8, 60),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(center.x, 0.16, center.z);
  fxGroup.add(ring);
  effects.push({ object: ring, ttl: 0.45, maxTtl: 0.45, grow: 0.9 });

  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.35, 0.04, 8, 48),
    new THREE.MeshBasicMaterial({
      color: blendTowardWhite(color, 0.28),
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  ring2.rotation.x = Math.PI / 2;
  ring2.position.set(center.x, 0.18, center.z);
  fxGroup.add(ring2);
  effects.push({ object: ring2, ttl: 0.55, maxTtl: 0.55, grow: 1.1 });

  addSparkBurstImpact(effects, fxGroup, center, color, Math.min(3.8, radius * 0.58));
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
  sprite.position.copy(position);
  sprite.scale.set(0.8, 0.8, 1);
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
  const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
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
    if (child instanceof THREE.Mesh) {
      const outline = new THREE.Mesh(
        child.geometry,
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
  effects.push({ object: group, ttl, maxTtl: ttl, grow: 0.05 });
}

export function updateTimedEffects(effects: TimedEffect[], fxGroup: THREE.Group, dt: number): TimedEffect[] {
  const nextEffects: TimedEffect[] = [];
  for (const effect of effects) {
    effect.tick?.(dt);
    effect.ttl -= dt;
    const alpha = Math.max(effect.ttl / effect.maxTtl, 0);
    if (!effect.suppressOpacityFade) {
      setObjectOpacity(effect.object, alpha);
    }
    if (effect.grow > 0) {
      const scale = 1 + (1 - alpha) * effect.grow;
      effect.object.scale.setScalar(scale);
    }
    if (effect.ttl <= 0) {
      fxGroup.remove(effect.object);
    } else {
      nextEffects.push(effect);
    }
  }
  return nextEffects;
}
