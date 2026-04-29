import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  applyModelScalesFromRecord as applyPersistedModelScales,
  createDefaultModelScales,
  getClampedUserScale as getPersistedUserScale,
  loadAnimationAsset,
  loadCustomAnimationsFromEditorUrls as loadPersistedAnimations,
  loadCustomModelAsset,
  loadModelFromUrl as loadPersistedModelFromUrl,
  loadPersistedGameAssetConfig,
  modelTargetLabel as getModelTargetLabel,
  parseModelData as parsePersistedModelData,
  prepareUploadedModel as normalizeUploadedModel,
  uploadModelFile as uploadPersistedModelFile,
} from "./asset-loading";
import { BUILD_SPECS, CITY_EDITOR_ALIASES, CITY_MAP, GACHA_POOLS } from "./content";
import { createEnemyForWave, findNearestEnemyTarget, getTowerBuffMultiplier } from "./defense-runtime";
import {
  getDefaultEnemyGlbUrl,
  getEnemyTargetBodyDiameter,
} from "./enemy-default-models";
import {
  createDefenseMoneyDrop,
  createExploreMoneyDrop,
  getAvailableMoneyDropCells,
  updateAutoCollectDrops,
  updateMoneyDropVisibility,
} from "./drops-runtime";
import { 
  addAuroraLaserEffect, 
  addBeamEffect, 
  addExplosionEffect, 
  addTowerProjectileImpactFx,
  updateTimedEffects,
  addStatusOutlineEffect
} from "./effects-runtime";
import { collectExploreDrops, getExploreMoveIntent, orientPlayerToMovement } from "./explore-runtime";
import { hydrateEditorLevelGeo } from "./geo-levels";
import { GeoTilesRuntime, canUseGeoTiles } from "./geo-tiles-runtime";
import { DEFAULT_PLAYER_MODEL_URLS, INITIAL_BASE_HP, INITIAL_MONEY } from "./game-config";
import {
  editorLevelRuntimePriority,
} from "./editor-runtime";
import { syncEditorLevelsToRuntime } from "./editor-sync";
import { getAvailableGachaPools, getGachaPoolDisplayModel, performGachaDraw, resolveSelectedGachaPoolId } from "./gacha";
import {
  applyCameraZoom,
  beginCameraDrag as beginInputCameraDrag,
  bindGameInputHandlers,
  endCameraDrag as endInputCameraDrag,
  resizeViewport,
  rotateCameraFromPointer as rotateInputCameraFromPointer,
  shouldStartCameraDrag as shouldStartInputCameraDrag,
} from "./input-controls";
import { buildRuntimeMapState, loadMapActors, renderRuntimeMapScene } from "./map-runtime";
import { EXPLORE_MAPS, EXPLORE_MAPS_BUILTIN_COUNT, MAPS, MAPS_BUILTIN_COUNT } from "./maps";
import {
  createBuildingMesh as createRenderedBuildingMesh,
  createFallbackPlayerMesh,
  createMoneyDropMesh as createRenderedMoneyDropMesh,
} from "./render-factories";
import { createSaveData, getSaveSummaryText, readSaveData, writeSaveData } from "./save-system";
import {
  clearGroup as clearSceneGroup,
  configureGameRenderer,
  configureGameScene,
  createHoverMesh,
} from "./scene-runtime";
import { renderGameUiShell } from "./ui-shell";
import {
  GRID_COLS,
  GRID_ROWS,
  TILE_SIZE,
  cellKey,
  cellToWorld,
  clamp,
  distancePointToSegmentXZ,
  distanceXZ,
  expandPath,
  expandPathToOrderedCells,
  getActiveGridCols,
  getActiveGridRows,
  keyToCell,
  mapCols,
  mapRows,
  orderEditorPathCells,
  randomWeightedAmount,
  sameCell,
  setActiveRuntimeGrid,
  uniqueCells,
  worldToCell,
} from "./runtime-grid";
import type {
  BuildId,
  BuildSpec,
  Building,
  CameraMode,
  EditorCell,
  EditorExplorationLayout,
  EditorLevel,
  EditorLevelMap,
  Enemy,
  EnemyType,
  GameAssetConfig,
  GameMode,
  GachaFocusBanner,
  GachaPool,
  GridCell,
  MapDefinition,
  MapTheme,
  ModelTarget,
  MoneyDrop,
  PlayerExploreTransform,
  SaveData,
  TimedEffect,
} from "./types";
import { UI_THEME_STORAGE_KEY, applyUiColorMode, getUiColorMode, toggleUiColorMode } from "./ui-theme";

/** 与各塔 procedural 网格大致匹配的炮口局部偏移（再 localToWorld），避免从地面对角线「贴地开火」观感 */
const PRESET_TOWER_MUZZLE_LOCAL: Partial<Record<BuildId, THREE.Vector3>> = {
  machine: new THREE.Vector3(0, 0.9, -0.78),
  cannon: new THREE.Vector3(0, 0.96, -1.08),
  frost: new THREE.Vector3(0, 1.05, -0.88),
  stellar: new THREE.Vector3(0, 1.15, -0.98),
  liqingzhao: new THREE.Vector3(0, 1.08, -0.92),
};
const DEFAULT_PRESET_MUZZLE_LOCAL = new THREE.Vector3(0, 0.88, -0.82);

const GEO_PLAYFIELD_SCALE = 20;
const GEO_PLAYFIELD_LIFT_METERS = 32;

function normalizeGameplayIdentity(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[·\s]/g, "")
    .replace(/市$/g, "");
}

function applyNumericOverride<T extends keyof BuildSpec>(
  spec: BuildSpec,
  key: T,
  value: unknown,
): void {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    (spec[key] as number | undefined) = numeric;
  }
}

