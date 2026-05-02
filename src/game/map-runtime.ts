import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import {
  TILE_SIZE,
  cellKey,
  cellToWorld,
  expandPath,
  expandPathToOrderedCells,
  getActiveGridCols,
  getActiveGridRows,
  mapCols,
  mapRows,
  setActiveRuntimeGrid,
} from "./runtime-grid";
import type { GameMode, GridCell, MapDefinition } from "./types";

/** 障碍物顶面纯色（不用贴图）：始终由底色与 accent 混合，避免出现贴图 UV + 高光造成的「发白顶」 */
function obstacleTopFaceTint(obstacleHex: number, accentHex: number): number {
  const base = new THREE.Color(obstacleHex);
  const accent = new THREE.Color(accentHex);
  return base.clone().lerp(accent, 0.34).offsetHSL(0, 0.035, 0.06).getHex();
}

function softPathGuideCenter(pathHex: number, accentHex: number): number {
  return new THREE.Color(pathHex).lerp(new THREE.Color(accentHex), 0.42).offsetHSL(0, 0.02, 0.07).getHex();
}

export interface RuntimeMapState {
  pathCells: Set<string>;
  obstacleCells: Set<string>;
  pathWorldPoints: THREE.Vector3[];
}

export function buildRuntimeMapState(map: MapDefinition): RuntimeMapState {
  setActiveRuntimeGrid(map);
  const pathCells = expandPath(map.path);
  const obstacleCells = new Set(
    map.obstacles
      .filter((cell) => !pathCells.has(cellKey(cell)))
      .map((cell) => cellKey(cell)),
  );
  const pathTrace = expandPathToOrderedCells(map.path);

  return {
    pathCells,
    obstacleCells,
    pathWorldPoints: pathTrace.map((cell) => cellToWorld(cell)),
  };
}

function stampGeoBackdropDepthBias(materials: THREE.Material[]): void {
  for (const m of materials) {
    m.polygonOffset = true;
    m.polygonOffsetFactor = -0.92;
    m.polygonOffsetUnits = -0.92;
  }
}

