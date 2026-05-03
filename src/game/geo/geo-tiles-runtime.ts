import * as THREE from "three";
import { TilesRenderer } from "3d-tiles-renderer/three";
import {
  CesiumIonAuthPlugin,
  GLTFExtensionsPlugin,
  ReorientationPlugin,
  TilesFadePlugin,
  UpdateOnChangePlugin,
} from "3d-tiles-renderer/three/plugins";

import { DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID } from "../data/content";
import type { GeoMapConfig } from "../core/types";

interface GeoTilesRuntimeOptions {
  mapGroup: THREE.Group;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
  onStatus?: (message: string, isError?: boolean) => void;
}

interface GeoTilesLoadOptions {
  backdropScale?: number;
}

export class GeoTilesRuntime {
  private readonly options: GeoTilesRuntimeOptions;
  private tiles: TilesRenderer | null = null;
  private activeKey = "";
  private loggedMissingToken = false;

  constructor(options: GeoTilesRuntimeOptions) {
    this.options = options;
  }

  load(geo?: GeoMapConfig, options: GeoTilesLoadOptions = {}): void {
    const normalized = normalizeGeoConfig(geo);
    if (!normalized) {
      this.dispose();
      return;
    }

    const token = getCesiumIonToken();
    if (!token) {
      if (!this.loggedMissingToken) {
        this.options.onStatus?.("未配置 Cesium ion token，已使用本地关卡底板。");
        this.loggedMissingToken = true;
      }
      this.dispose();
      return;
    }

    const backdropScale = options.backdropScale && options.backdropScale > 0 ? options.backdropScale : 1;
    const key = geoConfigKey(normalized, backdropScale);
    if (this.tiles && key === this.activeKey) {
      return;
    }

    this.dispose();
    this.activeKey = key;

    const tiles = new TilesRenderer();
    tiles.errorTarget = 8;
    tiles.maxTilesProcessed = 24;
    tiles.lruCache.minSize = 80;
    tiles.lruCache.maxSize = 220;
    tiles.lruCache.minBytesSize = 80 * 1024 * 1024;
    tiles.lruCache.maxBytesSize = 260 * 1024 * 1024;
    tiles.registerPlugin(new CesiumIonAuthPlugin({
      apiToken: token,
      assetId: normalized.assetId ?? DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID,
      autoRefreshToken: true,
    }));
    tiles.registerPlugin(new GLTFExtensionsPlugin({ rtc: true, metadata: true, autoDispose: true }));
    tiles.registerPlugin(new TilesFadePlugin({ fadeDuration: 280 }));
    tiles.registerPlugin(new UpdateOnChangePlugin());
    tiles.registerPlugin(new ReorientationPlugin({
      lat: THREE.MathUtils.degToRad(normalized.center.lat),
      lon: THREE.MathUtils.degToRad(normalized.center.lon),
      height: normalized.center.heightMeters ?? 0,
      azimuth: THREE.MathUtils.degToRad(normalized.rotationDeg ?? 0),
      up: "+y",
      recenter: true,
    }));

    tiles.addEventListener("load-root-tileset", () => this.applyOverrides(normalized, backdropScale));
    tiles.addEventListener("load-error", (event) => {
      console.warn("[GeoTilesRuntime] load error", event.error);
      this.options.onStatus?.("真实地图加载失败，已保留本地关卡底板。", true);
    });

    tiles.group.name = "geo-tiles";
    tiles.group.renderOrder = -10;
    this.options.mapGroup.add(tiles.group);
    this.tiles = tiles;
    this.update();
  }

  update(): void {
    if (!this.tiles) {
      return;
    }

    this.tiles.setCamera(this.options.camera);
    this.tiles.setResolutionFromRenderer(this.options.camera, this.options.renderer);
    this.tiles.update();
  }

  dispose(): void {
    if (!this.tiles) {
      this.activeKey = "";
      return;
    }

    this.options.mapGroup.remove(this.tiles.group);
    this.tiles.dispose();
    this.tiles = null;
    this.activeKey = "";
  }

  private applyOverrides(geo: RequiredGeoMapConfig, backdropScale: number): void {
    if (!this.tiles) {
      return;
    }

    const scale = (geo.scale && geo.scale > 0 ? geo.scale : 1) * backdropScale;
    this.tiles.group.scale.multiplyScalar(scale);
    this.tiles.group.position.y += geo.yOffsetMeters ?? 0;
  }
}

export function canUseGeoTiles(geo?: GeoMapConfig): boolean {
  return !!normalizeGeoConfig(geo) && !!getCesiumIonToken();
}

interface RequiredGeoMapConfig extends GeoMapConfig {
  center: {
    lat: number;
    lon: number;
    heightMeters?: number;
  };
}

function normalizeGeoConfig(geo?: GeoMapConfig): RequiredGeoMapConfig | null {
  if (!geo?.enabled || !Number.isFinite(geo.center?.lat) || !Number.isFinite(geo.center?.lon)) {
    return null;
  }

  return {
    ...geo,
    provider: geo.provider ?? "cesium-ion",
    assetId: geo.assetId || DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID,
    center: {
      lat: Number(geo.center.lat),
      lon: Number(geo.center.lon),
      heightMeters: Number(geo.center.heightMeters) || 0,
    },
    rotationDeg: Number(geo.rotationDeg) || 0,
    yOffsetMeters: Number(geo.yOffsetMeters) || 0,
    scale: Number(geo.scale) || 1,
  };
}

function geoConfigKey(geo: RequiredGeoMapConfig, backdropScale: number): string {
  return [
    geo.provider,
    geo.assetId,
    geo.center.lat,
    geo.center.lon,
    geo.center.heightMeters ?? 0,
    geo.rotationDeg ?? 0,
    geo.yOffsetMeters ?? 0,
    geo.scale ?? 1,
    backdropScale,
  ].join(":");
}

function getCesiumIonToken(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  const fromEnv = (env.VITE_CESIUM_ION_TOKEN || "").trim();
  if (fromEnv) {
    return fromEnv;
  }

  const browserGlobal = globalThis as typeof globalThis & {
    CESIUM_ION_TOKEN?: string;
    localStorage?: Storage;
  };
  return (
    browserGlobal.CESIUM_ION_TOKEN ||
    browserGlobal.localStorage?.getItem("earth-guardian.cesiumIonToken") ||
    ""
  ).trim();
}
