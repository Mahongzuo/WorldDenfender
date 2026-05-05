import { BUILD_SPECS } from "../data/content";
import type { BuildId, GlobalGameAudioConfig, LevelMapAudioConfig } from "../core/types";

let globalAudio: GlobalGameAudioConfig = {};
let levelAudioDefense: LevelMapAudioConfig | undefined;
let levelAudioExplore: LevelMapAudioConfig | undefined;
let gameInProgress = false;

const bgm = new Audio();
bgm.preload = "auto";
let lastBgmUrl = "";

function vol01(raw: number | undefined, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, n));
}

function firstNonEmpty(...urls: Array<string | undefined>): string {
  for (const u of urls) {
    const s = typeof u === "string" ? u.trim() : "";
    if (s) {
      return s;
    }
  }
  return "";
}

function playBgm(url: string, volume: number): void {
  const v = Math.max(0, Math.min(1, volume));
  if (!url) {
    lastBgmUrl = "";
    bgm.pause();
    bgm.removeAttribute("src");
    bgm.load();
    return;
  }
  if (url === lastBgmUrl) {
    bgm.volume = v;
    if (bgm.paused) {
      void bgm.play().catch(() => {});
    }
    return;
  }
  lastBgmUrl = url;
  bgm.loop = true;
  bgm.volume = v;
  bgm.src = url;
  void bgm.play().catch(() => {});
}

/** 全局默认 + 关卡覆盖的 URL（塔防 / 探索各自 level 表） */
function towerAttackUrlFor(buildId: BuildId, mode: "defense" | "explore"): string {
  const level = mode === "defense" ? levelAudioDefense : levelAudioExplore;
  return firstNonEmpty(
    level?.towerAttackSfxByBuildId?.[buildId],
    globalAudio.towerAttackSfxByBuildId?.[buildId],
    globalAudio.towerAttackDefaultSfxUrl,
  );
}

function towerAttackVolumeFor(mode: "defense" | "explore"): number {
  const level = mode === "defense" ? levelAudioDefense : levelAudioExplore;
  return vol01(level?.towerAttackSfxVolume ?? globalAudio.towerAttackSfxVolume, 0.62);
}

export function setGlobalGameAudio(cfg: GlobalGameAudioConfig | undefined): void {
  globalAudio = { ...(cfg ?? {}) };
}

export function setLevelAudioMaps(options: {
  defense?: LevelMapAudioConfig | undefined;
  explore?: LevelMapAudioConfig | undefined;
}): void {
  levelAudioDefense = options.defense;
  levelAudioExplore = options.explore;
}

/** 是否在关卡内（非主菜单）；用于区分菜单 BGM 与关卡 BGM */
export function setGameSessionActive(active: boolean): void {
  gameInProgress = active;
}

export function playMenuBgm(): void {
  const url = firstNonEmpty(globalAudio.menuBgmUrl);
  playBgm(url, vol01(globalAudio.menuBgmVolume, 0.55));
}

export function refreshBgmForMode(mode: "defense" | "explore"): void {
  if (!gameInProgress) {
    playMenuBgm();
    return;
  }
  if (mode === "explore") {
    const ex = (levelAudioExplore?.exploreBgmUrl || "").trim();
    const def = (levelAudioExplore?.defenseBgmUrl || "").trim();
    let url = "";
    let vol = 0.55;
    if (ex) {
      url = ex;
      vol = vol01(levelAudioExplore?.exploreBgmVolume, 0.55);
    } else if (def) {
      url = def;
      vol = vol01(levelAudioExplore?.defenseBgmVolume, 0.55);
    }
    playBgm(url, vol);
  } else {
    const url = firstNonEmpty(levelAudioDefense?.defenseBgmUrl);
    playBgm(url, vol01(levelAudioDefense?.defenseBgmVolume, 0.55));
  }
}

