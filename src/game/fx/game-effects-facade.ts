import * as THREE from "three";

import {
  addAuroraLaserEffect,
  addBeamEffect,
  addExplosionEffect,
  updateTimedEffects,
} from "./effects-runtime";
import type { TimedEffect } from "../core/types";

/** 将宿主 `effects` / `fxGroup` 收口为统一入口，便于塔防与其他系统注入同一套 FX。 */
export class GameEffectsFacade {
  constructor(
    private readonly fxGroup: THREE.Group,
    private readonly getEffects: () => TimedEffect[],
    private readonly setEffects: (next: TimedEffect[]) => void,
  ) {}

  addBeam(from: THREE.Vector3, to: THREE.Vector3, color: number): void {
    addBeamEffect(this.getEffects(), this.fxGroup, from, to, color);
  }

  addAuroraLaser(from: THREE.Vector3, to: THREE.Vector3): void {
    addAuroraLaserEffect(this.getEffects(), this.fxGroup, from, to);
  }

  addExplosion(center: THREE.Vector3, radius: number, color: number): void {
    addExplosionEffect(this.getEffects(), this.fxGroup, center, radius, color);
  }

  tick(dt: number): void {
    this.setEffects(updateTimedEffects(this.getEffects(), this.fxGroup, dt));
  }
}
