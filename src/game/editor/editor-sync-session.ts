import { BUILD_SPECS, CITY_EDITOR_ALIASES, CITY_MAP } from "../data/content";
import { syncEditorLevelsToRuntime } from "./editor-sync";
import { hydrateEditorLevelGeo } from "../geo/geo-levels";
import { EXPLORE_MAPS, EXPLORE_MAPS_BUILTIN_COUNT, MAPS, MAPS_BUILTIN_COUNT } from "../data/maps";
import type { BuildId, BuildSpec, EditorLevel } from "../core/types";
import type { DefenseConsumableSpec, DefenseEffectSpec, DefenseFunctionTag, DefenseStatusId } from "../core/defense-types";
import {
  parseEnemyArchetypeOverride,
  resetDefenseEnemyArchetypeOverrides,
  setDefenseEnemyArchetypeOverrides,
} from "../defense/defense-enemy-archetypes";
import {
  sanitizeDefenseElement,
  sanitizeDefenseFunctionTags,
  sanitizeDefenseStatusIds,
  resetDefenseConsumableOverrides,
  setDefenseConsumableOverrides,
} from "../defense/defense-taxonomy";

export function normalizeGameplayIdentity(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[·\s]/g, "")
    .replace(/市$/g, "");
}

export function applyNumericOverride<T extends keyof BuildSpec>(
  spec: BuildSpec,
  key: T,
  value: unknown,
): void {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    (spec[key] as number | undefined) = numeric;
  }
}

function clampDefenseEffectDurationSec(raw: unknown): number {
  const v = Number(raw);
  if (!Number.isFinite(v) || v <= 0) return 2;
  return Math.round(Math.min(120, Math.max(0.1, v)) * 10) / 10;
}

function defenseEffectsFromStatusIds(raw: unknown, durationSec?: unknown): DefenseEffectSpec[] {
  const duration = clampDefenseEffectDurationSec(durationSec);
  return sanitizeDefenseStatusIds(raw).map((statusId) => {
    switch (statusId) {
      case "slow":
        return { statusId, duration, magnitude: 0.55 };
      case "stun":
      case "paralysis":
        return { statusId, duration };
      case "thermalEffect":
      case "damageOverTime":
        return { statusId, duration, magnitude: 12, tickDamage: 12 };
      case "electromagneticInterference":
        return { statusId, duration, magnitude: 3 };
      default:
        return { statusId, duration };
    }
  });
}

function parseDefenseConsumableEntry(raw: unknown): DefenseConsumableSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as {
    id?: unknown;
    name?: unknown;
    summary?: unknown;
    stats?: Record<string, unknown>;
    cleanseEffects?: unknown;
    assetRefs?: { imagePath?: unknown };
  };
  const id = String(item.id || "").trim();
  if (!id) return null;
  const cleanseStatuses = sanitizeDefenseStatusIds(item.cleanseEffects);
  if (!cleanseStatuses.length) return null;
  const stats = item.stats && typeof item.stats === "object" ? item.stats : {};
  return {
    id,
    name: String(item.name || id),
    description: String(item.summary || "解除塔防负面效果。"),
    icon: String(id).slice(0, 2).toUpperCase(),
    cost: Math.max(0, Number(stats.cost) || 0),
    cooldown: Math.max(0, Number(stats.cooldown) || 0),
    maxCopies: Math.max(1, Math.round(Number(stats.maxCopies) || 1)),
    cleanseStatuses,
  };
}

/** 重置为内置棋盘与 CITY_MAP JSON，便于反复编辑器同步 */
export function resetBundledMapsBeforeEditorSync(bundledCityMapJson: string): void {
  MAPS.length = MAPS_BUILTIN_COUNT;
  EXPLORE_MAPS.length = EXPLORE_MAPS_BUILTIN_COUNT;
  let restored: typeof CITY_MAP;
  try {
    restored = JSON.parse(bundledCityMapJson) as typeof CITY_MAP;
  } catch {
    return;
  }
  for (const key of Object.keys(CITY_MAP)) {
    delete CITY_MAP[key];
  }
  Object.assign(CITY_MAP, restored);
}

