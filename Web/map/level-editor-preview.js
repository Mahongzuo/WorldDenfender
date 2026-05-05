/**
 * Three.js · 关卡场景预览 — level-editor.html 的 import map 将 `three` / `3d-tiles-renderer` 指向 /eg-vendor/（Vite 从 node_modules 提供）。
 */
import * as THREE from 'three';
import { TilesRenderer } from '3d-tiles-renderer/three';
import { CesiumIonAuthPlugin, GLTFExtensionsPlugin, ReorientationPlugin, TilesFadePlugin, UpdateOnChangePlugin } from '3d-tiles-renderer/three/plugins';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();
const gltfCache = new Map();
import { CITY_GEO_CONFIGS as BUILT_IN_GEO_CONFIGS, DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID, JINAN_MAP_TEXTURE_URL } from './editor/city-geo-configs.js';

function degToRad(d) {
  return (d * Math.PI) / 180;
}

function radToDeg(r) {
  return (r * 180) / Math.PI;
}

function ensureOffset(actor) {
  if (!actor.worldOffsetMeters || typeof actor.worldOffsetMeters !== 'object') {
    actor.worldOffsetMeters = { x: 0, y: 0, z: 0 };
  }
  ['x', 'y', 'z'].forEach(function (k) {
    if (!Number.isFinite(Number(actor.worldOffsetMeters[k]))) actor.worldOffsetMeters[k] = 0;
  });
}

function cellCenterXZ(col, row, cols, rows, tileSize) {
  return {
    x: (col - cols / 2 + 0.5) * tileSize,
    z: (row - rows / 2 + 0.5) * tileSize,
  };
}

function worldToAnchor(px, pz, cols, rows, tileSize) {
  var col = Math.floor(px / tileSize + cols / 2);
  var row = Math.floor(pz / tileSize + rows / 2);
  col = THREE.MathUtils.clamp(col, 0, cols - 1);
  row = THREE.MathUtils.clamp(row, 0, rows - 1);
  var c = cellCenterXZ(col, row, cols, rows, tileSize);
  return {
    col: col,
    row: row,
    offset: { x: px - c.x, y: 0, z: pz - c.z },
  };
}

function resolveAssetPath(path) {
  if (!path) return '';
  var s = String(path);
  if (s.startsWith('http') || s.startsWith('/')) return s;
  return '/' + s;
}

