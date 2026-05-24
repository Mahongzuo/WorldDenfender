import * as THREE from "three";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { arrayBufferToBase64 } from "../core/browser-utils";
import { clamp } from "../core/runtime-grid";
import { DEFAULT_CUSTOM_ANIMATION_URLS, DEFAULT_PLAYER_MODEL_URLS } from "../core/game-config";
import { mergeEmbeddedExplorationLocomotion } from "../explore/explore-locomotion-clips";
import { sanitizeGlobalGameAudioFromEditor } from "../audio/game-audio";
import { canonicalModelPathScaleKey, clampGlobalPathModelScale } from "./model-path-scale";
function normalizePersistedPathScaleTable(raw) {
    const out = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return out;
    }
    const src = raw;
    for (const key of Object.keys(src)) {
        const nk = canonicalModelPathScaleKey(key);
        if (!nk)
            continue;
        const parsed = typeof src[key] === "number" && Number.isFinite(src[key]) ? src[key] : Number(src[key]);
        if (!Number.isFinite(parsed) || parsed <= 0)
            continue;
        out[nk] = clampGlobalPathModelScale(parsed);
    }
    return out;
}
const EMBEDDED_ANIMATION_CLIPS_KEY = "embeddedAnimationClips";
export function attachEmbeddedAnimationClips(target, clips) {
    const next = Array.isArray(clips) ? clips.filter((clip) => clip instanceof THREE.AnimationClip) : [];
    if (next.length > 0) {
        target.userData[EMBEDDED_ANIMATION_CLIPS_KEY] = next;
    }
    else {
        delete target.userData[EMBEDDED_ANIMATION_CLIPS_KEY];
    }
}
export function getEmbeddedAnimationClips(target) {
    if (!target) {
        return [];
    }
    const raw = target.userData[EMBEDDED_ANIMATION_CLIPS_KEY];
    return Array.isArray(raw) ? raw.filter((clip) => clip instanceof THREE.AnimationClip) : [];
}
export async function loadPersistedGameAssetConfig(dependencies, buildSpecs) {
    const response = await fetch("/Web/data/level-editor-state.json", { cache: "no-store" });
    if (!response.ok) {
        return null;
    }
    const payload = (await response.json());
    const cfg = payload.gameAssetConfig;
    if (!cfg) {
        return null;
    }
    const modelScales = createDefaultModelScales(buildSpecs);
    applyModelScalesFromRecord(modelScales, buildSpecs, (cfg.modelScales ?? null));
    const customModelUrls = { ...(cfg.customModelUrls ?? {}) };
    const customDropModelUrl = cfg.customDropModelUrl ?? "";
    const customPlayerModelUrl = String(cfg.customPlayerModelUrl ?? "").trim() || DEFAULT_PLAYER_MODEL_URLS[0] || "";
    const customAnimationUrls = { ...DEFAULT_CUSTOM_ANIMATION_URLS, ...(cfg.customAnimationUrls ?? {}) };
    const customPlayerAsset = customPlayerModelUrl ? await loadModelAssetFromUrl(dependencies, customPlayerModelUrl) : null;
    const customAnimations = await loadCustomAnimationsFromEditorUrls(dependencies, customAnimationUrls);
    if (customPlayerAsset) {
        mergeEmbeddedExplorationLocomotion(customAnimations, customPlayerAsset.animations);
    }
    return {
        modelScales,
        globalModelPathScales: normalizePersistedPathScaleTable(cfg.globalModelPathScales ?? null),
        customModelUrls,
        customDropModelUrl,
        customPlayerModelUrl,
        customAnimationUrls,
        customModels: await restoreCustomModels(dependencies, customModelUrls),
        customDropModel: customDropModelUrl ? await loadModelFromUrl(dependencies, customDropModelUrl) : null,
        customPlayerModel: customPlayerAsset ? customPlayerAsset.model : null,
        customAnimations,
        playerExploreTransform: mergePlayerExploreTransform(cfg.playerExploreTransform),
        globalAudio: sanitizeGlobalGameAudioFromEditor(cfg.globalAudio) ?? {},
        globalScreenUi: sanitizeGlobalScreenUiFromEditor(cfg.globalScreenUi) ?? {},
    };
}
function sanitizeGlobalScreenUiFromEditor(raw) {
    if (!raw || typeof raw !== "object")
        return undefined;
    const src = raw;
    const out = {};
    const su = String(src.startScreenBackgroundUrl ?? "").trim();
    const lu = String(src.levelSelectBackgroundUrl ?? "").trim();
    const lbg = String(src.levelSelectBackgroundColor ?? "").trim();
    const lac = String(src.levelSelectAccentColor ?? "").trim();
    if (su)
        out.startScreenBackgroundUrl = su;
    if (lu)
        out.levelSelectBackgroundUrl = lu;
    if (lbg)
        out.levelSelectBackgroundColor = lbg;
    if (lac)
        out.levelSelectAccentColor = lac;
    return Object.keys(out).length ? out : undefined;
}
export function createDefaultModelScales(buildSpecs) {
    const modelScales = { moneyDrop: 1, player: 1 };
    for (const id of Object.keys(buildSpecs)) {
        modelScales[id] = 1;
    }
    return modelScales;
}
export function applyModelScalesFromRecord(modelScales, buildSpecs, record) {
    if (!record) {
        return;
    }
    for (const key of Object.keys(record)) {
        if (key !== "moneyDrop" && key !== "player" && !(key in buildSpecs)) {
            continue;
        }
        const raw = record[key];
        const parsed = typeof raw === "number" && Number.isFinite(raw) ? raw : Number(raw);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            continue;
        }
        modelScales[key] = clamp(parsed, 0.05, 8);
    }
}
export function getClampedUserScale(modelScales, target) {
    const raw = modelScales[target];
    const parsed = typeof raw === "number" && Number.isFinite(raw) ? raw : Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return 1;
    }
    return clamp(parsed, 0.05, 8);
}
export function mergePlayerExploreTransform(raw) {
    const merged = {
        offsetMeters: { x: 0, y: 0, z: 0 },
        rotationDeg: { x: 0, y: 0, z: 0 },
    };
    if (!raw || typeof raw !== "object") {
        return merged;
    }
    if (raw.offsetMeters && typeof raw.offsetMeters === "object") {
        merged.offsetMeters = {
            x: Number.isFinite(Number(raw.offsetMeters.x)) ? Number(raw.offsetMeters.x) : 0,
            y: Number.isFinite(Number(raw.offsetMeters.y)) ? Number(raw.offsetMeters.y) : 0,
            z: Number.isFinite(Number(raw.offsetMeters.z)) ? Number(raw.offsetMeters.z) : 0,
        };
    }
    if (raw.rotationDeg && typeof raw.rotationDeg === "object") {
        merged.rotationDeg = {
            x: Number.isFinite(Number(raw.rotationDeg.x)) ? Number(raw.rotationDeg.x) : 0,
            y: Number.isFinite(Number(raw.rotationDeg.y)) ? Number(raw.rotationDeg.y) : 0,
            z: Number.isFinite(Number(raw.rotationDeg.z)) ? Number(raw.rotationDeg.z) : 0,
        };
    }
    return merged;
}
function isLikelyHtmlSpaFallback(data) {
    const u8 = new Uint8Array(data);
    if (u8.length < 4) {
        return false;
    }
    if (u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf && u8[3] === 0x3c) {
        return true;
    }
    return u8[0] === 0x3c;
}
function looksLikeGlbMagic(data) {
    if (data.byteLength < 12) {
        return false;
    }
    const u8 = new Uint8Array(data);
    return u8[0] === 0x67 && u8[1] === 0x6c && u8[2] === 0x54 && u8[3] === 0x46;
}
async function fetchModelArrayBuffer(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("模型资源加载失败");
    }
    const ctype = response.headers.get("content-type") ?? "";
    if (ctype.includes("text/html")) {
        throw new Error(`模型路径返回了网页而非模型（通常文件不存在或 SPA 回退）：${url}`);
    }
    const data = await response.arrayBuffer();
    if (data.byteLength === 0) {
        throw new Error(`模型文件为空：${url}`);
    }
    if (isLikelyHtmlSpaFallback(data)) {
        throw new Error(`模型路径返回了 HTML（多为 404/Vite 索引页）。请确认已将 .glb 放在 public/GameModels 下且 URL 对应存在：${url}`);
    }
    const pathHint = url.split("?")[0].toLowerCase();
    if (pathHint.endsWith(".glb") && !looksLikeGlbMagic(data)) {
        throw new Error(`内容与 GLB 二进制不符（可能下载到了错误文件）：${url}`);
    }
    return data;
}
export async function loadModelAssetFromUrl(dependencies, url) {
    const data = await fetchModelArrayBuffer(url);
    const lowerUrl = url.split("?")[0].toLowerCase();
    if (lowerUrl.endsWith(".obj")) {
        return {
            model: prepareUploadedModel(dependencies.objLoader.parse(new TextDecoder().decode(data))),
            animations: [],
            data,
        };
    }
    const gltf = await new Promise((resolve, reject) => {
        dependencies.gltfLoader.parse(data, "", resolve, reject);
    });
    const model = prepareUploadedModel(gltf.scene);
    attachEmbeddedAnimationClips(model, gltf.animations ?? []);
    return {
        model,
        animations: gltf.animations ?? [],
        data,
    };
}
export async function loadModelFromUrl(dependencies, url) {
    return (await loadModelAssetFromUrl(dependencies, url)).model;
}
export async function loadCustomModelAsset(dependencies, file) {
    const data = await file.arrayBuffer();
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith(".obj")) {
        return {
            model: prepareUploadedModel(dependencies.objLoader.parse(new TextDecoder().decode(data))),
            animations: [],
            data,
        };
    }
    const gltf = await new Promise((resolve, reject) => {
        dependencies.gltfLoader.parse(data, "", resolve, reject);
    });
    const model = prepareUploadedModel(gltf.scene);
    attachEmbeddedAnimationClips(model, gltf.animations ?? []);
    return {
        model,
        animations: gltf.animations ?? [],
        data,
    };
}
export async function loadAnimationAsset(dependencies, file) {
    const data = await file.arrayBuffer();
    const gltf = await new Promise((resolve, reject) => {
        dependencies.gltfLoader.parse(data, "", resolve, reject);
    });
    return {
        clip: gltf.animations?.[0] ?? null,
        data,
    };
}
export async function parseModelData(dependencies, name, data) {
    if (name.toLowerCase().endsWith(".obj")) {
        return prepareUploadedModel(dependencies.objLoader.parse(new TextDecoder().decode(data)));
    }
    return new Promise((resolve, reject) => {
        dependencies.gltfLoader.parse(data, "", (gltf) => resolve(prepareUploadedModel(gltf.scene)), () => reject(new Error("模型解析失败，请确认文件为有效 glTF/GLB/OBJ")));
    });
}
export async function uploadModelFile(file, data) {
    const response = await fetch("/api/upload-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: file.name,
            content: arrayBufferToBase64(data),
        }),
    });
    if (!response.ok) {
        throw new Error("上传失败");
    }
    const result = (await response.json());
    return result.url ?? null;
}
export function modelTargetLabel(target, buildSpecs) {
    if (target === "moneyDrop") {
        return "已替换探索掉落道具模型";
    }
    if (target === "player") {
        return "已替换探索角色模型";
    }
    return `已替换模型：${buildSpecs[target].name}`;
}
export function prepareUploadedModel(scene) {
    const wrapper = new THREE.Group();
    const model = skeletonClone(scene);
    model.traverse((object) => {
        if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
        }
    });
    model.updateMatrixWorld(true);
    const box = new THREE.Box3();
    box.setFromObject(model, true);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    let maxDimension = Math.max(size.x, size.y, size.z, 0.001);
    maxDimension = Math.min(Math.max(maxDimension, 0.12), 5);
    const fitScale = Math.min(1.55 / maxDimension, 22);
    model.position.sub(center);
    model.scale.setScalar(fitScale);
    const normalizedBox = new THREE.Box3().setFromObject(model);
    model.position.y -= normalizedBox.min.y;
    wrapper.add(model);
    return wrapper;
}
async function restoreCustomModels(dependencies, customModelUrls) {
    const customModels = {};
    const entries = Object.entries(customModelUrls);
    await Promise.all(entries.map(async ([buildId, url]) => {
        if (!url) {
            return;
        }
        try {
            customModels[buildId] = await loadModelFromUrl(dependencies, url);
        }
        catch (error) {
            console.warn("[GameAssetConfig] failed to load custom model", buildId, url, error);
        }
    }));
    return customModels;
}
export async function loadCustomAnimationsFromEditorUrls(dependencies, customAnimationUrls) {
    const customAnimations = {};
    const entries = Object.entries(customAnimationUrls).filter((entry) => typeof entry[1] === "string" && entry[1].length > 0);
    await Promise.all(entries.map(async ([type, url]) => {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                return;
            }
            const data = await response.arrayBuffer();
            const gltf = await new Promise((resolve, reject) => {
                dependencies.gltfLoader.parse(data, "", resolve, reject);
            });
            if (gltf.animations?.[0]) {
                customAnimations[type] = gltf.animations[0];
            }
        }
        catch {
            /* ignore invalid editor animation urls */
        }
    }));
    return customAnimations;
}
