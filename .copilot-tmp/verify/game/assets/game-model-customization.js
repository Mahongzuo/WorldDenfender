import { applyModelScalesFromRecord as applyPersistedModelScales, createDefaultModelScales, getClampedUserScale as getPersistedUserScale, loadCustomAnimationsFromEditorUrls, loadModelAssetFromUrl, loadModelFromUrl, } from "./asset-loading";
import { mergeEmbeddedExplorationLocomotion } from "../explore/explore-locomotion-clips";
/**
 * User-defined meshes, scale overrides (editor), and exploration locomotion clips.
 */
export class GameModelCustomization {
    constructor(buildSpecs) {
        Object.defineProperty(this, "buildSpecs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: buildSpecs
        });
        Object.defineProperty(this, "modelScales", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /** 关卡放置模型等：按路径的全局缩放（与实例 scale 相乘） */
        Object.defineProperty(this, "globalModelPathScales", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {}
        });
        Object.defineProperty(this, "customModels", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {}
        });
        Object.defineProperty(this, "customModelUrls", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {}
        });
        Object.defineProperty(this, "customDropModel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "customDropModelUrl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ""
        });
        Object.defineProperty(this, "customPlayerModel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "customPlayerModelUrl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ""
        });
        Object.defineProperty(this, "customAnimations", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {}
        });
        Object.defineProperty(this, "customAnimationUrls", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {}
        });
        this.modelScales = createDefaultModelScales(buildSpecs);
    }
    /** Clears runtime meshes / URLs / embedded clips — prior `startNewGame` behavior before reloading editor bundle. */
    resetForFreshRun() {
        this.customModels = {};
        this.customModelUrls = {};
        this.customDropModel = null;
        this.customDropModelUrl = "";
        this.customPlayerModel = null;
        this.customPlayerModelUrl = "";
        this.customAnimationUrls = {};
        this.modelScales = createDefaultModelScales(this.buildSpecs);
        this.globalModelPathScales = {};
        this.customAnimations = {};
    }
    assignFromLoadedEditorBundle(loaded) {
        this.modelScales = loaded.modelScales;
        this.globalModelPathScales = { ...(loaded.globalModelPathScales ?? {}) };
        this.customModelUrls = loaded.customModelUrls;
        this.customDropModelUrl = loaded.customDropModelUrl;
        this.customPlayerModelUrl = loaded.customPlayerModelUrl;
        this.customAnimationUrls = loaded.customAnimationUrls;
        this.customModels = loaded.customModels;
        this.customDropModel = loaded.customDropModel;
        this.customPlayerModel = loaded.customPlayerModel;
        this.customAnimations = loaded.customAnimations;
    }
    restoreScalesToDefaults() {
        this.modelScales = createDefaultModelScales(this.buildSpecs);
    }
    applyPersistedScaleRecord(record) {
        applyPersistedModelScales(this.modelScales, this.buildSpecs, record);
    }
    getClampedScale(target) {
        return getPersistedUserScale(this.modelScales, target);
    }
    rememberModelUrl(target, url) {
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
    rememberAnimationUrl(kind, url) {
        this.customAnimationUrls[kind] = url;
    }
    async restoreMeshesFromStoredUrls(loaders) {
        const entries = Object.entries(this.customModelUrls);
        await Promise.all(entries.map(async ([buildId, url]) => {
            if (!url) {
                return;
            }
            try {
                const model = await loadModelFromUrl(loaders, url);
                this.customModels[buildId] = model;
            }
            catch (error) {
                console.warn("[Game] failed to load saved custom model", buildId, url, error);
            }
        }));
        if (this.customDropModelUrl) {
            try {
                this.customDropModel = await loadModelFromUrl(loaders, this.customDropModelUrl);
            }
            catch (error) {
                console.warn("[Game] failed to load drop model", this.customDropModelUrl, error);
            }
        }
        if (this.customPlayerModelUrl) {
            try {
                const loaded = await loadModelAssetFromUrl(loaders, this.customPlayerModelUrl);
                this.customPlayerModel = loaded.model;
                mergeEmbeddedExplorationLocomotion(this.customAnimations, loaded.animations);
            }
            catch (error) {
                console.warn("[Game] failed to load player model", this.customPlayerModelUrl, error);
            }
        }
    }
    async reloadAnimationsFromStoredUrls(loaders) {
        this.customAnimations = await loadCustomAnimationsFromEditorUrls(loaders, this.customAnimationUrls);
    }
    ingestEmbeddedLocomotionClips(clips) {
        mergeEmbeddedExplorationLocomotion(this.customAnimations, clips);
    }
    setAnimationClip(kind, clip) {
        this.customAnimations[kind] = clip;
    }
}
