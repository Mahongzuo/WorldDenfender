import * as THREE from "three";
const LOCOMOTION_KEYS = ["idle", "walk", "run"];
const LOCOMOTION_KEY_SET = new Set(LOCOMOTION_KEYS);
/** AnimationMixer lifecycle for exploration third-person locomotion clips. */
export class PlayerExploreAnimator {
    constructor() {
        Object.defineProperty(this, "mixer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "actions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {}
        });
        Object.defineProperty(this, "activeAction", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "pendingLocomotion", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "idle"
        });
        Object.defineProperty(this, "transientActionType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ""
        });
    }
    clear() {
        this.mixer = undefined;
        this.actions = {};
        this.activeAction = undefined;
        this.pendingLocomotion = "idle";
        this.transientActionType = "";
    }
    attachTo(playerRoot, clips) {
        this.clear();
        const mixer = new THREE.AnimationMixer(playerRoot);
        this.mixer = mixer;
        for (const [key, clip] of Object.entries(clips)) {
            if (clip) {
                const action = mixer.clipAction(clip);
                if (!LOCOMOTION_KEY_SET.has(key)) {
                    action.setLoop(THREE.LoopOnce, 1);
                    action.clampWhenFinished = true;
                }
                this.actions[key] = action;
            }
        }
        if (this.actions.idle) {
            this.activeAction = this.actions.idle;
            this.activeAction.play();
        }
    }
    fadeTo(type, duration = 0.25, force = false) {
        if (!force && this.transientActionType && LOCOMOTION_KEY_SET.has(type)) {
            this.pendingLocomotion = type;
            return;
        }
        const nextAction = this.actions[type];
        if (!nextAction || nextAction === this.activeAction) {
            return;
        }
        this.pendingLocomotion = LOCOMOTION_KEY_SET.has(type) ? type : this.pendingLocomotion;
        if (this.activeAction) {
            this.activeAction.fadeOut(duration);
        }
        nextAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(duration).play();
        this.activeAction = nextAction;
    }
    playAction(type, fadeDuration = 0.12) {
        const nextAction = this.actions[type];
        if (!nextAction) {
            return false;
        }
        this.transientActionType = type;
        if (this.activeAction && this.activeAction !== nextAction) {
            this.activeAction.fadeOut(fadeDuration);
        }
        nextAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fadeDuration).play();
        this.activeAction = nextAction;
        return true;
    }
    update(dt) {
        this.mixer?.update(dt);
        if (!this.transientActionType) {
            return;
        }
        const action = this.actions[this.transientActionType];
        const clip = action && action.getClip ? action.getClip() : null;
        if (!action || !clip) {
            this.transientActionType = "";
            return;
        }
        if (action.time >= Math.max(0, clip.duration - 0.02)) {
            const nextLocomotion = this.pendingLocomotion || "idle";
            this.transientActionType = "";
            this.fadeTo(nextLocomotion, 0.15, true);
        }
    }
}