export function renderRuntimeMapScene(options: {
  scene: THREE.Scene;
  mapGroup: THREE.Group;
  hoverMesh: THREE.Mesh;
  map: MapDefinition;
  pathCells: Set<string>;
  obstacleCells: Set<string>;
  currentCity: string;
  mode: GameMode;
  useGeoBackdrop?: boolean;
  safeZoneCells?: Set<string>;
}): void {
  const { scene, mapGroup, hoverMesh, map, pathCells, obstacleCells, currentCity, mode, useGeoBackdrop, safeZoneCells } = options;

  mapGroup.add(hoverMesh);
  hoverMesh.visible = false;

  const tileGeometry = new THREE.BoxGeometry(TILE_SIZE * 0.96, 0.18, TILE_SIZE * 0.96);
  const pathGeometry = new THREE.BoxGeometry(TILE_SIZE * 0.98, 0.22, TILE_SIZE * 0.98);
  const obstacleGeometry = new THREE.CylinderGeometry(TILE_SIZE * 0.46, TILE_SIZE * 0.54, 1.35, 6);

  const groundMaterial = new THREE.MeshStandardMaterial({
    color: map.theme.ground,
    roughness: 0.4,
    metalness: 0.1,
  });
  const groundAltMaterial = new THREE.MeshStandardMaterial({
    color: map.theme.groundAlt,
    roughness: 0.4,
    metalness: 0.1,
  });
  const pathMaterial = new THREE.MeshStandardMaterial({
    color: map.theme.path,
    emissive: map.theme.path,
    emissiveIntensity: 0.025,
    roughness: 0.55,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2.4,
    polygonOffsetUnits: -2.4,
  });

  const isJinan = currentCity === "jinan" || map.id.startsWith("jinan");
  const isBeijing = currentCity === "beijing" || map.id.startsWith("beijing");
  const usesGeoBackdrop = !!useGeoBackdrop && !!map.geo?.enabled;
  const trimmedBoard = (map.theme.boardTextureUrl ?? "").trim();
  const hasCustomBoardImage = trimmedBoard.length > 0;
  const jinanPresetBoard = isJinan && !hasCustomBoardImage;
  const flatBoardMode = !usesGeoBackdrop && (jinanPresetBoard || hasCustomBoardImage);
  const pathGlowOpacity = map.theme.pathGlowOpacity ?? 0.46;
  const pathDetailOpacity = map.theme.pathDetailOpacity ?? 0.82;
  scene.background = new THREE.Color(usesGeoBackdrop ? 0x9eb8c4 : map.theme.fog);
  scene.fog = usesGeoBackdrop ? new THREE.Fog(0x9eb8c4, 1500, 8500) : new THREE.Fog(map.theme.fog, 150, 320);

  const boardTexture = createBoardTexture(map.theme.ground, map.theme.groundAlt);
  const pathTexture = createPathTexture(map.theme.path, map.theme.accent);
  const obstacleTexture = createObstacleTexture(map.theme.obstacle, map.theme.accent);

  const obstacleTopTint = obstacleTopFaceTint(map.theme.obstacle, map.theme.accent);
  const obstacleSideMat = new THREE.MeshStandardMaterial({
    map: obstacleTexture,
    color: new THREE.Color(map.theme.obstacle).multiplyScalar(1.02),
    roughness: 0.88,
    metalness: 0,
  });
  const obstacleTopMat = new THREE.MeshStandardMaterial({
    color: obstacleTopTint,
    roughness: 0.94,
    metalness: 0,
  });
  const obstacleBottomMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(map.theme.obstacle).multiplyScalar(0.86),
    roughness: 0.94,
    metalness: 0,
  });
  const obstacleMaterials: THREE.MeshStandardMaterial[] = [obstacleSideMat, obstacleTopMat, obstacleBottomMat];

  groundMaterial.map = boardTexture;
  groundMaterial.color.copy(new THREE.Color(map.theme.ground)).multiplyScalar(1.02);
  groundMaterial.roughness = 0.9;
  groundMaterial.metalness = 0;
  groundAltMaterial.map = boardTexture;
  groundAltMaterial.color.copy(new THREE.Color(map.theme.groundAlt)).multiplyScalar(1.02);
  groundAltMaterial.roughness = 0.92;
  groundAltMaterial.metalness = 0;
  pathMaterial.map = pathTexture;
  pathMaterial.color.copy(new THREE.Color(map.theme.path)).multiplyScalar(1.02);
  pathMaterial.emissiveIntensity = 0.05;

  if (usesGeoBackdrop) {
    stampGeoBackdropDepthBias([
      groundMaterial,
      groundAltMaterial,
      pathMaterial,
      obstacleSideMat,
      obstacleTopMat,
      obstacleBottomMat,
    ]);
    const groundOpacity = map.theme.geoTileOpacity ?? 0.48;
    for (const m of [groundMaterial, groundAltMaterial]) {
      m.transparent = true;
      m.opacity = groundOpacity;
      m.depthWrite = false;
      m.needsUpdate = true;
    }
    pathMaterial.transparent = true;
    pathMaterial.opacity = map.theme.geoPathOpacity ?? 0.92;
    pathMaterial.depthWrite = false;
    pathMaterial.needsUpdate = true;
  }

  if (usesGeoBackdrop || (!flatBoardMode && !isJinan)) {
    addBoardBase(mapGroup, map, usesGeoBackdrop);
  }
  if (usesGeoBackdrop) {
    addGridOverlay(mapGroup, map, map.theme.accent, true);
  }

  const textureLoader = new THREE.TextureLoader();
  const beijingTextures: Record<string, THREE.Texture> = {};
  if (isBeijing && !usesGeoBackdrop) {
    const types = ["grass", "water", "urban", "house", "forest"];
    types.forEach(t => {
      // 预先使用动态生成的保底纹理
      beijingTextures[t] = createDynamicTexture(t);
      // 尝试异步加载实际资产
      textureLoader.load(`/Arts/Maps/beijing_${t}.png`, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        beijingTextures[t].dispose();
        beijingTextures[t] = tex;
      });
    });
  }

  for (let row = 0; row < mapRows(map); row += 1) {
    for (let col = 0; col < mapCols(map); col += 1) {
      const cell = { col, row };
      const key = cellKey(cell);
      const position = cellToWorld(cell);

      if (pathCells.has(key)) {
        if (usesGeoBackdrop) {
          const mesh = new THREE.Mesh(pathGeometry, pathMaterial);
          mesh.position.set(position.x, 0.14, position.z);
          mesh.renderOrder = 6;
          mesh.receiveShadow = true;
          mapGroup.add(mesh);
          addPathTileDetails(mapGroup, cell, position, map.theme.accent, pathCells, pathDetailOpacity);
        } else if (flatBoardMode) {
          addPathOverlayTile(mapGroup, position, map.theme.path, pathGlowOpacity);
        } else if (isBeijing && !flatBoardMode) {
          const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE),
            new THREE.MeshStandardMaterial({ 
              map: beijingTextures["urban"], 
              color: 0x8a9e96,
              roughness: 0.8 
            })
          );
          plane.rotation.x = -Math.PI / 2;
          plane.position.set(position.x, 0.02, position.z);
          plane.receiveShadow = true;
          mapGroup.add(plane);
        } else {
          const mesh = new THREE.Mesh(pathGeometry, pathMaterial);
          mesh.position.set(position.x, 0.06, position.z);
          mesh.receiveShadow = true;
          mapGroup.add(mesh);
          addPathTileDetails(mapGroup, cell, position, map.theme.accent, pathCells, pathDetailOpacity);
        }
      } else if (obstacleCells.has(key)) {
        if (usesGeoBackdrop) {
          const mesh = new THREE.Mesh(obstacleGeometry, obstacleMaterials);
          mesh.rotation.y = ((col * 17 + row * 11) % 6) * (Math.PI / 6);
          mesh.position.set(position.x, 0.72, position.z);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mapGroup.add(mesh);
        } else if (isBeijing && !flatBoardMode) {
          const buildingHeight = 1.0 + (Math.sin(col * 0.5) + Math.cos(row * 0.5)) * 0.5;
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(TILE_SIZE * 0.85, buildingHeight, TILE_SIZE * 0.85),
            new THREE.MeshStandardMaterial({ 
              map: beijingTextures["house"],
              color: 0x948888,
            })
          );
          mesh.position.set(position.x, buildingHeight / 2, position.z);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mapGroup.add(mesh);
        } else {
          const mesh = new THREE.Mesh(obstacleGeometry, obstacleMaterials);
          mesh.rotation.y = ((col * 17 + row * 11) % 6) * (Math.PI / 6);
          mesh.position.set(position.x, 0.72, position.z);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          if (!jinanPresetBoard) {
            mapGroup.add(mesh);
          }
        }
      } else {
        if (usesGeoBackdrop) {
          const mesh = new THREE.Mesh(tileGeometry, (col + row) % 2 === 0 ? groundMaterial : groundAltMaterial);
          mesh.position.set(position.x, -0.01, position.z);
          mesh.receiveShadow = true;
          mapGroup.add(mesh);
        } else if (isBeijing && !flatBoardMode) {
          // Use pseudo-random biomes for Beijing ground
          const noise = (Math.sin(col * 0.3) + Math.cos(row * 0.3) + 2) / 4;
          let type = "grass";
          let fallbackColor = 0x2d3e2d; // Deep grass
          if (noise < 0.2) {
            type = "water";
            fallbackColor = 0x1a2b3c; // Deep water
          } else if (noise > 0.7) {
            type = "forest";
            fallbackColor = 0x1b2e1b; // Deep forest
          } else if (noise > 0.5) {
            type = "urban";
            fallbackColor = 0x2a2a2a; // Deep urban
          }

          const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE),
            new THREE.MeshStandardMaterial({ 
              map: beijingTextures[type],
              color: (col + row) % 2 === 0 ? fallbackColor : new THREE.Color(fallbackColor).multiplyScalar(0.92).getHex(),
              roughness: 0.9
            })
          );
          plane.rotation.x = -Math.PI / 2;
          plane.position.set(position.x, 0, position.z);
          plane.receiveShadow = true;
          mapGroup.add(plane);
        } else {
          const mesh = new THREE.Mesh(tileGeometry, (col + row) % 2 === 0 ? groundMaterial : groundAltMaterial);
          mesh.position.set(position.x, -0.01, position.z);
          mesh.receiveShadow = true;
          if (!flatBoardMode) {
            mapGroup.add(mesh);
          }
        }
      }
    }
  }

  if (flatBoardMode) {
    const planeUrl = hasCustomBoardImage ? trimmedBoard : "/Arts/Maps/jinan_full_map.png";
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(planeUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    const planeGeo = new THREE.PlaneGeometry(getActiveGridCols() * TILE_SIZE, getActiveGridRows() * TILE_SIZE);
    const planeMat = new THREE.MeshBasicMaterial({ map: texture });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0.05;
    mapGroup.add(plane);
    addJinanPathGuides(mapGroup, map.path, map.theme.path, softPathGuideCenter(map.theme.path, map.theme.accent));
  }

  /* 略高于程序性格子 / flat 整块底板，低于路径高亮与安全区 */
  const decorY = usesGeoBackdrop ? 0.048 : flatBoardMode ? 0.063 : 0.098;
  addBoardDecorImageLayers(mapGroup, map, decorY);

  if (mode === "defense") {
    addEndpointMarker(mapGroup, map.path[0], 0x6bbf90, "入口");
    addEndpointMarker(mapGroup, map.path[map.path.length - 1], 0xd87880, "基地");
  } else {
    addEndpointMarker(mapGroup, map.path[0], map.theme.accent, "探索起点");
  }

  // Safe zone floor overlays
  if (safeZoneCells && safeZoneCells.size > 0) {
    const safeGeo = new THREE.PlaneGeometry(TILE_SIZE * 0.94, TILE_SIZE * 0.94);
    const safeMat = new THREE.MeshBasicMaterial({
      color: 0x22dd77,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    const borderGeo = new THREE.RingGeometry(TILE_SIZE * 0.40, TILE_SIZE * 0.47, 4);
    const borderMat = new THREE.MeshBasicMaterial({
      color: 0x55ffaa,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -5,
      polygonOffsetUnits: -5,
    });
    for (const key of safeZoneCells) {
      const parts = key.split(",");
      const cell = { col: Number(parts[0]), row: Number(parts[1]) };
      const pos = cellToWorld(cell);
      const plane = new THREE.Mesh(safeGeo, safeMat);
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(pos.x, 0.12, pos.z);
      plane.renderOrder = 5;
      mapGroup.add(plane);
      const ring = new THREE.Mesh(borderGeo, borderMat);
      ring.rotation.x = -Math.PI / 2;
      ring.rotation.z = Math.PI / 4;
      ring.position.set(pos.x, 0.14, pos.z);
      ring.renderOrder = 6;
      mapGroup.add(ring);
    }
  }
}

function boardFootprintClipPlanes(halfWidthX: number, halfDepthZ: number): THREE.Plane[] {
  return [
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), halfWidthX),
    new THREE.Plane(new THREE.Vector3(1, 0, 0), halfWidthX),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), halfDepthZ),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), halfDepthZ),
  ];
}