export class TowerDefenseGame {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 10000);
  /** logarithmicDepthBuffer：城市级 3D Tiles 与同场景棋盘并排时减弱深度缓冲区闪烁 */
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  private readonly gltfLoader = new GLTFLoader();
  private readonly objLoader = new OBJLoader();
  private readonly textureLoader = new THREE.TextureLoader();
  /** 默认敌人 GLB 首包缓存（按 URL），实例用 SkeletonUtils.clone。 */
  private readonly enemyDefaultGltfTemplateByUrl = new Map<string, THREE.Object3D>();
  private mapActorGen = 0;
  private readonly textures: Record<string, THREE.Texture> = {};
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly geoGroup = new THREE.Group();
  private readonly mapGroup = new THREE.Group();
  private readonly buildGroup = new THREE.Group();
  private readonly enemyGroup = new THREE.Group();
  private readonly dropGroup = new THREE.Group();
  private readonly actorGroup = new THREE.Group();
  private readonly fxGroup = new THREE.Group();
  private readonly geoTilesRuntime = new GeoTilesRuntime({
    mapGroup: this.geoGroup,
    camera: this.camera,
    renderer: this.renderer,
    onStatus: (message, isError) => {
      if (isError) {
        console.warn(message);
      }
      this.showToast(message, true);
    },
  });
  private readonly keys = new Set<string>();

  private playerMixer?: THREE.AnimationMixer;
  private playerActions: Record<string, THREE.AnimationAction> = {};
  private playerActiveAction?: THREE.AnimationAction;
  private customAnimations: Record<string, THREE.AnimationClip> = {};
  private customAnimationUrls: Record<string, string> = {};

  private sceneHost!: HTMLElement;
  private toastElement!: HTMLElement;
  private sideToastElement!: HTMLElement;
  private modeElement!: HTMLElement;
  private moneyElement!: HTMLElement;
  private baseElement!: HTMLElement;
  private waveElement!: HTMLElement;
  private mapElement!: HTMLElement;
  private dropElement!: HTMLElement;
  private selectedElement!: HTMLElement;
  private cameraElement!: HTMLElement;
  private mapButtonsElement!: HTMLElement;
  private selectedUnitPanel!: HTMLElement;
  private selectedUnitName!: HTMLElement;
  private selectedUnitStats!: HTMLElement;
  private activeSkillButton!: HTMLButtonElement;
  private gachaPanel!: HTMLElement;
  private homeOverlay!: HTMLElement;
  private saveSummaryElement!: HTMLElement;
  private gachaPullsElement!: HTMLElement;
  private gachaPityElement!: HTMLElement;
  private gachaUnlockElement!: HTMLElement;
  private gachaResultElement!: HTMLElement;
  private gachaStageElement!: HTMLElement;
  private gachaTitleElement!: HTMLElement;
  private gachaDescElement!: HTMLElement;
  private gachaFeaturedNameElement!: HTMLElement;
  private gachaStageImgElement!: HTMLImageElement;
  private gachaPoolTabsElement!: HTMLElement;
  private gachaFocusTabsElement!: HTMLElement;
  private pausePanel!: HTMLElement;
  private gameRootEl!: HTMLElement;
  private hoverMesh!: THREE.Mesh;
  private player!: THREE.Group;
  private playfieldVisualScale = 1;
  private playfieldYOffset = 0;

  private defenseMapIndex = 0;
  private exploreMapIndex = 0;
  private mode: GameMode = "defense";
  private cameraMode: CameraMode = "free";
  private selectedBuild: BuildId = "machine";
  private money = INITIAL_MONEY;
  private freePulls = 100;
  private pityCounter = 0;
  private sTowerUnlocked = false;
  private gachaOpen = false;
  private gachaAnimating = false;
  private selectedGachaPool = "standard";
  /** 济南等多 UP：按卡池 id 记住选中的当期补给 */
  private gachaFocusPickByPool: Partial<Record<string, string>> = {};
  private baseHp = INITIAL_BASE_HP;
  private wave = 1;
  private nextWaveDelay = 3;
  private spawnRemaining = 0;
  private spawnCooldown = 0;
  private waveActive = false;
  private selectedBuilding: Building | null = null;
  private dropTimer = 5;
  private toastTimer = 0;
  private sideToastTimer = 0;
  private elapsed = 0;
  private lastFrameTime = performance.now();
  private nextUid = 1;
  private hoverCell: GridCell | null = null;
  private pathCells = new Set<string>();
  private obstacleCells = new Set<string>();
  private pathWorldPoints: THREE.Vector3[] = [];
  private defensePathCells = new Set<string>();
  private defenseObstacleCells = new Set<string>();
  private defensePathWorldPoints: THREE.Vector3[] = [];
  private explorePathCells = new Set<string>();
  private exploreObstacleCells = new Set<string>();
  private buildings: Building[] = [];
  private enemies: Enemy[] = [];
  private drops: MoneyDrop[] = [];
  private effects: TimedEffect[] = [];
  private customModels: Partial<Record<BuildId, THREE.Group>> = {};
  private customModelUrls: Partial<Record<BuildId, string>> = {};
  private customDropModel: THREE.Group | null = null;
  private customDropModelUrl = "";
  private customPlayerModel: THREE.Group | null = null;
  private customPlayerModelUrl = "";
  private modelScales: Partial<Record<ModelTarget, number>> = {
    moneyDrop: 1,
    player: 1,
  };
  private cameraPan = new THREE.Vector3(0, 0, 0);
  private freeCameraYaw = -Math.PI / 4;
  private freeCameraPitch = 0.55;
  private freeCameraDistance = 86;
  private topdownDistance = 120;
  private exploreCameraYaw = 0;
  private exploreCameraPitch = 0.48;
  private exploreCameraDistance = 9.5;
  /** 探索模式：true = 慢走，false = 奔跑（默认奔跑，Ctrl 切换） */
  private exploreWalkMode = false;
  private isCameraDragging = false;
  private cameraDragButton = -1;
  private cameraDragMoved = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private exploreMapInitialized = false;
  private gameStarted = false;
  private currentCity = "";
  private currentCityLabel = "";
  private requestedLevelId = "";
  private requestedRegionCode = "";
  private requestedRegionName = "";
  private requestedDefIdx = -1;
  private requestedExpIdx = -1;
  /** 首次挂载前快照，编辑器多次同步时需先清空 `syncEditorLevelsToRuntime` 追加的地图条目 */
  private bundledCityMapJson = "";
  private bundledBuildSpecsJson = "";

  /** 从编辑器标签页保存后返回时防抖热重载 */
  private editorProjectReloadTimer = 0;

  /** 跳过首次文档可见事件，避免启动时重复拉取与 loadEditorRuntimeMaps 竞态 */
  private skipNextVisibilityEditorReload = true;

  private paused = false;
  private playerExploreTransform: PlayerExploreTransform = {
    offsetMeters: { x: 0, y: 0, z: 0 },
    rotationDeg: { x: 0, y: 0, z: 0 },
  };

  constructor() {
    applyUiColorMode(getUiColorMode());
    this.bundledCityMapJson = JSON.stringify(CITY_MAP);
    this.bundledBuildSpecsJson = JSON.stringify(BUILD_SPECS);
    this.createDom();
    this.configureRenderer();
    this.configureScene();
    this.bindEvents();

    document.addEventListener("visibilitychange", () => this.onDocumentVisibilityChange());

    const params = new URLSearchParams(window.location.search);
    const cityCode = params.get("city") || "";
    this.currentCity = cityCode && CITY_MAP[cityCode] ? cityCode : "";
    this.currentCityLabel = this.currentCity ? CITY_MAP[this.currentCity].label : "";
    this.requestedLevelId = params.get("levelId") || "";
    this.requestedRegionCode = params.get("regionCode") || "";
    this.requestedRegionName = params.get("regionName") || "";
    void (async () => {
      await this.loadGameAssetConfig();
      await this.loadEditorRuntimeMaps();
      this.loadInitialCityMap();
      await this.loadDefaultPlayer();
    })();
    this.animate();
  }

  private createDom(): void {
    const app = document.querySelector<HTMLElement>("#app");
    if (!app) {
      throw new Error("Missing #app root element.");
    }
    const uiShell = renderGameUiShell(app, this.requiredElement.bind(this));
    Object.assign(this, uiShell);

    this.requiredElement("#newGameButton").addEventListener("click", () => this.startNewGame());
    this.requiredElement("#loadGameButton").addEventListener("click", () => void this.loadGame());
    this.requiredElement("#saveGameHomeButton").addEventListener("click", () => this.saveGame());
    this.requiredElement("#backToSelectionButton").addEventListener("click", () => this.backToSelection());
    this.requiredElement("#homeButton").addEventListener("click", () => this.backToSelection());
    this.requiredElement("#saveGameButton").addEventListener("click", () => this.saveGame());
    this.requiredElement("#modeToggleButton").addEventListener("click", () => this.toggleMode());
    this.requiredElement("#cameraToggleButton").addEventListener("click", () => this.toggleCameraMode());
    this.selectedUnitPanel = this.requiredElement("#selectedUnitPanel");
    this.selectedUnitName = this.requiredElement("#selectedUnitName");
    this.selectedUnitStats = this.requiredElement("#selectedUnitStats");
    this.activeSkillButton = this.requiredElement<HTMLButtonElement>("#activeSkillButton");
    
    this.activeSkillButton.addEventListener("click", () => this.castActiveSkill());
    this.requiredElement("#gachaOpenButton").addEventListener("click", () => this.openGacha());
    this.requiredElement("#gachaCloseButton").addEventListener("click", () => this.closeGacha());
    this.requiredElement("#pullOneButton").addEventListener("click", () => this.drawGacha(1));
    this.requiredElement("#pullTenButton").addEventListener("click", () => this.drawGacha(10));
    this.requiredElement("#pauseButton").addEventListener("click", () => this.togglePause());
    this.requiredElement("#resumeButton").addEventListener("click", () => this.resumeGame());
    this.requiredElement("#pauseSaveButton").addEventListener("click", () => this.saveGame());
    this.requiredElement("#pauseHomeButton").addEventListener("click", () => this.backToSelection());
    this.requiredElement("#levelEditorButton").addEventListener("click", () => this.openCurrentLevelEditor());
    const onUiThemeClick = () => {
      toggleUiColorMode();
      this.refreshUiThemeButtonLabels();
    };
    this.requiredElement("#uiThemeToggleTop").addEventListener("click", onUiThemeClick);
    this.requiredElement("#uiThemeToggleHome").addEventListener("click", onUiThemeClick);
    this.requiredElement("#uiThemeTogglePause").addEventListener("click", onUiThemeClick);
    this.requiredElement("#rightTerminalHideBtn").addEventListener("click", () => this.setTerminalPanelCollapsed(true));
    this.requiredElement("#rightTerminalShowBtn").addEventListener("click", () => this.setTerminalPanelCollapsed(false));
    const { toolbar } = uiShell;
    for (const spec of Object.values(BUILD_SPECS)) {
      const card = document.createElement("div");
      card.className = "build-card";
      card.dataset.build = spec.id;

      const button = document.createElement("button");
      button.className = "build-button";
      button.dataset.build = spec.id;
      if (spec.rank) {
        button.dataset.rank = spec.rank;
      }
      button.innerHTML = `
        <div class="build-image" style="background-image: url('/Arts/Cards/char_${spec.id}.png');"></div>
        <div class="build-info">
          <div class="build-name">
            <span>${spec.key} \u00b7 ${spec.name}</span>
            <span class="cost">${spec.rank ? spec.rank + "\u7ea7 " : ""}$${spec.cost}</span>
          </div>
          <div class="build-desc">${spec.description}</div>
        </div>
        ${spec.rank === "S" ? '<div class="s-badge">\u7ec8\u6781</div>' : ""}
      `;
      button.addEventListener("click", () => this.selectBuild(spec.id));

      card.append(button);
      toolbar.append(card);
    }

    this.setupToolbarScrolling(toolbar);
    this.renderMapButtons();
    this.updateSaveSummary();
    this.refreshUiThemeButtonLabels();
  }

  private setupToolbarScrolling(toolbar: HTMLElement): void {
    let isDown = false;
    let isDragging = false;
    let startX: number;
    let scrollLeft: number;

    toolbar.addEventListener("mousedown", (e) => {
      isDown = true;
      isDragging = false;
      startX = e.pageX - toolbar.offsetLeft;
      scrollLeft = toolbar.scrollLeft;
    });

    toolbar.addEventListener("mouseleave", () => {
      isDown = false;
      toolbar.classList.remove("toolbar--active");
    });

    toolbar.addEventListener("mouseup", () => {
      isDown = false;
      // 延迟一帧移除类，防止在 click 事件触发前就让 pointer-events 恢复导致误触
      setTimeout(() => {
        toolbar.classList.remove("toolbar--active");
      }, 0);
    });

    toolbar.addEventListener("mousemove", (e) => {
      if (!isDown) {
        return;
      }
      const x = e.pageX - toolbar.offsetLeft;
      const dist = Math.abs(x - startX);
      
      if (!isDragging && dist > 5) {
        isDragging = true;
        toolbar.classList.add("toolbar--active");
      }

      if (isDragging) {
        e.preventDefault();
        const walk = (x - startX) * 1.5;
        toolbar.scrollLeft = scrollLeft - walk;
      }
    });
  }

  private refreshUiThemeButtonLabels(): void {
    const dark = getUiColorMode() === "dark";
    const label = dark ? "\u6d45\u8272\u6a21\u5f0f" : "\u6df1\u8272\u6a21\u5f0f";
    const title = dark ? "\u5207\u6362\u4e3a\u6d45\u8272\u754c\u9762" : "\u5207\u6362\u4e3a\u6df1\u8272\u754c\u9762";
    for (const id of ["#uiThemeToggleTop", "#uiThemeToggleHome", "#uiThemeTogglePause"]) {
      const el = document.querySelector<HTMLButtonElement>(id);
      if (el) {
        el.textContent = label;
        el.title = title;
      }
    }
  }

  private setTerminalPanelCollapsed(collapsed: boolean): void {
    this.gameRootEl.classList.toggle("game-root--terminal-collapsed", collapsed);
    const hideBtn = document.querySelector<HTMLButtonElement>("#rightTerminalHideBtn");
    const showBtn = document.querySelector<HTMLButtonElement>("#rightTerminalShowBtn");
    hideBtn?.setAttribute("aria-expanded", String(!collapsed));
    showBtn?.setAttribute("aria-expanded", String(collapsed));
    if (showBtn) {
      if (collapsed) {
        showBtn.removeAttribute("aria-hidden");
        showBtn.tabIndex = 0;
      } else {
        showBtn.setAttribute("aria-hidden", "true");
        showBtn.tabIndex = -1;
      }
    }
  }

  private requiredElement<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = document.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing DOM element: ${selector}`);
    }
    return element;
  }

  private renderMapButtons(): void {
    const maps = this.currentMapList();
    this.mapButtonsElement.innerHTML = "";
    maps.forEach((map, index) => {
      const button = document.createElement("button");
      button.className = "map-button";
      button.dataset.map = String(index);
      button.innerHTML = `<strong>${index + 1}. ${map.name}</strong><br /><span>${map.description}</span>`;
      button.addEventListener("click", () => {
        // Keep city-specific build cards in sync with the selected map.
        const matchedCity = Object.entries(CITY_MAP).find(([, info]) => {
          return this.mode === "explore" ? info.exploreIndex === index : info.defenseIndex === index;
        });
        if (matchedCity) {
          this.currentCity = matchedCity[0];
          this.currentCityLabel = CITY_MAP[this.currentCity].label;
        } else {
          this.currentCity = "";
          this.currentCityLabel = "";
        }
        this.loadMap(index);
      });
      this.mapButtonsElement.append(button);
    });
  }

  private startNewGame(): void {
    this.gameStarted = true;
    this.homeOverlay.classList.remove("show");
    this.mode = "defense";
    this.money = INITIAL_MONEY;
    this.freePulls = 100;
    this.pityCounter = 0;
    this.sTowerUnlocked = false;
    this.defenseMapIndex = this.requestedDefIdx >= 0 ? this.requestedDefIdx : this.defenseMapIndex;
    this.exploreMapIndex = this.requestedExpIdx >= 0 ? this.requestedExpIdx : this.exploreMapIndex;
    this.exploreMapInitialized = false;
    this.customModels = {};
    this.customModelUrls = {};
    this.customDropModel = null;
    this.customDropModelUrl = "";
    this.customPlayerModel = null;
    this.customPlayerModelUrl = "";
    this.resetModelScalesToDefaults();
    this.customAnimations = {};
    void this.finishNewGameAfterModels();
  }

  private async finishNewGameAfterModels(): Promise<void> {
    try {
      await this.loadGameAssetConfig();
      this.createPlayer();
      await this.loadDefaultPlayer();
      this.renderMapButtons();
      if (this.requestedLevelId && this.requestedDefIdx >= 0) {
        this.defenseMapIndex = this.requestedDefIdx;
        this.exploreMapIndex = this.requestedExpIdx >= 0 ? this.requestedExpIdx : this.exploreMapIndex;
      } else if (this.currentCity && CITY_MAP[this.currentCity]) {
        const cityInfo = CITY_MAP[this.currentCity];
        this.defenseMapIndex = cityInfo.defenseIndex;
        this.exploreMapIndex = cityInfo.exploreIndex;
      }
      this.loadDefenseMap(this.defenseMapIndex, true);
      this.saveGame(false);
      this.showToast("\u65b0\u6e38\u620f\u5df2\u5f00\u59cb", true);
    } catch (error) {
      console.error("[finishNewGameAfterModels] error:", error);
      this.showToast("\u542f\u52a8\u65b0\u6e38\u620f\u5931\u8d25\uff0c\u8bf7\u67e5\u770b\u63a7\u5236\u53f0\u3002");
    }
  }

  private openHome(): void {
    this.homeOverlay.classList.add("show");
    this.updateSaveSummary();
  }

  private backToSelection(): void {
    window.location.href = "/Web/map/china.html";
  }

  private openCurrentLevelEditor(): void {
    const levelId = this.resolveCurrentEditorLevelId();
    const url = levelId
      ? `/Web/map/level-editor.html?levelId=${encodeURIComponent(levelId)}`
      : "/Web/map/level-editor.html";
    window.open(url, "_blank", "noopener,noreferrer");
  }

  private resolveCurrentEditorLevelId(): string {
    if (this.requestedLevelId) {
      return this.requestedLevelId;
    }

    const mapId = this.currentMap().id;
    const stripped = mapId.replace(/-(defense|explore)$/u, "");
    if (stripped !== mapId) {
      return stripped;
    }

    if (this.currentCity === "beijing") {
      return "CN_beijing";
    }
    if (this.currentCity === "jinan") {
      return "city-cn-370100";
    }
    return "";
  }

  private resumeGame(): void {
    this.gameStarted = true;
    this.homeOverlay.classList.remove("show");
    this.paused = false;
    this.pausePanel.classList.remove("show");
    this.updateUi();
  }

  private saveGame(showFeedback = true): void {
    const data = createSaveData({
      mode: this.mode,
      money: this.money,
      freePulls: this.freePulls,
      pityCounter: this.pityCounter,
      sTowerUnlocked: this.sTowerUnlocked,
      defenseMapIndex: this.defenseMapIndex,
      exploreMapIndex: this.exploreMapIndex,
      baseHp: this.baseHp,
      wave: this.wave,
      nextWaveDelay: this.nextWaveDelay,
      spawnRemaining: this.spawnRemaining,
      spawnCooldown: this.spawnCooldown,
      waveActive: this.waveActive,
      buildings: this.buildings.map((building) => ({
        id: building.spec.id,
        cell: building.cell,
      })),
      customModelUrls: this.customModelUrls,
      customDropModelUrl: this.customDropModelUrl,
      customPlayerModelUrl: this.customPlayerModelUrl,
      customAnimationUrls: this.customAnimationUrls,
      modelScales: this.modelScales,
    });

    writeSaveData(data);
    this.updateSaveSummary();
    if (showFeedback) {
      this.showToast("\u5b58\u6863\u5df2\u4fdd\u5b58");
    }
  }

  private async loadGame(): Promise<void> {
    try {
      const data = readSaveData();
      if (!data) {
        this.showToast("\u6ca1\u6709\u53ef\u8bfb\u53d6\u7684\u5b58\u6863");
        return;
      }

      this.gameStarted = true;
      this.money = data.money ?? INITIAL_MONEY;
      this.freePulls = data.freePulls ?? 100;
      this.pityCounter = data.pityCounter ?? 0;
      this.sTowerUnlocked = !!data.sTowerUnlocked;
      this.mode = data.mode ?? "defense";
      this.customModels = {};
      this.customModelUrls = data.customModelUrls ?? {};
      this.customDropModel = null;
      this.customDropModelUrl = data.customDropModelUrl ?? "";
      this.customPlayerModel = null;
      this.customPlayerModelUrl = data.customPlayerModelUrl ?? "";
      this.customAnimationUrls = Object.fromEntries(
        Object.entries(data.customAnimationUrls ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
      );
      this.resetModelScalesToDefaults();
      this.applyModelScalesFromRecord((data.modelScales ?? null) as Record<string, unknown> | null);
      this.customAnimations = {};

      await this.restoreCustomModels();
      await this.loadCustomAnimationsFromEditorUrls();
      if (this.customPlayerModel) {
        this.createPlayer();
      } else {
        await this.loadDefaultPlayer();
      }
      this.loadDefenseMap(data.defenseMapIndex ?? 0, true);
      this.baseHp = data.baseHp ?? INITIAL_BASE_HP;
      this.wave = data.wave ?? 1;
      this.nextWaveDelay = data.nextWaveDelay ?? 3;
      this.spawnRemaining = data.spawnRemaining ?? 0;
      this.spawnCooldown = data.spawnCooldown ?? 0;
      this.waveActive = !!data.waveActive;

      const restoredUniqueS = new Set<BuildId>();
      for (const savedBuilding of data.buildings ?? []) {
        const spec = BUILD_SPECS[savedBuilding.id];
        if (!spec) {
          continue;
        }
        if (spec.rank === "S") {
          if (restoredUniqueS.has(spec.id)) {
            continue;
          }
          restoredUniqueS.add(spec.id);
        }
        const building: Building = {
          uid: this.nextUid,
          spec,
          cell: { ...savedBuilding.cell },
          mesh: this.createBuildingMesh(spec),
          cooldown: 0,
          armed: true,
          hp: spec.maxHp ?? 1,
          blockingEnemies: [],
          skillCooldownTimer: 0,
        };
        this.attachBuildingHud(building);
        this.nextUid += 1;
        const position = cellToWorld(building.cell);
        building.mesh.position.set(position.x, 0, position.z);
        this.buildings.push(building);
        this.buildGroup.add(building.mesh);
      }

      this.exploreMapIndex = data.exploreMapIndex ?? 0;
      if (this.mode === "explore") {
        this.loadExploreMap(this.exploreMapIndex, true);
      } else {
        this.showDefenseView();
      }
      this.renderMapButtons();
      this.resumeGame();
      this.showToast("\u5b58\u6863\u8bfb\u53d6\u5b8c\u6210");
    } catch {
      this.showToast("\u5b58\u6863\u8bfb\u53d6\u5931\u8d25");
    }
  }

  private async restoreCustomModels(): Promise<void> {
    const entries = Object.entries(this.customModelUrls) as Array<[BuildId, string]>;
    await Promise.all(
      entries.map(async ([buildId, url]) => {
        if (!url) {
          return;
        }
        try {
          const model = await loadPersistedModelFromUrl({ gltfLoader: this.gltfLoader, objLoader: this.objLoader }, url);
          this.customModels[buildId] = model;
        } catch (error) {
          console.warn("[Game] failed to load saved custom model", buildId, url, error);
        }
      }),
    );

    if (this.customDropModelUrl) {
      try {
        this.customDropModel = await loadPersistedModelFromUrl(
          { gltfLoader: this.gltfLoader, objLoader: this.objLoader },
          this.customDropModelUrl,
        );
      } catch (error) {
        console.warn("[Game] failed to load drop model", this.customDropModelUrl, error);
      }
    }
    if (this.customPlayerModelUrl) {
      try {
        this.customPlayerModel = await loadPersistedModelFromUrl(
          { gltfLoader: this.gltfLoader, objLoader: this.objLoader },
          this.customPlayerModelUrl,
        );
      } catch (error) {
        console.warn("[Game] failed to load player model", this.customPlayerModelUrl, error);
      }
    }
  }

  private async loadCustomAnimationsFromEditorUrls(): Promise<void> {
    this.customAnimations = await loadPersistedAnimations(
      { gltfLoader: this.gltfLoader, objLoader: this.objLoader },
      this.customAnimationUrls,
    );
  }

  private async loadGameAssetConfig(): Promise<void> {
    try {
      const loaded = await loadPersistedGameAssetConfig(
        { gltfLoader: this.gltfLoader, objLoader: this.objLoader },
        BUILD_SPECS,
      );
      if (!loaded) {
        return;
      }

      this.modelScales = loaded.modelScales;
      this.customModelUrls = loaded.customModelUrls;
      this.customDropModelUrl = loaded.customDropModelUrl;
      this.customPlayerModelUrl = loaded.customPlayerModelUrl;
      this.customAnimationUrls = loaded.customAnimationUrls;
      this.customModels = loaded.customModels;
      this.customDropModel = loaded.customDropModel;
      this.customPlayerModel = loaded.customPlayerModel;
      this.customAnimations = loaded.customAnimations;
      this.playerExploreTransform = loaded.playerExploreTransform;
    } catch (error) {
      console.warn("[GameAssetConfig]", error);
    }
  }

  private mergePlayerExploreTransform(raw: PlayerExploreTransform | undefined | null): PlayerExploreTransform {
    return raw ?? {
      offsetMeters: { x: 0, y: 0, z: 0 },
      rotationDeg: { x: 0, y: 0, z: 0 },
    };
  }

  private resetModelScalesToDefaults(): void {
    this.modelScales = createDefaultModelScales(BUILD_SPECS);
  }

  private applyModelScalesFromRecord(record: Record<string, unknown> | null | undefined): void {
    applyPersistedModelScales(this.modelScales, BUILD_SPECS, record);
  }

  private getClampedUserScale(target: ModelTarget): number {
    return getPersistedUserScale(this.modelScales, target);
  }

  private async loadModelFromUrl(url: string): Promise<THREE.Group> {
    return loadPersistedModelFromUrl({ gltfLoader: this.gltfLoader, objLoader: this.objLoader }, url);
  }

  private async loadDefaultPlayer(): Promise<void> {
    if (this.customPlayerModel) {
      this.createPlayer();
      return;
    }
    for (const url of DEFAULT_PLAYER_MODEL_URLS) {
      try {
        const gltf = await new Promise<any>((resolve, reject) => {
          this.gltfLoader.load(url, resolve, undefined, reject);
        });
        this.customPlayerModel = this.prepareUploadedModel(gltf.scene);
        /* Preserve editor/save scale; do not force player scale back to 1. */

        gltf.animations.forEach((clip: THREE.AnimationClip) => {
          const name = clip.name.toLowerCase();
          if (name.includes("idle") || name.includes("stand")) this.customAnimations["idle"] = clip;
          if (name.includes("walk")) this.customAnimations["walk"] = clip;
          if (name.includes("run")) this.customAnimations["run"] = clip;
        });
        this.createPlayer();
        this.showToast(url.includes("RobotExpressive") ? "\u5df2\u8f7d\u5165 three.js \u5b98\u65b9\u63a2\u7d22\u89d2\u8272" : "\u5df2\u8f7d\u5165\u63a2\u7d22\u89d2\u8272\u6a21\u578b");
        return;
      } catch (error) {
        console.warn("[PlayerModel] failed to load", url, error);
      }
    }
    this.showToast("\u9ed8\u8ba4\u89d2\u8272\u52a0\u8f7d\u5931\u8d25\uff0c\u5df2\u4f7f\u7528\u5907\u7528\u65b9\u5757\u6a21\u578b");
  }

  private updateSaveSummary(): void {
    this.saveSummaryElement.textContent = getSaveSummaryText();
  }

  private async loadCustomModel(target: ModelTarget, file: File): Promise<void> {
    if (!file.name.match(/\.(glb|gltf|obj)$/i)) {
      this.showToast("\u8bf7\u4e0a\u4f20 .glb\u3001.gltf \u6216 .obj \u6a21\u578b\u6587\u4ef6");
      return;
    }

    try {
      const loaded = await loadCustomModelAsset({ gltfLoader: this.gltfLoader, objLoader: this.objLoader }, file);

      // If animations are embedded in the character file, use them as defaults
      if (loaded.animations.length > 0) {
        loaded.animations.forEach((clip) => {
          if (clip.name.toLowerCase().includes("idle")) this.customAnimations["idle"] = clip;
          if (clip.name.toLowerCase().includes("walk")) this.customAnimations["walk"] = clip;
          if (clip.name.toLowerCase().includes("run")) this.customAnimations["run"] = clip;
        });
      }

      this.applyCustomModel(target, loaded.model);

      try {
        const uploadedUrl = await uploadPersistedModelFile(file, loaded.data);
        if (uploadedUrl) {
          this.rememberModelUrl(target, uploadedUrl);
          this.saveGame(false);
        }
      } catch {
        this.showToast("\u6a21\u578b\u5df2\u5e94\u7528\uff0c\u4f46\u5f53\u524d\u670d\u52a1\u5668\u672a\u542f\u7528\u6301\u4e45\u5316 API");
      }

      this.showToast(this.modelTargetLabel(target));
      this.updateUi();
    } catch (error) {
      this.showToast(error instanceof Error ? error.message : "\u6a21\u578b\u52a0\u8f7d\u5931\u8d25");
    }
  }

  private async loadCustomAnimation(type: string, file: File): Promise<void> {
    try {
      const loaded = await loadAnimationAsset({ gltfLoader: this.gltfLoader, objLoader: this.objLoader }, file);
      if (loaded.clip) {
        this.customAnimations[type] = loaded.clip;
        this.showToast(`\u5df2\u66ff\u6362\u52a8\u753b\uff1a${type}`);

        try {
          const uploadedUrl = await uploadPersistedModelFile(file, loaded.data);
          if (uploadedUrl) {
            this.customAnimationUrls[type] = uploadedUrl;
            this.saveGame(false);
          }
        } catch {
          this.showToast("\u6a21\u578b\u5df2\u5e94\u7528\uff0c\u4f46\u5f53\u524d\u670d\u52a1\u5668\u672a\u542f\u7528\u6301\u4e45\u5316 API");
        }

        this.createPlayer(); // Refresh player to bind new animation
      } else {
        this.showToast("\u8be5\u6587\u4ef6\u672a\u5305\u542b\u6709\u6548\u52a8\u753b");
      }
    } catch {
      this.showToast("\u52a8\u753b\u52a0\u8f7d\u5931\u8d25");
    }
  }

  private async parseModelData(name: string, data: ArrayBuffer): Promise<THREE.Group> {
    return parsePersistedModelData({ gltfLoader: this.gltfLoader, objLoader: this.objLoader }, name, data);
  }

  private async uploadModelFile(file: File, data: ArrayBuffer): Promise<string | null> {
    try {
      return await uploadPersistedModelFile(file, data);
    } catch {
      this.showToast("\u6a21\u578b\u5df2\u5e94\u7528\uff0c\u4f46\u5f53\u524d\u670d\u52a1\u5668\u672a\u542f\u7528\u6301\u4e45\u5316 API");
      return null;
    }
  }

  private applyCustomModel(target: ModelTarget, model: THREE.Group): void {
    if (target === "moneyDrop") {
      this.customDropModel = model;
      for (const drop of this.drops.filter((item) => item.source === "explore")) {
        const position = drop.mesh.position.clone();
        this.dropGroup.remove(drop.mesh);
        drop.mesh = this.createMoneyDropMesh(drop.amount);
        drop.mesh.position.copy(position);
        this.dropGroup.add(drop.mesh);
      }
      this.updateDropVisibility();
      return;
    }
    if (target === "player") {
      const position = this.player.position.clone();
      const rotation = this.player.rotation.y;
      this.customPlayerModel = model;
      this.createPlayer();
      this.player.position.copy(position);
      this.player.rotation.y = rotation;
      return;
    }

    this.customModels[target] = model;
    this.refreshPlacedModels(target);
  }

  private rememberModelUrl(target: ModelTarget, url: string): void {
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

  private setModelScale(target: ModelTarget, value: number): void {
    const scale = clamp(Number.isFinite(value) ? value : 1, 0.1, 8);
    this.modelScales[target] = scale;
    this.syncScaleInputs(target, scale);

    if (target === "moneyDrop") {
      for (const drop of this.drops.filter((item) => item.source === "explore")) {
        const position = drop.mesh.position.clone();
        this.dropGroup.remove(drop.mesh);
        drop.mesh = this.createMoneyDropMesh(drop.amount);
        drop.mesh.position.copy(position);
        this.dropGroup.add(drop.mesh);
      }
      this.updateDropVisibility();
    } else if (target === "player") {
      const position = this.player.position.clone();
      const rotation = this.player.rotation.y;
      this.createPlayer();
      this.player.position.copy(position);
      this.player.rotation.y = rotation;
    } else {
      this.refreshPlacedModels(target);
    }

    this.saveGame(false);
  }

  private syncScaleInputs(_target: ModelTarget, _scale: number): void {}

  private modelTargetLabel(target: ModelTarget): string {
    return getModelTargetLabel(target, BUILD_SPECS);
  }

  private prepareUploadedModel(scene: THREE.Object3D): THREE.Group {
    return normalizeUploadedModel(scene);
  }

  private refreshPlacedModels(buildId: BuildId): void {
    for (const building of this.buildings) {
      if (building.spec.id !== buildId) {
        continue;
      }

      const position = building.mesh.position.clone();
      this.buildGroup.remove(building.mesh);
      building.mesh = this.createBuildingMesh(building.spec);
      this.attachBuildingHud(building);
      building.mesh.position.copy(position);
      this.buildGroup.add(building.mesh);
    }
  }

  private configureRenderer(): void {
    configureGameRenderer(this.renderer, this.sceneHost);
  }

  private configureScene(): void {
    this.hoverMesh = createHoverMesh();
    configureGameScene({
      scene: this.scene,
      camera: this.camera,
      groups: {
        mapGroup: this.mapGroup,
        buildGroup: this.buildGroup,
        enemyGroup: this.enemyGroup,
        dropGroup: this.dropGroup,
        actorGroup: this.actorGroup,
        fxGroup: this.fxGroup,
      },
      hoverMesh: this.hoverMesh,
      onCreatePlayer: () => this.createPlayer(),
      onResize: () => this.resize(),
    });
    this.geoGroup.name = "geo-backdrop";
    this.scene.add(this.geoGroup);
  }

  private bindEvents(): void {
    bindGameInputHandlers({
      windowRef: window,
      domElement: this.renderer.domElement,
      themeStorageKey: UI_THEME_STORAGE_KEY,
      onThemeStorageChanged: () => {
        applyUiColorMode(getUiColorMode());
        this.refreshUiThemeButtonLabels();
      },
      onResize: () => this.resize(),
      onPointerMove: (event) => {
        if (this.isCameraDragging) {
          this.rotateCameraFromPointer(event);
        }
        this.updatePointer(event);
      },
      onPointerLeave: () => {
        this.hoverCell = null;
        this.hoverMesh.visible = false;
      },
      onPointerDown: (event) => {
        this.updatePointer(event);
        if (this.shouldStartCameraDrag(event)) {
          this.beginCameraDrag(event);
          return;
        }
        if (event.button === 0) {
          if (this.mode === "defense" && this.hoverCell) {
            const clickedBuilding = this.buildings.find((building) => sameCell(building.cell, this.hoverCell!));
            if (clickedBuilding) {
              if (clickedBuilding === this.selectedBuilding && clickedBuilding.spec.activeSkill) {
                this.castActiveSkill();
                return;
              }
              this.selectedBuilding = clickedBuilding;
              this.updateUi();
              return;
            }
            this.selectedBuilding = null;
            this.updateUi();
          }
          this.tryBuild();
        }
      },
      onPointerUp: (event) => {
        if (!this.isCameraDragging) {
          return;
        }
        const wasRightClick = this.cameraDragButton === 2;
        const moved = this.cameraDragMoved;
        this.endCameraDrag(event);
        if (this.mode === "defense" && wasRightClick && !moved) {
          this.updatePointer(event);
          this.tryDemolish();
        }
      },
      onWheel: (direction) => {
        const nextZoomState = applyCameraZoom(
          {
            freeCameraDistance: this.freeCameraDistance,
            topdownDistance: this.topdownDistance,
            exploreCameraDistance: this.exploreCameraDistance,
          },
          this.mode,
          this.cameraMode,
          direction,
        );
        this.freeCameraDistance = nextZoomState.freeCameraDistance;
        this.topdownDistance = nextZoomState.topdownDistance;
        this.exploreCameraDistance = nextZoomState.exploreCameraDistance;
      },
      onEscape: () => {
        if (this.gachaOpen) {
          this.closeGacha();
        } else if (this.homeOverlay.classList.contains("show")) {
          this.resumeGame();
        } else {
          this.togglePause();
        }
      },
      onPauseToggle: () => this.togglePause(),
      onGachaToggle: () => {
        this.gachaOpen ? this.closeGacha() : this.openGacha();
      },
      isGachaOpen: () => this.gachaOpen,
      onModeToggle: () => this.toggleMode(),
      onCameraModeToggle: () => this.toggleCameraMode(),
      resolveBuildHotkey: (code) => Object.values(BUILD_SPECS).find((spec) => `Key${spec.key}` === code)?.id ?? null,
      onSelectBuild: (buildId) => this.selectBuild(buildId),
      resolveMapHotkey: (key) => {
        const mapNumber = Number(key);
        if (mapNumber >= 1 && mapNumber <= this.currentMapList().length) {
          return mapNumber - 1;
        }
        return null;
      },
      onSelectMap: (index) => this.loadMap(index),
      onActiveSkill: () => this.castActiveSkill(),
      onKeyStateChange: (code, pressed, meta) => {
        if (
          pressed &&
          meta?.repeat !== true &&
          (code === "ControlLeft" || code === "ControlRight") &&
          this.mode === "explore"
        ) {
          this.exploreWalkMode = !this.exploreWalkMode;
        }
        if (pressed) {
          this.keys.add(code);
        } else {
          this.keys.delete(code);
        }
      },
    });
  }

  private async loadEditorRuntimeMaps(): Promise<void> {
    try {
      const importedCount = await this.pullEditorLevelsFromProjectFile();
      if (importedCount > 0) {
        this.renderMapButtons();
        this.showToast(`\u5df2\u540c\u6b65 ${importedCount} \u4e2a\u7f16\u8f91\u5668\u5173\u5361`);
      }
    } catch (error) {
      console.warn("[LevelEditorRuntime] failed to load editor maps", error);
      this.showToast("\u672a\u8bfb\u53d6\u5230\u7f16\u8f91\u5668\u5173\u5361\uff0c\u5df2\u4f7f\u7528\u5185\u7f6e\u5730\u56fe");
    }
  }

  /** 重置为内置棋盘与内置 CITY_MAP，再合并 JSON — 允许反复保存而不无限 push 运行时地图条目 */
  private resetBundledMapsBeforeEditorSync(): void {
    MAPS.length = MAPS_BUILTIN_COUNT;
    EXPLORE_MAPS.length = EXPLORE_MAPS_BUILTIN_COUNT;
    let restored: typeof CITY_MAP;
    try {
      restored = JSON.parse(this.bundledCityMapJson) as typeof CITY_MAP;
    } catch {
      return;
    }
    for (const key of Object.keys(CITY_MAP)) {
      delete CITY_MAP[key];
    }
    Object.assign(CITY_MAP, restored);
  }

  /** 仅从项目读取并合并编辑器关卡列表；返回写入的运行时关卡条目数 */
  private async pullEditorLevelsFromProjectFile(): Promise<number> {
    const response = await fetch("/Web/data/level-editor-state.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      levels?: EditorLevel[];
      cityGameplayConfigs?: Record<string, unknown>;
    };
    const levels = Array.isArray(payload.levels) ? payload.levels : [];
    this.resetBundledMapsBeforeEditorSync();
    this.applyTowerGameplayOverrides(payload.cityGameplayConfigs);
    this.applyRequestedRegionContext(levels);
    await hydrateEditorLevelGeo(levels);
    const result = syncEditorLevelsToRuntime({
      levels,
      requestedLevelId: this.requestedLevelId,
      maps: MAPS,
      exploreMaps: EXPLORE_MAPS,
      cityMap: CITY_MAP,
      cityAliases: CITY_EDITOR_ALIASES,
    });
    this.requestedDefIdx = result.requestedDefIdx;
    this.requestedExpIdx = result.requestedExpIdx;
    return result.importedCount;
  }

  private applyTowerGameplayOverrides(rawConfigs?: Record<string, unknown>): void {
    try {
      const restored = JSON.parse(this.bundledBuildSpecsJson) as typeof BUILD_SPECS;
      for (const key of Object.keys(BUILD_SPECS) as BuildId[]) {
        Object.assign(BUILD_SPECS[key], restored[key]);
      }
    } catch {
      return;
    }
    if (!rawConfigs || typeof rawConfigs !== "object") {
      return;
    }

    const desiredCity = new Set(
      [this.currentCity, this.currentCityLabel, this.requestedRegionCode, this.requestedRegionName]
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
        towers?: Array<{ id?: string; stats?: Record<string, unknown> }>;
      };
      const identities = [configKey, config.cityCode, config.cityName, ...(Array.isArray(config.aliases) ? config.aliases : [])]
        .map((value) => normalizeGameplayIdentity(value))
        .filter(Boolean);
      if (desiredCity.size && !identities.some((identity) => desiredCity.has(identity))) {
        continue;
      }
      for (const tower of config.towers ?? []) {
        const id = String(tower.id || "") as BuildId;
        const spec = BUILD_SPECS[id];
        if (!spec || !tower.stats || typeof tower.stats !== "object") {
          continue;
        }
        applyNumericOverride(spec, "cost", tower.stats.cost);
        applyNumericOverride(spec, "maxHp", tower.stats.hp);
        applyNumericOverride(spec, "damage", tower.stats.attack);
        applyNumericOverride(spec, "range", tower.stats.range);
        applyNumericOverride(spec, "fireRate", tower.stats.fireRate);
        applyNumericOverride(spec, "splash", tower.stats.splash);
      }
    }
  }

  private onDocumentVisibilityChange(): void {
    if (document.visibilityState !== "visible") {
      return;
    }
    if (this.skipNextVisibilityEditorReload) {
      this.skipNextVisibilityEditorReload = false;
      return;
    }
    if (this.editorProjectReloadTimer) {
      window.clearTimeout(this.editorProjectReloadTimer);
    }
    this.editorProjectReloadTimer = window.setTimeout(() => {
      this.editorProjectReloadTimer = 0;
      void this.reloadEditorProjectAfterTabVisible();
    }, 420);
  }

  /** 从编辑器页面保存返回游戏页时重新拉取 `level-editor-state.json` */
  private async reloadEditorProjectAfterTabVisible(): Promise<void> {
    try {
      const importedCount = await this.pullEditorLevelsFromProjectFile();
      await this.loadGameAssetConfig();
      this.defenseMapIndex = Math.min(this.defenseMapIndex, MAPS.length - 1);
      this.exploreMapIndex = Math.min(this.exploreMapIndex, EXPLORE_MAPS.length - 1);
      this.renderMapButtons();

      const inactiveSession =
        !this.gameStarted || this.paused || this.homeOverlay.classList.contains("show");

      if (inactiveSession) {
        if (this.mode === "defense") {
          this.loadDefenseMap(this.defenseMapIndex, true);
        } else {
          this.loadExploreMap(this.exploreMapIndex, true);
        }
      }

      if (importedCount > 0) {
        if (inactiveSession) {
          this.showToast(`已从项目重新同步 ${importedCount} 个关卡`);
        } else {
          this.showToast(
            `项目已更新 ${importedCount} 个关卡；进行中的对局请暂停或回主菜单后再开新局以载入新地图`,
          );
        }
      }
    } catch (error) {
      console.warn("[EditorProjectReload]", error);
    }
  }

  private applyRequestedRegionContext(levels: EditorLevel[]): void {
    if (!this.requestedLevelId || !this.requestedRegionCode) {
      return;
    }

    const location = this.createRequestedRegionLocation();
    if (!location) {
      return;
    }

    const requestedLevel = levels.find((level) => level.id === this.requestedLevelId);
    if (!requestedLevel) {
      return;
    }

    const isDefaultLevel = requestedLevel.id === "__DEFAULT_TD__" || requestedLevel.id === "__DEFAULT_EXP__";
    const currentLocation = requestedLevel.location ?? {};
    const hasSpecificLocation = !!(currentLocation.countryCode || currentLocation.cityCode || currentLocation.cityName);
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
      const regionLabel = location.regionLabel || location.cityName || location.countryName || this.requestedRegionName || this.requestedRegionCode;
      requestedLevel.name = `${regionLabel} · ${requestedLevel.name || "默认关卡"}`;
      requestedLevel.description = requestedLevel.description || `为 ${regionLabel} 自动生成的默认关卡，可在编辑器中继续设计。`;
    }
  }

  private createRequestedRegionLocation(): NonNullable<EditorLevel["location"]> | null {
    const code = this.requestedRegionCode.trim();
    if (!code) {
      return null;
    }

    const displayName = this.requestedRegionName.trim();
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

  private loadInitialCityMap(): void {
    // Direct levelId request takes priority
    if (this.requestedLevelId && this.requestedDefIdx >= 0) {
      this.defenseMapIndex = this.requestedDefIdx;
      this.exploreMapIndex = this.requestedExpIdx >= 0 ? this.requestedExpIdx : this.requestedDefIdx;
      // Sync currentCity based on which city owns this map index
      if (!this.currentCity) {
        const matchedCity = Object.entries(CITY_MAP).find(([, info]) => info.defenseIndex === this.defenseMapIndex);
        if (matchedCity) {
          this.currentCity = matchedCity[0];
          this.currentCityLabel = CITY_MAP[this.currentCity].label;
        }
      }
      this.loadDefenseMap(this.defenseMapIndex, true);
      const cityLabel = document.getElementById("cityLabel");
      if (cityLabel) cityLabel.textContent = MAPS[this.defenseMapIndex]?.name || this.requestedLevelId;
      return;
    }

    if (this.currentCity && CITY_MAP[this.currentCity]) {
      const cityInfo = CITY_MAP[this.currentCity];
      this.defenseMapIndex = cityInfo.defenseIndex;
      this.exploreMapIndex = cityInfo.exploreIndex;
      this.loadDefenseMap(this.defenseMapIndex, true);
      const cityLabel = document.getElementById("cityLabel");
      if (cityLabel) cityLabel.textContent = `${cityInfo.label} \u00b7 ${MAPS[cityInfo.defenseIndex].name}`;
      return;
    }

    this.loadDefenseMap(0, true);
  }

  private shouldStartCameraDrag(event: PointerEvent): boolean {
    return shouldStartInputCameraDrag(this.gachaOpen, this.mode, event.button);
  }

  private beginCameraDrag(event: PointerEvent): void {
    const nextDragState = beginInputCameraDrag(
      {
        isCameraDragging: this.isCameraDragging,
        cameraDragButton: this.cameraDragButton,
        cameraDragMoved: this.cameraDragMoved,
        lastPointerX: this.lastPointerX,
        lastPointerY: this.lastPointerY,
      },
      this.renderer.domElement,
      event,
    );
    this.isCameraDragging = nextDragState.isCameraDragging;
    this.cameraDragButton = nextDragState.cameraDragButton;
    this.cameraDragMoved = nextDragState.cameraDragMoved;
    this.lastPointerX = nextDragState.lastPointerX;
    this.lastPointerY = nextDragState.lastPointerY;
  }

  private rotateCameraFromPointer(event: PointerEvent): void {
    const nextState = rotateInputCameraFromPointer(
      {
        isCameraDragging: this.isCameraDragging,
        cameraDragButton: this.cameraDragButton,
        cameraDragMoved: this.cameraDragMoved,
        lastPointerX: this.lastPointerX,
        lastPointerY: this.lastPointerY,
      },
      {
        freeCameraYaw: this.freeCameraYaw,
        freeCameraPitch: this.freeCameraPitch,
        exploreCameraYaw: this.exploreCameraYaw,
        exploreCameraPitch: this.exploreCameraPitch,
      },
      this.mode,
      event,
    );
    this.isCameraDragging = nextState.dragState.isCameraDragging;
    this.cameraDragButton = nextState.dragState.cameraDragButton;
    this.cameraDragMoved = nextState.dragState.cameraDragMoved;
    this.lastPointerX = nextState.dragState.lastPointerX;
    this.lastPointerY = nextState.dragState.lastPointerY;
    this.freeCameraYaw = nextState.orbitState.freeCameraYaw;
    this.freeCameraPitch = nextState.orbitState.freeCameraPitch;
    this.exploreCameraYaw = nextState.orbitState.exploreCameraYaw;
    this.exploreCameraPitch = nextState.orbitState.exploreCameraPitch;
  }

  private endCameraDrag(event: PointerEvent): void {
    const nextDragState = endInputCameraDrag(
      {
        isCameraDragging: this.isCameraDragging,
        cameraDragButton: this.cameraDragButton,
        cameraDragMoved: this.cameraDragMoved,
        lastPointerX: this.lastPointerX,
        lastPointerY: this.lastPointerY,
      },
      this.renderer.domElement,
      event,
    );
    this.isCameraDragging = nextDragState.isCameraDragging;
    this.cameraDragButton = nextDragState.cameraDragButton;
    this.cameraDragMoved = nextDragState.cameraDragMoved;
    this.lastPointerX = nextDragState.lastPointerX;
    this.lastPointerY = nextDragState.lastPointerY;
  }

  private resize(): void {
    resizeViewport(this.camera, this.renderer, window.innerWidth, window.innerHeight);
    if (window.innerWidth <= 1080 && this.gameRootEl.classList.contains("game-root--terminal-collapsed")) {
      this.setTerminalPanelCollapsed(false);
    }
  }

  private loadMap(index: number): void {
    if (this.mode === "explore") {
      this.loadExploreMap(index, true);
    } else {
      this.loadDefenseMap(index, true);
    }
  }

  private loadDefenseMap(index: number, resetEncounter: boolean): void {
    this.defenseMapIndex = index;
    this.baseHp = INITIAL_BASE_HP;
    this.wave = 1;
    this.nextWaveDelay = 3;
    this.spawnRemaining = 0;
    this.spawnCooldown = 0;
    this.waveActive = false;
    this.cameraPan.set(0, 0, 0);

    if (resetEncounter) {
      this.clearGroup(this.buildGroup);
      this.clearGroup(this.enemyGroup);
      this.clearGroup(this.dropGroup);
      this.clearGroup(this.fxGroup);
      this.buildings = [];
      this.enemies = [];
      this.drops = [];
      this.effects = [];
    }

    const map = MAPS[this.defenseMapIndex];
    const runtimeState = buildRuntimeMapState(map);
    this.defensePathCells = runtimeState.pathCells;
    this.defenseObstacleCells = runtimeState.obstacleCells;
    this.defensePathWorldPoints = runtimeState.pathWorldPoints;

    if (this.mode === "defense") {
      this.showDefenseView();
    }
    this.showToast(`\u5df2\u52a0\u8f7d\u5730\u56fe\uff1a${map.name}`);
    this.updateUi();
  }

  private loadExploreMap(index: number, resetExploration: boolean): void {
    this.exploreMapIndex = index;
    this.exploreMapInitialized = true;
    const map = EXPLORE_MAPS[this.exploreMapIndex];
    const runtimeState = buildRuntimeMapState(map);
    this.explorePathCells = runtimeState.pathCells;
    this.exploreObstacleCells = runtimeState.obstacleCells;
    this.pathCells = this.explorePathCells;
    this.obstacleCells = this.exploreObstacleCells;

    if (resetExploration) {
      this.exploreWalkMode = false;
      this.dropTimer = 5;
      for (const drop of this.drops.filter((item) => item.source === "explore")) {
        this.dropGroup.remove(drop.mesh);
      }
      this.drops = this.drops.filter((item) => item.source !== "explore");
      this.positionPlayerAtStart();
    }

    this.showExploreView();
    if (resetExploration) {
      this.spawnExploreMoneyDrops(5);
    }
    this.showToast(`\u5df2\u8fdb\u5165\u63a2\u7d22\u5730\u56fe\uff1a${map.name}`);
    this.updateUi();
  }

  private showDefenseView(): void {
    const map = MAPS[this.defenseMapIndex];
    const hasGeoBackdrop = canUseGeoTiles(map.geo);
    setActiveRuntimeGrid(map);
    this.pathCells = this.defensePathCells;
    this.obstacleCells = this.defenseObstacleCells;
    this.pathWorldPoints = this.defensePathWorldPoints;
    this.applyPlayfieldVisualScale(hasGeoBackdrop ? GEO_PLAYFIELD_SCALE : 1, hasGeoBackdrop ? this.geoBoardHeight(map) : 0);
    if (this.playfieldVisualScale > 1) {
      this.freeCameraDistance = Math.max(this.freeCameraDistance, 760);
      this.topdownDistance = Math.max(this.topdownDistance, 1100);
    }
    this.geoTilesRuntime.dispose();
    this.clearGroup(this.mapGroup);
    renderRuntimeMapScene({
      scene: this.scene,
      mapGroup: this.mapGroup,
      hoverMesh: this.hoverMesh,
      map,
      pathCells: this.pathCells,
      obstacleCells: this.obstacleCells,
      currentCity: this.currentCity,
      mode: this.mode,
      useGeoBackdrop: hasGeoBackdrop,
    });
    this.geoTilesRuntime.load(map.geo);
    const defActorGen = ++this.mapActorGen;
    const defYOffset = hasGeoBackdrop ? this.geoBoardHeight(map) : 0;
    loadMapActors({
      group: this.mapGroup,
      map,
      gltfLoader: this.gltfLoader,
      isStale: () => this.mapActorGen !== defActorGen,
      playfieldScale: this.playfieldVisualScale,
      yOffset: defYOffset,
    }).catch((e) => console.warn("[MapActors]", e));
    this.buildGroup.visible = true;
    this.enemyGroup.visible = true;
    this.fxGroup.visible = true;
    this.actorGroup.visible = false;
    this.updateDropVisibility();
  }

  private showExploreView(): void {
    if (!this.exploreMapInitialized) {
      this.loadExploreMap(this.exploreMapIndex, true);
      return;
    }

    const map = EXPLORE_MAPS[this.exploreMapIndex];
    setActiveRuntimeGrid(map);
    this.pathCells = this.explorePathCells;
    this.obstacleCells = this.exploreObstacleCells;
    this.pathWorldPoints = expandPathToOrderedCells(map.path).map((cell) => cellToWorld(cell));
    this.applyPlayfieldVisualScale(1);
    this.geoTilesRuntime.dispose();
    this.clearGroup(this.mapGroup);
    renderRuntimeMapScene({
      scene: this.scene,
      mapGroup: this.mapGroup,
      hoverMesh: this.hoverMesh,
      map,
      pathCells: this.pathCells,
      obstacleCells: this.obstacleCells,
      currentCity: this.currentCity,
      mode: this.mode,
      useGeoBackdrop: canUseGeoTiles(map.geo),
    });
    this.geoTilesRuntime.load(map.geo);
    const expActorGen = ++this.mapActorGen;
    loadMapActors({
      group: this.mapGroup,
      map,
      gltfLoader: this.gltfLoader,
      isStale: () => this.mapActorGen !== expActorGen,
    }).catch((e) => console.warn("[MapActors]", e));
    this.buildGroup.visible = false;
    this.enemyGroup.visible = false;
    this.fxGroup.visible = false;
    this.actorGroup.visible = true;
    this.updateDropVisibility();
  }

  private applyPlayfieldVisualScale(scale: number, yOffset = 0): void {
    this.playfieldVisualScale = scale;
    this.playfieldYOffset = yOffset;
    this.groundPlane.constant = -yOffset;
    for (const group of [this.mapGroup, this.buildGroup, this.enemyGroup, this.dropGroup, this.fxGroup]) {
      group.scale.set(scale, 1, scale);
      group.position.y = yOffset;
    }
  }

  /** 地图组使用 (sx,1,sz) 拉大棋盘会与真实底板对齐，但会令子物体的 Y 被相对“拍扁”；对单位根结点补偿 Y，使占位与 GLTF 等高宽比恢复正常。 */
  private applyGeoPlayfieldSquashCompensation(mesh: THREE.Object3D): void {
    const s = this.playfieldVisualScale;
    if (s !== 1 && mesh.userData.geoSquashCompensatedScale !== s) {
      const previous = Number(mesh.userData.geoSquashCompensatedScale) || 1;
      mesh.scale.y /= previous;
      mesh.scale.y *= s;
      mesh.userData.geoSquashCompensatedScale = s;
    }
  }

  /** 根据除血条外的子物体包围盒，将血条移到模型顶缘上方（与新 GLB / 球体占位一致）。 */
  private syncEnemyHealthBarVertical(enemy: Enemy): void {
    enemy.mesh.updateMatrixWorld(true);
    const bar = enemy.healthBar;
    const box = new THREE.Box3();
    for (const ch of enemy.mesh.children) {
      if (!ch.userData.isEnemyHealthBar) {
        box.expandByObject(ch);
      }
    }
    if (box.isEmpty()) {
      return;
    }
    const cx = (box.min.x + box.max.x) * 0.5;
    const cz = (box.min.z + box.max.z) * 0.5;
    const ratio = Math.max(enemy.hp / enemy.maxHp, 0);
    const worldTop = new THREE.Vector3(cx, box.max.y + 0.24, cz);
    const localTop = enemy.mesh.worldToLocal(worldTop.clone());
    const barRoot = enemy.mesh.children.find((ch) => ch.userData.isEnemyHealthBarRoot);
    if (barRoot) {
      barRoot.position.set(0, localTop.y, 0);
      bar.position.y = 0;
    } else {
      bar.position.y = localTop.y;
    }
    bar.position.z = 0.02;
    bar.position.x = -(1 - ratio) * 0.59;
    for (const ch of enemy.mesh.children) {
      if (ch.userData.isEnemyHealthBar && ch !== bar && !ch.userData.isEnemyHealthBarRoot) {
        ch.position.set(0, localTop.y, 0);
      }
    }
  }

  /** 塔开火瞄准点：敌人模型世界空间包围盒中心（比固定 y=0.7 更准确）。 */
  private enemyAimWorldCenter(enemy: Enemy): THREE.Vector3 {
    enemy.mesh.updateMatrixWorld(true);
    const box = new THREE.Box3();
    for (const ch of enemy.mesh.children) {
      if (!ch.userData.isEnemyHealthBar) {
        box.expandByObject(ch);
      }
    }
    if (box.isEmpty()) {
      const p = enemy.mesh.position.clone();
      p.y += 0.72;
      return p;
    }
    return new THREE.Vector3(
      (box.min.x + box.max.x) * 0.5,
      (box.min.y + box.max.y) * 0.52,
      (box.min.z + box.max.z) * 0.5,
    );
  }

  /**
   * basic / scout：用 public/GameModels/Enemy 下的 GLB 替换球体占位；
   * 地理棋盘压扁在未使用 GLB 时已在 spawn 时处理，此处最终再压一次整组 scale.y。
   */
  private async replaceEnemyBodyWithDefaultGltf(enemy: Enemy): Promise<void> {
    const url = getDefaultEnemyGlbUrl(enemy.type);
    if (!url) {
      return;
    }

    try {
      let template = this.enemyDefaultGltfTemplateByUrl.get(url);
      if (!template) {
        const gltf = await new Promise<any>((resolve, reject) => {
          this.gltfLoader.load(url, resolve, undefined, reject);
        });
        template = gltf.scene as THREE.Object3D;
        this.enemyDefaultGltfTemplateByUrl.set(url, template);
      }

      if (!this.enemies.includes(enemy)) {
        return;
      }

      const root = skeletonClone(template);
      root.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });

      for (const ch of [...enemy.mesh.children]) {
        if (!ch.userData.isEnemyHealthBar) {
          enemy.mesh.remove(ch);
        }
      }

      const targetDiameter = getEnemyTargetBodyDiameter(enemy);
      const boxBefore = new THREE.Box3().setFromObject(root);
      const sizeBefore = boxBefore.getSize(new THREE.Vector3());
      const horizontal = Math.max(sizeBefore.x, sizeBefore.z, 0.001);
      const uniform = targetDiameter / horizontal;
      root.scale.setScalar(uniform);

      const boxAfter = new THREE.Box3().setFromObject(root);
      root.position.y = -boxAfter.min.y;

      enemy.mesh.add(root);
      this.applyGeoPlayfieldSquashCompensation(enemy.mesh);
      this.syncEnemyHealthBarVertical(enemy);
    } catch (error) {
      console.warn("[EnemyModel] failed to load default GLB:", url, error);
      if (this.enemies.includes(enemy)) {
        this.applyGeoPlayfieldSquashCompensation(enemy.mesh);
        this.syncEnemyHealthBarVertical(enemy);
      }
    }
  }

  private geoBoardHeight(map: MapDefinition): number {
    const configured = Number(map.geo?.boardHeightMeters);
    return Number.isFinite(configured) && configured > 0 ? configured : GEO_PLAYFIELD_LIFT_METERS;
  }

  private createPlayer(): void {
    // Preserve the player's current position/rotation so async model-reloads
    // (e.g. loadDefaultPlayer completing while in explore mode) don't teleport
    // the character back to world origin.
    const savedPos = this.player ? this.player.position.clone() : null;
    const savedRotY = this.player ? this.player.rotation.y : 0;
    const shouldRestorePos = !!savedPos && this.mode === "explore" && this.exploreMapInitialized;

    if (this.player) {
      this.actorGroup.remove(this.player);
      this.playerMixer = undefined;
      this.playerActions = {};
      this.playerActiveAction = undefined;
    }

    this.player = new THREE.Group();
    this.player.rotation.order = "YXZ";

    if (this.customPlayerModel) {
      // skeletonClone properly re-wires SkinnedMesh bone references so
      // that AnimationMixer can bind clips to the cloned skeleton.
      const model = skeletonClone(this.customPlayerModel) as THREE.Group;
      const scale = this.getClampedUserScale("player");
      model.scale.set(scale, scale, scale);
      model.position.y = 0;
      this.player.add(model);
    } else {
      this.player.add(createFallbackPlayerMesh());
    }

    this.player.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Build animation mixer on the player root; SkeletonUtils.clone ensures
    // bone names in this.player's subtree match the clip track paths.
    this.playerMixer = new THREE.AnimationMixer(this.player);
    const animTypes = ["idle", "walk", "run"];
    animTypes.forEach((type) => {
      const clip = this.customAnimations[type];
      if (clip) {
        const action = this.playerMixer!.clipAction(clip);
        this.playerActions[type] = action;
      }
    });

    // Start with idle
    if (this.playerActions["idle"]) {
      this.playerActiveAction = this.playerActions["idle"];
      this.playerActiveAction.play();
    }

    this.actorGroup.add(this.player);

    // Restore position after adding so the player doesn't snap to origin
    if (shouldRestorePos && savedPos) {
      this.player.position.copy(savedPos);
      this.player.rotation.y = savedRotY;
    }
  }

  private fadeToAnimation(type: string, duration = 0.25): void {
    const nextAction = this.playerActions[type];
    if (!nextAction || nextAction === this.playerActiveAction) {
      return;
    }

    if (this.playerActiveAction) {
      this.playerActiveAction.fadeOut(duration);
    }
    nextAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(duration).play();
    this.playerActiveAction = nextAction;
  }

  private positionPlayerAtStart(): void {
    const start = this.currentMap().path[0];
    const fallback = { col: Math.min(start.col + 2, getActiveGridCols() - 1), row: start.row };
    const cell = this.isBuildBlocked(fallback) ? start : fallback;
    const position = cellToWorld(cell);
    const t = this.playerExploreTransform;
    this.player.position.set(
      position.x + t.offsetMeters.x,
      position.y + t.offsetMeters.y,
      position.z + t.offsetMeters.z,
    );
    this.player.rotation.set(
      THREE.MathUtils.degToRad(t.rotationDeg.x),
      THREE.MathUtils.degToRad(t.rotationDeg.y),
      THREE.MathUtils.degToRad(t.rotationDeg.z),
    );
  }

  private updatePointer(event: PointerEvent): void {
    const rectBounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rectBounds.left) / rectBounds.width) * 2 - 1;
    this.pointer.y = -(((event.clientY - rectBounds.top) / rectBounds.height) * 2 - 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.groundPlane, hit)) {
      const localHit = hit.clone();
      if (this.playfieldVisualScale !== 1) {
        localHit.x /= this.playfieldVisualScale;
        localHit.z /= this.playfieldVisualScale;
      }
      const cell = worldToCell(localHit);
      this.hoverCell = this.isInsideGrid(cell) ? cell : null;
      this.updateHover();
    }
  }

  private updateHover(): void {
    if (this.mode === "explore") {
      this.hoverMesh.visible = false;
      return;
    }
    if (!this.hoverCell) {
      this.hoverMesh.visible = false;
      return;
    }

    const position = cellToWorld(this.hoverCell);
    this.hoverMesh.position.set(position.x, 0.12, position.z);
    this.hoverMesh.visible = true;

    const material = this.hoverMesh.material as THREE.MeshBasicMaterial;
    const validation = this.validateBuild(this.hoverCell, false);
    material.color.set(validation.ok ? 0x8be9ff : 0xff5e73);
  }

  private selectBuild(id: BuildId): void {
    const spec = BUILD_SPECS[id];
    if (spec.requiresUnlock && !this.sTowerUnlocked) {
      this.showToast("S \u7ea7\u9632\u5fa1\u5854\u5c1a\u672a\u89e3\u9501\uff0c\u8bf7\u5148\u6253\u5f00\u8865\u7ed9\u62bd\u5361");
      this.openGacha();
      return;
    }
    this.selectedBuild = id;
    this.updateUi();
  }

  private toggleMode(): void {
    this.mode = this.mode === "defense" ? "explore" : "defense";
    this.renderMapButtons();
    if (this.mode === "explore") {
      this.exploreWalkMode = false;
      this.showExploreView();
    } else {
      this.showDefenseView();
    }
    this.showToast(
      this.mode === "explore" ? "\u81ea\u7531\u63a2\u7d22\uff1a\u6218\u7ebf\u5728\u540e\u53f0\u7ee7\u7eed\u63a8\u8fdb" : "\u5854\u9632\u6a21\u5f0f\uff1a\u56de\u5230\u5b9e\u65f6\u6218\u7ebf",
    );
  }

  private toggleCameraMode(): void {
    if (this.mode === "explore") {
      this.showToast("\u63a2\u7d22\u6a21\u5f0f\u56fa\u5b9a\u7b2c\u4e09\u4eba\u79f0\u89c6\u89d2\uff0c\u53ef\u4f7f\u7528\u6eda\u8f6e\u7f29\u653e");
      return;
    }
    this.cameraMode = this.cameraMode === "topdown" ? "free" : "topdown";
    this.showToast(this.cameraMode === "topdown" ? "\u955c\u5934\uff1a\u6218\u672f\u4fef\u89c6" : "\u955c\u5934\uff1a\u659c\u89c6\u5de1\u822a");
    this.updateUi();
  }

  private tryBuild(): void {
    if (this.mode !== "defense") {
      this.showToast("\u8bf7\u5207\u56de\u5854\u9632\u6a21\u5f0f\u540e\u518d\u90e8\u7f72\u9632\u5fa1\u5854");
      return;
    }
    if (!this.hoverCell) {
      return;
    }

    const validation = this.validateBuild(this.hoverCell, true);
    if (!validation.ok) {
      this.showToast(validation.reason);
      return;
    }

    const spec = BUILD_SPECS[this.selectedBuild];
    this.money -= spec.cost;
    const building: Building = {
      uid: this.nextUid,
      spec,
      cell: { ...this.hoverCell },
      mesh: this.createBuildingMesh(spec),
      cooldown: 0,
      armed: true,
      hp: spec.maxHp ?? 1,
      blockingEnemies: [],
      skillCooldownTimer: 0,
    };
    this.attachBuildingHud(building);
    this.nextUid += 1;

    const position = cellToWorld(building.cell);
    building.mesh.position.set(position.x, 0, position.z);
    this.buildings.push(building);
    this.buildGroup.add(building.mesh);
    this.showToast(`\u5efa\u9020\u5b8c\u6210\uff1a${spec.name}`);
    this.updateUi();
    this.updateHover();
  }

  private tryDemolish(): void {
    if (!this.hoverCell) {
      return;
    }

    const building = this.buildings.find((item) => sameCell(item.cell, this.hoverCell));
    if (!building) {
      return;
    }

    this.money += Math.floor(building.spec.cost * 0.5);
    this.buildGroup.remove(building.mesh);
    this.buildings = this.buildings.filter((item) => item !== building);
    this.showToast(`\u5df2\u62c6\u9664\uff1a${building.spec.name}`);
    this.updateUi();
    this.updateHover();
  }

  private validateBuild(cell: GridCell, includeMoney: boolean): { ok: true } | { ok: false; reason: string } {
    const spec = BUILD_SPECS[this.selectedBuild];
    const key = cellKey(cell);
    const pathCells = this.defensePathCells;
    const obstacleCells = this.defenseObstacleCells;
    const mustPlaceOnPath = spec.id === "mine" || spec.id === "qinqiong";

    if (!this.isInsideGrid(cell)) {
      return { ok: false, reason: "\u8d85\u51fa\u5730\u56fe\u8fb9\u754c" };
    }
    if (obstacleCells.has(key)) {
      return { ok: false, reason: "\u65e0\u6cd5\u5728\u969c\u788d\u7269\u4e0a\u5efa\u9020" };
    }
    if (spec.requiresUnlock && !this.sTowerUnlocked) {
      return { ok: false, reason: "S \u7ea7\u9632\u5fa1\u5854\u5c1a\u672a\u89e3\u9501" };
    }
    if (this.buildings.some((building) => sameCell(building.cell, cell))) {
      return { ok: false, reason: "\u8be5\u683c\u5df2\u6709\u5efa\u7b51" };
    }
    if (spec.rank === "S" && this.buildings.some((building) => building.spec.id === spec.id)) {
      return { ok: false, reason: `${spec.name} \u662f S \u7ea7\u9650\u5b9a\u5361\uff0c\u6bcf\u5f20\u5730\u56fe\u53ea\u80fd\u90e8\u7f72 1 \u6b21` };
    }
    if (mustPlaceOnPath) {
      if (!pathCells.has(key)) {
        return {
          ok: false,
          reason: spec.id === "qinqiong" ? "\u79e6\u743c\u00b7\u95e8\u795e\u53ea\u80fd\u90e8\u7f72\u5728\u9053\u8def\u4e0a\u963b\u6321\u654c\u4eba" : "\u5730\u96f7\u53ea\u80fd\u94fa\u5728\u9053\u8def\u4e0a",
        };
      }
    } else if (pathCells.has(key)) {
      return { ok: false, reason: "\u9053\u8def\u4f9b\u654c\u519b\u884c\u8fdb\uff0c\u4ec5\u80fd\u653e\u7f6e\u5730\u96f7\u6216\u79e6\u743c\u00b7\u95e8\u795e" };
    }
    if (includeMoney && this.money < spec.cost) {
      return { ok: false, reason: `\u8d44\u91d1\u4e0d\u8db3\uff0c\u8fd8\u9700 $${spec.cost - this.money}` };
    }

    return { ok: true };
  }

  private createBuildingMesh(spec: BuildSpec): THREE.Group {
    const visual = createRenderedBuildingMesh({
      spec,
      customModel: this.customModels[spec.id],
      getClampedUserScale: (target) => this.getClampedUserScale(target),
      isBeijing: this.currentCity === "beijing" || this.currentMap().id.startsWith("beijing"),
    });
    const root = new THREE.Group();
    this.applyGeoPlayfieldSquashCompensation(visual);
    root.add(visual);
    return root;
  }

  private attachBuildingHud(building: Building): void {
    building.healthBarGroup = undefined;
    building.healthBarFill = undefined;
    building.skillHud = undefined;
    building.skillHudText = undefined;

    const barGroup = new THREE.Group();
    barGroup.position.y = 2.05;
    barGroup.visible = false;
    const background = new THREE.Mesh(
      new THREE.PlaneGeometry(1.34, 0.16),
      new THREE.MeshBasicMaterial({ color: 0x111827, transparent: true, opacity: 0.72, depthTest: false }),
    );
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(1.18, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x52ff7f, transparent: true, opacity: 0.95, depthTest: false }),
    );
    fill.position.z = 0.01;
    barGroup.add(background, fill);
    building.mesh.add(barGroup);
    building.healthBarGroup = barGroup;
    building.healthBarFill = fill;

    if (building.spec.activeSkill) {
      const skillHud = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.createHudTexture("技能准备中", false),
          transparent: true,
          depthTest: false,
          depthWrite: false,
        }),
      );
      skillHud.position.set(0, 2.75, 0);
      skillHud.scale.set(2.7, 1, 1);
      skillHud.visible = false;
      building.mesh.add(skillHud);
      building.skillHud = skillHud;
      building.skillHudText = "";
    }
  }

  private createHudTexture(text: string, ready: boolean): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 384;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = ready ? "rgba(255, 214, 102, 0.92)" : "rgba(17, 24, 39, 0.82)";
      context.strokeStyle = ready ? "rgba(255, 255, 255, 0.95)" : "rgba(148, 163, 184, 0.8)";
      context.lineWidth = 4;
      context.fillRect(12, 18, canvas.width - 24, canvas.height - 36);
      context.strokeRect(12, 18, canvas.width - 24, canvas.height - 36);
      context.fillStyle = ready ? "#1f1300" : "#e5e7eb";
      context.font = "700 28px Microsoft YaHei, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      const lines = text.split("\n");
      lines.forEach((line, index) => {
        context.fillText(line, canvas.width / 2, 50 + index * 34);
      });
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private updateSkillHud(building: Building): void {
    if (!building.skillHud || !building.spec.activeSkill) {
      return;
    }
    const selected = this.selectedBuilding === building;
    building.skillHud.visible = selected;
    if (!selected) {
      return;
    }

    const cooldown = Math.max(0, building.skillCooldownTimer);
    const ready = cooldown <= 0;
    const text = ready ? `点击/F 释放\n${building.spec.activeSkill.name}` : `冷却 ${Math.ceil(cooldown)}s\n${building.spec.activeSkill.name}`;
    if (building.skillHudText === text) {
      return;
    }
    building.skillHudText = text;
    const material = building.skillHud.material as THREE.SpriteMaterial;
    material.map?.dispose();
    material.map = this.createHudTexture(text, ready);
    material.needsUpdate = true;
  }

  private updateBuildingHud(): void {
    for (const building of this.buildings) {
      const maxHp = building.spec.maxHp ?? 1;
      const ratio = clamp(building.hp / maxHp, 0, 1);
      const isSelected = this.selectedBuilding === building;
      const showHealth =
        isSelected ||
        ratio < 0.999 ||
        building.blockingEnemies.length > 0 ||
        (building.damageReductionUntil ?? 0) > this.elapsed;

      if (building.healthBarGroup && building.healthBarFill) {
        building.healthBarGroup.visible = showHealth;
        if (showHealth) {
          building.healthBarGroup.quaternion.copy(this.camera.quaternion);
          building.healthBarFill.scale.x = Math.max(0.02, ratio);
          building.healthBarFill.position.x = -(1 - ratio) * 0.59;
          const material = building.healthBarFill.material as THREE.MeshBasicMaterial;
          material.color.set(ratio > 0.55 ? 0x52ff7f : ratio > 0.25 ? 0xffd166 : 0xff5e73);
        }
      }

      building.mesh.traverse((child) => {
        if (child.userData.isRangeRing) {
          child.visible = isSelected;
        }
      });

      this.updateSkillHud(building);
    }
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());
    const now = performance.now();
    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = now;
    this.elapsed += dt;

    if (this.gameStarted && !this.paused) {
      this.updateDefense(dt);
      if (this.mode === "explore") {
        this.updateExplore(dt);
      }
      this.updateDrops(dt);
    }
    this.updateCamera(dt);
    this.geoTilesRuntime.update();
    if (!this.paused) {
      this.updateEffects(dt);
      this.updateToast(dt);
    }
    this.updateEnemyHuds();
    this.updateBuildingHud();
    this.updateUi();
    this.renderer.render(this.scene, this.camera);
  }

  private updateDefense(dt: number): void {
    if (this.mode === "defense") {
      this.moveDefenseCamera(dt);
    }
    this.updateSpawner(dt);
    this.updateEnemies(dt);
    this.updateTowers(dt);
    this.updateMines();
  }

  private moveDefenseCamera(dt: number): void {
    if (this.keys.has("KeyJ")) this.freeCameraYaw += dt * 1.3;
    if (this.keys.has("KeyL")) this.freeCameraYaw -= dt * 1.3;

    const input = new THREE.Vector3();
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) input.z += 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) input.z -= 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) input.x -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) input.x += 1;
    if (input.lengthSq() === 0) {
      return;
    }

    input.normalize();
    const screenForward = new THREE.Vector3(-Math.sin(this.freeCameraYaw), 0, -Math.cos(this.freeCameraYaw));
    const screenRight = new THREE.Vector3(Math.cos(this.freeCameraYaw), 0, -Math.sin(this.freeCameraYaw));
    const worldDirection = screenRight
      .multiplyScalar(input.x)
      .add(screenForward.multiplyScalar(input.z))
      .normalize();
    const speed = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") ? 24 : 14;
    this.cameraPan.x = clamp(this.cameraPan.x + worldDirection.x * speed * dt, -getActiveGridCols(), getActiveGridCols());
    this.cameraPan.z = clamp(this.cameraPan.z + worldDirection.z * speed * dt, -getActiveGridRows(), getActiveGridRows());
  }

  private updateSpawner(dt: number): void {
    if (this.waveActive && this.spawnRemaining === 0 && this.enemies.length === 0) {
      const reward = 70 + this.wave * 12;
      this.money += reward;
      this.wave += 1;
      this.nextWaveDelay = 5;
      this.waveActive = false;
      this.showToast(`\u6ce2\u6b21\u6e05\u7406\u5b8c\u6bd5\uff0c\u5956\u52b1 $${reward}`);
      return;
    }

    if (!this.waveActive) {
      this.nextWaveDelay -= dt;
      if (this.nextWaveDelay <= 0) {
        this.waveActive = true;
        this.spawnRemaining = 5 + this.wave * 2;
        this.spawnCooldown = 0;
        this.showToast(`\u7b2c ${this.wave} \u6ce2\u5df2\u5f00\u59cb`, true);
      }
      return;
    }

    if (this.spawnRemaining <= 0) {
      return;
    }

    this.spawnCooldown -= dt;
    if (this.spawnCooldown <= 0) {
      this.spawnEnemy();
      this.spawnRemaining -= 1;
      this.spawnCooldown = Math.max(0.42, 1.05 - this.wave * 0.025);
    }
  }

  private spawnEnemy(): void {
    const map = MAPS[this.defenseMapIndex];
    const start = cellToWorld(map.path[0]);
    const enemy = createEnemyForWave({
      uid: this.nextUid,
      wave: this.wave,
      start,
    });
    const usesDefaultGltf = getDefaultEnemyGlbUrl(enemy.type) !== undefined;
    if (!usesDefaultGltf) {
      this.applyGeoPlayfieldSquashCompensation(enemy.mesh);
      this.syncEnemyHealthBarVertical(enemy);
    }
    this.nextUid += 1;

    this.enemies.push(enemy);
    this.enemyGroup.add(enemy.mesh);
    if (usesDefaultGltf) {
      void this.replaceEnemyBodyWithDefaultGltf(enemy);
    }
  }

  private updateEnemies(dt: number): void {
    for (const enemy of [...this.enemies]) {
      if (enemy.stunUntil > this.elapsed) {
        continue;
      }
      
      const speed = enemy.speed * (this.elapsed < enemy.slowUntil ? enemy.slowFactor : 1);
      let distance = speed * dt;

      if (enemy.blockedBy) {
        if (enemy.blockedBy.hp <= 0) {
          enemy.blockedBy = null;
        } else {
          this.damageBuilding(enemy.blockedBy, 20 * dt);
          continue;
        }
      }

      if (this.tryBlockEnemy(enemy)) {
        continue;
      }

      while (distance > 0 && enemy.segment < this.defensePathWorldPoints.length - 1) {
        const target = this.defensePathWorldPoints[enemy.segment + 1];
        const current = enemy.mesh.position;
        const dx = target.x - current.x;
        const dz = target.z - current.z;
        const segmentDistance = Math.hypot(dx, dz);

        if (segmentDistance <= distance) {
          enemy.mesh.rotation.y = Math.atan2(dx, dz);
          current.set(target.x, 0, target.z);
          enemy.segment += 1;
          distance -= segmentDistance;
        } else {
          enemy.mesh.rotation.y = Math.atan2(dx, dz);
          current.x += (dx / segmentDistance) * distance;
          current.z += (dz / segmentDistance) * distance;
          distance = 0;
        }
      }

      this.tryBlockEnemy(enemy);

      if (enemy.segment >= this.defensePathWorldPoints.length - 1) {
        this.enemyGroup.remove(enemy.mesh);
        this.enemies = this.enemies.filter((item) => item !== enemy);
        this.baseHp -= 1;
        this.showToast("\u654c\u4eba\u7a81\u7834\u9632\u7ebf\uff0c\u57fa\u5730\u751f\u547d -1");
        if (this.baseHp <= 0) {
          this.showToast("\u57fa\u5730\u88ab\u653b\u7834\uff0c\u6b63\u5728\u91cd\u7f6e\u5730\u56fe", true);
          this.loadDefenseMap(this.defenseMapIndex, true);
          return;
        }
      }
    }
  }

  private updateEnemyHuds(): void {
    const parentWorldQuaternion = new THREE.Quaternion();
    const localBillboardQuaternion = new THREE.Quaternion();
    for (const enemy of this.enemies) {
      enemy.mesh.getWorldQuaternion(parentWorldQuaternion);
      localBillboardQuaternion.copy(parentWorldQuaternion).invert().multiply(this.camera.quaternion);
      let rotatedRoot = false;
      for (const child of enemy.mesh.children) {
        if (child.userData.isEnemyHealthBarRoot) {
          child.quaternion.copy(localBillboardQuaternion);
          rotatedRoot = true;
        }
      }
      if (!rotatedRoot) {
        for (const child of enemy.mesh.children) {
          if (child.userData.isEnemyHealthBar) {
            child.quaternion.copy(localBillboardQuaternion);
          }
        }
      }
    }
  }

  private tryBlockEnemy(enemy: Enemy): boolean {
    if (enemy.blockedBy) {
      return true;
    }

    const currentCell = worldToCell(enemy.mesh.position);
    const blocker = this.buildings.find(
      (building) =>
        building.spec.role === "melee" &&
        sameCell(building.cell, currentCell) &&
        building.blockingEnemies.length < this.getBuildingBlockLimit(building),
    );
    if (!blocker) {
      return false;
    }

    enemy.blockedBy = blocker;
    blocker.blockingEnemies.push(enemy);
    enemy.mesh.position.copy(cellToWorld(blocker.cell));
    this.showToast(`${blocker.spec.name} \u963b\u6321\u4e86\u654c\u4eba`, true);
    return true;
  }

  private getBuildingBlockLimit(building: Building): number {
    const base = building.spec.maxBlockCount ?? 1;
    return (building.bonusBlockUntil ?? 0) > this.elapsed ? base + 1 : base;
  }

  private damageBuilding(building: Building, damage: number): void {
    const reductionFactor =
      (building.damageReductionUntil ?? 0) > this.elapsed ? building.damageReductionFactor ?? 1 : 1;
    building.hp -= damage * reductionFactor;
    if (building.hp <= 0) {
      this.demolishBuildingByRef(building);
    }
  }

  private demolishBuildingByRef(building: Building): void {
    this.buildGroup.remove(building.mesh);
    this.buildings = this.buildings.filter((item) => item !== building);
    // Free up blocked enemies
    for (const enemy of this.enemies) {
      if (enemy.blockedBy === building) {
        enemy.blockedBy = null;
      }
    }
  }

  private updateTowers(dt: number): void {
    for (const building of this.buildings) {
      if (building.skillCooldownTimer > 0) {
        building.skillCooldownTimer -= dt;
      }

      if (building.spec.role === "melee") {
        building.cooldown -= dt;
        if (building.cooldown <= 0 && building.blockingEnemies.length > 0) {
          // Melee attack
          building.blockingEnemies = building.blockingEnemies.filter(e => e.hp > 0);
          for (const e of building.blockingEnemies) {
            this.damageEnemy(e, building.spec.damage ?? 0);
          }
          building.cooldown = 1 / (building.spec.fireRate ?? 1);
        }
        continue;
      }

      if (building.spec.role === "healer") {
        building.cooldown -= dt;
        if (building.cooldown <= 0) {
          const origin = cellToWorld(building.cell);
          const range = (building.spec.healRange ?? 0) * TILE_SIZE;
          let healed = false;
          for (const target of this.buildings) {
            if (target.hp < (target.spec.maxHp ?? 1) && distanceXZ(origin, cellToWorld(target.cell)) <= range) {
              target.hp = Math.min(target.hp + (building.spec.healAmount ?? 0), target.spec.maxHp ?? 1);
              this.addBeam(origin, cellToWorld(target.cell), 0x4caf50); // Green heal beam
              healed = true;
            }
          }
          if (healed) {
            building.cooldown = 1 / (building.spec.fireRate ?? 1);
          }
        }
        continue;
      }

      if (building.spec.category !== "tower" || building.spec.role === "device") {
        continue;
      }

      const buff = this.towerBuffMultiplier(building);
      if (buff > 1 && Math.random() < 0.05) {
        // 能量信标增益描边特效
        addStatusOutlineEffect(this.effects, this.fxGroup, building.mesh, 0xffd700, 0.3);
      }
      building.cooldown -= dt;
      if (building.cooldown > 0) {
        continue;
      }

      const target = this.findTarget(building);
      if (!target) {
        continue;
      }

      this.fireAt(building, target);
      building.cooldown = 1 / ((building.spec.fireRate ?? 1) * buff);
    }
  }

  private towerBuffMultiplier(building: Building): number {
    return getTowerBuffMultiplier(building, this.buildings);
  }

  private findTarget(building: Building): Enemy | null {
    return findNearestEnemyTarget(building, this.enemies);
  }

  /** 世界空间枪口：预制局部炮口偏移 + building.localToWorld，随塔模型与棋盘缩放一起走。 */
  private towerProjectileMuzzleWorld(building: Building): THREE.Vector3 {
    building.mesh.updateMatrixWorld(true);
    const local =
      PRESET_TOWER_MUZZLE_LOCAL[building.spec.id]?.clone() ?? DEFAULT_PRESET_MUZZLE_LOCAL.clone();
    return building.mesh.localToWorld(local);
  }

  private fireAt(building: Building, target: Enemy): void {
    const origin = this.towerProjectileMuzzleWorld(building);
    const destination = this.enemyAimWorldCenter(target);
    const splashRadiusWorld =
      building.spec.splash !== undefined && building.spec.splash > 0
        ? building.spec.splash * TILE_SIZE
        : undefined;

    addTowerProjectileImpactFx(
      this.effects,
      this.fxGroup,
      origin,
      destination,
      building.spec.color,
      building.spec.id,
      splashRadiusWorld,
    );

    /** 溅射圆心必须与寻路脚底 anchor 一致，否则 bbox 中心与 mesh 水平错位时圈内判空（加农打不中） */
    if (splashRadiusWorld) {
      const anchor = target.mesh.position;
      for (const enemy of [...this.enemies]) {
        if (distanceXZ(anchor, enemy.mesh.position) <= splashRadiusWorld) {
          this.applyTowerDebuff(building, enemy);
          this.damageEnemy(enemy, building.spec.damage ?? 0);
        }
      }
      return;
    }

    this.applyTowerDebuff(building, target);
    this.damageEnemy(target, building.spec.damage ?? 0);
  }

  private applyTowerDebuff(building: Building, enemy: Enemy): void {
    if (!building.spec.slowFactor || !building.spec.slowDuration) {
      return;
    }
    enemy.slowFactor = building.spec.slowFactor;
    enemy.slowUntil = this.elapsed + building.spec.slowDuration;

    // 冰霜塔减速描边特效
    if (building.spec.id === "frost" || building.spec.id === "liqingzhao") {
      addStatusOutlineEffect(this.effects, this.fxGroup, enemy.mesh, 0x00e5ff, 0.4);
    }
  }

  private updateMines(): void {
    const mines = this.buildings.filter((building) => building.spec.id === "mine" && building.armed);
    for (const mine of mines) {
      const minePosition = cellToWorld(mine.cell);
      const triggerRadius = (mine.spec.triggerRadius ?? 0.7) * TILE_SIZE;
      const triggered = this.enemies.some(
        (enemy) => distanceXZ(minePosition, enemy.mesh.position) <= triggerRadius,
      );

      if (!triggered) {
        continue;
      }

      mine.armed = false;
      const splash = (mine.spec.splash ?? 1.3) * TILE_SIZE;
      this.addExplosion(minePosition, splash, mine.spec.color);
      for (const enemy of [...this.enemies]) {
        if (distanceXZ(minePosition, enemy.mesh.position) <= splash) {
          this.damageEnemy(enemy, mine.spec.damage ?? 0);
        }
      }
      this.buildGroup.remove(mine.mesh);
      this.buildings = this.buildings.filter((building) => building !== mine);
    }
  }

  private castActiveSkill(): void {
    if (!this.selectedBuilding || !this.selectedBuilding.spec.activeSkill) {
      return;
    }

    if (this.selectedBuilding.skillCooldownTimer > 0) {
      this.showToast(
        `${this.selectedBuilding.spec.activeSkill.name} \u51b7\u5374\u4e2d\uff1a${Math.ceil(this.selectedBuilding.skillCooldownTimer)}s`,
      );
      return;
    }

    const b = this.selectedBuilding;
    const origin = cellToWorld(b.cell);

    if (b.spec.id === "stellar") {
      this.addExplosion(origin, 7 * TILE_SIZE, 0xff4fd8);
      let hits = 0;
      for (const enemy of [...this.enemies]) {
        hits += 1;
        this.addBeam(origin, enemy.mesh.position.clone(), 0xff4fd8);
        enemy.slowUntil = this.elapsed + 4.5;
        enemy.slowFactor = 0.22;
        this.damageEnemy(enemy, 420);
      }
      this.showToast(`\u5929\u6cb3\u5ba1\u5224\u9501\u5b9a\u5168\u573a\uff0c\u547d\u4e2d ${hits} \u4e2a\u654c\u4eba`);
    } else if (b.spec.id === "qinqiong") {
      b.hp = b.spec.maxHp ?? b.hp;
      b.damageReductionUntil = this.elapsed + 8;
      b.damageReductionFactor = 0.18;
      b.bonusBlockUntil = this.elapsed + 8;
      this.addExplosion(origin, 3 * TILE_SIZE, 0xd4af37);
      let hits = 0;
      for (const enemy of [...this.enemies]) {
        if (distanceXZ(origin, enemy.mesh.position) <= 3 * TILE_SIZE) {
          hits += 1;
          enemy.stunUntil = this.elapsed + 2.5;
          this.damageEnemy(enemy, 220);
        }
      }
      this.showToast(`\u4e0d\u52a8\u5982\u5c71\uff1a\u79e6\u743c\u6ee1\u8840\u51cf\u4f24\uff0c\u9707\u6151 ${hits} \u4e2a\u654c\u4eba`);
    } else if (b.spec.id === "liqingzhao") {
      this.addExplosion(origin, 9 * TILE_SIZE, 0x98ff98);
      let hits = 0;
      for (const enemy of [...this.enemies]) {
        if (distanceXZ(origin, enemy.mesh.position) <= 9 * TILE_SIZE) {
          hits += 1;
          this.damageEnemy(enemy, 340);
          enemy.slowUntil = this.elapsed + 5.0;
          enemy.slowFactor = 0.16;
        }
      }
      this.showToast(`\u6f31\u7389\u5929\u6f6e\u547d\u4e2d ${hits} \u4e2a\u654c\u4eba\uff0c\u51b0\u5c01\u884c\u519b\u901f\u5ea6`);
    } else if (b.spec.id === "bianque") {
      this.addExplosion(origin, 7 * TILE_SIZE, 0x4caf50);
      for (const target of this.buildings) {
        target.hp = target.spec.maxHp ?? target.hp;
        target.damageReductionUntil = this.elapsed + 6;
        target.damageReductionFactor = 0.45;
      }
      let hits = 0;
      for (const enemy of [...this.enemies]) {
        if (distanceXZ(origin, enemy.mesh.position) <= 7 * TILE_SIZE) {
          hits += 1;
          this.damageEnemy(enemy, 180);
        }
      }
      this.showToast(`\u9752\u56ca\u6d4e\u4e16\uff1a\u5168\u4f53\u53cb\u519b\u56de\u6ee1\u5e76\u51cf\u4f24\uff0c\u836f\u6bd2\u53cd\u566c ${hits} \u4e2a\u654c\u4eba`);
    }

    b.skillCooldownTimer = b.spec.activeSkill!.cooldown;
    this.updateUi();
  }

  private damageEnemy(enemy: Enemy, damage: number): void {
    if (enemy.hp <= 0) {
      return;
    }

    enemy.hp -= damage;
    const ratio = Math.max(enemy.hp / enemy.maxHp, 0);
    enemy.healthBar.scale.x = ratio;
    enemy.healthBar.position.x = -(1 - ratio) * 0.59;
    const healthMaterial = enemy.healthBar.material as THREE.MeshBasicMaterial;
    healthMaterial.color.set(ratio > 0.55 ? 0x34ff6a : ratio > 0.25 ? 0xffd84a : 0xff3d5e);

    if (enemy.hp > 0) {
      return;
    }

    // Unblock if it was blocked
    if (enemy.blockedBy) {
       enemy.blockedBy.blockingEnemies = enemy.blockedBy.blockingEnemies.filter(e => e !== enemy);
       enemy.blockedBy = null;
    }

    // Hacker: Stun nearby ranged/mage towers
    if (enemy.type === "hacker") {
       this.addExplosion(enemy.mesh.position, 4 * TILE_SIZE, 0x9d5cff);
       for (const b of this.buildings) {
          if (b.spec.role === "ranged" || b.spec.role === "mage" || b.spec.role === "support") {
             if (distanceXZ(b.mesh.position, enemy.mesh.position) <= 4 * TILE_SIZE) {
                b.cooldown = Math.max(b.cooldown, 3.0); // Stun for 3 seconds
                this.showToast(`[\u9ed1\u5ba2] \u5df2\u7628\u75ea ${b.spec.name}`);
             }
          }
       }
    }

    // Swarm: Split into 3 basic drones
    if (enemy.type === "swarm") {
       for (let i = 0; i < 3; i++) {
          const healthBar = new THREE.Mesh(
            new THREE.BoxGeometry(0.9, 0.12, 0.1),
            new THREE.MeshBasicMaterial({ color: 0x34ff6a, transparent: true, opacity: 0.98, depthTest: false }),
          );
          healthBar.renderOrder = 30;
          healthBar.userData.isEnemyHealthBar = true;
          const healthBarBack = new THREE.Mesh(
            new THREE.BoxGeometry(1.02, 0.18, 0.11),
            new THREE.MeshBasicMaterial({ color: 0x10131a, transparent: true, opacity: 0.78, depthTest: false }),
          );
          healthBarBack.renderOrder = 29;
          healthBarBack.userData.isEnemyHealthBar = true;
          const healthBarGroup = new THREE.Group();
          healthBarGroup.userData.isEnemyHealthBar = true;
          healthBarGroup.userData.isEnemyHealthBarRoot = true;
          healthBarGroup.add(healthBarBack, healthBar);
          const spawnEnemy: Enemy = {
            uid: this.nextUid++,
            type: "basic",
            bodyRadius: 0.3,
            mesh: new THREE.Group(),
            healthBar,
            hp: 60,
            maxHp: 60,
            speed: 2.2,
            reward: 5,
            segment: enemy.segment,
            slowUntil: 0,
            slowFactor: 1,
            blockedBy: null,
            stunUntil: 0,
          };
          const bMat = new THREE.MeshStandardMaterial({
            color: 0x24a317,
            roughness: 0.45,
            emissive: 0x24a317,
            emissiveIntensity: 0.18,
          });
          const bMesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), bMat);
          bMesh.position.y = 0.3;
          bMesh.castShadow = true;
          healthBar.position.set(0, 0, 0.02);
          healthBarBack.position.set(0, 0, 0);
          healthBarGroup.position.set(0, 0.82, 0);
          spawnEnemy.mesh.add(bMesh, healthBarGroup);

          const offset = new THREE.Vector3((Math.random() - 0.5) * TILE_SIZE, 0, (Math.random() - 0.5) * TILE_SIZE);
          spawnEnemy.mesh.position.copy(enemy.mesh.position).add(offset);
          this.enemies.push(spawnEnemy);
          this.enemyGroup.add(spawnEnemy.mesh);
          void this.replaceEnemyBodyWithDefaultGltf(spawnEnemy);
       }
    }

    this.spawnMoneyDropAt(enemy.mesh.position.clone(), enemy.reward, true);
    this.enemyGroup.remove(enemy.mesh);
    this.enemies = this.enemies.filter((item) => item !== enemy);
  }

  private updateExplore(dt: number): void {
    this.movePlayer(dt);
    this.dropTimer -= dt;
    if (this.dropTimer <= 0) {
      this.spawnExploreMoneyDrops(5);
      this.dropTimer = 5;
    }

    this.drops = collectExploreDrops({
      drops: this.drops,
      playerPosition: this.player.position,
      dropGroup: this.dropGroup,
      onCollect: (drop) => {
        this.money += Math.round(drop.amount);
        this.freePulls += 1;
        this.showToast(`\u62fe\u53d6\u8d44\u6e90 +$${drop.amount}\uff0c\u83b7\u5f97 1 \u5f20\u7279\u6d3e\u8865\u7ed9\u5361\uff01`);
        this.updateUi();
      },
    });
  }

  private movePlayer(dt: number): void {
    const moveIntent = getExploreMoveIntent(this.keys, this.exploreCameraYaw, this.exploreWalkMode);

    // Animation State Machine
    if (this.playerMixer) {
      if (!moveIntent.isMoving) {
        this.fadeToAnimation("idle");
      } else {
        this.fadeToAnimation(moveIntent.isRunning ? "run" : "walk");
      }
      this.playerMixer.update(dt);
    }

    if (!moveIntent.isMoving) {
      return;
    }

    const next = this.player.position.clone().addScaledVector(moveIntent.worldDirection, -moveIntent.speed * dt);
    const cell = worldToCell(next);
    if (!this.isInsideGrid(cell) || this.obstacleCells.has(cellKey(cell))) {
      return;
    }
    this.player.position.copy(next);
    orientPlayerToMovement(this.player, moveIntent.worldDirection, this.playerExploreTransform);
  }

  private updateCamera(dt: number): void {
    const smoothing = 1 - Math.pow(0.001, dt);

    if (this.mode === "explore") {
      this.camera.up.set(0, 1, 0);
      const target = this.player.position.clone();
      target.x *= this.playfieldVisualScale;
      target.z *= this.playfieldVisualScale;
      target.y = 1.35;
      const offset = new THREE.Vector3(
        Math.sin(this.exploreCameraYaw) * this.exploreCameraDistance,
        Math.sin(this.exploreCameraPitch) * this.exploreCameraDistance,
        Math.cos(this.exploreCameraYaw) * this.exploreCameraDistance,
      );
      const cameraPosition = target.clone().add(offset);
      this.camera.position.lerp(cameraPosition, smoothing);
      this.camera.lookAt(target);
      return;
    }

    const target = new THREE.Vector3(
      this.cameraPan.x * this.playfieldVisualScale,
      this.playfieldYOffset,
      this.cameraPan.z * this.playfieldVisualScale,
    );
    if (this.cameraMode === "topdown") {
      const cameraPosition = new THREE.Vector3(target.x, this.playfieldYOffset + this.topdownDistance, target.z + 0.01);
      this.camera.up.set(Math.sin(this.freeCameraYaw), 0, Math.cos(this.freeCameraYaw));
      this.camera.position.lerp(cameraPosition, smoothing);
      this.camera.lookAt(target);
      return;
    }

    this.camera.up.set(0, 1, 0);
    const horizontalDistance = Math.cos(this.freeCameraPitch) * this.freeCameraDistance;
    const cameraHeight = Math.sin(this.freeCameraPitch) * this.freeCameraDistance;
    const cameraPosition = new THREE.Vector3(
      target.x + Math.sin(this.freeCameraYaw) * horizontalDistance,
      this.playfieldYOffset + cameraHeight,
      target.z + Math.cos(this.freeCameraYaw) * horizontalDistance,
    );
    this.camera.position.lerp(cameraPosition, smoothing);
    this.camera.lookAt(target);
  }

  private spawnExploreMoneyDrops(count: number): void {
    let spawned = 0;
    for (let index = 0; index < count; index += 1) {
      if (this.spawnMoneyDrop(false)) {
        spawned += 1;
      }
    }
    if (spawned > 0) {
      this.showToast(`\u63a2\u7d22\u533a\u5237\u65b0\u4e86 ${spawned} \u4e2a\u91d1\u94b1\u9053\u5177`);
    }
  }

  private spawnMoneyDrop(showFeedback = true): boolean {
    const candidates = getAvailableMoneyDropCells({
      buildings: this.buildings,
      obstacleCells: this.obstacleCells,
    });
    if (candidates.length === 0) {
      return false;
    }

    const cell = candidates[Math.floor(Math.random() * candidates.length)];
    const amount = randomWeightedAmount();
    const drop = createExploreMoneyDrop({
      uid: this.nextUid,
      amount,
      cell,
      mesh: this.createMoneyDropMesh(amount),
    });
    this.nextUid += 1;

    const position = cellToWorld(cell);
    drop.mesh.position.set(position.x, 0.25, position.z);
    this.drops.push(drop);
    this.dropGroup.add(drop.mesh);
    this.updateDropVisibility();
    if (showFeedback) {
      this.showToast(`\u5730\u56fe\u4e0a\u6389\u843d $${amount}`);
    }
    return true;
  }

  private spawnMoneyDropAt(position: THREE.Vector3, amount: number, autoCollect: boolean): void {
    const drop = createDefenseMoneyDrop({
      uid: this.nextUid,
      amount,
      mesh: this.createMoneyDropMesh(amount),
      autoCollect,
    });
    this.nextUid += 1;
    drop.mesh.position.set(position.x, 0.28, position.z);
    this.drops.push(drop);
    this.dropGroup.add(drop.mesh);
    this.updateDropVisibility();
  }

  private createMoneyDropMesh(amount: number): THREE.Group {
    const mesh = createRenderedMoneyDropMesh({
      amount,
      customDropModel: this.customDropModel,
      getClampedUserScale: (target) => this.getClampedUserScale(target),
    });
    this.applyGeoPlayfieldSquashCompensation(mesh);
    return mesh;
  }

  private updateDrops(dt: number): void {
    this.drops = updateAutoCollectDrops({
      drops: this.drops,
      mode: this.mode,
      elapsed: this.elapsed,
      dt,
      dropGroup: this.dropGroup,
      onCollect: (amount) => {
        this.money += Math.round(amount);
        this.showToast(`\u51fb\u6740\u6389\u843d +$${amount}`);
      },
    });
  }

  private updateDropVisibility(): void {
    updateMoneyDropVisibility(this.drops, this.mode);
  }

  private addBeam(from: THREE.Vector3, to: THREE.Vector3, color: number): void {
    addBeamEffect(this.effects, this.fxGroup, from, to, color);
  }

  private addAuroraLaser(from: THREE.Vector3, to: THREE.Vector3): void {
    addAuroraLaserEffect(this.effects, this.fxGroup, from, to);
  }

  private addExplosion(center: THREE.Vector3, radius: number, color: number): void {
    addExplosionEffect(this.effects, this.fxGroup, center, radius, color);
  }

  private updateEffects(dt: number): void {
    this.effects = updateTimedEffects(this.effects, this.fxGroup, dt);
  }

  private updateToast(dt: number): void {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.toastElement.classList.remove("show");
      }
    }
    if (this.sideToastTimer > 0) {
      this.sideToastTimer -= dt;
      if (this.sideToastTimer <= 0) {
        this.sideToastElement.classList.remove("show");
      }
    }
  }

  private togglePause(): void {
    if (this.homeOverlay.classList.contains("show") || this.gachaOpen) {
      return;
    }
    this.paused = !this.paused;
    this.pausePanel.classList.toggle("show", this.paused);
    if (this.paused) {
      this.showToast("\u6e38\u620f\u5df2\u6682\u505c");
    }
  }

  private openGacha(): void {
    this.gachaOpen = true;
    this.gachaPanel.classList.add("show");
    this.gachaPanel.setAttribute("aria-hidden", "false");
    this.renderGachaPoolTabs();
    this.updateUi();
  }

  private renderGachaPoolTabs(): void {
    const availablePools = getAvailableGachaPools(GACHA_POOLS, this.currentCity);
    this.selectedGachaPool = resolveSelectedGachaPoolId(availablePools, this.selectedGachaPool);

    this.gachaPoolTabsElement.innerHTML = "";
    availablePools.forEach((pool) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "gacha-pool-tab" + (pool.id === this.selectedGachaPool ? " active" : "");
      tab.textContent = pool.name;
      tab.addEventListener("click", () => {
        this.selectedGachaPool = pool.id;
        this.renderGachaPoolTabs();
        this.updateGachaPoolDisplay();
      });
      this.gachaPoolTabsElement.append(tab);
    });

    this.renderGachaFocusTabs();
    this.updateGachaPoolDisplay();
  }

  private getResolvedGachaFocusBanner(): GachaFocusBanner | null {
    const pool = GACHA_POOLS.find((p) => p.id === this.selectedGachaPool) ?? GACHA_POOLS[0];
    const banners = pool?.focusBanners;
    if (!pool || !banners?.length) {
      return null;
    }
    let pickId = this.gachaFocusPickByPool[pool.id];
    if (!pickId || !banners.some((b) => b.id === pickId)) {
      pickId = banners[0]!.id;
      this.gachaFocusPickByPool[pool.id] = pickId;
    }
    return banners.find((b) => b.id === pickId) ?? banners[0]!;
  }

  private renderGachaFocusTabs(): void {
    const pool = GACHA_POOLS.find((p) => p.id === this.selectedGachaPool) ?? GACHA_POOLS[0];
    const banners = pool?.focusBanners;
    if (!pool || !banners?.length) {
      this.gachaFocusTabsElement.hidden = true;
      this.gachaFocusTabsElement.innerHTML = "";
      return;
    }

    let pickId = this.gachaFocusPickByPool[pool.id];
    if (!pickId || !banners.some((b) => b.id === pickId)) {
      pickId = banners[0]!.id;
      this.gachaFocusPickByPool[pool.id] = pickId;
    }

    this.gachaFocusTabsElement.hidden = false;
    this.gachaFocusTabsElement.innerHTML = "";
    const label = document.createElement("div");
    label.className = "gacha-focus-tabs-label";
    label.textContent = "当期补给";
    this.gachaFocusTabsElement.append(label);

    banners.forEach((banner) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "gacha-focus-tab" + (banner.id === pickId ? " active" : "");
      tab.textContent = banner.name;
      tab.title = `\u672c\u6b21 UP\uff1a${banner.name}\uff08\u51fa S \u65f6\u4ec5\u4e3a\u8be5\u5e72\u5458\uff09`;
      tab.addEventListener("click", () => {
        this.gachaFocusPickByPool[pool.id] = banner.id;
        this.renderGachaFocusTabs();
        this.updateGachaPoolDisplay();
      });
      this.gachaFocusTabsElement.append(tab);
    });
  }

  private updateGachaPoolDisplay(): void {
    const pool = GACHA_POOLS.find((p) => p.id === this.selectedGachaPool) ?? GACHA_POOLS[0];
    if (!pool) return;
    const focus = this.getResolvedGachaFocusBanner();
    const display = getGachaPoolDisplayModel(pool, this.pityCounter, focus);
    this.gachaTitleElement.textContent = display.title;
    this.gachaDescElement.textContent = display.description;
    this.gachaFeaturedNameElement.textContent = display.featuredName;
    this.gachaStageImgElement.src = display.featuredImg;
    this.gachaPityElement.textContent = String(display.pityRemaining);
  }

  private closeGacha(): void {
    if (this.gachaAnimating) {
      return;
    }
    this.gachaOpen = false;
    this.gachaPanel.classList.remove("show");
    this.gachaPanel.setAttribute("aria-hidden", "true");
  }

  private drawGacha(requestedCount: number): void {
    if (this.gachaAnimating) {
      return;
    }

    const pool = GACHA_POOLS.find((p) => p.id === this.selectedGachaPool) ?? GACHA_POOLS[0];
    const focus = this.getResolvedGachaFocusBanner();
    const draw = performGachaDraw(
      requestedCount,
      pool,
      {
        freePulls: this.freePulls,
        pityCounter: this.pityCounter,
        sTowerUnlocked: this.sTowerUnlocked,
      },
      { focusedSRollLabel: focus?.sRollLabel ?? null },
    );
    if (draw.depleted) {
      this.gachaResultElement.textContent = "\u5df2\u65e0\u53ef\u7528\u8865\u7ed9\u62bd\u5361\u6b21\u6570";
      this.showToast("\u6682\u65e0\u53ef\u7528\u8865\u7ed9\u62bd\u5361\u6b21\u6570");
      return;
    }

    this.freePulls = draw.nextState.freePulls;
    this.pityCounter = draw.nextState.pityCounter;
    this.sTowerUnlocked = draw.nextState.sTowerUnlocked;

    this.gachaAnimating = true;
    this.gachaStageElement.classList.toggle("s-hit", draw.hitS);
    this.gachaStageElement.classList.remove("reveal");
    this.gachaStageElement.classList.add("pulling");
    this.gachaResultElement.innerHTML = `<span>\u73af\u80fd\u626b\u63cf\u4e2d\u2026</span><span>${draw.count} \u8fde\u8865\u7ed9\u542f\u52a8</span>`;
    this.updateUi();

    window.setTimeout(() => {
      this.gachaStageElement.classList.remove("pulling");
      this.gachaStageElement.classList.add("reveal");
      this.gachaResultElement.innerHTML = draw.results
        .map((result) => `<span class="${result.startsWith("S") ? "rank-s" : ""}">${result}</span>`)
        .join("");
      if (draw.unlockedNow) {
        const buildId = draw.unlockedBuildId ?? pool.featured.id;
        this.selectedBuild = buildId;
        this.showToast(`${pool.name}\uff1aS \u7ea7\u5e72\u5458\u5df2\u89e3\u9501\uff0c\u53ef\u5728\u5854\u9632\u5730\u56fe\u90e8\u7f72`);
      }
      this.gachaAnimating = false;
      this.updateUi();
    }, draw.unlockedNow ? 1400 : 900);
  }

  private showToast(message: string, critical = false): void {
    const element = critical ? this.toastElement : this.sideToastElement;
    element.textContent = message;
    element.classList.add("show");
    if (critical) {
      this.toastTimer = 1.65;
    } else {
      this.sideToastTimer = 1.25;
    }
  }

  private updateUi(): void {
    const map = this.currentMap();
    this.modeElement.textContent = this.mode === "defense" ? "\u5854\u9632\u6a21\u5f0f" : "\u81ea\u7531\u63a2\u7d22";
    this.moneyElement.textContent = `$${Math.round(this.money)}`;
    this.cameraElement.textContent =
      this.mode === "explore"
        ? "\u7b2c\u4e09\u4eba\u79f0"
        : this.cameraMode === "topdown"
          ? "\u6218\u672f\u4fef\u89c6"
          : "\u659c\u89c6\u5de1\u822a";
    this.baseElement.textContent = `${this.baseHp}/${INITIAL_BASE_HP}`;
    const waveText = this.waveActive
      ? `\u7b2c ${this.wave} \u6ce2 \u00b7 \u5269\u4f59 ${this.spawnRemaining + this.enemies.length}`
      : `\u7b2c ${this.wave} \u6ce2 \u00b7 ${Math.ceil(this.nextWaveDelay)}s`;
    this.waveElement.textContent =
      this.mode === "defense" ? waveText : `\u540e\u53f0 ${waveText}`;
    this.mapElement.textContent = map.name;
    this.dropElement.textContent =
      this.mode === "explore"
        ? `${Math.ceil(this.dropTimer)}s \u540e\u6389\u843d`
        : "\u5207\u5230\u63a2\u7d22";

    const spec = BUILD_SPECS[this.selectedBuild];
    this.selectedElement.textContent = `\u5f53\u524d\uff1a${spec.name}\uff08$${spec.cost}\uff09${
      spec.requiresUnlock && !this.sTowerUnlocked ? " \u00b7 \u672a\u89e3\u9501" : ""
    }`;
    this.gachaPullsElement.textContent = String(this.freePulls);
    const pityPool = GACHA_POOLS.find((p) => p.id === this.selectedGachaPool) ?? GACHA_POOLS[0];
    const hard = pityPool?.hardPity ?? 20;
    this.gachaPityElement.textContent = String(Math.max(hard - this.pityCounter, 0));
    this.gachaUnlockElement.textContent = this.sTowerUnlocked
      ? "\u5df2\u89e3\u9501"
      : "\u672a\u89e3\u9501";
    this.gachaUnlockElement.classList.toggle("unlocked", this.sTowerUnlocked);
    if (this.selectedBuilding) {
      this.selectedUnitPanel.style.display = "flex";
      this.selectedUnitName.textContent = this.selectedBuilding.spec.name;
      this.selectedUnitStats.textContent = `\u751f\u547d\uff1a${Math.ceil(this.selectedBuilding.hp)}/${
        this.selectedBuilding.spec.maxHp ?? 1
      } | \u653b\u51fb\uff1a${this.selectedBuilding.spec.damage ?? 0}`;

      this.activeSkillButton.style.display = "none";
    } else {
      this.selectedUnitPanel.style.display = "none";
    }

    document.querySelectorAll<HTMLButtonElement>(".build-button").forEach((button) => {
      const buildId = button.dataset.build as BuildId;
      const buildSpec = BUILD_SPECS[buildId];
      const locked = !!buildSpec.requiresUnlock && !this.sTowerUnlocked;
      const deployedUnique = buildSpec.rank === "S" && this.buildings.some((building) => building.spec.id === buildId);
      button.classList.toggle("active", button.dataset.build === this.selectedBuild);
      button.classList.toggle("locked", locked || deployedUnique);
      button.disabled = locked || deployedUnique;
      button.title = deployedUnique ? "\u6bcf\u5f20 S \u5361\u5728\u5355\u5f20\u5730\u56fe\u4e2d\u53ea\u80fd\u90e8\u7f72 1 \u6b21" : "";

      if (buildSpec.city) {
        const isCurrentCity = this.currentCity === buildSpec.city || this.currentMap().id.startsWith(buildSpec.city);
        if (button.parentElement) {
          button.parentElement.style.display = isCurrentCity ? "flex" : "none";
        }
      } else if (button.parentElement) {
        button.parentElement.style.display = "flex";
      }
    });
    document.querySelectorAll<HTMLElement>(".map-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.map === String(this.activeMapIndex()));
    });
    document.querySelectorAll<HTMLElement>(".build-card").forEach((card) => {
      const buildId = card.dataset.build as BuildId;
      card.classList.toggle("has-model", !!this.customModels[buildId]);
    });
  }

  private activeMapIndex(): number {
    return this.mode === "explore" ? this.exploreMapIndex : this.defenseMapIndex;
  }

  private currentMapList(): MapDefinition[] {
    return this.mode === "explore" ? EXPLORE_MAPS : MAPS;
  }

  private currentMap(): MapDefinition {
    return this.currentMapList()[this.activeMapIndex()];
  }

  private isInsideGrid(cell: GridCell): boolean {
    return cell.col >= 0 && cell.col < getActiveGridCols() && cell.row >= 0 && cell.row < getActiveGridRows();
  }

  private isBuildBlocked(cell: GridCell): boolean {
    const key = cellKey(cell);
    return this.obstacleCells.has(key) || this.pathCells.has(key);
  }

  private clearGroup(group: THREE.Group): void {
    clearSceneGroup(group);
  }
}

