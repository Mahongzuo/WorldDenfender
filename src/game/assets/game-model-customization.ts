import type { AnimationClip, Group } from "three";

import type { AssetLoaderDependencies, LoadedAssetConfig } from "./asset-loading";
import {
  applyModelScalesFromRecord as applyPersistedModelScales,
  createDefaultModelScales,
  getClampedUserScale as getPersistedUserScale,
  loadCustomAnimationsFromEditorUrls,
  loadModelFromUrl,
} from "./asset-loading";
import { mergeEmbeddedExplorationLocomotion } from "../explore/explore-locomotion-clips";
import type { BuildId, BuildSpec, ModelTarget } from "../core/types";

/**
 * User-defined meshes, scale overrides (editor), and exploration locomotion clips.
 */
export class GameModelCustomization {
  modelScales: Partial<Record<ModelTarget, number>>;
  customModels: Partial<Record<BuildId, Group>> = {};
  customModelUrls: Partial<Record<BuildId, string>> = {};
  customDropModel: Group | null = null;
  customDropModelUrl = "";
  customPlayerModel: Group | null = null;
  customPlayerModelUrl = "";
  customAnimations: Record<string, AnimationClip> = {};
  customAnimationUrls: Record<string, string> = {};

  constructor(private readonly buildSpecs: Record<BuildId, BuildSpec>) {
    this.modelScales = createDefaultModelScales(buildSpecs);
  }

  /** Clears runtime meshes / URLs / embedded clips — prior `startNewGame` behavior before reloading editor bundle. */
  resetForFreshRun(): void {
    this.customModels = {};
    this.customModelUrls = {};
    this.customDropModel = null;
    this.customDropModelUrl = "";
    this.customPlayerModel = null;
    this.customPlayerModelUrl = "";
    this.modelScales = createDefaultModelScales(this.buildSpecs);
    this.customAnimations = {};
  }

  assignFromLoadedEditorBundle(loaded: LoadedAssetConfig): void {
    this.modelScales = loaded.modelScales;
    this.customModelUrls = loaded.customModelUrls;
    this.customDropModelUrl = loaded.customDropModelUrl;
    this.customPlayerModelUrl = loaded.customPlayerModelUrl;
    this.customAnimationUrls = loaded.customAnimationUrls;
    this.customModels = loaded.customModels;
    this.customDropModel = loaded.customDropModel;
    this.customPlayerModel = loaded.customPlayerModel;
    this.customAnimations = loaded.customAnimations;
  }

  restoreScalesToDefaults(): void {
    this.modelScales = createDefaultModelScales(this.buildSpecs);
  }

  applyPersistedScaleRecord(record: Record<string, unknown> | null | undefined): void {
    applyPersistedModelScales(this.modelScales, this.buildSpecs, record);
  }

  getClampedScale(target: ModelTarget): number {
    return getPersistedUserScale(this.modelScales, target);
  }

  rememberModelUrl(target: ModelTarget, url: string): void {
    if (target === "moneyDrop") {
      this.customDropModelUrl = url;
      return;
    }
    if (target === "player") {
      this.customPlayerModelUrl = url;
      return;
    }
    this.customModelUrls[target] = url;
  }

  rememberAnimationUrl(kind: string, url: string): void {
    this.customAnimationUrls[kind] = url;
  }

  async restoreMeshesFromStoredUrls(loaders: AssetLoaderDependencies): Promise<void> {
    const entries = Object.entries(this.customModelUrls) as Array<[BuildId, string]>;
    await Promise.all(
      entries.map(async ([buildId, url]) => {
        if (!url) {
          return;
        }
        try {
          const model = await loadModelFromUrl(loaders, url);
          this.customModels[buildId] = model;
        } catch (error) {
          console.warn("[Game] failed to load saved custom model", buildId, url, error);
        }
      }),
    );

    if (this.customDropModelUrl) {
      try {
        this.customDropModel = await loadModelFromUrl(loaders, this.customDropModelUrl);
      } catch (error) {
        console.warn("[Game] failed to load drop model", this.customDropModelUrl, error);
      }
    }
    if (this.customPlayerModelUrl) {
      try {
        this.customPlayerModel = await loadModelFromUrl(loaders, this.customPlayerModelUrl);
      } catch (error) {
        console.warn("[Game] failed to load player model", this.customPlayerModelUrl, error);
      }
    }
  }

  async reloadAnimationsFromStoredUrls(loaders: AssetLoaderDependencies): Promise<void> {
    this.customAnimations = await loadCustomAnimationsFromEditorUrls(loaders, this.customAnimationUrls);
  }

  ingestEmbeddedLocomotionClips(clips: readonly AnimationClip[]): void {
    mergeEmbeddedExplorationLocomotion(this.customAnimations, clips);
  }

  setAnimationClip(kind: string, clip: AnimationClip): void {
    this.customAnimations[kind] = clip;
  }
}
