import { collectIso3166Alpha3Candidates } from "./country-code-helpers";
import { DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID } from "./content";
import type { EditorLevel, GeoMapConfig } from "./types";

interface GeoPoint {
  lat: number;
  lon: number;
  heightMeters?: number;
}

interface CountryGeoJsonFeature {
  id?: string | number;
  properties?: { name?: string };
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
}

/** 与 Web/country-geo-presets.js 地标一致的关键国家（离线首充） */
const CAPITAL_COORDS: Record<string, GeoPoint> = {
  ARG: { lat: -34.6037, lon: -58.3816 },
  AUS: { lat: -35.2809, lon: 149.13 },
  AUT: { lat: 48.2082, lon: 16.3738 },
  BEL: { lat: 50.8503, lon: 4.3517 },
  BGD: { lat: 23.8103, lon: 90.4125 },
  BRA: { lat: -15.7939, lon: -47.8828 },
  CAN: { lat: 45.4215296, lon: -75.6971931 },
  CHE: { lat: 46.948, lon: 7.4474 },
  CHL: { lat: -33.4489, lon: -70.6693 },
  COL: { lat: 4.711, lon: -74.0721 },
  CUB: { lat: 23.1136, lon: -82.3666 },
  CZE: { lat: 50.0755, lon: 14.4378 },
  DEU: { lat: 52.52, lon: 13.405 },
  DNK: { lat: 55.6761, lon: 12.5683 },
  DZA: { lat: 36.7538, lon: 3.0588 },
  EGY: { lat: 30.0444, lon: 31.2357 },
  ESP: { lat: 40.4168, lon: -3.7038 },
  ETH: { lat: 8.9806, lon: 38.7578 },
  FIN: { lat: 60.1699, lon: 24.9384 },
  /** Eiffel landmark */
  FRA: { lat: 48.8583736, lon: 2.2944813 },
  GBR: { lat: 51.5072, lon: -0.1276 },
  GRC: { lat: 37.9838, lon: 23.7275 },
  IDN: { lat: -6.2088, lon: 106.8456 },
  IND: { lat: 28.6139391, lon: 77.2090213 },
  IRN: { lat: 35.6892, lon: 51.389 },
  IRQ: { lat: 33.3152, lon: 44.3661 },
  ISR: { lat: 31.7683, lon: 35.2137 },
  ITA: { lat: 41.9028, lon: 12.4964 },
  JPN: { lat: 35.6812363, lon: 139.7671248 },
  KEN: { lat: -1.2921, lon: 36.8219 },
  KOR: { lat: 37.5759269, lon: 126.9768153 },
  MAR: { lat: 34.0209, lon: -6.8416 },
  MEX: { lat: 19.4326, lon: -99.1332 },
  MYS: { lat: 3.139, lon: 101.6869 },
  NGA: { lat: 9.0765, lon: 7.3986 },
  NLD: { lat: 52.3676, lon: 4.9041 },
  NOR: { lat: 59.9139, lon: 10.7522 },
  NPL: { lat: 27.7172, lon: 85.324 },
  NZL: { lat: -41.2865, lon: 174.7762 },
  PAK: { lat: 33.6844, lon: 73.0479 },
  PER: { lat: -12.0464, lon: -77.0428 },
  PHL: { lat: 14.5995, lon: 120.9842 },
  POL: { lat: 52.2297, lon: 21.0122 },
  PRT: { lat: 38.7223, lon: -9.1393 },
  RUS: { lat: 55.7558, lon: 37.6173 },
  SAU: { lat: 24.7136, lon: 46.6753 },
  SGP: { lat: 1.3521, lon: 103.8198 },
  SWE: { lat: 59.3293, lon: 18.0686 },
  THA: { lat: 13.7563, lon: 100.5018 },
  TUR: { lat: 39.9334, lon: 32.8597 },
  UKR: { lat: 50.4501, lon: 30.5234 },
  USA: { lat: 40.6892474, lon: -74.0445004 },
  VEN: { lat: 10.4806, lon: -66.9036 },
  VNM: { lat: 21.0278, lon: 105.8342 },
  ZAF: { lat: -25.7479, lon: 28.2293 },
};

let geoSourcePromise: Promise<{
  countries: Map<string, GeoMapConfig>;
  chinaCities: Map<string, GeoMapConfig>;
}> | null = null;