export function createPreview(options) {
  var host = options.host;
  var getLevel = options.getLevel;
  var getActiveEditorMode = options.getActiveEditorMode;
  var getCatalog = options.getCatalog;
  var getGeoMappingEnabled =
    typeof options.getGeoMappingEnabled === 'function'
      ? options.getGeoMappingEnabled
      : function () {
          return true;
        };
  var onSelectActor = options.onSelectActor;
  var onActorModified = options.onActorModified;
  var onTransformModeChange = options.onTransformModeChange;

  var scene = new THREE.Scene();
  /* fog / background 在每关 buildTerrain 中与主游戏 renderVisibleMap 一致 */

  var camera = new THREE.PerspectiveCamera(55, 1, 0.1, 10000);
  camera.up.set(0, 1, 0);
  camera.position.set(0, 12, 16);

  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.localClippingEnabled = true;
  host.innerHTML = '';
  host.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';

  /* TowerDefenseGame.configureScene — 与环境一致（主游戏共用） */
  var ambientLight = new THREE.HemisphereLight(0xd5e8e4, 0x7a8894, 1.52);
  var dirLight = new THREE.DirectionalLight(0xe8ddd0, 2.38);
  dirLight.position.set(-48, 72, 34);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  var skyFill = new THREE.DirectionalLight(0xa8c4cc, 0.52);
  skyFill.position.set(36, 34, -52);
  scene.add(ambientLight, dirLight, skyFill);

  var orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.06;
  orbit.maxDistance = 5200;
  orbit.target.set(0, 0, 0);
  window.addEventListener('keydown', onKeyDown);

  function onKeyDown(ev) {
    if (ev.key === 'Escape') {
      setSelectedActor(null);
      if (onSelectActor) onSelectActor(null);
      return;
    }
    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (ev.key === 'f' || ev.key === 'F') {
      if (!selectionId) return;
      ev.preventDefault();
      focusSelection();
      return;
    }
    if (!selectionId) return;
    if (ev.key === 'w' || ev.key === 'W') {
      ev.preventDefault();
      setTransformMode('translate');
      if (onTransformModeChange) onTransformModeChange('translate');
    } else if (ev.key === 'r' || ev.key === 'R') {
      ev.preventDefault();
      setTransformMode('rotate');
      if (onTransformModeChange) onTransformModeChange('rotate');
    } else if (ev.key === 's' || ev.key === 'S') {
      ev.preventDefault();
      setTransformMode('scale');
      if (onTransformModeChange) onTransformModeChange('scale');
    }
  }

  var transform = new TransformControls(camera, renderer.domElement);
  transform.addEventListener('dragging-changed', function (e) {
    orbit.enabled = !e.value;
    if (!e.value) {
      syncSelectedFromScene(false);
    }
  });
  // Three.js r165+: TransformControls extends Controls (EventDispatcher), not Object3D.
  // The visual gizmo is a separate Object3D returned by getHelper().
  var transformHelper = transform.getHelper();
  scene.add(transformHelper);

  var rootGroup = new THREE.Group();
  var geoGroup = new THREE.Group();
  geoGroup.name = 'geo-tiles-root';
  var terrainGroup = new THREE.Group();
  terrainGroup.name = 'terrain';
  var actorsHolder = new THREE.Group();
  actorsHolder.name = 'actors';
  rootGroup.add(geoGroup, terrainGroup, actorsHolder);
  scene.add(rootGroup);

  var placementHud = document.createElement('div');
  placementHud.className = 'preview-placement-hud panel-surface';
  placementHud.style.display = 'none';
  placementHud.setAttribute('aria-hidden', 'true');
  host.appendChild(placementHud);

  var placementGhost = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({
      color: 0x5a9088,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  placementGhost.visible = false;
  placementGhost.renderOrder = 50;
  scene.add(placementGhost);

  var onWindowDragEndForPreview = function () {
    hidePlacementPreview();
    if (typeof window !== 'undefined') window.__egCatalogDragMeta = null;
  };
  window.addEventListener('dragend', onWindowDragEndForPreview);

  /** @type Map<string, THREE.Object3D> */
  var actorRoots = new Map();
  /** @type Map<string, THREE.Mesh> */
  var placeholderMeshes = new Map();
  var textureLoader = new THREE.TextureLoader();
  var jinanMapTexture = null;
  var geoTiles = null;
  var geoTilesKey = '';
  var missingGeoTokenLogged = false;
  var geoTokenRequest = null;
  var previewPlayfieldScale = 1;
  var previewPlayfieldYOffset = 0;

  /** @type {string|null} */
  var selectionId = null;

  /** @type {THREE.WebGLRenderer & { __raf?: number }} */
  var rafHook = renderer;
  function loop() {
    rafHook.__raf = requestAnimationFrame(loop);
    orbit.update();
    updateGeoTiles();
    renderer.render(scene, camera);
  }
  loop();

  /** @type {ResizeObserver|null} */
  var ro =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(function () {
          resize();
        })
      : null;
  if (ro) ro.observe(host);

  function resize() {
    var w = host.clientWidth || 1;
    var h = host.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  resize();

  /** updateCamera(explore)：与主游戏第三人称起点参数一致（Yaw=0, Pitch=0.48, Dist=9.5） */
  function frameCameraToLevel(level) {
    if (!level || !level.map || !level.map.grid) return;
    var map = level.map;
    var cols = map.grid.cols;
    var rows = map.grid.rows;
    var ts = Number(map.grid.tileSize) || 2;
    camera.near = 0.1;
    camera.far = 10000;
    camera.updateProjectionMatrix();

    var start = { col: Math.floor(cols / 2), row: Math.floor(rows / 2) };
    var explore = getActiveEditorMode() === 'explore';
    if (explore && map.explorationLayout && Array.isArray(map.explorationLayout.path) && map.explorationLayout.path.length > 0) {
      start = map.explorationLayout.path[0];
    } else if (!explore && map.enemyPaths && map.enemyPaths[0] && map.enemyPaths[0].cells && map.enemyPaths[0].cells.length > 0) {
      start = map.enemyPaths[0].cells[0];
    } else if (Array.isArray(map.spawnPoints) && map.spawnPoints.length) start = map.spawnPoints[0];

    var pw = cellCenterXZ(start.col, start.row, cols, rows, ts);
    var yaw = 0;
    var pitch = 0.48;
    var dist = 9.5;

    var tx = pw.x * previewPlayfieldScale;
    var tz = pw.z * previewPlayfieldScale;
    var ty = previewPlayfieldYOffset;
    orbit.target.set(tx, ty + 1.35, tz);
    camera.up.set(0, 1, 0);
    camera.position.set(
      tx + Math.sin(yaw) * dist,
      ty + 1.35 + Math.sin(pitch) * dist,
      tz + Math.cos(yaw) * dist,
    );
    orbit.update();
  }

  /** 布局从「棋盘」切到「预览」后，首帧再量一次尺寸（否则高度仍为 0）。 */
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      resize();
      var lv = getLevel();
      if (lv) frameCameraToLevel(lv);
    });
  });

  function clearActors() {
    actorRoots.forEach(function (obj) {
      transform.detach();
      actorsHolder.remove(obj);
    });
    actorRoots.clear();
    placeholderMeshes.clear();
  }

  function disposeHierarchy(obj) {
    obj.traverse(function (ch) {
      if (ch.geometry) ch.geometry.dispose();
      if (ch.material) {
        if (Array.isArray(ch.material)) ch.material.forEach(function (m) { return m.dispose(); });
        else ch.material.dispose();
      }
    });
  }

  function parseCssColor(v, fallbackHex) {
    if (typeof v === 'number' && Number.isFinite(v)) return v >>> 0;
    var s = v == null ? '' : String(v).trim();
    if (/^#[0-9a-fA-F]{6}$/.test(s)) return parseInt(s.slice(1), 16);
    return fallbackHex >>> 0;
  }

  function obstacleTopFaceTint(obstacleHex, accentHex) {
    var base = new THREE.Color(obstacleHex);
    var accent = new THREE.Color(accentHex);
    return base.clone().lerp(accent, 0.34).offsetHSL(0, 0.035, 0.06).getHex();
  }

  function softPathGuideCenterHex(pathHex, accentHex) {
    return new THREE.Color(pathHex).lerp(new THREE.Color(accentHex), 0.42).offsetHSL(0, 0.02, 0.07).getHex();
  }

  function resolveThemePalette(level) {
    var map = level.map || {};
    var explore = getActiveEditorMode() === 'explore';
    var raw = Object.assign({}, map.theme || {});
    if (explore && map.explorationLayout && map.explorationLayout.theme)
      Object.assign(raw, map.explorationLayout.theme);
    var fogFallback = raw.fog || raw.groundAlt || raw.ground || '#334455';
    return {
      ground: parseCssColor(raw.ground, 0x5a7d82),
      groundAlt: parseCssColor(raw.groundAlt || raw.ground, 0x4f7178),
      path: parseCssColor(raw.path || raw.road, 0x6f9288),
      obstacle: parseCssColor(raw.obstacle, 0x5d6870),
      accent: parseCssColor(raw.accent, 0x8fb8ae),
      fogHex: fogFallback,
    };
  }

  var ED_DEF_COLS = 28;
  var ED_DEF_ROWS = 18;

  function clampDefense(v, lo, hi) {
    return THREE.MathUtils.clamp(v, lo, hi);
  }

  /** 与 Web/map/level-editor.js `expandPathWaypointPolyline` 一致 */
  function expandPathWaypointPolyline(points) {
    var bucket = new Set();
    if (!points || points.length < 2) {
      points = points || [];
      for (var k = 0; k < points.length; k += 1)
        bucket.add(String(points[k].col) + ',' + String(points[k].row));
      return bucket;
    }
    for (var idx = 0; idx < points.length - 1; idx += 1) {
      var start = points[idx];
      var endPt = points[idx + 1];
      var cx = Number(start.col) || 0;
      var cy = Number(start.row) || 0;
      bucket.add(String(cx) + ',' + String(cy));
      while (cx !== Number(endPt.col)) {
        cx += Math.sign(Number(endPt.col) - cx);
        bucket.add(String(cx) + ',' + String(cy));
      }
      while (cy !== Number(endPt.row)) {
        cy += Math.sign(Number(endPt.row) - cy);
        bucket.add(String(cx) + ',' + String(cy));
      }
    }
    return bucket;
  }

  function uniqueDefenseCellsPv(cells, cols, rows) {
    var seen = {};
    var result = [];
    for (var i = 0; i < cells.length; i += 1) {
      var cell = cells[i];
      var normalized = {
        col: clampDefense(Math.round(Number(cell.col) || 0), 0, cols - 1),
        row: clampDefense(Math.round(Number(cell.row) || 0), 0, rows - 1),
      };
      var key = normalized.col + ',' + normalized.row;
      if (seen[key]) continue;
      seen[key] = true;
      result.push(normalized);
    }
    return result;
  }

  function manhattanDefensePv(a, b) {
    return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
  }

  function sameDefenseCellPv(a, b) {
    return !!b && a.col === b.col && a.row === b.row;
  }

  function orderEditorPathCellsDefensePv(cells, start, end, cols, rows) {
    var remaining = uniqueDefenseCellsPv(cells, cols, rows).slice();
    var ordered = [];
    var current = start;
    if (!remaining.some(function (cell) { return sameDefenseCellPv(cell, start); }))
      ordered.push({ col: start.col, row: start.row });
    while (remaining.length > 0) {
      var nextIndex = remaining.findIndex(function (cell) {
        return manhattanDefensePv(cell, current) === 1;
      });
      if (nextIndex < 0) {
        nextIndex = remaining.reduce(function (bestIndex, cell, index) {
          return manhattanDefensePv(cell, current) < manhattanDefensePv(remaining[bestIndex], current)
            ? index
            : bestIndex;
        }, 0);
      }
      var next = remaining.splice(nextIndex, 1)[0];
      ordered.push(next);
      current = next;
    }
    if (!ordered.some(function (cell) { return sameDefenseCellPv(cell, end); })) ordered.push({ col: end.col, row: end.row });
    return uniqueDefenseCellsPv(ordered, cols, rows);
  }

  function projectGridCellDefensePv(cell, cols, rows) {
    return {
      col: clampDefense(Math.round(Number(cell.col) || 0), 0, cols - 1),
      row: clampDefense(Math.round(Number(cell.row) || 0), 0, rows - 1),
    };
  }

  function defensePathSourceCellsPv(map) {
    if (map.enemyPaths) {
      for (var pi = 0; pi < map.enemyPaths.length; pi += 1) {
        var p = map.enemyPaths[pi];
        if (p && p.cells && p.cells.length) return p.cells.slice();
      }
    }
    return map.roads && map.roads.length ? map.roads.slice() : [];
  }

  function buildDefenseFallbackVertexListPv(spawn, objective, cols, rows) {
    var midA = {
      col: clampDefense(Math.floor((spawn.col + objective.col) / 2), 0, cols - 1),
      row: spawn.row,
    };
    var midB = { col: midA.col, row: objective.row };
    return uniqueDefenseCellsPv([spawn, midA, midB, objective], cols, rows);
  }

  /** 与 level-editor.js `getDefenseEditorPathKeys` / main editorLevelToRuntimeMap 一致 */
  function defensePathKeysFromMap(map) {
    if (!map || !map.grid) return new Set();
    var cols = clampDefense(Math.floor(Number(map.grid.cols) || ED_DEF_COLS), 4, 80);
    var rows = clampDefense(Math.floor(Number(map.grid.rows) || ED_DEF_ROWS), 4, 80);
    var objectiveDefault = { col: cols - 1, row: Math.floor(rows / 2) };
    var objective = map.objectivePoint ? projectGridCellDefensePv(map.objectivePoint, cols, rows) : objectiveDefault;
    var spawn = Array.isArray(map.spawnPoints) && map.spawnPoints[0]
      ? projectGridCellDefensePv(map.spawnPoints[0], cols, rows)
      : { col: 0, row: objective.row };
    var raw = defensePathSourceCellsPv(map);
    var projected = uniqueDefenseCellsPv(
      raw.map(function (c) {
        return projectGridCellDefensePv(c, cols, rows);
      }),
      cols,
      rows
    );
    var orderedPath = orderEditorPathCellsDefensePv(projected, spawn, objective, cols, rows);
    var fallbackPath = buildDefenseFallbackVertexListPv(spawn, objective, cols, rows);
    var pathVerts = orderedPath.length >= 2 ? orderedPath : fallbackPath;
    return expandPathWaypointPolyline(pathVerts);
  }

  function pathCellSet(level) {
    /** @type {Set<string>} */
    var bucket = new Set();
    var map = level.map || {};
    var explore = getActiveEditorMode() === 'explore';
    if (explore && map.explorationLayout && Array.isArray(map.explorationLayout.path))
      expandPathWaypointPolyline(map.explorationLayout.path).forEach(function (k) {
        bucket.add(k);
      });
    else
      defensePathKeysFromMap(map).forEach(function (k) {
        bucket.add(k);
      });
    return bucket;
  }

  function obstacleCellSet(level) {
    /** @type {Set<string>} */
    var bucket = new Set();
    var map = level.map || {};
    var explore = getActiveEditorMode() === 'explore';
    if (explore && map.explorationLayout && Array.isArray(map.explorationLayout.obstacles))
      map.explorationLayout.obstacles.forEach(function (c) { bucket.add(cellKeyNum(c.col, c.row)); });
    else if (Array.isArray(map.obstacles)) map.obstacles.forEach(function (c) { bucket.add(cellKeyNum(c.col, c.row)); });
    return bucket;
  }

  function safeZoneCellSet(level) {
    /** @type {Set<string>} */
    var bucket = new Set();
    if (getActiveEditorMode() !== 'explore') return bucket;
    var map = level.map || {};
    var raw = map.explorationLayout && map.explorationLayout.safeZones;
    if (!Array.isArray(raw)) return bucket;
    raw.forEach(function (c) { bucket.add(cellKeyNum(c.col, c.row)); });
    return bucket;
  }

  function cellKeyNum(col, row) {
    return String(col) + ',' + String(row);
  }

  function clearTerrain() {
    while (terrainGroup.children.length) {
      var child = terrainGroup.children[0];
      terrainGroup.remove(child);
      disposeHierarchy(child);
    }
  }

  function matchBuiltInGeoKey(level) {
    var text = [
      level && level.id,
      level && level.name,
      level && level.location && level.location.cityName,
      level && level.location && level.location.regionLabel,
      level && level.location && level.location.cityCode,
    ].filter(Boolean).join(' ').replace(/\s+/g, '');
    /* 京城 常指北京；“奇遇记”类标题可能不含「北京」二字，与编辑器 CITY_EDITOR_ALIASES / runtime resolvePresetGeo 对齐 */
    if (/CN_beijing|city-cn-110100|京城|帝都|故宫|北京|北京市|beijing/i.test(text)) return 'beijing';
    if (/city-cn-370100|中国·济南市|中国·济南|济南市/i.test(text)) return 'jinanOlympic';
    if (/济南|泉城|370100|shandong|cn-370100|shandong_370100/i.test(text)) return 'jinan';
    if (/上海|上海市|shanghai/i.test(text)) return 'shanghai';
    if (/广州|广州市|guangzhou/i.test(text)) return 'guangzhou';
    if (/深圳|深圳市|shenzhen/i.test(text)) return 'shenzhen';
    if (/paris|巴黎/i.test(text)) return 'paris';
    return '';
  }

  /**
   * 与 src/game/editor/editor-sync.ts `geoMapConfigIsUsable` + `resolveEditorLevelGeo` 一致：
   * 若关卡内 map.geo.enabled 为 false 或占位 0,0，应回退到城市预设，否则运行时已有 Cesium 而预览永远没有。
   */
  function geoMapConfigIsUsable(src) {
    if (!src || !src.center) return false;
    if (!src.enabled) return false;
    var lat = Number(src.center.lat);
    var lon = Number(src.center.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
    if (lat === 0 && lon === 0) return false;
    return true;
  }

  /** 与 src/game/editor/editor-sync.ts `resolvePresetGeoForLevel` 同步（正则顺序敏感：济南奥体先于泉城） */
  function resolvePresetGeoForPreview(level) {
    if (!level) return null;
    var text = [
      level.id,
      level.name,
      level.location && level.location.cityCode,
      level.location && level.location.cityName,
      level.location && level.location.regionLabel,
    ].filter(Boolean).join(' ').replace(/\s+/g, '');

    if (/city-cn-370100|中国·济南市|中国·济南|济南市/.test(text)) {
      return BUILT_IN_GEO_CONFIGS.jinanOlympic;
    }
    if (/CN_shandong_370100|泉城浮生录|山东·济南|山东_370100/i.test(text)) {
      return BUILT_IN_GEO_CONFIGS.jinan;
    }
    if (/CN_beijing|city-cn-110100|京城|帝都|故宫|北京|北京市|beijing/i.test(text)) {
      return BUILT_IN_GEO_CONFIGS.beijing;
    }
    if (/CN_shanghai|city-cn-310100|上海|上海市|shanghai/i.test(text)) {
      return BUILT_IN_GEO_CONFIGS.shanghai;
    }
    if (/city-cn-440100|广州|广州市|guangzhou/i.test(text)) {
      return BUILT_IN_GEO_CONFIGS.guangzhou;
    }
    if (/CN_guangdong_440300|city-cn-440300|深圳|深圳市|shenzhen/i.test(text)) {
      return BUILT_IN_GEO_CONFIGS.shenzhen;
    }
    if (/^FRA$|保卫巴黎|卢浮宫|埃菲尔|巴黎|法国|France|Paris|paris/i.test(text)) {
      return BUILT_IN_GEO_CONFIGS.paris;
    }
    return null;
  }

  function normalizeGeoConfig(level) {
    if (!level) return null;
    var stored = (level.map && level.map.geo) || (level.location && level.location.geo);
    var builtin = BUILT_IN_GEO_CONFIGS[matchBuiltInGeoKey(level)];
    var preset = resolvePresetGeoForPreview(level);

    var candidate = stored ?? builtin ?? preset;
    if (!geoMapConfigIsUsable(stored)) {
      candidate = preset ?? builtin ?? stored;
    }
    if (!candidate || !geoMapConfigIsUsable(candidate)) {
      candidate = preset || builtin;
    }
    if (!candidate || !geoMapConfigIsUsable(candidate)) return null;

    var lat = Number(candidate.center.lat);
    var lon = Number(candidate.center.lon);
    return {
      enabled: true,
      provider: candidate.provider || 'cesium-ion',
      assetId: String(candidate.assetId || DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID),
      center: {
        lat: lat,
        lon: lon,
        heightMeters: Number(candidate.center.heightMeters) || 0,
      },
      rotationDeg: Number(candidate.rotationDeg) || 0,
      yOffsetMeters: Number(candidate.yOffsetMeters) || 0,
      boardHeightMeters: Number(candidate.boardHeightMeters) || 32,
      scale: Number(candidate.scale) || 1,
    };
  }

  function boardHeightForLevel(level) {
    var geo = normalizeGeoConfig(level);
    var value = Number(geo && geo.boardHeightMeters);
    return Number.isFinite(value) && value > 0 ? value : 32;
  }

  function geoConfigKey(geo) {
    return [
      geo.provider,
      geo.assetId,
      geo.center.lat,
      geo.center.lon,
      geo.center.heightMeters,
      geo.rotationDeg,
      geo.yOffsetMeters,
      geo.scale,
    ].join(':');
  }

  function getCesiumIonToken() {
    try {
      if (import.meta && import.meta.env && import.meta.env.VITE_CESIUM_ION_TOKEN) {
        return String(import.meta.env.VITE_CESIUM_ION_TOKEN).trim();
      }
    } catch (e) {
      // Static preview can also be opened without Vite transforms.
    }
    return String(window.CESIUM_ION_TOKEN || window.localStorage.getItem('earth-guardian.cesiumIonToken') || '').trim();
  }

  function requestCesiumIonTokenFromAppConfig() {
    if (geoTokenRequest) return geoTokenRequest;
    geoTokenRequest = fetch('/api/app-config', { cache: 'no-store' })
      .then(function (res) {
        return res && res.ok ? res.json() : null;
      })
      .then(function (cfg) {
        var token = cfg && cfg.cesiumIonToken ? String(cfg.cesiumIonToken).trim() : '';
        if (token) {
          window.CESIUM_ION_TOKEN = token;
          try {
            window.localStorage.setItem('earth-guardian.cesiumIonToken', token);
          } catch (ignore) {}
        }
        return token;
      })
      .catch(function () {
        return '';
      })
      .finally(function () {
        geoTokenRequest = null;
      });
    return geoTokenRequest;
  }

  function loadGeoTilesForLevel(level) {
    if (!getGeoMappingEnabled()) {
      disposeGeoTiles();
      return;
    }
    var geo = normalizeGeoConfig(level);
    if (!geo) {
      disposeGeoTiles();
      return;
    }
    var token = getCesiumIonToken();
    if (!token) {
      if (!missingGeoTokenLogged) {
        console.info('[Preview] Cesium ion token missing; using grid terrain fallback.');
        missingGeoTokenLogged = true;
      }
      requestCesiumIonTokenFromAppConfig().then(function (resolvedToken) {
        if (!resolvedToken) return;
        var latestLevel = getLevel();
        if (latestLevel && normalizeGeoConfig(latestLevel)) {
          buildTerrainFromGameLogic(latestLevel);
        }
      });
      disposeGeoTiles();
      return;
    }
    var key = geoConfigKey(geo);
    if (geoTiles && geoTilesKey === key) return;

    disposeGeoTiles();
    geoTilesKey = key;
    geoTiles = new TilesRenderer();
    geoTiles.errorTarget = 8;
    geoTiles.errorThreshold = 40;
    geoTiles.maxTilesProcessed = 24;
    geoTiles.lruCache.minSize = 80;
    geoTiles.lruCache.maxSize = 220;
    geoTiles.registerPlugin(new CesiumIonAuthPlugin({
      apiToken: token,
      assetId: geo.assetId,
      autoRefreshToken: true,
    }));
    geoTiles.registerPlugin(new GLTFExtensionsPlugin({ rtc: true, metadata: true, autoDispose: true }));
    geoTiles.registerPlugin(new TilesFadePlugin({ fadeDuration: 280 }));
    geoTiles.registerPlugin(new UpdateOnChangePlugin());
    geoTiles.registerPlugin(new ReorientationPlugin({
      lat: THREE.MathUtils.degToRad(geo.center.lat),
      lon: THREE.MathUtils.degToRad(geo.center.lon),
      height: geo.center.heightMeters,
      azimuth: THREE.MathUtils.degToRad(geo.rotationDeg),
      up: '+y',
      recenter: true,
    }));
    geoTiles.addEventListener('load-root-tileset', function () {
      geoTiles.group.scale.multiplyScalar(geo.scale > 0 ? geo.scale : 1);
      geoTiles.group.position.y += geo.yOffsetMeters || 0;
    });
    geoTiles.addEventListener('load-error', function (event) {
      console.warn('[PreviewGeoTiles]', event.error);
    });
    geoTiles.group.name = 'preview-geo-tiles';
    geoTiles.group.renderOrder = -10;
    geoGroup.add(geoTiles.group);
    updateGeoTiles();
  }

  function updateGeoTiles() {
    if (!geoTiles) return;
    geoTiles.setCamera(camera);
    geoTiles.setResolutionFromRenderer(camera, renderer);
    geoTiles.update();
  }

  function disposeGeoTiles() {
    if (!geoTiles) {
      geoTilesKey = '';
      return;
    }
    var g = geoTiles.group;
    if (g.parent) g.parent.remove(g);
    geoTiles.dispose();
    geoTiles = null;
    geoTilesKey = '';
  }

  function isJinanLevel(level) {
    var text = [
      level && level.id,
      level && level.name,
      level && level.location && level.location.cityName,
      level && level.location && level.location.regionLabel,
      level && level.location && level.location.cityCode,
    ].filter(Boolean).join(' ').replace(/\s+/g, '');
    return /济南|泉城|370100|shandong|cn-370100|shandong_370100/i.test(text);
  }

  function getJinanMapTexture() {
    if (!jinanMapTexture) {
      jinanMapTexture = textureLoader.load(JINAN_MAP_TEXTURE_URL);
      if (THREE.SRGBColorSpace) jinanMapTexture.colorSpace = THREE.SRGBColorSpace;
    }
    return jinanMapTexture;
  }

  function addJinanTexturePlane(cols, rows, ts) {
    var plane = new THREE.Mesh(
      new THREE.PlaneGeometry(cols * ts, rows * ts),
      new THREE.MeshBasicMaterial({ map: getJinanMapTexture() }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0.05;
    terrainGroup.add(plane);
  }

  function addJinanPathGuides(path, cols, rows, ts, pathHex, accentHex) {
    if (!Array.isArray(path) || path.length < 2) return;
    var laneMat = new THREE.MeshBasicMaterial({
      color: pathHex,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });
    var centerMat = new THREE.MeshBasicMaterial({
      color: softPathGuideCenterHex(pathHex, accentHex),
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    var pathKeys = expandPathWaypointPolyline(path);
    pathKeys.forEach(function (key) {
      var parts = key.split(',');
      var cell = { col: Number(parts[0]) || 0, row: Number(parts[1]) || 0 };
      var pos = cellCenterXZ(cell.col, cell.row, cols, rows, ts);
      var directions = [
        { dc: -1, dr: 0, x: -1, z: 0 },
        { dc: 1, dr: 0, x: 1, z: 0 },
        { dc: 0, dr: -1, x: 0, z: -1 },
        { dc: 0, dr: 1, x: 0, z: 1 },
      ].filter(function (dir) {
        return pathKeys.has(cellKeyNum(cell.col + dir.dc, cell.row + dir.dr));
      });
      var connected = directions.length ? directions : [{ x: 0, z: 1 }];

      var hubLane = new THREE.Mesh(new THREE.PlaneGeometry(ts * 0.62, ts * 0.62), laneMat);
      hubLane.rotation.x = -Math.PI / 2;
      hubLane.position.set(pos.x, 0.18, pos.z);
      terrainGroup.add(hubLane);

      var hubCenter = new THREE.Mesh(new THREE.CircleGeometry(ts * 0.12, 18), centerMat);
      hubCenter.rotation.x = -Math.PI / 2;
      hubCenter.position.set(pos.x, 0.2, pos.z);
      terrainGroup.add(hubCenter);

      connected.forEach(function (dir) {
        var horizontal = dir.x !== 0;
        var lane = new THREE.Mesh(
          new THREE.PlaneGeometry(horizontal ? ts * 0.72 : ts * 0.52, horizontal ? ts * 0.52 : ts * 0.72),
          laneMat,
        );
        lane.rotation.x = -Math.PI / 2;
        lane.position.set(pos.x + dir.x * ts * 0.25, 0.18, pos.z + dir.z * ts * 0.25);
        terrainGroup.add(lane);

        var center = new THREE.Mesh(
          new THREE.PlaneGeometry(horizontal ? ts * 0.72 : ts * 0.14, horizontal ? ts * 0.14 : ts * 0.72),
          centerMat,
        );
        center.rotation.x = -Math.PI / 2;
        center.position.set(lane.position.x, 0.2, lane.position.z);
        terrainGroup.add(center);
      });
    });
  }

  function previewBoardFootprintClipPlanes(halfWidthX, halfDepthZ) {
    return [
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), halfWidthX),
      new THREE.Plane(new THREE.Vector3(1, 0, 0), halfWidthX),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), halfDepthZ),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), halfDepthZ),
    ];
  }

  function decorClampPctPreview(v, fallback) {
    var n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(100, n));
  }

  function decorClamp01Preview(v, fallback) {
    var n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(1, n));
  }

  /** 与 map-runtime `addBoardDecorImageLayers` 对齐；裁剪范围按 terrainGroup 世界缩放计算 */
  function addBoardDecorImageLayersPreview(map, cols, rows, ts, decorYLocal) {
    var layers = map.boardImageLayers;
    if (!layers || !layers.length) return;
    var spanX = cols * ts;
    var spanZ = rows * ts;
    var sc = Number(previewPlayfieldScale);
    if (!Number.isFinite(sc) || sc <= 0) sc = 1;
    var clipPlanes = previewBoardFootprintClipPlanes((spanX * 0.5) * sc, (spanZ * 0.5) * sc);
    var sorted = layers.slice().sort(function (a, b) {
      return (Number(a.order) || 0) - (Number(b.order) || 0);
    });
    sorted.forEach(function (layer) {
      var src = typeof layer.src === 'string' ? layer.src.trim() : '';
      if (!src) return;
      var url = src.indexOf('data:') === 0 ? src : resolveAssetPath(src);
      textureLoader.load(
        url,
        function (tex) {
          if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
          tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
          var aspect = 1;
          if (Number.isFinite(Number(layer.aspect)) && Number(layer.aspect) > 0) aspect = Number(layer.aspect);
          if (tex.image && tex.image.width > 0) aspect = tex.image.height / tex.image.width;
          var widthPct = decorClampPctPreview(layer.widthPct, 45);
          var planeW = (widthPct / 100) * spanX;
          var planeH = planeW * aspect;
          var leftPct = decorClampPctPreview(layer.centerX, 0);
          var topPct = decorClampPctPreview(layer.centerY, 0);
          var wx0 = -spanX / 2 + (leftPct / 100) * spanX;
          var wz0 = -spanZ / 2 + (topPct / 100) * spanZ;
          var cx = wx0 + planeW / 2;
          var cz = wz0 + planeH / 2;
          var opacity = decorClamp01Preview(layer.opacity != null ? layer.opacity : 1, 1);
          var mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(planeW, planeH),
            new THREE.MeshBasicMaterial({
              map: tex,
              transparent: opacity < 0.999,
              opacity: opacity,
              depthWrite: false,
              polygonOffset: true,
              polygonOffsetFactor: -1.35,
              polygonOffsetUnits: -1.35,
              clipping: true,
              clippingPlanes: clipPlanes,
              clipIntersection: false,
            }),
          );
          mesh.rotation.x = -Math.PI / 2;
          mesh.position.set(cx, decorYLocal, cz);
          mesh.renderOrder = 4;
          terrainGroup.add(mesh);
        },
        undefined,
        function () {
          console.warn('[Preview] boardImageLayer load failed:', src.slice(0, 80));
        },
      );
    });
  }

  /** 与 TowerDefenseGame.drawTerrain / renderVisibleMap 一致 */
  function buildTerrainFromGameLogic(level) {
    clearTerrain();
    var map = level.map;
    var cols = map.grid.cols;
    var rows = map.grid.rows;
    var ts = Number(map.grid.tileSize) || 2;
    var pal = resolveThemePalette(level);
    var fogHex = parseCssColor(pal.fogHex || '#071019', 0x071019);
    var isJinan = isJinanLevel(level);
    var usesGeoBackdrop =
      !!getGeoMappingEnabled() && !!normalizeGeoConfig(level) && !!getCesiumIonToken();
    setPreviewPlayfieldScale(
      usesGeoBackdrop && getActiveEditorMode() === 'defense' ? 20 : 1,
      usesGeoBackdrop && getActiveEditorMode() === 'defense' ? boardHeightForLevel(level) : 0,
    );
    scene.background = new THREE.Color(usesGeoBackdrop ? 0x9eb8c4 : fogHex);
    scene.fog = null;
    scene.fog = usesGeoBackdrop ? new THREE.Fog(0x9eb8c4, 1500, 8500) : new THREE.Fog(fogHex, 150, 320);

    /* 与运行时 TowerDefenseGame 对齐：Cesium 底图不随棋盘 XZ 缩放，只有关卡棋盘和 Actor 放大到城市尺度。 */
    if (usesGeoBackdrop) loadGeoTilesForLevel(level);
    else disposeGeoTiles();

    var pathCells = pathCellSet(level);
    var obstacleCells = obstacleCellSet(level);
    var safeZoneCells = safeZoneCellSet(level);

    var safeZonePreviewMat = new THREE.MeshBasicMaterial({
      color: 0x22dd77,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });

    var tileGeom = new THREE.BoxGeometry(ts * 0.96, 0.18, ts * 0.96);
    var pathGeom = new THREE.BoxGeometry(ts * 0.98, 0.22, ts * 0.98);
    var obstacleGeom = new THREE.BoxGeometry(ts * 0.85, 1.2, ts * 0.85);

    var groundMat = new THREE.MeshStandardMaterial({ color: pal.ground, roughness: 0.9, metalness: 0 });
    var groundAltMat = new THREE.MeshStandardMaterial({ color: pal.groundAlt, roughness: 0.92, metalness: 0 });
    var pathMat = new THREE.MeshStandardMaterial({
      color: pal.path,
      emissive: pal.path,
      emissiveIntensity: 0.05,
      roughness: 0.3,
      polygonOffset: true,
      polygonOffsetFactor: -2.4,
      polygonOffsetUnits: -2.4,
    });
    var obstacleMat = new THREE.MeshStandardMaterial({
      color: pal.obstacle,
      roughness: 0.88,
      metalness: 0,
    });
    var capHighlight = obstacleTopFaceTint(pal.obstacle, pal.accent);
    var capMat = new THREE.MeshStandardMaterial({
      color: capHighlight,
      roughness: 0.94,
      metalness: 0,
    });
    if (usesGeoBackdrop) {
      groundMat.transparent = true;
      groundMat.opacity = 0.48;
      groundMat.depthWrite = false;
      groundAltMat.transparent = true;
      groundAltMat.opacity = 0.48;
      groundAltMat.depthWrite = false;
      pathMat.transparent = true;
      pathMat.opacity = 0.92;
      pathMat.depthWrite = false;
    }
    var jinanGlowMat = new THREE.MeshBasicMaterial({
      color: pal.path,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    var jinanBorderMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(pal.path).offsetHSL(0, 0.02, 0.14).getHex(),
      transparent: true,
      opacity: 0.78,
    });

    for (var row = 0; row < rows; row += 1) {
      for (var col = 0; col < cols; col += 1) {
        var key = cellKeyNum(col, row);
        var pos = cellCenterXZ(col, row, cols, rows, ts);
        var x = pos.x;
        var z = pos.z;

        if (pathCells.has(key)) {
          if (usesGeoBackdrop) {
            var pMeshGeo = new THREE.Mesh(pathGeom, pathMat);
            pMeshGeo.position.set(x, 0.14, z);
            pMeshGeo.renderOrder = 6;
            pMeshGeo.receiveShadow = true;
            terrainGroup.add(pMeshGeo);
          } else if (isJinan) {
            var glowMat = usesGeoBackdrop
              ? new THREE.MeshBasicMaterial({ color: pal.path, transparent: true, opacity: 0.58, depthWrite: false })
              : jinanGlowMat;
            var glow = new THREE.Mesh(new THREE.PlaneGeometry(ts * 0.96, ts * 0.96), glowMat);
            glow.rotation.x = -Math.PI / 2;
            glow.position.set(x, 0.12, z);
            terrainGroup.add(glow);

            var border = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(ts * 0.96, ts * 0.96)), jinanBorderMat);
            border.rotation.x = -Math.PI / 2;
            border.position.set(x, 0.13, z);
            terrainGroup.add(border);
          } else {
            var pMesh = new THREE.Mesh(pathGeom, pathMat);
            pMesh.position.set(x, 0.02, z);
            pMesh.receiveShadow = true;
            terrainGroup.add(pMesh);
          }
        } else if (obstacleCells.has(key)) {
          var oMesh = new THREE.Mesh(obstacleGeom, obstacleMat);
          oMesh.position.set(x, 0.6, z);
          oMesh.castShadow = true;
          oMesh.receiveShadow = true;
          if (usesGeoBackdrop || !isJinan) terrainGroup.add(oMesh);

          var cap = new THREE.Mesh(new THREE.BoxGeometry(ts * 0.82, 0.1, ts * 0.82), capMat);
          cap.position.set(x, 1.3, z);
          if (usesGeoBackdrop || !isJinan) terrainGroup.add(cap);
        } else {
          var grass = new THREE.Mesh(tileGeom, (col + row) % 2 === 0 ? groundMat : groundAltMat);
          grass.position.set(x, 0, z);
          grass.receiveShadow = true;
          if (usesGeoBackdrop || !isJinan) terrainGroup.add(grass);
        }
        if (getActiveEditorMode() === 'explore' && safeZoneCells.has(key)) {
          var szPlane = new THREE.Mesh(new THREE.PlaneGeometry(ts * 0.94, ts * 0.94), safeZonePreviewMat);
          szPlane.rotation.x = -Math.PI / 2;
          szPlane.position.set(x, 0.16, z);
          szPlane.renderOrder = 8;
          terrainGroup.add(szPlane);
        }
      }
    }

    if (isJinan && !usesGeoBackdrop) {
      addJinanTexturePlane(cols, rows, ts);
      var guidePath = getActiveEditorMode() === 'explore' && map.explorationLayout && Array.isArray(map.explorationLayout.path)
        ? map.explorationLayout.path
        : defensePathSourceCellsPv(map);
      addJinanPathGuides(guidePath, cols, rows, ts, pal.path, pal.accent);
    }

    var trimmedBoard = String((map.theme && map.theme.boardTextureUrl) || '').trim();
    var hasCustomBoardImage = trimmedBoard.length > 0;
    var jinanPresetBoard = isJinan && !hasCustomBoardImage;
    var flatBoardMode = !usesGeoBackdrop && (jinanPresetBoard || hasCustomBoardImage);
    var decorYPreview = usesGeoBackdrop ? 0.048 : flatBoardMode ? 0.063 : 0.098;
    addBoardDecorImageLayersPreview(map, cols, rows, ts, decorYPreview);
  }

  function setPreviewPlayfieldScale(scale, yOffset) {
    previewPlayfieldScale = scale;
    previewPlayfieldYOffset = Number(yOffset) || 0;
    terrainGroup.scale.set(scale, 1, scale);
    terrainGroup.position.y = previewPlayfieldYOffset;
    actorsHolder.scale.set(scale, 1, scale);
    actorsHolder.position.y = previewPlayfieldYOffset;
  }

  function attachActorObject(actorId, obj) {
    var prev = actorRoots.get(actorId);
    if (prev) actorsHolder.remove(prev);
    actorRoots.set(actorId, obj);
    actorsHolder.add(obj);
  }

  async function ensureActorMesh(actor, level) {
    var cols = level.map.grid.cols;
    var rows = level.map.grid.rows;
    var ts = level.map.grid.tileSize;
    ensureOffset(actor);

    var group = new THREE.Group();
    group.userData.actorId = actor.id;
    group.userData.draggableActor = true;

    var ox = actor.worldOffsetMeters.x;
    var oy = actor.worldOffsetMeters.y;
    var oz = actor.worldOffsetMeters.z;
    var c = cellCenterXZ(actor.col, actor.row, cols, rows, ts);
    group.position.set(c.x + ox, oy, c.z + oz);
    group.rotation.set(0, degToRad(Number(actor.rotation) || 0), 0);
    var sc = Number(actor.scale) > 0 ? Number(actor.scale) : 1;
    /* actorsHolder 使用 (sx,1,sz) 时需按 Y 补偿，否则会像主游戏棋盘单位一样显得被拍扁 */
    if (previewPlayfieldScale !== 1) {
      group.scale.set(sc, sc * previewPlayfieldScale, sc);
    } else {
      group.scale.setScalar(sc);
    }

    var catalog = getCatalog && getCatalog();
    var assets = (catalog && catalog.modelAssets) || [];
    var extraAssets = (catalog && catalog.editorAssetsCatalog) || [];
    var gmAssets = (catalog && catalog.gameModels) || [];
    var asset = actor.modelId
      ? assets.find(function (a) {
          return a.id === actor.modelId;
        }) ||
        extraAssets.find(function (a) {
          return a.id === actor.modelId;
        }) ||
        gmAssets.find(function (a) {
          return a.id === actor.modelId;
        })
      : null;
    var url = asset ? resolveAssetPath(asset.path || asset.publicUrl) : resolveAssetPath(actor.modelPath || '');

    if (url && /\.(glb|gltf)(\?|$)/i.test(url)) {
      try {
        var tmpl = await loadGlTFRoot(url);
        var mesh = tmpl.clone(true);
        mesh.traverse(function (ch) {
          if (ch.isMesh && ch.material) ch.castShadow = true;
        });
        group.add(mesh);
      } catch (e) {
        console.warn('[PreviewGLTF]', e);
        addPlaceholderCube(group, actor);
      }
    } else if (url) {
      console.warn('[Preview] unsupported model format:', url);
      addPlaceholderCube(group, actor);
    } else {
      addPlaceholderCube(group, actor);
    }

    return group;
  }

  function addPlaceholderCube(group, actor) {
    var hue = actor.category === 'tower' ? 0x63e6be : actor.category === 'enemy' ? 0xff8899 : 0xc084fc;
    var ts = placeholderSize(actor);
    var geo = new THREE.BoxGeometry(ts, ts, ts);
    var mat = new THREE.MeshStandardMaterial({ color: hue, roughness: 0.5, metalness: 0.08 });
    var cube = new THREE.Mesh(geo, mat);
    cube.castShadow = true;
    cube.userData.placeholderLabel = actor.name ? actor.name.slice(0, 8) : 'Actor';
    group.add(cube);
    placeholderMeshes.set(actor.id, cube);
  }

  function placeholderSize(actor) {
    var level = getLevel();
    var base = level && level.map.grid ? level.map.grid.tileSize * 0.36 : 0.72;
    return actor.category === 'objective' ? base * 1.4 : base;
  }

  function loadGlTFRoot(url) {
    var cached = gltfCache.get(url);
    if (cached) return Promise.resolve(cached.clone(true));
    return new Promise(function (resolve, reject) {
      gltfLoader.load(
        url,
        function (gltf) {
          gltfCache.set(url, gltf.scene);
          resolve(gltf.scene.clone(true));
        },
        undefined,
        reject,
      );
    });
  }

  function refresh(opts) {
    opts = opts || {};
    var preserveView = !!opts.preserveView;
    var selectAfter = opts.selectActorId != null && opts.selectActorId !== '' ? opts.selectActorId : null;

    hidePlacementPreview();
    var level = getLevel();
    selectionId = null;
    transform.detach();   // detach() already sets helper.visible = false
    clearActors();
    clearTerrain();
    if (!level) return;
    buildTerrainFromGameLogic(level);
    if (!preserveView) frameCameraToLevel(level);
    resize();

    Promise.all((level.map.actors || []).map(function (actor) { return ensureActorMesh(actor, level); }))
      .then(function (objs) {
        (level.map.actors || []).forEach(function (actor, idx) {
          attachActorObject(actor.id, objs[idx]);
        });
        resize();
        if (!preserveView) frameCameraToLevel(level);
        if (selectAfter && actorRoots.has(selectAfter)) {
          setSelectedActor(selectAfter);
          if (onSelectActor) onSelectActor(selectAfter);
        }
      })
      .catch(function (err) {
        console.warn('[Preview] actor build:', err);
      });
  }

  function eulerYawDegreesFromQuaternion(q) {
    var e = new THREE.Euler(0, 0, 0, 'YXZ');
    e.setFromQuaternion(q instanceof THREE.Quaternion ? q : new THREE.Quaternion(q.x, q.y, q.z, q.w));
    return radToDeg(e.y);
  }

  function logicalActorScaleFromObjectScale(scaleVec) {
    var lx = Number(scaleVec.x);
    var lz = Number(scaleVec.z);
    var ly = Number(scaleVec.y);
    if (previewPlayfieldScale !== 1 && previewPlayfieldScale > 1e-6) {
      ly = ly / previewPlayfieldScale;
    }
    var u = lx;
    if (Number.isFinite(lx) && Number.isFinite(lz) && lx > 1e-6 && lz > 1e-6) {
      u = Math.abs(lx - lz) < 1e-4 ? lx : (lx + lz) * 0.5;
    } else if (Number.isFinite(ly) && ly > 1e-6) {
      u = ly;
    } else if (Number.isFinite(lx) && lx > 1e-6) {
      u = lx;
    } else if (Number.isFinite(lz) && lz > 1e-6) {
      u = lz;
    } else {
      u = 1;
    }
    return u > 1e-6 ? u : 1;
  }

  function syncSelectedFromScene(silentOnly) {
    var level = getLevel();
    if (!level || !selectionId) return;
    var obj = actorRoots.get(selectionId);
    var actor = (level.map.actors || []).find(function (a) { return a.id === selectionId; });
    if (!obj || !actor) return;

    obj.updateWorldMatrix(true, false);
    ensureOffset(actor);
    var cols = level.map.grid.cols;
    var rows = level.map.grid.rows;
    var ts = level.map.grid.tileSize;

    var wp = obj.getWorldPosition(new THREE.Vector3());
    var logical = logicalPointFromWorldHit(wp);
    var anc = worldToAnchor(logical.x, logical.z, cols, rows, ts);
    actor.col = anc.col;
    actor.row = anc.row;
    var c = cellCenterXZ(anc.col, anc.row, cols, rows, ts);
    actor.worldOffsetMeters.x = logical.x - c.x;
    actor.worldOffsetMeters.y = logical.y;
    actor.worldOffsetMeters.z = logical.z - c.z;

    actor.rotation = eulerYawDegreesFromQuaternion(obj.quaternion);

    actor.scale = logicalActorScaleFromObjectScale(obj.scale);

    if (!silentOnly && onActorModified) onActorModified(actor);
  }

  function setSelectedActor(id) {
    selectionId = id || null;
    transform.detach();   // detach() sets helper.visible = false
    if (!selectionId) return;
    var obj = actorRoots.get(selectionId);
    if (!obj) return;
    transform.attach(obj);  // attach() sets helper.visible = true
    transform.setSpace('world');
    transform.setMode('translate');
  }

  function logicalPointFromWorldHit(worldPoint) {
    var v = worldPoint instanceof THREE.Vector3 ? worldPoint : new THREE.Vector3(worldPoint.x, worldPoint.y, worldPoint.z);
    return {
      x: v.x / previewPlayfieldScale,
      y: v.y - previewPlayfieldYOffset,
      z: v.z / previewPlayfieldScale,
    };
  }

  function boardCenterLogicalHit(level) {
    var g = level && level.map && level.map.grid ? level.map.grid : null;
    if (!g) return { x: 0, y: 0, z: 0 };
    var ts = g.tileSize != null ? g.tileSize : 2;
    var cols = g.cols || 28;
    var rows = g.rows || 18;
    var col = Math.floor(cols / 2);
    var row = Math.floor(rows / 2);
    return {
      x: (col - cols / 2 + 0.5) * ts,
      y: 0,
      z: (row - rows / 2 + 0.5) * ts,
    };
  }

  function hidePlacementPreview() {
    if (placementHud) placementHud.style.display = 'none';
    if (placementGhost) placementGhost.visible = false;
  }

  function escPlacementHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function shortenModelLabel(path) {
    var s = String(path || '').trim();
    if (!s) return '—';
    var tail = s.split(/[/\\?#]/).filter(Boolean).pop() || s;
    if (tail.length > 42) return tail.slice(0, 40) + '…';
    return tail;
  }

  function collectPlacementMeshes(placeOpts) {
    var po = placeOpts || {};
    var list = [];
    terrainGroup.updateMatrixWorld(true);
    terrainGroup.traverse(function (ch) {
      if (ch.isMesh) list.push(ch);
    });
    if (po.includeActors !== false) {
      actorRoots.forEach(function (grp) {
        grp.updateMatrixWorld(true);
        grp.traverse(function (ch) {
          if (ch.isMesh) list.push(ch);
        });
      });
    }
    if (po.includeGeo && geoTiles && geoTiles.group) {
      geoTiles.group.updateMatrixWorld(true);
      geoTiles.group.traverse(function (ch) {
        if (ch.isMesh && ch.visible) list.push(ch);
      });
    }
    return list;
  }

  function raycastPlaceSurface(clientX, clientY, placeOpts) {
    var rect = renderer.domElement.getBoundingClientRect();
    var nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    var ny = -((clientY - rect.top) / rect.height) * 2 + 1;
    var ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
    var meshes = collectPlacementMeshes(placeOpts);
    if (meshes.length) {
      var th = ray.intersectObjects(meshes, true);
      if (th.length) {
        var p = th[0].point.clone();
        var n = new THREE.Vector3(0, 1, 0);
        if (th[0].face && th[0].object) {
          n.copy(th[0].face.normal);
          n.transformDirection(th[0].object.matrixWorld);
          if (n.lengthSq() < 1e-8) n.set(0, 1, 0);
          else n.normalize();
        }
        return { logical: logicalPointFromWorldHit(p), worldPoint: p, normal: n };
      }
    }
    var plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -previewPlayfieldYOffset);
    var hit = new THREE.Vector3();
    var ok = ray.ray.intersectPlane(plane, hit);
    if (!ok) return null;
    return { logical: logicalPointFromWorldHit(hit), worldPoint: hit.clone(), normal: new THREE.Vector3(0, 1, 0) };
  }

  function showPlacementPreview(clientX, clientY) {
    if (!placementHud || !placementGhost) return;
    var meta =
      typeof window !== 'undefined' &&
      window.__egCatalogDragMeta &&
      typeof window.__egCatalogDragMeta === 'object'
        ? window.__egCatalogDragMeta
        : null;
    var level = getLevel();
    if (!meta || !level || !level.map || !level.map.grid) {
      hidePlacementPreview();
      return;
    }
    var hitInfo = raycastPlaceSurface(clientX, clientY, { includeActors: true, includeGeo: true });
    if (!hitInfo || !hitInfo.logical) {
      hidePlacementPreview();
      return;
    }
    var logical = hitInfo.logical;
    var cols = level.map.grid.cols || 28;
    var rows = level.map.grid.rows || 18;
    var ts = Number(level.map.grid.tileSize) || 2;
    var anc = worldToAnchor(logical.x, logical.z, cols, rows, ts);
    placementHud.style.display = 'block';
    var title = meta.name || meta.assetId || '模型';
    var fp = meta.modelPath || '';
    placementHud.innerHTML = [
      '<div class="preview-placement-hud__title">放置：' + escPlacementHtml(title) + '</div>',
      '<div class="preview-placement-hud__path" title="' + escPlacementHtml(fp) + '">' + escPlacementHtml(shortenModelLabel(fp)) + '</div>',
      '<div class="preview-placement-hud__snap">吸附 · 棋盘格 (' + anc.col + ', ' + anc.row + ') · 高度约 ' +
        logical.y.toFixed(2) +
        ' m · 缩放×' +
        previewPlayfieldScale +
        '</div>',
    ].join('');
    placementGhost.visible = true;
    var box = ts * 0.42;
    box *= Math.min(2.2, Math.max(0.35, previewPlayfieldScale));
    if (!(box > 0.12) || !Number.isFinite(box)) box = 0.5;
    placementGhost.scale.set(box, box, box);
    placementGhost.position.copy(hitInfo.worldPoint);
    placementGhost.position.addScaledVector(hitInfo.normal, box * 0.52);
  }

  function onHostDragOver(ev) {
    previewDnDAllow(ev);
    showPlacementPreview(ev.clientX, ev.clientY);
  }

  function raycastGround(clientX, clientY) {
    var rect = renderer.domElement.getBoundingClientRect();
    var nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    var ny = -((clientY - rect.top) / rect.height) * 2 + 1;
    var ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
    var terrainMeshes = [];
    terrainGroup.updateMatrixWorld(true);
    terrainGroup.traverse(function (ch) {
      if (ch.isMesh) terrainMeshes.push(ch);
    });
    if (terrainMeshes.length) {
      var th = ray.intersectObjects(terrainMeshes, true);
      if (th.length) {
        return logicalPointFromWorldHit(th[0].point);
      }
    }
    var plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -previewPlayfieldYOffset);
    var hit = new THREE.Vector3();
    var ok = ray.ray.intersectPlane(plane, hit);
    return ok ? logicalPointFromWorldHit(hit) : null;
  }

  function readDnDPayload(dataTransfer) {
    if (!dataTransfer) return null;
    function tryParse(raw) {
      var s = raw == null ? '' : String(raw).trim();
      if (!s) return null;
      try {
        return JSON.parse(s);
      } catch (e) {
        return null;
      }
    }
    var payload = tryParse(dataTransfer.getData('application/json'));
    if (payload && Object.keys(payload).length) return payload;
    payload = tryParse(dataTransfer.getData('text/plain'));
    if (payload && Object.keys(payload).length) return payload;
    var types = [];
    try {
      types = dataTransfer.types ? Array.prototype.slice.call(dataTransfer.types) : [];
    } catch (e2) {
      types = [];
    }
    for (var i = 0; i < types.length; i += 1) {
      var mime = types[i];
      if (mime === 'Files' || mime === 'text/uri-list') continue;
      payload = tryParse(dataTransfer.getData(mime));
      if (payload && Object.keys(payload).length) return payload;
    }
    return null;
  }

  function previewDnDAllow(ev) {
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy';
  }

  var previewDnDAbortController = null;
  function teardownPreviewDnD() {
    if (previewDnDAbortController) {
      try {
        previewDnDAbortController.abort();
      } catch (e) {
      }
      previewDnDAbortController = null;
    }
  }

  function onHostDrop(ev) {
    ev.preventDefault();
    var level = getLevel();
    if (!level) return;
    var payload = readDnDPayload(ev.dataTransfer);
    hidePlacementPreview();
    if (!payload) return;

    var hitInfo = raycastPlaceSurface(ev.clientX, ev.clientY, { includeActors: true, includeGeo: true });
    var hb = boardCenterLogicalHit(level);
    var use = (hitInfo && hitInfo.logical) || hb || { x: 0, y: 0, z: 0 };

    if (payload.kind === 'catalogModel') {
      if (options.onDropCatalogModel)
        options.onDropCatalogModel({
          assetId: payload.assetId || payload.id,
          worldX: use.x,
          worldY: use.y,
          worldZ: use.z,
        });
      return;
    }
    if (payload.kind === 'template') {
      if (options.onDropActorTemplate)
        options.onDropActorTemplate({
          templateId: payload.id,
          worldX: use.x,
          worldY: use.y,
          worldZ: use.z,
        });
    }
  }

  teardownPreviewDnD();
  if (typeof AbortController !== 'undefined') {
    previewDnDAbortController = new AbortController();
    var dnOpts = { signal: previewDnDAbortController.signal };
    host.addEventListener('dragenter', previewDnDAllow, dnOpts);
    host.addEventListener('dragover', onHostDragOver, dnOpts);
    host.addEventListener('drop', onHostDrop, dnOpts);
  } else {
    host.addEventListener('dragenter', previewDnDAllow);
    host.addEventListener('dragover', onHostDragOver);
    host.addEventListener('drop', onHostDrop);
  }

  renderer.domElement.addEventListener(
    'pointerdown',
    function (evt) {
    if (evt.button !== 0) return;
    // Let TransformControls handle gizmo handle clicks (axis is set when hovering over a handle)
    if (transform.axis !== null || transform.dragging) return;

    var rect = renderer.domElement.getBoundingClientRect();
    var nx = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
    var ny = -((evt.clientY - rect.top) / rect.height) * 2 + 1;
    var ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(nx, ny), camera);

    var list = [];
    actorRoots.forEach(function (grp) {
      grp.traverse(function (ch) {
        if (ch.isMesh) list.push(ch);
      });
    });
    // Use recursive=true so deeply nested GLTF meshes are correctly hit-tested
    var hits = ray.intersectObjects(list, true);
    if (hits.length) {
      var o = hits[0].object;
      while (o && !o.userData.actorId && o.parent) o = o.parent;
      var aid = o && o.userData.actorId;
      if (aid) {
        setSelectedActor(aid);
        if (onSelectActor) onSelectActor(aid);
        evt.preventDefault();
        evt.stopPropagation();
        return;
      }
    }
    // Clicked empty space — deselect
    if (selectionId) {
      setSelectedActor(null);
      if (onSelectActor) onSelectActor(null);
    }
  },
    true,
  );

  function setTransformMode(mode) {
    if (mode === 'rotate' || mode === 'scale' || mode === 'translate') {
      transform.setMode(mode);
    }
  }

  function focusSelection() {
    var level = getLevel();
    if (!level || !selectionId) return;
    var obj = actorRoots.get(selectionId);
    if (!obj) return;

    var box = new THREE.Box3().setFromObject(obj);
    var sphere = box.getBoundingSphere(new THREE.Sphere());
    orbit.target.copy(box.getCenter(new THREE.Vector3()));

    var dist = Math.max(sphere.radius * 2.8, 14);
    var dir = new THREE.Vector3(1.1, 0.72, 1.05).normalize();
    camera.position.copy(orbit.target.clone().add(dir.multiplyScalar(dist)));
    orbit.update();
  }

  function dispose() {
    teardownPreviewDnD();
    if (onWindowDragEndForPreview) {
      window.removeEventListener('dragend', onWindowDragEndForPreview);
      onWindowDragEndForPreview = null;
    }
    if (placementGhost) {
      scene.remove(placementGhost);
      placementGhost.geometry.dispose();
      placementGhost.material.dispose();
      placementGhost = null;
    }
    placementHud = null;
    window.removeEventListener('keydown', onKeyDown);
    if (rafHook.__raf) cancelAnimationFrame(rafHook.__raf);
    disposeGeoTiles();
    scene.remove(transformHelper);
    transform.dispose();
    orbit.dispose();
    renderer.dispose();
    if (ro) ro.disconnect();
    actorRoots.clear();
    host.innerHTML = '';
    gltfCache.clear();
  }

  refresh();

  return {
    refresh: function (opts) {
      refresh(opts || {});
    },
    resize: resize,
    dispose: dispose,
    setSelectedActor: setSelectedActor,
    setTransformMode: setTransformMode,
    focusSelection: focusSelection,
    getRendererCanvas: function () {
      return renderer.domElement;
    },
  };
}