export interface TowerGameplayOverrideContext {
  bundledBuildSpecsJson: string;
  currentCity: string;
  currentCityLabel: string;
  requestedRegionCode: string;
  requestedRegionName: string;
}

export function mergeTowerGameplayConfigsFromCityPayload(
  rawConfigs: Record<string, unknown> | undefined,
  ctx: TowerGameplayOverrideContext,
): void {
  try {
    const restored = JSON.parse(ctx.bundledBuildSpecsJson) as typeof BUILD_SPECS;
    for (const key of Object.keys(BUILD_SPECS) as BuildId[]) {
      Object.assign(BUILD_SPECS[key], restored[key]);
    }
    resetDefenseEnemyArchetypeOverrides();
    resetDefenseConsumableOverrides();
  } catch {
    return;
  }
  if (!rawConfigs || typeof rawConfigs !== "object") {
    return;
  }

  const desiredCity = new Set(
    [ctx.currentCity, ctx.currentCityLabel, ctx.requestedRegionCode, ctx.requestedRegionName]
      .map((value) => normalizeGameplayIdentity(value))
      .filter(Boolean),
  );

  for (const [configKey, rawConfig] of Object.entries(rawConfigs)) {
    if (!rawConfig || typeof rawConfig !== "object") {
      continue;
    }
    const config = rawConfig as {
      cityCode?: string;
      cityName?: string;
      aliases?: string[];
      towers?: Array<{
        id?: string;
        stats?: Record<string, unknown>;
        element?: unknown;
        functionTags?: unknown;
        effects?: unknown;
        effectDurationSec?: unknown;
      }>;
      enemies?: Array<{ id?: string; element?: unknown; resistances?: unknown }>;
      items?: unknown[];
    };
    const identities = [configKey, config.cityCode, config.cityName, ...(Array.isArray(config.aliases) ? config.aliases : [])]
      .map((value) => normalizeGameplayIdentity(value))
      .filter(Boolean);
    if (desiredCity.size && !identities.some((identity) => desiredCity.has(identity))) {
      continue;
    }
    const enemyOverrides: Parameters<typeof setDefenseEnemyArchetypeOverrides>[0] = {};
    const consumables: DefenseConsumableSpec[] = [];
    for (const tower of config.towers ?? []) {
      const id = String(tower.id || "") as BuildId;
      const spec = BUILD_SPECS[id];
      if (!spec) {
        continue;
      }
      if (tower.stats && typeof tower.stats === "object") {
        applyNumericOverride(spec, "cost", tower.stats.cost);
        applyNumericOverride(spec, "maxHp", tower.stats.hp);
        applyNumericOverride(spec, "damage", tower.stats.attack);
        applyNumericOverride(spec, "range", tower.stats.range);
        applyNumericOverride(spec, "fireRate", tower.stats.fireRate);
        applyNumericOverride(spec, "splash", tower.stats.splash);
      }
      spec.element = sanitizeDefenseElement(tower.element, spec.element);
      const tags = sanitizeDefenseFunctionTags(tower.functionTags);
      if (tags.length) spec.functionTags = tags as DefenseFunctionTag[];
      const effects = defenseEffectsFromStatusIds(tower.effects, tower.effectDurationSec);
      if (effects.length) spec.effects = effects;
    }
    for (const enemy of config.enemies ?? []) {
      const type = String(enemy.id || "") as keyof typeof enemyOverrides;
      const parsed = parseEnemyArchetypeOverride(enemy);
      if (parsed && (type === "basic" || type === "scout" || type === "hacker" || type === "tank" || type === "swarm")) {
        enemyOverrides[type] = parsed;
      }
    }
    for (const item of config.items ?? []) {
      const parsed = parseDefenseConsumableEntry(item);
      if (parsed) consumables.push(parsed);
    }
    if (Object.keys(enemyOverrides).length) setDefenseEnemyArchetypeOverrides(enemyOverrides);
    if (consumables.length) setDefenseConsumableOverrides(consumables);
  }
}