export async function hydrateEditorLevelGeo(levels: EditorLevel[]): Promise<void> {
  const sources = await loadGeoSources();
  for (const level of levels) {
    if (hasUsableGeo(level.map?.geo) || hasUsableGeo(level.location?.geo)) {
      continue;
    }

    const cityGeo = resolveChinaCityGeo(level, sources.chinaCities);
    const countryGeo = cityGeo ? undefined : resolveCountryGeo(level, sources.countries);
    const geo = cityGeo ?? countryGeo;
    if (!geo) {
      continue;
    }

    level.map = { ...(level.map ?? {}), geo };
  }
}

function loadGeoSources(): Promise<{
  countries: Map<string, GeoMapConfig>;
  chinaCities: Map<string, GeoMapConfig>;
}> {
  geoSourcePromise ??= Promise.all([loadCountryGeo(), loadChinaCityGeo()])
    .then(([countries, chinaCities]) => ({ countries, chinaCities }))
    .catch((error) => {
      console.warn("[GeoLevels] failed to hydrate geo sources", error);
      return { countries: new Map(), chinaCities: new Map() };
    });
  return geoSourcePromise;
}

async function loadCountryGeo(): Promise<Map<string, GeoMapConfig>> {
  const [data, remoteCapitals] = await Promise.all([
    fetchGeoJsonScript<{ features?: CountryGeoJsonFeature[] }>("/Web/data/world-data.js", "__WORLD_GEOJSON__"),
    fetchCountryCapitalCoords(),
  ]);
  const result = new Map<string, GeoMapConfig>();
  for (const feature of data.features ?? []) {
    const code = String(feature.id || "").toUpperCase();
    const name = String(feature.properties?.name || "");
    const capital = CAPITAL_COORDS[code] ?? remoteCapitals.get(code);
    const fallback = getGeometryCenter(feature.geometry?.coordinates);
    const point = capital ?? fallback;
    if (!point) {
      continue;
    }

    const geo = createGeoConfig(point, capital ? 2200 : 3200);
    if (code === "FRA") {
      geo.boardHeightMeters = 80;
    }
    if (code === "JPN") {
      geo.boardHeightMeters = 42; // 默认 32 + 10，避免地图遮住棋盘
    }
    if (code === "RUS") {
      geo.boardHeightMeters = 62; // 默认 32 + 30，避免地图遮住棋盘
    }
    if (code) {
      result.set(code, geo);
      result.set(`country-${code.toLowerCase()}`, geo);
    }
    if (name) {
      result.set(normalizeKey(name), geo);
    }
  }
  return result;
}

async function fetchCountryCapitalCoords(): Promise<Map<string, GeoPoint>> {
  try {
    const response = await fetch("https://restcountries.com/v3.1/all?fields=cca3,capitalInfo", { cache: "force-cache" });
    if (!response.ok) {
      return new Map();
    }
    const rows = (await response.json()) as Array<{ cca3?: string; capitalInfo?: { latlng?: number[] } }>;
    return new Map(
      rows
        .map((row): [string, GeoPoint] | null => {
          const code = String(row.cca3 || "").toUpperCase();
          const latlng = row.capitalInfo?.latlng;
          if (!code || !Array.isArray(latlng) || latlng.length < 2) {
            return null;
          }
          return [code, { lat: Number(latlng[0]), lon: Number(latlng[1]) }];
        })
        .filter((item): item is [string, GeoPoint] => !!item),
    );
  } catch {
    return new Map();
  }
}

async function loadChinaCityGeo(): Promise<Map<string, GeoMapConfig>> {
  const china = await fetchGeoJsonScript<{ features?: Array<{ properties?: { adcode?: string | number } }> }>("/Web/data/china-data.js", "__CHINA_GEOJSON__");
  const provinceCodes = (china.features ?? [])
    .map((feature) => String(feature.properties?.adcode || ""))
    .filter(Boolean);
  const groups = await Promise.all(provinceCodes.map(loadProvinceCityGeo));
  return new Map(groups.flat());
}

