import * as THREE from "three";

const LOCOMOTION_KEYS = ["idle", "walk", "run"] as const;
const LOCOMOTION_KEY_SET = new Set<string>(LOCOMOTION_KEYS);

/** AnimationMixer lifecycle for exploration third-person locomotion clips. */
export class PlayerExploreAnimator {
  private mixer?: THREE.AnimationMixer;
  private actions: Record<string, THREE.AnimationAction> = {};
  private activeAction?: THREE.AnimationAction;
  private pendingLocomotion = "idle";
  private transientActionType = "";

  clear(): void {
    this.mixer = undefined;
    this.actions = {};
    this.activeAction = undefined;
    this.pendingLocomotion = "idle";
    this.transientActionType = "";
  }

  attachTo(playerRoot: THREE.Group, clips: Record<string, THREE.AnimationClip>): void {
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

  fadeTo(type: string, duration = 0.25, force = false): void {
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

  playAction(type: string, fadeDuration = 0.12): boolean {
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

  update(dt: number): void {
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