export function playOneShotFromUrl(url: string, volume = 0.65): void {
  const u = typeof url === "string" ? url.trim() : "";
  if (!u) {
    return;
  }
  try {
    const a = new Audio(u);
    a.volume = Math.max(0, Math.min(1, volume));
    void a.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

export function playTowerBuild(): void {
  playOneShotFromUrl(
    globalAudio.towerBuildSfxUrl ?? "",
    vol01(globalAudio.towerBuildSfxVolume, 0.55),
  );
}

export function playTowerFire(buildId: BuildId, mode: "defense" | "explore"): void {
  playOneShotFromUrl(towerAttackUrlFor(buildId, mode), towerAttackVolumeFor(mode));
}

export function playDefenseEnemyKilled(): void {
  playOneShotFromUrl(
    globalAudio.defenseEnemyDeathSfxUrl ?? "",
    vol01(globalAudio.defenseEnemyDeathSfxVolume, 0.5),
  );
}

export function playExploreBasicAttack(): void {
  playOneShotFromUrl(
    globalAudio.exploreBasicAttackSfxUrl ?? "",
    vol01(globalAudio.exploreBasicAttackSfxVolume, 0.45),
  );
}

export function playExploreEnemyKilled(): void {
  playOneShotFromUrl(
    globalAudio.exploreEnemyDeathSfxUrl ?? "",
    vol01(globalAudio.exploreEnemyDeathSfxVolume, 0.5),
  );
}

export function playExplorePlayerHit(): void {
  playOneShotFromUrl(
    globalAudio.explorePlayerHitSfxUrl ?? "",
    vol01(globalAudio.explorePlayerHitSfxVolume, 0.55),
  );
}

function volFromUnknown(raw: unknown): number | undefined {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : undefined;
}

/** 校验 JSON 中的塔 ID，避免写入任意键 */
export function sanitizeLevelMapAudioFromEditor(raw: unknown): LevelMapAudioConfig | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const r = raw as Record<string, unknown>;
  const defenseBgmUrl = typeof r.defenseBgmUrl === "string" ? r.defenseBgmUrl.trim() : "";
  const exploreBgmUrl = typeof r.exploreBgmUrl === "string" ? r.exploreBgmUrl.trim() : "";
  const towerAttackSfxByBuildId: Partial<Record<BuildId, string>> = {};
  const tab = r.towerAttackSfxByBuildId;
  if (tab && typeof tab === "object") {
    for (const id of Object.keys(BUILD_SPECS) as BuildId[]) {
      const v = (tab as Record<string, unknown>)[id];
      if (typeof v === "string" && v.trim()) {
        towerAttackSfxByBuildId[id] = v.trim();
      }
    }
  }
  const defenseBgmVolume = volFromUnknown(r.defenseBgmVolume);
  const exploreBgmVolume = volFromUnknown(r.exploreBgmVolume);
  const towerAttackSfxVolume = volFromUnknown(r.towerAttackSfxVolume);

  const out: LevelMapAudioConfig = {};
  if (defenseBgmUrl) {
    out.defenseBgmUrl = defenseBgmUrl;
  }
  if (exploreBgmUrl) {
    out.exploreBgmUrl = exploreBgmUrl;
  }
  if (defenseBgmVolume !== undefined) {
    out.defenseBgmVolume = defenseBgmVolume;
  }
  if (exploreBgmVolume !== undefined) {
    out.exploreBgmVolume = exploreBgmVolume;
  }
  if (towerAttackSfxVolume !== undefined) {
    out.towerAttackSfxVolume = towerAttackSfxVolume;
  }
  if (Object.keys(towerAttackSfxByBuildId).length) {
    out.towerAttackSfxByBuildId = towerAttackSfxByBuildId;
  }

  const hasAny =
    !!out.defenseBgmUrl ||
    !!out.exploreBgmUrl ||
    out.defenseBgmVolume !== undefined ||
    out.exploreBgmVolume !== undefined ||
    out.towerAttackSfxVolume !== undefined ||
    !!out.towerAttackSfxByBuildId;
  return hasAny ? out : undefined;
}

export function sanitizeGlobalGameAudioFromEditor(raw: unknown): GlobalGameAudioConfig | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const r = raw as Record<string, unknown>;
  const str = (k: string) => (typeof r[k] === "string" ? (r[k] as string).trim() : "");
  const towerAttackSfxByBuildId: Partial<Record<BuildId, string>> = {};
  const tab = r.towerAttackSfxByBuildId;
  if (tab && typeof tab === "object") {
    for (const id of Object.keys(BUILD_SPECS) as BuildId[]) {
      const v = (tab as Record<string, unknown>)[id];
      if (typeof v === "string" && v.trim()) {
        towerAttackSfxByBuildId[id] = v.trim();
      }
    }
  }
  const out: GlobalGameAudioConfig = {};
  const menu = str("menuBgmUrl");
  const build = str("towerBuildSfxUrl");
  const atkDef = str("towerAttackDefaultSfxUrl");
  const defDeath = str("defenseEnemyDeathSfxUrl");
  const exAtk = str("exploreBasicAttackSfxUrl");
  const exDeath = str("exploreEnemyDeathSfxUrl");
  const exHit = str("explorePlayerHitSfxUrl");
  if (menu) {
    out.menuBgmUrl = menu;
  }
  if (build) {
    out.towerBuildSfxUrl = build;
  }
  if (atkDef) {
    out.towerAttackDefaultSfxUrl = atkDef;
  }
  if (Object.keys(towerAttackSfxByBuildId).length) {
    out.towerAttackSfxByBuildId = towerAttackSfxByBuildId;
  }
  if (defDeath) {
    out.defenseEnemyDeathSfxUrl = defDeath;
  }
  if (exAtk) {
    out.exploreBasicAttackSfxUrl = exAtk;
  }
  if (exDeath) {
    out.exploreEnemyDeathSfxUrl = exDeath;
  }
  if (exHit) {
    out.explorePlayerHitSfxUrl = exHit;
  }

  const mv = volFromUnknown(r.menuBgmVolume);
  const bv = volFromUnknown(r.towerBuildSfxVolume);
  const av = volFromUnknown(r.towerAttackSfxVolume);
  const dv = volFromUnknown(r.defenseEnemyDeathSfxVolume);
  const eav = volFromUnknown(r.exploreBasicAttackSfxVolume);
  const edv = volFromUnknown(r.exploreEnemyDeathSfxVolume);
  const phv = volFromUnknown(r.explorePlayerHitSfxVolume);
  if (mv !== undefined) {
    out.menuBgmVolume = mv;
  }
  if (bv !== undefined) {
    out.towerBuildSfxVolume = bv;
  }
  if (av !== undefined) {
    out.towerAttackSfxVolume = av;
  }
  if (dv !== undefined) {
    out.defenseEnemyDeathSfxVolume = dv;
  }
  if (eav !== undefined) {
    out.exploreBasicAttackSfxVolume = eav;
  }
  if (edv !== undefined) {
    out.exploreEnemyDeathSfxVolume = edv;
  }
  if (phv !== undefined) {
    out.explorePlayerHitSfxVolume = phv;
  }

  return Object.keys(out).length ? out : undefined;
}