function decorClampPct(v: number, fallback: number): number {
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(100, v));
}

function decorClamp01(v: number, fallback: number): number {
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(1, v));
}

function addBoardDecorImageLayers(mapGroup: THREE.Group, map: MapDefinition, y: number): void {
  const layers = map.boardImageLayers;
  if (!layers?.length) return;
  const textureLoader = new THREE.TextureLoader();
  const cols = mapCols(map);
  const rows = mapRows(map);
  const spanX = cols * TILE_SIZE;
  const spanZ = rows * TILE_SIZE;
  const clipPlanes = boardFootprintClipPlanes(spanX / 2, spanZ / 2);
  [...layers].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).forEach(layer => {
    textureLoader.load(
      layer.src,
      tex => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        let aspect = 1;
        if (Number.isFinite(Number(layer.aspect)) && Number(layer.aspect) > 0) {
          aspect = Number(layer.aspect);
        }
        if (tex.image && "width" in tex.image && (tex.image as HTMLImageElement).width > 0) {
          aspect = (tex.image as HTMLImageElement).height / (tex.image as HTMLImageElement).width;
        }
        const widthPct = decorClampPct(layer.widthPct, 45);
        const planeW = (widthPct / 100) * spanX;
        const planeH = planeW * aspect;
        const leftPct = decorClampPct(layer.centerX, 0);
        const topPct = decorClampPct(layer.centerY, 0);
        const wx0 = -spanX / 2 + (leftPct / 100) * spanX;
        const wz0 = -spanZ / 2 + (topPct / 100) * spanZ;
        const cx = wx0 + planeW / 2;
        const cz = wz0 + planeH / 2;
        const opacity = decorClamp01(layer.opacity ?? 1, 1);
        const decoMat = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: opacity < 0.999,
          opacity,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1.35,
          polygonOffsetUnits: -1.35,
        });
        const decoAny = decoMat as THREE.MeshBasicMaterial & {
          clipping: boolean;
          clippingPlanes: THREE.Plane[];
          clipIntersection: boolean;
        };
        decoAny.clipping = true;
        decoAny.clippingPlanes = clipPlanes;
        decoAny.clipIntersection = false;
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeH), decoMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(cx, y, cz);
        mesh.renderOrder = 4;
        mapGroup.add(mesh);
      },
      undefined,
      () => console.warn("[map-runtime] boardImageLayer load failed:", layer.src.slice(0, 80)),
    );
  });
}

