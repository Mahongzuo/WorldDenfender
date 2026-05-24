import { addAuroraLaserEffect, addBeamEffect, addExplosionEffect, updateTimedEffects, } from "./effects-runtime";
import { addDamageFloatEffect } from "./damage-float-effect";
/** 将宿主 `effects` / `fxGroup` 收口为统一入口，便于塔防与其他系统注入同一套 FX。 */
export class GameEffectsFacade {
    constructor(fxGroup, getEffects, setEffects) {
        Object.defineProperty(this, "fxGroup", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: fxGroup
        });
        Object.defineProperty(this, "getEffects", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: getEffects
        });
        Object.defineProperty(this, "setEffects", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: setEffects
        });
    }
    addBeam(from, to, color) {
        addBeamEffect(this.getEffects(), this.fxGroup, from, to, color);
    }
    addAuroraLaser(from, to) {
        addAuroraLaserEffect(this.getEffects(), this.fxGroup, from, to);
    }
    addExplosion(center, radius, color) {
        addExplosionEffect(this.getEffects(), this.fxGroup, center, radius, color);
    }
    spawnDamageFloat(worldCenter, damage, options) {
        addDamageFloatEffect(this.getEffects(), this.fxGroup, worldCenter, damage, options);
    }
    tick(dt) {
        this.setEffects(updateTimedEffects(this.getEffects(), this.fxGroup, dt));
    }
}
