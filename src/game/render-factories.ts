import * as THREE from "three";

import { TILE_SIZE } from "./runtime-grid";
import type { BuildSpec, ModelTarget } from "./types";

export function createBuildingMesh(options: {
  spec: BuildSpec;
  customModel?: THREE.Group;
  getClampedUserScale: (target: ModelTarget) => number;
  isBeijing?: boolean;
}): THREE.Group {
  const { spec, customModel, getClampedUserScale, isBeijing } = options;
  if (customModel) {
    return createCustomBuildingMesh(spec, customModel, getClampedUserScale(spec.id));
  }
  if (isBeijing) {
    return createSpriteTowerMesh(spec);
  }
  if (spec.id === "mine") {
    return createMineMesh(spec);
  }
  if (spec.id === "beacon") {
    return createBeaconMesh(spec);
  }
  return createTowerMesh(spec);
}

export function createSpriteTowerMesh(spec: BuildSpec): THREE.Group {
  const group = new THREE.Group();
  const color = spec.color;
  
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.78, 0.15, 8),
    new THREE.MeshStandardMaterial({ 
      color: 0x1a2b3c, 
      roughness: 0.68,
      emissive: color,
      emissiveIntensity: 0.1
    })
  );
  base.position.y = 0.08;
  base.receiveShadow = true;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.03, 8, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.16;

  const textureLoader = new THREE.TextureLoader();
  const placeholderMap = createTowerPlaceholderTexture(color);
  const material = new THREE.SpriteMaterial({ 
    map: placeholderMap, 
    transparent: true,
    opacity: 0.7
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.y = 0.85;
  sprite.scale.set(1.8, 1.8, 1);
  
  textureLoader.load(`/Arts/Towers/tower_${spec.id}.png`, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    material.map = tex;
    material.opacity = 1.0;
    material.needsUpdate = true;
  });
  
  group.add(base, ring, sprite);
  return group;
}

function createTowerPlaceholderTexture(colorNum: number): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const color = `#${colorNum.toString(16).padStart(6, "0")}`;
  
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, color);
  grad.addColorStop(1, "transparent");
  
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(32, 32, 28, 0, Math.PI * 2);
  ctx.fill();
  
  return new THREE.CanvasTexture(canvas);
}

export function createCustomBuildingMesh(spec: BuildSpec, source: THREE.Group, scale: number): THREE.Group {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.86, 0.2, 16),
    new THREE.MeshStandardMaterial({
      color: spec.color,
      emissive: spec.color,
      emissiveIntensity: 0.08,
      roughness: 0.52,
    }),
  );
  base.position.y = 0.1;
  base.castShadow = true;
  base.receiveShadow = true;

  const model = source.clone(true);
  model.position.y = 0.22;
  model.scale.multiplyScalar(scale);
  group.add(base, model);

  if (spec.range) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(spec.range * TILE_SIZE, 0.025, 8, 72),
      new THREE.MeshBasicMaterial({ color: spec.color, transparent: true, opacity: 0.35 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.04;
    ring.visible = false;
    ring.userData.isRangeRing = true;
    group.add(ring);
  }
  return group;
}

export function createTowerMesh(spec: BuildSpec): THREE.Group {
  const group = new THREE.Group();
  const color = spec.color;
  const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x28384b, roughness: 0.68 });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.42,
    emissive: color,
    emissiveIntensity: 0.1,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.78, 0.38, 8), baseMaterial);
  base.position.y = 0.2;
  base.castShadow = true;
  base.receiveShadow = true;

  const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.48, 0.48, 12), accentMaterial);
  turret.position.y = 0.65;
  turret.castShadow = true;

  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.9), accentMaterial);
  barrel.position.set(0, 0.72, -0.54);
  barrel.castShadow = true;

  if (spec.id === "cannon") {
    turret.scale.setScalar(1.18);
    barrel.scale.set(1.35, 1.35, 1.2);
  }
  if (spec.id === "frost") {
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.34), accentMaterial);
    crystal.position.y = 1.08;
    crystal.castShadow = true;
    group.add(crystal);
  }
  if (spec.id === "stellar") {
    turret.scale.setScalar(1.22);
    barrel.scale.set(1.1, 1.1, 1.45);
    const prism = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 1), accentMaterial);
    prism.position.y = 1.18;
    prism.castShadow = true;
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.78, 0.035, 8, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.65 }),
    );
    halo.position.y = 1.18;
    halo.rotation.x = Math.PI / 2;
    group.add(prism, halo);
  }

  group.add(base, turret, barrel);
  return group;
}

export function createMineMesh(spec: BuildSpec): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: spec.color,
    emissive: spec.color,
    emissiveIntensity: 0.15,
    roughness: 0.35,
  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.52, 0.16, 12), material);
  body.position.y = 0.12;
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), material);
  top.position.y = 0.28;
  group.add(body, top);
  return group;
}

export function createBeaconMesh(spec: BuildSpec): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: spec.color,
    emissive: spec.color,
    emissiveIntensity: 0.22,
    roughness: 0.35,
  });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 0.28, 10), material);
  base.position.y = 0.16;
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), material);
  core.position.y = 0.72;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry((spec.buffRange ?? 3) * TILE_SIZE, 0.035, 8, 72),
    new THREE.MeshBasicMaterial({ color: spec.color, transparent: true, opacity: 0.45 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.06;
  ring.visible = false;
  ring.userData.isRangeRing = true;
  group.add(base, core, ring);
  return group;
}

export function createFallbackPlayerMesh(): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.34, 0.72, 5, 10),
    new THREE.MeshStandardMaterial({ color: 0x4bb6ff, roughness: 0.45 }),
  );
  body.position.y = 0.62;
  body.castShadow = true;

  const pointer = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.45, 4),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x204c8f, emissiveIntensity: 0.25 }),
  );
  pointer.position.set(0, 1.28, -0.35);
  pointer.rotation.x = Math.PI / 2;

  group.add(body, pointer);
  return group;
}

export function createMoneyDropMesh(options: {
  amount: number;
  customDropModel: THREE.Group | null;
  getClampedUserScale: (target: ModelTarget) => number;
}): THREE.Group {
  const { amount, customDropModel, getClampedUserScale } = options;
  const group = new THREE.Group();
  const color = amount >= 200 ? 0xff80d5 : amount >= 100 ? 0xfff06a : 0x8cff78;
  if (customDropModel) {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.5, 0.12, 16),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.12 }),
    );
    base.position.y = 0.06;
    const model = customDropModel.clone(true);
    model.position.y = 0.16;
    model.scale.multiplyScalar(getClampedUserScale("moneyDrop"));
    group.add(base, model);
    group.scale.setScalar(amount >= 200 ? 1.2 : amount >= 100 ? 1.06 : 0.92);
    return group;
  }

  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.2,
    roughness: 0.35,
    metalness: 0.2,
  });
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.12, 20), material);
  coin.rotation.x = Math.PI / 2;
  coin.castShadow = true;
  const glow = new THREE.Mesh(
    new THREE.TorusGeometry(0.56, 0.035, 8, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45 }),
  );
  glow.rotation.x = Math.PI / 2;
  group.add(coin, glow);
  group.scale.setScalar(amount >= 200 ? 1.22 : amount >= 100 ? 1.08 : 1);
  return group;
}