function createDynamicTexture(type: string): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  
  const colors: Record<string, string> = {
    grass: "#1a2e1a",
    water: "#0a1a2a",
    urban: "#1a1a1a",
    house: "#2a1a1a",
    forest: "#0a1e0a",
    path: "#2a3a4a"
  };
  
  ctx.fillStyle = colors[type] || "#111";
  ctx.fillRect(0, 0, 64, 64);
  
  const strokeRgb = colors[type] || "#111";
  const strokeCol = new THREE.Color(strokeRgb);
  ctx.strokeStyle = `rgba(${Math.round(strokeCol.r * 255)},${Math.round(strokeCol.g * 255)},${Math.round(strokeCol.b * 255)},0.09)`;
  for(let i=0; i<=64; i+=16) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 64); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(64, i); ctx.stroke();
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createBoardTexture(primary: number, secondary: number): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const p = new THREE.Color(primary);
  const s = new THREE.Color(secondary);
  const gradient = ctx.createLinearGradient(0, 0, 128, 128);
  gradient.addColorStop(0, `#${p.clone().multiplyScalar(1.04).getHexString()}`);
  gradient.addColorStop(1, `#${s.clone().multiplyScalar(0.88).getHexString()}`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const rimLit = p.clone().lerp(s, 0.5).offsetHSL(0, 0, 0.14);
  ctx.strokeStyle = `rgba(${Math.round(rimLit.r * 255)},${Math.round(rimLit.g * 255)},${Math.round(rimLit.b * 255)},0.22)`;
  ctx.lineWidth = 3;
  ctx.strokeRect(5, 5, 118, 118);
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, 104, 104);
  const hi = p.clone().offsetHSL(0, -0.02, 0.05);
  ctx.fillStyle = `rgba(${Math.round(hi.r * 255)},${Math.round(hi.g * 255)},${Math.round(hi.b * 255)},0.06)`;
  ctx.fillRect(8, 8, 18, 18);
  ctx.fillRect(102, 102, 18, 18);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createPathTexture(base: number, accent: number): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const baseColor = new THREE.Color(base);
  const accentColor = new THREE.Color(accent);
  ctx.fillStyle = `#${baseColor.clone().multiplyScalar(0.84).getHexString()}`;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = `#${baseColor.clone().multiplyScalar(1.08).getHexString()}`;
  ctx.fillRect(0, 14, 128, 100);
  ctx.strokeStyle = `#${accentColor.getHexString()}`;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 4;
  ctx.setLineDash([14, 10]);
  ctx.beginPath();
  ctx.moveTo(0, 64);
  ctx.lineTo(128, 64);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.26;
  const pathRim = baseColor.clone().offsetHSL(0, 0, 0.12);
  ctx.strokeStyle = `#${pathRim.getHexString()}`;
  ctx.lineWidth = 3;
  ctx.strokeRect(5, 5, 118, 118);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createObstacleTexture(base: number, accent: number): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const baseColor = new THREE.Color(base);
  const accentColor = new THREE.Color(accent);
  ctx.fillStyle = `#${baseColor.clone().multiplyScalar(0.78).getHexString()}`;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = `#${baseColor.clone().multiplyScalar(0.96).getHexString()}`;
  ctx.beginPath();
  ctx.moveTo(64, 8);
  ctx.lineTo(118, 38);
  ctx.lineTo(118, 92);
  ctx.lineTo(64, 120);
  ctx.lineTo(10, 92);
  ctx.lineTo(10, 38);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = `#${accentColor.getHexString()}`;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 5;
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addBoardBase(mapGroup: THREE.Group, map: MapDefinition, usesGeoBackdrop: boolean): void {
  const width = mapCols(map) * TILE_SIZE + TILE_SIZE * 1.2;
  const height = mapRows(map) * TILE_SIZE + TILE_SIZE * 1.2;
  const baseOpacity = map.theme.boardBaseOpacity ?? 0.42;
  const baseMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(map.theme.ground).multiplyScalar(0.72),
    roughness: 0.72,
    metalness: 0.08,
    polygonOffset: true,
    polygonOffsetFactor: 1.06,
    polygonOffsetUnits: 1.06,
    ...(usesGeoBackdrop
      ? { transparent: true, opacity: baseOpacity, depthWrite: false }
      : {}),
  });
  const base = new THREE.Mesh(new THREE.BoxGeometry(width, 0.16, height), baseMat);
  /** 整块底板下移，避免与地面格子盒体顶/底重合产生 z-fighting（约 0.1+ 净空）*/
  base.position.y = usesGeoBackdrop ? -0.36 : -0.32;
  base.receiveShadow = true;
  mapGroup.add(base);

  const rimOpacity = map.theme.rimOpacity ?? 0.32;
  const rim = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(width, 0.18, height)),
    new THREE.LineBasicMaterial({ color: map.theme.accent, transparent: true, opacity: rimOpacity }),
  );
  rim.position.y = usesGeoBackdrop ? -0.24 : -0.22;
  mapGroup.add(rim);
}

