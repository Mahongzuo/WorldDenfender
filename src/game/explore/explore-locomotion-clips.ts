import * as THREE from "three";

/** Merges idle/walk/run clips from embedded GLTF animations into `destination`. */
export function mergeEmbeddedExplorationLocomotion(
  destination: Record<string, THREE.AnimationClip>,
  clips: Iterable<THREE.AnimationClip>,
): void {
  for (const clip of clips) {
    const name = clip.name.toLowerCase();
    if (name.includes("idle") || name.includes("stand")) destination.idle = clip;
    if (name.includes("walk")) destination.walk = clip;
    if (name.includes("run")) destination.run = clip;
  }
}
