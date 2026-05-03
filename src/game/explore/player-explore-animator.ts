import * as THREE from "three";

const LOCOMOTION_KEYS = ["idle", "walk", "run"] as const;

/** AnimationMixer lifecycle for exploration third-person locomotion clips. */
export class PlayerExploreAnimator {
  private mixer?: THREE.AnimationMixer;
  private actions: Record<string, THREE.AnimationAction> = {};
  private activeAction?: THREE.AnimationAction;

  clear(): void {
    this.mixer = undefined;
    this.actions = {};
    this.activeAction = undefined;
  }

  attachTo(playerRoot: THREE.Group, clips: Record<string, THREE.AnimationClip>): void {
    this.clear();
    const mixer = new THREE.AnimationMixer(playerRoot);
    this.mixer = mixer;
    for (const key of LOCOMOTION_KEYS) {
      const clip = clips[key];
      if (clip) {
        this.actions[key] = mixer.clipAction(clip);
      }
    }
    if (this.actions.idle) {
      this.activeAction = this.actions.idle;
      this.activeAction.play();
    }
  }

  fadeTo(type: string, duration = 0.25): void {
    const nextAction = this.actions[type];
    if (!nextAction || nextAction === this.activeAction) {
      return;
    }
    if (this.activeAction) {
      this.activeAction.fadeOut(duration);
    }
    nextAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(duration).play();
    this.activeAction = nextAction;
  }

  update(dt: number): void {
    this.mixer?.update(dt);
  }
}