function addGridOverlay(mapGroup: THREE.Group, map: MapDefinition, color: number, geoBias = false): void {
  const cols = mapCols(map);
  const rows = mapRows(map);
  const halfW = (cols * TILE_SIZE) / 2;
  const halfH = (rows * TILE_SIZE) / 2;
  const points: THREE.Vector3[] = [];
  for (let col = 0; col <= cols; col += 1) {
    const x = -halfW + col * TILE_SIZE;
    points.push(new THREE.Vector3(x, 0.38, -halfH), new THREE.Vector3(x, 0.38, halfH));
  }
  for (let row = 0; row <= rows; row += 1) {
    const z = -halfH + row * TILE_SIZE;
    points.push(new THREE.Vector3(-halfW, 0.38, z), new THREE.Vector3(halfW, 0.38, z));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const gridOpacity = map.theme.gridLineOpacity ?? 0.42;
  const lineMat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: gridOpacity,
    depthWrite: false,
    ...(geoBias ? { polygonOffset: true as const, polygonOffsetFactor: -0.92, polygonOffsetUnits: -0.92 } : {}),
  });
  const grid = new THREE.LineSegments(geometry, lineMat);
  mapGroup.add(grid);
}

function addPathOverlayTile(mapGroup: THREE.Group, position: THREE.Vector3, color: number, opacity: number): void {
  const borderTint = new THREE.Color(color).offsetHSL(0, 0.02, 0.14).getHex();
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(TILE_SIZE * 1.02, TILE_SIZE * 1.02),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
    }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(position.x, 0.16, position.z);
  mapGroup.add(glow);

  const border = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(TILE_SIZE * 1.02, TILE_SIZE * 1.02)),
    new THREE.LineBasicMaterial({ color: borderTint, transparent: true, opacity: 0.82 }),
  );
  border.rotation.x = -Math.PI / 2;
  border.position.set(position.x, 0.17, position.z);
  mapGroup.add(border);
}