export function applyRequestedRegionToLevels(
  levels: EditorLevel[],
  requestedLevelId: string,
  requestedRegionCode: string,
  requestedRegionName: string,
): void {
  if (!requestedLevelId || !requestedRegionCode) {
    return;
  }

  const location = createRequestedRegionLocation(requestedRegionCode, requestedRegionName);
  if (!location) {
    return;
  }

  const requestedLevel = levels.find((level) => level.id === requestedLevelId);
  if (!requestedLevel) {
    return;
  }

  const isDefaultLevel =
    requestedLevel.id === "__DEFAULT_TD__" || requestedLevel.id === "__DEFAULT_EXP__";
  const currentLocation = requestedLevel.location ?? {};
  const hasSpecificLocation =
    !!(currentLocation.countryCode || currentLocation.cityCode || currentLocation.cityName);
  if (!isDefaultLevel && hasSpecificLocation) {
    return;
  }

  requestedLevel.location = {
    ...currentLocation,
    ...location,
    countryName: location.countryName || currentLocation.countryName,
    regionLabel: location.regionLabel || currentLocation.regionLabel,
  };

  if (isDefaultLevel) {
    const regionLabel =
      location.regionLabel ||
      location.cityName ||
      location.countryName ||
      requestedRegionName ||
      requestedRegionCode;
    requestedLevel.name = `${regionLabel} · ${requestedLevel.name || "默认关卡"}`;
    requestedLevel.description =
      requestedLevel.description ||
      `为 ${regionLabel} 自动生成的默认关卡，可在编辑器中继续设计。`;
  }
}

export function createRequestedRegionLocation(
  requestedRegionCode: string,
  requestedRegionName: string,
): NonNullable<EditorLevel["location"]> | null {
  const code = requestedRegionCode.trim();
  if (!code) {
    return null;
  }

  const displayName = requestedRegionName.trim();
  const cnCityMatch = /^CN_[^_]+_(\d{6})$/i.exec(code);
  if (cnCityMatch) {
    return {
      countryCode: "CN",
      countryName: "中国",
      cityCode: cnCityMatch[1],
      cityName: displayName.replace(/^中国[·\s-]*/, ""),
      regionLabel: displayName || `中国·${cnCityMatch[1]}`,
    };
  }

  if (/^CN_/i.test(code)) {
    return {
      countryCode: "CN",
      countryName: "中国",
      cityName: displayName.replace(/^中国[·\s-]*/, ""),
      regionLabel: displayName || "中国",
    };
  }

  return {
    countryCode: code.toUpperCase(),
    countryName: displayName || code.toUpperCase(),
    cityName: "",
    regionLabel: displayName || code.toUpperCase(),
  };
}

export interface EditorLevelsPullContext {
  requestedLevelId: string;
}

export async function pullEditorLevelsFromProjectFile(options: {
  bundledCityMapJson: string;
  bundledBuildSpecsJson: string;
  towerOverrideCtx: TowerGameplayOverrideContext;
  levelsPullCtx: EditorLevelsPullContext;
}): Promise<{ importedCount: number; requestedDefIdx: number; requestedExpIdx: number }> {
  const response = await fetch("/Web/data/level-editor-state.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    levels?: EditorLevel[];
    cityGameplayConfigs?: Record<string, unknown>;
  };
  const levels = Array.isArray(payload.levels) ? payload.levels : [];
  resetBundledMapsBeforeEditorSync(options.bundledCityMapJson);
  mergeTowerGameplayConfigsFromCityPayload(payload.cityGameplayConfigs, options.towerOverrideCtx);
  applyRequestedRegionToLevels(
    levels,
    options.levelsPullCtx.requestedLevelId,
    options.towerOverrideCtx.requestedRegionCode,
    options.towerOverrideCtx.requestedRegionName,
  );
  await hydrateEditorLevelGeo(levels);
  const result = syncEditorLevelsToRuntime({
    levels,
    requestedLevelId: options.levelsPullCtx.requestedLevelId,
    maps: MAPS,
    exploreMaps: EXPLORE_MAPS,
    cityMap: CITY_MAP,
    cityAliases: CITY_EDITOR_ALIASES,
    cityGameplayConfigs: payload.cityGameplayConfigs,
  });
  return {
    importedCount: result.importedCount,
    requestedDefIdx: result.requestedDefIdx,
    requestedExpIdx: result.requestedExpIdx,
  };
}