async function loadProvinceCityGeo(adcode: string): Promise<Array<[string, GeoMapConfig]>> {
  try {
    const variableName = `__PROVINCE_${adcode}_GEOJSON__`;
    const data = await fetchGeoJsonScript<{ features?: Array<{ properties?: { adcode?: string | number; name?: string; center?: number[]; centroid?: number[] } }> }>(
      `/Web/data/provinces/${adcode}-data.js`,
      variableName,
    );
    return (data.features ?? [])
      .map((feature): Array<[string, GeoMapConfig]> => {
        const props = feature.properties ?? {};
        const center = props.center ?? props.centroid;
        if (!Array.isArray(center) || center.length < 2) {
          return [];
        }
        const geo = createGeoConfig({ lon: Number(center[0]), lat: Number(center[1]) }, 1600);
        const entries: Array<[string, GeoMapConfig]> = [[String(props.adcode || ""), geo]];
        const cityName = normalizeChineseCityName(props.name || "");
        if (cityName) {
          entries.push([cityName, geo]);
        }
        return entries;
      })
      .flat()
      .filter((item): item is [string, GeoMapConfig] => !!item[0]);
  } catch {
    return [];
  }
}

async function fetchGeoJsonScript<T>(url: string, variableName: string): Promise<T> {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`${url} ${response.status}`);
  }
  const text = await response.text();
  const prefix = `window.${variableName} = `;
  const start = text.indexOf(prefix);
  if (start === -1) {
    throw new Error(`Missing ${variableName}`);
  }
  const bodyStart = start + prefix.length;
  const end = text.lastIndexOf(";");
  return JSON.parse(text.slice(bodyStart, end > bodyStart ? end : undefined).trim()) as T;
}

function resolveChinaCityGeo(level: EditorLevel, cities: Map<string, GeoMapConfig>): GeoMapConfig | undefined {
  if (level.location?.countryCode && level.location.countryCode !== "CN") {
    return undefined;
  }
  const cityCode = String(level.location?.cityCode || "").trim();
  const cityName = normalizeChineseCityName(level.location?.cityName || level.location?.regionLabel || level.name || "");
  return (cityCode ? cities.get(cityCode) : undefined) ?? (cityName ? cities.get(cityName) : undefined);
}

function resolveCountryGeo(level: EditorLevel, countries: Map<string, GeoMapConfig>): GeoMapConfig | undefined {
  const candidates = collectIso3166Alpha3Candidates(
    String(level.id || ""),
    String(level.location?.countryCode || ""),
  );
  for (const code of candidates) {
    const hit = countries.get(code) ?? countries.get(`country-${code.toLowerCase()}`);
    if (hit) {
      return hit;
    }
  }

  const name = normalizeKey(level.location?.countryName || level.location?.regionLabel || level.name || "");
  return countries.get(name);
}

function createGeoConfig(point: GeoPoint, extentMeters: number): GeoMapConfig {
  return {
    enabled: true,
    provider: "cesium-ion",
    assetId: DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID,
    center: {
      lat: point.lat,
      lon: point.lon,
      heightMeters: point.heightMeters ?? 0,
    },
    extentMeters,
    rotationDeg: 0,
    yOffsetMeters: 0,
    boardHeightMeters: 32,
    scale: 1,
  };
}

function hasUsableGeo(geo?: GeoMapConfig): boolean {
  return !!geo?.enabled && Number.isFinite(geo.center?.lat) && Number.isFinite(geo.center?.lon);
}

function normalizeKey(value: unknown): string {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeChineseCityName(value: unknown): string {
  return String(value || "")
    .replace(/^中国[·\s-]*/, "")
    .replace(/ · .+$/, "")
    .replace(/[市区县盟州地区特别行政\s]/g, "")
    .trim();
}

function getGeometryCenter(coordinates: unknown): GeoPoint | null {
  const bounds = { minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity };
  visitCoordinatePairs(coordinates, (lon, lat) => {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      return;
    }
    bounds.minLon = Math.min(bounds.minLon, lon);
    bounds.maxLon = Math.max(bounds.maxLon, lon);
    bounds.minLat = Math.min(bounds.minLat, lat);
    bounds.maxLat = Math.max(bounds.maxLat, lat);
  });
  if (!Number.isFinite(bounds.minLon) || !Number.isFinite(bounds.minLat)) {
    return null;
  }
  return {
    lon: (bounds.minLon + bounds.maxLon) / 2,
    lat: (bounds.minLat + bounds.maxLat) / 2,
  };
}

function visitCoordinatePairs(value: unknown, visitor: (lon: number, lat: number) => void): void {
  if (!Array.isArray(value)) {
    return;
  }
  if (typeof value[0] === "number" && typeof value[1] === "number") {
    visitor(Number(value[0]), Number(value[1]));
    return;
  }
  for (const item of value) {
    visitCoordinatePairs(item, visitor);
  }
}