function addPathTileDetails(
  mapGroup: THREE.Group,
  cell: GridCell,
  position: THREE.Vector3,
  color: number,
  pathCells: Set<string>,
  pathDetailOpacity = 0.82,
): void {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: pathDetailOpacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1.4,
    polygonOffsetUnits: -1.4,
  });
  const directions = [
    { dc: -1, dr: 0, x: -1, z: 0 },
    { dc: 1, dr: 0, x: 1, z: 0 },
    { dc: 0, dr: -1, x: 0, z: -1 },
    { dc: 0, dr: 1, x: 0, z: 1 },
  ].filter((dir) => pathCells.has(cellKey({ col: cell.col + dir.dc, row: cell.row + dir.dr })));
  const connected = directions.length ? directions : [{ dc: 0, dr: 0, x: 0, z: 1 }];

  for (const dir of connected) {
    const horizontal = dir.x !== 0;
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(horizontal ? TILE_SIZE * 0.66 : TILE_SIZE * 0.14, horizontal ? TILE_SIZE * 0.14 : TILE_SIZE * 0.66),
      material,
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(position.x + dir.x * TILE_SIZE * 0.24, 0.32, position.z + dir.z * TILE_SIZE * 0.24);
    stripe.renderOrder = 9;
    mapGroup.add(stripe);
  }

  const hub = new THREE.Mesh(
    new THREE.CircleGeometry(TILE_SIZE * 0.13, 18),
    material,
  );
  hub.rotation.x = -Math.PI / 2;
  hub.position.set(position.x, 0.325, position.z);
  hub.renderOrder = 10;
  mapGroup.add(hub);
}

