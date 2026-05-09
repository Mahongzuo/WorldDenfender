import * as THREE from "three";

import type { TimedEffect } from "../core/types";
import { worldPointToFxGroupLocal } from "./fx-coordinate-space";

export interface DamageFloatOptions {
  critical?: boolean;
}

function buildDamageLabelCanvas(amount: number, critical: boolean): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  const w = critical ? 512 : 336;
  const h = critical ? 200 : 128;
  const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const texFail = new THREE.CanvasTexture(canvas);
    return texFail;
  }
  ctx.scale(dpr, dpr);

  const display = Math.round(amount).toString();
  ctx.clearRect(0, 0, w, h);

  if (critical) {
    ctx.font = `900 40px ui-sans-serif, "Segoe UI","Microsoft YaHei",sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const gradCrit = ctx.createLinearGradient(w * 0.5, 0, w * 0.5, 56);
    gradCrit.addColorStop(0, "#fff8a8");
    gradCrit.addColorStop(0.5, "#ffcc22");
    gradCrit.addColorStop(1, "#ff5a08");
    ctx.strokeStyle = "rgba(96,12,12,0.92)";
    ctx.lineWidth = 6;
    ctx.lineJoin = "round";
    const critLine = "\u7206\u51fb"; // 暴击
    ctx.strokeText(critLine, w / 2, 8);
    ctx.fillStyle = gradCrit;
    ctx.fillText(critLine, w / 2, 8);

    const numGrad = ctx.createLinearGradient(w * 0.5, 56, w * 0.5, 190);
    numGrad.addColorStop(0, "#ffffff");
    numGrad.addColorStop(0.35, "#fffb00");
    numGrad.addColorStop(1, "#ff6600");

    ctx.font = `900 96px ui-sans-serif, "Segoe UI","Microsoft YaHei",sans-serif`;
    ctx.textBaseline = "alphabetic";
    ctx.strokeStyle = "rgba(80, 0, 12, 0.95)";
    ctx.lineWidth = 10;
    ctx.strokeText(display, w / 2, h * 0.56);
    ctx.fillStyle = numGrad;
    ctx.fillText(display, w / 2, h * 0.56);
  } else {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const grad = ctx.createLinearGradient(w * 0.5, 28, w * 0.5, h - 28);
    grad.addColorStop(0, "#fff5d9");
    grad.addColorStop(0.48, "#ffdd88");
    grad.addColorStop(1, "#ffaa55");
    ctx.font = `800 76px ui-sans-serif, "Segoe UI","Microsoft YaHei",sans-serif`;
    ctx.strokeStyle = "rgba(28,14,42,0.88)";
    ctx.lineWidth = 8;
    ctx.lineJoin = "round";
    ctx.strokeText(display, w / 2, h * 0.5);
    ctx.fillStyle = grad;
    ctx.fillText(display, w / 2, h * 0.5);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * 在场景内上浮的伤害数字 Sprite；塔防暴击使用更大画布与饱和度更高的配色。
 */
export function addDamageFloatEffect(
  effects: TimedEffect[],
  fxGroup: THREE.Group,
  worldCenter: THREE.Vector3,
  amount: number,
  options?: DamageFloatOptions,
): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    return;
  }

  const critical = Boolean(options?.critical);

  const position = worldCenter.clone();
  position.y += 0.85 + Math.random() * 0.35;
  position.x += (Math.random() - 0.45) * 0.42;
  position.z += (Math.random() - 0.45) * 0.42;

  const texture = buildDamageLabelCanvas(amount, critical);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      fog: false,
      blending: critical ? THREE.AdditiveBlending : THREE.NormalBlending,
    }),
  );
  sprite.renderOrder = 48;
  sprite.center.set(0.5, critical ? 0.38 : 0.42);
  sprite.position.copy(worldPointToFxGroupLocal(fxGroup, position));

  const aspect = texture.image.width / Math.max(texture.image.height, 1);
  const worldH = critical ? 2.05 : 1.25;
  const sfx = fxGroup.scale.x;
  const sfxOk =
    sfx > 1.001 && Math.abs(sfx - fxGroup.scale.z) < 0.02 && fxGroup.scale.y <= 1.05;
  const ix = sfxOk ? 1 / sfx : 1;
  const baseScale = new THREE.Vector3(worldH * aspect * ix, worldH, 1);

  let vy = critical ? 3.45 : 2.72;
  const driftX = (Math.random() - 0.5) * 0.82;
  const driftZ = (Math.random() - 0.5) * 0.82;
  let age = 0;
  const maxTtl = critical ? 0.92 : 0.74;

  sprite.scale.copy(baseScale);
  fxGroup.add(sprite);

  effects.push({
    object: sprite,
    ttl: maxTtl,
    maxTtl,
    grow: 0,
    baseOpacity: 1,
    tick: (dt: number) => {
      age += dt;
      sprite.position.y += vy * dt;
      vy = Math.max(0.92, vy - 7.8 * dt);
      sprite.position.x += driftX * dt;
      sprite.position.z += driftZ * dt;
      let pop = 1;
      if (critical) {
        const t = THREE.MathUtils.clamp(age / 0.12, 0, 1);
        pop = THREE.MathUtils.lerp(1.45, 1, t * t);
      }
      sprite.scale.set(baseScale.x * pop, baseScale.y * pop, 1);
    },
  });
}