function addJinanPathGuides(mapGroup: THREE.Group, path: GridCell[], laneColor: number, centerColor: number): void {
  const laneMaterial = new THREE.MeshBasicMaterial({
    color: laneColor,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });
  const centerMaterial = new THREE.MeshBasicMaterial({
    color: centerColor,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });

  const expandedPath = expandPathToOrderedCells(path);
  const pathSet = new Set(expandedPath.map((cell) => cellKey(cell)));
  for (const cell of expandedPath) {
    const position = cellToWorld(cell);
    const directions = [
      { dc: -1, dr: 0, x: -1, z: 0 },
      { dc: 1, dr: 0, x: 1, z: 0 },
      { dc: 0, dr: -1, x: 0, z: -1 },
      { dc: 0, dr: 1, x: 0, z: 1 },
    ].filter((dir) => pathSet.has(cellKey({ col: cell.col + dir.dc, row: cell.row + dir.dr })));
    const connected = directions.length ? directions : [{ dc: 0, dr: 0, x: 0, z: 1 }];

    const hubLane = new THREE.Mesh(new THREE.PlaneGeometry(TILE_SIZE * 0.62, TILE_SIZE * 0.62), laneMaterial);
    hubLane.rotation.x = -Math.PI / 2;
    hubLane.position.set(position.x, 0.18, position.z);
    mapGroup.add(hubLane);

    const hubCenter = new THREE.Mesh(new THREE.CircleGeometry(TILE_SIZE * 0.12, 18), centerMaterial);
    hubCenter.rotation.x = -Math.PI / 2;
    hubCenter.position.set(position.x, 0.2, position.z);
    mapGroup.add(hubCenter);

    for (const dir of connected) {
      const horizontal = dir.x !== 0;
      const lane = new THREE.Mesh(
        new THREE.PlaneGeometry(horizontal ? TILE_SIZE * 0.72 : TILE_SIZE * 0.52, horizontal ? TILE_SIZE * 0.52 : TILE_SIZE * 0.72),
        laneMaterial,
      );
      lane.rotation.x = -Math.PI / 2;
      lane.position.set(position.x + dir.x * TILE_SIZE * 0.25, 0.18, position.z + dir.z * TILE_SIZE * 0.25);
      mapGroup.add(lane);

      const center = new THREE.Mesh(
        new THREE.PlaneGeometry(horizontal ? TILE_SIZE * 0.72 : TILE_SIZE * 0.14, horizontal ? TILE_SIZE * 0.14 : TILE_SIZE * 0.72),
        centerMaterial,
      );
      center.rotation.x = -Math.PI / 2;
      center.position.set(lane.position.x, 0.2, lane.position.z);
      mapGroup.add(center);
    }
  }
}

function addEndpointMarker(mapGroup: THREE.Group, cell: GridCell, color: number, label: string): void {
  const group = new THREE.Group();
  const position = cellToWorld(cell);
  group.position.set(position.x, 0.2, position.z);

  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(0.9, 48),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.02;
  group.add(halo);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.055, 12, 48),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.65, roughness: 0.28 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.1;
  group.add(ring);

  const beacon = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 0.95, 6),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.2 }),
  );
  beacon.position.y = 0.62;
  group.add(beacon);
  group.userData.label = label;
  mapGroup.add(group);
}

export async function loadMapActors(options: {
  group: THREE.Group;
  map: MapDefinition;
  gltfLoader: GLTFLoader;
  isStale?: () => boolean;
  playfieldScale?: number;
  yOffset?: number;
}): Promise<void> {
  const { group, map, gltfLoader, isStale, playfieldScale = 1, yOffset = 0 } = options;
  const actors = map.actors ?? [];
  if (!actors.length) return;

  await Promise.allSettled(
    actors.map(async (actor) => {
      try {
        const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
          gltfLoader.load(actor.modelPath, resolve, undefined, reject);
        });
        if (isStale?.()) return;
        const mesh = gltf.scene.clone(true);
        const worldPos = cellToWorld({ col: actor.col, row: actor.row });
        const ox = actor.worldOffsetMeters?.x ?? 0;
        const oy = actor.worldOffsetMeters?.y ?? 0;
        const oz = actor.worldOffsetMeters?.z ?? 0;
        const sc = (actor.scale ?? 1) > 0 ? (actor.scale ?? 1) : 1;
        mesh.position.set(worldPos.x + ox, oy + yOffset, worldPos.z + oz);
        mesh.rotation.y = ((actor.rotation ?? 0) * Math.PI) / 180;
        if (playfieldScale !== 1) {
          mesh.scale.set(sc, sc * playfieldScale, sc);
        } else {
          mesh.scale.setScalar(sc);
        }
        mesh.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).castShadow = true;
        });
        if (!isStale?.()) {
          group.add(mesh);
        }
      } catch (e) {
        console.warn(`[MapActors] 加载失败 ${actor.modelPath}:`, e);
      }
    }),
  );
}