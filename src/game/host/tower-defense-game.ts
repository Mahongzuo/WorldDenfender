import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  loadAnimationAsset,
  loadCustomModelAsset,
  loadPersistedGameAssetConfig,
  modelTargetLabel as getModelTargetLabel,
  parseModelData as parsePersistedModelData,
  prepareUploadedModel as normalizeUploadedModel,
  uploadModelFile as uploadPersistedModelFile,
} from "../assets/asset-loading";
import { BuildingDefenseHud } from "../defense/building-defense-hud";
import { EnemyDefenseVisuals } from "../defense/enemy-defense-visuals";
import { BUILD_SPECS, CITY_MAP, GACHA_POOLS } from "../data/content";
import { tryCastDefenseActiveSkill } from "../defense/defense-active-skills";
import { DefenseSession } from "../defense/defense-session";
import {
  advanceDefenseSpawnState,
  spawnDefenseWaveEnemy,
} from "../defense/defense-wave-spawner";
import { tickDefenseMines } from "../defense/defense-mines";
import { applyDefenseEnemyDamage } from "../defense/defense-enemy-hit";
import { tickDefenseEnemyWave } from "../defense/defense-enemy-wave-sim";
import { updateAutoCollectDrops, updateMoneyDropVisibility } from "../drops/drops-runtime";
import { tickDefenseKeyboardCameraPan, tickDefenseSceneCamera, type DefenseKeyboardPanState } from "../camera/defense-camera";
import { GameEffectsFacade } from "../fx/game-effects-facade";
import {
  refreshBuildCardModelFlags,
  refreshGameplayHud,
  refreshMapButtonsActiveState,
} from "../ui/gameplay-hud";
import { ExploreCombatRuntime, type ExploreCombatHost } from "../explore/explore-combat-runtime";
import { buildExploreInventoryGridHtml, ExploreInventory } from "../explore/explore-inventory";
import { ExplorePlayerProgress } from "../explore/explore-player-progress";
import { resolveExploreGameplay, type ResolvedExploreGameplay } from "../explore/explore-gameplay-settings";
import { getExploreMoveIntent, orientPlayerToMovement } from "../explore/explore-runtime";
import { tickExploreSession } from "../explore/explore-session";
import { tickExploreFollowCamera } from "../camera/explore-camera";
import {
  pullEditorLevelsFromProjectFile as importEditorLevelsFromProjectFile,
} from "../editor/editor-sync-session";
import { GeoTilesRuntime, canUseGeoTiles } from "../geo/geo-tiles-runtime";
import { DEFAULT_PLAYER_MODEL_URLS, INITIAL_BASE_HP } from "../core/game-config";
import { GameEconomy } from "../economy/game-economy";
import { GameModelCustomization } from "../assets/game-model-customization";
import { GachaPanelPresenter } from "../ui/gacha-panel";
import {
  applyCameraZoom,
  beginCameraDrag as beginInputCameraDrag,
  bindGameInputHandlers,
  endCameraDrag as endInputCameraDrag,
  resizeViewport,
  rotateCameraFromPointer as rotateInputCameraFromPointer,
  shouldStartCameraDrag as shouldStartInputCameraDrag,
} from "../camera/input-controls";
import {
  applySharedRunFailureCleanup,
  presentGameOverScreen,
} from "../persistence/game-flow-coordinator";
import { HudBillboardOrient } from "../ui/hud-billboard-orient";
import { spawnDefenseMoneyDropAtWorld, spawnExploreMoneyDropOnGrid } from "../drops/money-drop-spawn";
import {
  buildRuntimeMapState,
  loadMapActors,
  renderRuntimeMapScene,
} from "../maps/map-runtime";
import { EXPLORE_MAPS, MAPS } from "../data/maps";
import {
  createBuildingMesh as createRenderedBuildingMesh,
  createFallbackPlayerMesh,
  createMoneyDropMesh as createRenderedMoneyDropMesh,
} from "../assets/render-factories";
import { createSaveData, getSaveSummaryText, readSaveData, writeSaveData } from "../persistence/save-system";
import {
  clearGroup as clearSceneGroup,
  configureGameRenderer,
  configureGameScene,
  createHoverMesh,
} from "../rendering/scene-runtime";
import { PlayerExploreAnimator } from "../explore/player-explore-animator";
import { renderGameUiShell } from "../ui/ui-shell";
import { tickTowerDefenseCombat } from "../defense/tower-defense-combat";
import { ToastController } from "../ui/toast-controller";
import {
  GRID_COLS,
  GRID_ROWS,
  cellKey,
  cellToWorld,
  clamp,
  distancePointToSegmentXZ,
  expandPath,
  expandPathToOrderedCells,
  getActiveGridCols,
  getActiveGridRows,
  keyToCell,
  mapCols,
  mapRows,
  orderEditorPathCells,
  sameCell,
  setActiveRuntimeGrid,
  uniqueCells,
  worldToCell,
} from "../core/runtime-grid";
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
  InventoryItem,
  MapDefinition,
  MapTheme,
  ModelTarget,
  MoneyDrop,
  PlayerExploreTransform,
  SaveData,
  TimedEffect,
} from "../core/types";
import { UI_THEME_STORAGE_KEY, applyUiColorMode, getUiColorMode, toggleUiColorMode } from "../ui/ui-theme";

const GEO_PLAYFIELD_SCALE = 20;
const GEO_PLAYFIELD_LIFT_METERS = 32;

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
  private readonly hudBillboardOrient = new HudBillboardOrient();

  private readonly modelCustomization = new GameModelCustomization(BUILD_SPECS);
  private readonly playerAnimator = new PlayerExploreAnimator();

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
  private activeSkillMeta!: HTMLElement;
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

  // Explore HUD and inventory DOM refs (populated via Object.assign from ui-shell)
  private exploreHud!: HTMLElement;
  private exploreLevelBadge!: HTMLElement;
  private exploreXpBar!: HTMLElement;
  private exploreHpBar!: HTMLElement;
  private exploreHpText!: HTMLElement;
  private exploreSkillAttackCd!: HTMLElement;
  private exploreSkillECd!: HTMLElement;
  private exploreSkillRCd!: HTMLElement;
  private inventoryPanel!: HTMLElement;
  private inventoryGrid!: HTMLElement;

  private readonly exploreProgress = new ExplorePlayerProgress();
  private readonly exploreInventory = new ExploreInventory();
  private exploreCombat!: ExploreCombatRuntime;
  private inventoryOpen = false;
  private readonly exploreEnemyGroup = new THREE.Group();
  private readonly exploreProjectileGroup = new THREE.Group();
  private exploreSafeZoneCells = new Set<string>();

  // Game-over state
  private gameOverPanel!: HTMLElement;
  private safeZoneShopPanel!: HTMLElement;
  private gameOverActive = false;
  // Safe-zone shop state
  private inSafeZone = false;

  private defenseMapIndex = 0;
  private exploreMapIndex = 0;
  private mode: GameMode = "defense";
  private cameraMode: CameraMode = "free";
  private selectedBuild: BuildId = "machine";
  private readonly economy = new GameEconomy(() => this.updateUi());
  private gachaOpen = false;
  private gachaAnimating = false;
  private selectedGachaPool = "standard";
  /** 济南等多 UP：按卡池 id 记住选中的当期补给 */
  private gachaFocusPickByPool: Partial<Record<string, string>> = {};
  private toasts!: ToastController;
  private gachaPresenter!: GachaPanelPresenter;
  private baseHp = INITIAL_BASE_HP;
  private wave = 1;
  private nextWaveDelay = 3;
  private spawnRemaining = 0;
  private spawnCooldown = 0;
  private waveActive = false;
  private selectedBuilding: Building | null = null;
  private dropTimer = resolveExploreGameplay(undefined).moneyDropRespawnIntervalSec;
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
  private readonly effectsFacade = new GameEffectsFacade(this.fxGroup, () => this.effects, (next) => {
    this.effects = next;
  });
  private cameraPan = new THREE.Vector3(0, 0, 0);
  private freeCameraYaw = -Math.PI / 4;
  private freeCameraPitch = 0.55;
  private freeCameraDistance = 86;
  private topdownDistance = 120;
  private exploreCameraYaw = 0;
  private exploreCameraPitch = 0.48;
  private exploreCameraDistance = 9.5;
  private readonly exploreFollowPivotSmoothed = new THREE.Vector3(0, 1.35, 0);
  private exploreCameraYawSmoothed = 0;
  private exploreCameraPitchSmoothed = 0.48;
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

  private readonly buildingDefenseHud!: BuildingDefenseHud;
  private readonly enemyDefenseVisuals!: EnemyDefenseVisuals;
  private readonly defenseSession!: DefenseSession;

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
    this.toasts = new ToastController(this.toastElement, this.sideToastElement);
    this.gachaPresenter = new GachaPanelPresenter(
      {
        panel: this.gachaPanel,
        poolTabsElement: this.gachaPoolTabsElement,
        focusTabsElement: this.gachaFocusTabsElement,
        titleElement: this.gachaTitleElement,
        descElement: this.gachaDescElement,
        featuredNameElement: this.gachaFeaturedNameElement,
        stageImgElement: this.gachaStageImgElement,
        pityDisplayElement: this.gachaPityElement,
        resultElement: this.gachaResultElement,
        stageElement: this.gachaStageElement,
      },
      {
        getCurrentCity: () => this.currentCity,
        economy: this.economy,
        getSelectedPool: () => this.selectedGachaPool,
        setSelectedPool: (id) => {
          this.selectedGachaPool = id;
        },
        focusPickByPool: this.gachaFocusPickByPool,
        getAnimating: () => this.gachaAnimating,
        setAnimating: (v) => {
          this.gachaAnimating = v;
        },
        setPanelOpen: (open) => {
          this.gachaOpen = open;
        },
        getSelectedBuild: () => this.selectedBuild,
        setSelectedBuild: (id) => {
          this.selectedBuild = id;
        },
        refreshUi: () => this.updateUi(),
        toast: (m, c) => this.showToast(m, c),
        scheduleReveal: (fn, ms) => window.setTimeout(fn, ms),
      },
    );
    this.configureRenderer();
    this.configureScene();
    this.bindEvents();

    this.buildingDefenseHud = new BuildingDefenseHud({
      buildGroupScaleX: () => this.buildGroup.scale.x,
      playfieldVisualScale: () => this.playfieldVisualScale,
      elapsed: () => this.elapsed,
      selectedBuilding: () => this.selectedBuilding,
      orientHudToCamera: (obj) => this.hudBillboardOrient.orient(this.camera, this.mode, this.cameraMode, obj),
      allBuildings: () => this.buildings,
    });

    this.enemyDefenseVisuals = new EnemyDefenseVisuals({
      hudScale: () => this.buildingDefenseHud.hudScale(),
      applyGeoPlayfieldSquashCompensation: (mesh) => this.applyGeoPlayfieldSquashCompensation(mesh),
      gltfLoader: this.gltfLoader,
      templateByUrl: this.enemyDefaultGltfTemplateByUrl,
      enemies: () => this.enemies,
      orientHudToCamera: (obj) => this.hudBillboardOrient.orient(this.camera, this.mode, this.cameraMode, obj),
    });

    this.defenseSession = new DefenseSession({
      isDefenseMode: () => this.mode === "defense",
      moveDefenseCamera: (dt) => this.moveDefenseCamera(dt),
      updateSpawner: (dt) => this.updateSpawner(dt),
      updateEnemies: (dt) => this.updateEnemies(dt),
      updateTowers: (dt) => this.updateTowers(dt),
      updateMines: () => this.updateMines(),
    });

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
    this.activeSkillMeta = this.requiredElement("#activeSkillMeta");
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
    this.requiredElement("#inventoryCloseBtn").addEventListener("click", () => this.toggleInventory());
    this.requiredElement("#gameOverRestartBtn").addEventListener("click", () => this.restartAfterGameOver());
    this.requiredElement("#gameOverMapBtn").addEventListener("click", () => this.returnToHomeFromGameOver());
    this.requiredElement("#shopCloseBtn").addEventListener("click", () => this.closeSafeZoneShop());
    this.requiredElement("#shopItems").addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".shop-item-buy");
      if (btn?.dataset.item) this.buySafeZoneItem(btn.dataset.item);
    });
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
    this.economy.resetForNewRun();
    this.defenseMapIndex = this.requestedDefIdx >= 0 ? this.requestedDefIdx : this.defenseMapIndex;
    this.exploreMapIndex = this.requestedExpIdx >= 0 ? this.requestedExpIdx : this.exploreMapIndex;
    this.exploreMapInitialized = false;
    this.modelCustomization.resetForFreshRun();
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
      ...this.economy.toSaveSlice(),
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
      customModelUrls: this.modelCustomization.customModelUrls,
      customDropModelUrl: this.modelCustomization.customDropModelUrl,
      customPlayerModelUrl: this.modelCustomization.customPlayerModelUrl,
      customAnimationUrls: this.modelCustomization.customAnimationUrls,
      modelScales: this.modelCustomization.modelScales,
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
      this.economy.applyFromSave(data);
      this.mode = data.mode ?? "defense";
      this.modelCustomization.customModels = {};
      this.modelCustomization.customModelUrls = data.customModelUrls ?? {};
      this.modelCustomization.customDropModel = null;
      this.modelCustomization.customDropModelUrl = data.customDropModelUrl ?? "";
      this.modelCustomization.customPlayerModel = null;
      this.modelCustomization.customPlayerModelUrl = data.customPlayerModelUrl ?? "";
      this.modelCustomization.customAnimationUrls = Object.fromEntries(
        Object.entries(data.customAnimationUrls ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
      );
      this.modelCustomization.restoreScalesToDefaults();
      this.modelCustomization.applyPersistedScaleRecord((data.modelScales ?? null) as Record<string, unknown> | null);
      this.modelCustomization.customAnimations = {};

      await this.modelCustomization.restoreMeshesFromStoredUrls({
        gltfLoader: this.gltfLoader,
        objLoader: this.objLoader,
      });
      await this.modelCustomization.reloadAnimationsFromStoredUrls({
        gltfLoader: this.gltfLoader,
        objLoader: this.objLoader,
      });
      if (this.modelCustomization.customPlayerModel) {
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
        this.buildingDefenseHud.attachToBuilding(building);
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

  private async loadGameAssetConfig(): Promise<void> {
    try {
      const loaded = await loadPersistedGameAssetConfig(
        { gltfLoader: this.gltfLoader, objLoader: this.objLoader },
        BUILD_SPECS,
      );
      if (!loaded) {
        return;
      }

      this.modelCustomization.assignFromLoadedEditorBundle(loaded);
      this.playerExploreTransform = loaded.playerExploreTransform;
    } catch (error) {
      console.warn("[GameAssetConfig]", error);
    }
  }

  private async loadDefaultPlayer(): Promise<void> {
    if (this.modelCustomization.customPlayerModel) {
      this.createPlayer();
      return;
    }
    for (const url of DEFAULT_PLAYER_MODEL_URLS) {
      try {
        const gltf = await new Promise<any>((resolve, reject) => {
          this.gltfLoader.load(url, resolve, undefined, reject);
        });
        this.modelCustomization.customPlayerModel = this.prepareUploadedModel(gltf.scene);
        /* Preserve editor/save scale; do not force player scale back to 1. */

        this.modelCustomization.ingestEmbeddedLocomotionClips(gltf.animations as THREE.AnimationClip[]);
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
        this.modelCustomization.ingestEmbeddedLocomotionClips(loaded.animations);
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
        this.modelCustomization.setAnimationClip(type, loaded.clip);
        this.showToast(`\u5df2\u66ff\u6362\u52a8\u753b\uff1a${type}`);

        try {
          const uploadedUrl = await uploadPersistedModelFile(file, loaded.data);
          if (uploadedUrl) {
            this.modelCustomization.rememberAnimationUrl(type, uploadedUrl);
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
      this.modelCustomization.customDropModel = model;
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
      this.modelCustomization.customPlayerModel = model;
      this.createPlayer();
      this.player.position.copy(position);
      this.player.rotation.y = rotation;
      return;
    }

    this.modelCustomization.customModels[target] = model;
    this.refreshPlacedModels(target);
  }

  private rememberModelUrl(target: ModelTarget, url: string): void {
    this.modelCustomization.rememberModelUrl(target, url);
  }

  private setModelScale(target: ModelTarget, value: number): void {
    const scale = clamp(Number.isFinite(value) ? value : 1, 0.1, 8);
    this.modelCustomization.modelScales[target] = scale;
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
      this.buildingDefenseHud.attachToBuilding(building);
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
    this.exploreEnemyGroup.name = "explore-enemies";
    this.scene.add(this.exploreEnemyGroup);
    this.exploreProjectileGroup.name = "explore-projectiles";
    this.scene.add(this.exploreProjectileGroup);
    this.exploreEnemyGroup.visible = false;
    this.exploreProjectileGroup.visible = false;
    this.exploreCombat = new ExploreCombatRuntime({
      enemyGroup: this.exploreEnemyGroup,
      projectileGroup: this.exploreProjectileGroup,
      inventory: this.exploreInventory,
      progress: this.exploreProgress,
      host: this.createExploreCombatHost(),
    });
  }

  private createExploreCombatHost(): ExploreCombatHost {
    return {
      getPlayerPosition: () => this.player.position,
      getExploreAttackForward: () => {
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.player.quaternion);
        forward.y = 0;
        if (forward.lengthSq() < 0.001) {
          forward.set(0, 0, -1);
        }
        return forward.normalize();
      },
      worldCellToWorld: (cell) => cellToWorld(cell),
      getObstacleCellKeys: () => this.obstacleCells,
      getSafeZoneCellKeys: () => this.exploreSafeZoneCells,
      getMapGridSize: () => {
        const map = EXPLORE_MAPS[this.exploreMapIndex];
        return { cols: map.cols ?? 28, rows: map.rows ?? 18 };
      },
      isInsideGrid: (cell) => this.isInsideGrid(cell),
      allocateUid: () => {
        const id = this.nextUid;
        this.nextUid += 1;
        return id;
      },
      showToast: (text, important) => this.showToast(text, important),
      damageExplorePlayer: (amount) => this.applyExplorePlayerDamage(amount),
    };
  }

  private applyExplorePlayerDamage(amount: number): void {
    this.exploreProgress.hp = Math.max(0, this.exploreProgress.hp - amount);
    if (this.exploreProgress.hp <= 0) {
      this.triggerGameOver("explore");
    }
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
          if (this.mode === "explore") {
            this.exploreCombat.fireBasicAttack();
            return;
          }
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
        if (pressed && meta?.repeat !== true && this.mode === "explore") {
          if (code === "KeyB") {
            // B = open safe zone shop (only when in safe zone)
            if (this.inSafeZone) {
              const hidden = this.safeZoneShopPanel.getAttribute("aria-hidden") !== "false";
              this.safeZoneShopPanel.setAttribute("aria-hidden", String(!hidden));
            } else {
              this.showToast("\u8fdb\u5165\u5b89\u5168\u533a\u624d\u80fd\u8d2d\u4e70");
            }
          }
          if (code === "KeyI") this.toggleInventory();
          if (code === "KeyE") this.exploreCombat.castOrbSkill();
          if (code === "KeyR") this.exploreCombat.castRSkill();
        }
        if (pressed) {
          this.keys.add(code);
        } else {
          this.keys.delete(code);
        }
      },
      onClearAllKeys: () => this.keys.clear(),
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

  private async pullEditorLevelsFromProjectFile(): Promise<number> {
    const result = await importEditorLevelsFromProjectFile({
      bundledCityMapJson: this.bundledCityMapJson,
      bundledBuildSpecsJson: this.bundledBuildSpecsJson,
      towerOverrideCtx: {
        bundledBuildSpecsJson: this.bundledBuildSpecsJson,
        currentCity: this.currentCity,
        currentCityLabel: this.currentCityLabel,
        requestedRegionCode: this.requestedRegionCode,
        requestedRegionName: this.requestedRegionName,
      },
      levelsPullCtx: { requestedLevelId: this.requestedLevelId },
    });
    this.requestedDefIdx = result.requestedDefIdx;
    this.requestedExpIdx = result.requestedExpIdx;
    return result.importedCount;
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

  private resolveCurrentExploreGameplay(): ResolvedExploreGameplay {
    return resolveExploreGameplay(EXPLORE_MAPS[this.exploreMapIndex]?.exploreGameplay);
  }

  private loadExploreMap(
    index: number,
    resetExploration: boolean,
    options?: { skipViewRefresh?: boolean; silent?: boolean },
  ): void {
    this.exploreMapIndex = index;
    this.exploreMapInitialized = true;
    const map = EXPLORE_MAPS[this.exploreMapIndex];
    this.exploreCombat.syncGameplay(map.exploreGameplay);
    const runtimeState = buildRuntimeMapState(map);
    this.explorePathCells = runtimeState.pathCells;
    this.exploreObstacleCells = runtimeState.obstacleCells;
    if (!options?.skipViewRefresh) {
      this.pathCells = this.explorePathCells;
      this.obstacleCells = this.exploreObstacleCells;
    }
    this.exploreSafeZoneCells = new Set((map.safeZones ?? []).map((c) => cellKey(c)));

    if (resetExploration) {
      const gp = this.resolveCurrentExploreGameplay();
      this.exploreWalkMode = false;
      this.dropTimer = gp.moneyDropRespawnIntervalSec;
      for (const drop of this.drops.filter((item) => item.source === "explore")) {
        this.dropGroup.remove(drop.mesh);
      }
      this.drops = this.drops.filter((item) => item.source !== "explore");
      this.positionPlayerAtStart();

      // Clear explore enemies and projectiles
      this.exploreCombat.resetEncounter();
      this.exploreProgress.hp = this.exploreProgress.maxHp;
    }

    if (resetExploration) {
      this.spawnExploreMoneyDrops(5);
    }

    if (options?.skipViewRefresh) {
      return;
    }

    this.showExploreView();
    if (!options?.silent) {
      this.showToast(`\u5df2\u8fdb\u5165\u63a2\u7d22\u5730\u56fe\uff1a${map.name}`);
    }
    this.updateUi();
  }

  private showDefenseView(): void {
    // Clear stuck keys so the camera/player can't drift after mode switch
    this.keys.clear();
    // Purge any in-flight defense effects so they don't ghost at the wrong
    // scale after applyPlayfieldVisualScale rescales fxGroup
    this.clearGroup(this.fxGroup);
    this.effects = [];
    // Expire all explore skill/projectile rings immediately – they don't tick
    // when in defense mode and would otherwise accumulate indefinitely
    this.exploreCombat.clearEphemeralProjectiles();

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
    this.exploreEnemyGroup.visible = false;
    this.exploreProjectileGroup.visible = false;
    this.exploreHud.setAttribute("aria-hidden", "true");
    this.safeZoneShopPanel.setAttribute("aria-hidden", "true");
    this.inSafeZone = false;
    this.gameRootEl.classList.remove("game-root--explore");
    if (this.inventoryOpen) {
      this.inventoryOpen = false;
      this.inventoryPanel.setAttribute("aria-hidden", "true");
    }
    this.updateDropVisibility();
  }

  private showExploreView(): void {
    // Clear stuck keys so the player can't auto-walk after mode switch
    this.keys.clear();

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
      safeZoneCells: this.exploreSafeZoneCells,
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
    this.exploreEnemyGroup.visible = true;
    this.exploreProjectileGroup.visible = true;
    this.exploreHud.setAttribute("aria-hidden", "false");
    this.gameRootEl.classList.add("game-root--explore");
    // Close gacha panel if it was open
    this.gachaPanel.classList.remove("show");
    this.gachaPanel.setAttribute("aria-hidden", "true");
    this.updateDropVisibility();
    this.syncExploreFollowCameraSmoothing();
  }

  private applyPlayfieldVisualScale(scale: number, yOffset = 0): void {
    this.playfieldVisualScale = scale;
    this.playfieldYOffset = yOffset;
    this.groundPlane.constant = -yOffset;
    for (const group of [this.mapGroup, this.buildGroup, this.enemyGroup, this.dropGroup, this.fxGroup]) {
      group.scale.set(scale, 1, scale);
      group.position.y = yOffset;
    }
    this.buildingDefenseHud.syncSkillHudScaleCorrection(this.buildings);
    this.buildingDefenseHud.layoutAll(this.buildings);
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
      this.playerAnimator.clear();
    }

    this.player = new THREE.Group();
    this.player.rotation.order = "YXZ";

    if (this.modelCustomization.customPlayerModel) {
      const model = skeletonClone(this.modelCustomization.customPlayerModel) as THREE.Group;
      const scale = this.modelCustomization.getClampedScale("player");
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

    this.playerAnimator.attachTo(this.player, this.modelCustomization.customAnimations);

    this.actorGroup.add(this.player);

    // Restore position after adding so the player doesn't snap to origin
    if (shouldRestorePos && savedPos) {
      this.player.position.copy(savedPos);
      this.player.rotation.y = savedRotY;
    }
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
    const map = this.currentMap();
    const th = map.theme;
    material.opacity = th.hoverCellOpacity ?? 0.42;
    material.color.set(validation.ok ? (th.hoverColorOk ?? 0x8be9ff) : (th.hoverColorBad ?? 0xff5e73));
  }

  private selectBuild(id: BuildId): void {
    const spec = BUILD_SPECS[id];
    if (spec.requiresUnlock && !this.economy.sTowerUnlocked) {
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
    if (!this.economy.trySpend(spec.cost)) {
      this.showToast(
        `\u8d44\u91d1\u4e0d\u8db3\uff0c\u8fd8\u9700 $${this.economy.insufficientFundsGap(spec.cost)}`,
      );
      return;
    }
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
    this.buildingDefenseHud.attachToBuilding(building);
    this.nextUid += 1;

    const position = cellToWorld(building.cell);
    building.mesh.position.set(position.x, 0, position.z);
    this.buildings.push(building);
    this.buildGroup.add(building.mesh);
    this.showToast(`\u5efa\u9020\u5b8c\u6210\uff1a${spec.name}`);
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

    this.economy.addMoney(Math.floor(building.spec.cost * 0.5));
    this.buildGroup.remove(building.mesh);
    this.buildings = this.buildings.filter((item) => item !== building);
    this.showToast(`\u5df2\u62c6\u9664\uff1a${building.spec.name}`);
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
    if (spec.requiresUnlock && !this.economy.sTowerUnlocked) {
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
    if (includeMoney && this.economy.balance < spec.cost) {
      return { ok: false, reason: `\u8d44\u91d1\u4e0d\u8db3\uff0c\u8fd8\u9700 $${this.economy.insufficientFundsGap(spec.cost)}` };
    }

    return { ok: true };
  }

  private createBuildingMesh(spec: BuildSpec): THREE.Group {
    const visual = createRenderedBuildingMesh({
      spec,
      customModel: this.modelCustomization.customModels[spec.id],
      getClampedUserScale: (target) => this.modelCustomization.getClampedScale(target),
      isBeijing: this.currentCity === "beijing" || this.currentMap().id.startsWith("beijing"),
    });
    const root = new THREE.Group();
    this.applyGeoPlayfieldSquashCompensation(visual);
    root.add(visual);
    return root;
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());
    const now = performance.now();
    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = now;
    this.elapsed += dt;

    if (this.gameStarted && !this.paused && !this.gameOverActive) {
      this.updateDefense(dt);
      /** 对战进行中探索与塔防并行模拟（切视图也不断探索侧计时/战斗） */
      this.updateExplore(dt);
      this.updateDrops(dt);
    }
    this.updateCamera(dt);
    this.geoTilesRuntime.update();
    if (!this.paused) {
      this.updateEffects(dt);
      this.updateToast(dt);
    }
    this.enemyDefenseVisuals.tickEnemyHuds(this.enemies);
    this.buildingDefenseHud.updatePerFrame(this.buildings);
    this.updateUi();
    this.renderer.render(this.scene, this.camera);
  }

  private updateDefense(dt: number): void {
    this.defenseSession.tick(dt);
  }

  private moveDefenseCamera(dt: number): void {
    const host = this;
    const panState: DefenseKeyboardPanState = {
      keys: host.keys,
      get freeCameraYaw() {
        return host.freeCameraYaw;
      },
      set freeCameraYaw(v: number) {
        host.freeCameraYaw = v;
      },
      cameraPan: host.cameraPan,
    };
    tickDefenseKeyboardCameraPan(dt, panState);
  }

  private updateSpawner(dt: number): void {
    const out = advanceDefenseSpawnState({
      dt,
      timers: {
        wave: this.wave,
        waveActive: this.waveActive,
        nextWaveDelay: this.nextWaveDelay,
        spawnRemaining: this.spawnRemaining,
        spawnCooldown: this.spawnCooldown,
      },
      enemiesLength: this.enemies.length,
    });
    this.wave = out.timers.wave;
    this.waveActive = out.timers.waveActive;
    this.nextWaveDelay = out.timers.nextWaveDelay;
    this.spawnRemaining = out.timers.spawnRemaining;
    this.spawnCooldown = out.timers.spawnCooldown;
    for (const fx of out.effects) {
      if (fx.kind === "economyGrant") {
        this.economy.addMoney(fx.amount);
      } else if (fx.kind === "toastWaveClearReward") {
        this.showToast(`\u6ce2\u6b21\u6e05\u7406\u5b8c\u6bd5\uff0c\u5956\u52b1 $${fx.reward}`);
      } else if (fx.kind === "toastWaveBegins") {
        this.showToast(`\u7b2c ${fx.wave} \u6ce2\u5df2\u5f00\u59cb`, true);
      } else if (fx.kind === "spawnEnemy") {
        this.spawnEnemy();
      }
    }
  }

  private spawnEnemy(): void {
    spawnDefenseWaveEnemy({
      defenseMapIndex: this.defenseMapIndex,
      wave: this.wave,
      enemies: this.enemies,
      enemyGroup: this.enemyGroup,
      allocateUid: () => {
        const uid = this.nextUid;
        this.nextUid += 1;
        return uid;
      },
      applyGeoSquash: (mesh) => this.applyGeoPlayfieldSquashCompensation(mesh),
      syncEnemyHealthBars: (enemy) => this.enemyDefenseVisuals.syncHealthBarVertical(enemy),
      replaceEnemyVisualMaybe: (enemy) => {
        void this.enemyDefenseVisuals.replaceBodyWithDefaultGltf(enemy);
      },
    });
  }

  private updateEnemies(dt: number): void {
    tickDefenseEnemyWave({
      dt,
      elapsed: this.elapsed,
      enemies: this.enemies,
      buildings: this.buildings,
      defensePathWorldPoints: this.defensePathWorldPoints,
      enemyGroup: this.enemyGroup,
      buildGroup: this.buildGroup,
      getBaseHp: () => this.baseHp,
      setBaseHp: (next) => {
        this.baseHp = next;
      },
      triggerGameOverDefense: () => this.triggerGameOver("defense"),
      showToast: (m, c) => this.showToast(m, c),
    });
  }

  private updateTowers(dt: number): void {
    tickTowerDefenseCombat(dt, {
      buildings: this.buildings,
      enemies: this.enemies,
      effects: this.effects,
      fxGroup: this.fxGroup,
      elapsed: this.elapsed,
      aimWorldCenter: (e) => this.enemyDefenseVisuals.aimWorldCenter(e),
      damageEnemy: (e, d) => this.damageEnemy(e, d),
      addBeam: (from, to, color) => this.addBeam(from, to, color),
    });
  }

  private updateMines(): void {
    tickDefenseMines({
      buildings: this.buildings,
      enemies: this.enemies,
      buildGroup: this.buildGroup,
      addExplosion: (c, r, col) => this.addExplosion(c, r, col),
      damageEnemy: (e, d) => this.damageEnemy(e, d),
    });
  }

  private castActiveSkill(): void {
    tryCastDefenseActiveSkill({
      getSelectedBuilding: () => this.selectedBuilding,
      getElapsed: () => this.elapsed,
      getEnemies: () => this.enemies,
      getBuildings: () => this.buildings,
      addExplosion: (center, radius, color) => this.addExplosion(center, radius, color),
      addBeam: (from, to, color) => this.addBeam(from, to, color),
      damageEnemy: (enemy, damage) => this.damageEnemy(enemy, damage),
      showToast: (message, critical) => this.showToast(message, critical),
      refreshUi: () => this.updateUi(),
    });
  }

  private damageEnemy(enemy: Enemy, damage: number): void {
    applyDefenseEnemyDamage(
      {
        buildings: this.buildings,
        enemies: this.enemies,
        enemyGroup: this.enemyGroup,
        allocateEnemyUid: () => {
          const uid = this.nextUid;
          this.nextUid += 1;
          return uid;
        },
        spawnMoneyDropAt: (position, amount, autoCollect) => this.spawnMoneyDropAt(position, amount, autoCollect),
        addExplosion: (center, radius, color) => this.addExplosion(center, radius, color),
        showToast: (message, critical) => this.showToast(message, critical),
        visuals: this.enemyDefenseVisuals,
      },
      enemy,
      damage,
    );
  }

  private updateExplore(dt: number): void {
    tickExploreSession({
      dt,
      movePlayer: (d) => this.movePlayer(d),
      dropTimer: this.dropTimer,
      dropRespawnIntervalSec: this.resolveCurrentExploreGameplay().moneyDropRespawnIntervalSec,
      setDropTimer: (v) => {
        this.dropTimer = v;
      },
      spawnExploreMoneyDrops: (c) => this.spawnExploreMoneyDrops(c),
      drops: this.drops,
      setDrops: (next) => {
        this.drops = next;
      },
      playerPosition: this.player.position,
      dropGroup: this.dropGroup,
      onExploreDropCollect: (drop) => {
        this.economy.grantExploreResourcePickup(Math.round(drop.amount), 1);
        this.showToast(`\u62fe\u53d6\u8d44\u6e90 +$${drop.amount}\uff0c\u83b7\u5f97 1 \u5f20\u7279\u6d3e\u8865\u7ed9\u5361\uff01`);
        this.addInventoryItem({
          id: `drop-${Date.now()}`,
          name: "\u8d44\u6e90\u78c1\u7247",
          quantity: 1,
          type: "material",
          icon: "\ud83d\udcbe",
          collectedAt: Date.now(),
        });
      },
      exploreCombatTick: (d) => this.exploreCombat.tick(d),
      updateExploreHud: () => this.updateExploreHud(),
      exploreSafeZoneCells: this.exploreSafeZoneCells,
      wasInSafeZone: this.inSafeZone,
      setInSafeZone: (v) => {
        this.inSafeZone = v;
      },
      safeZoneShopPanel: this.safeZoneShopPanel,
      showToast: (message, critical) => this.showToast(message, critical),
    });
  }

  private triggerGameOver(mode: "defense" | "explore"): void {
    presentGameOverScreen({
      getGameOverActive: () => this.gameOverActive,
      setGameOverActive: (v) => {
        this.gameOverActive = v;
      },
      gameOverReasonElement: this.requiredElement("#gameOverReason"),
      gameOverPanel: this.gameOverPanel,
      mode,
    });
  }

  /** 塔防与探索共享一局进度；任意模式失败后「重新开始」会重置资金、补给、抽卡与双模式战场状态。 */
  private resetSharedRunStateAfterFailure(): void {
    applySharedRunFailureCleanup({
      getGachaOpen: () => this.gachaOpen,
      closeGacha: () => this.closeGacha(),
      economyResetForNewRun: () => this.economy.resetForNewRun(),
      exploreProgressReset: () => this.exploreProgress.reset(),
      exploreInventoryReset: () => this.exploreInventory.reset(),
      exploreCombatResetAfterRunFailure: () => this.exploreCombat.resetAfterRunFailure(),
      setInventoryOpen: (open) => {
        this.inventoryOpen = open;
      },
      inventoryPanelHide: () => this.inventoryPanel.setAttribute("aria-hidden", "true"),
      setExploreWalkMode: (walking) => {
        this.exploreWalkMode = walking;
      },
      setElapsedZero: () => {
        this.elapsed = 0;
      },
      resetUid: () => {
        this.nextUid = 1;
      },
      clearSelectedBuilding: () => {
        this.selectedBuilding = null;
      },
      setDropTimerInitial: () => {
        this.dropTimer = this.resolveCurrentExploreGameplay().moneyDropRespawnIntervalSec;
      },
      setSafeZoneFalse: () => {
        this.inSafeZone = false;
      },
      safeZoneShopHide: () => this.safeZoneShopPanel.setAttribute("aria-hidden", "true"),
      renderInventoryGrid: () => this.renderInventoryGrid(),
    });
  }

  private restartAfterGameOver(): void {
    this.gameOverActive = false;
    this.gameOverPanel.setAttribute("aria-hidden", "true");
    this.resetSharedRunStateAfterFailure();
    this.mode = "defense";
    this.loadDefenseMap(this.defenseMapIndex, true);
    this.loadExploreMap(this.exploreMapIndex, true, { skipViewRefresh: true });
    this.saveGame(false);
    this.showToast(
      "\u5df2\u4ece\u5934\u5f00\u59cb\uff1a\u8d44\u91d1\u3001\u8865\u7ed9\u4e0e\u5854\u9632/\u63a2\u7d22\u8fdb\u5ea6\u5747\u5df2\u91cd\u7f6e",
      true,
    );
    this.updateUi();
  }

  private returnToHomeFromGameOver(): void {
    this.gameOverActive = false;
    this.gameOverPanel.setAttribute("aria-hidden", "true");
    this.backToSelection();
  }

  private closeSafeZoneShop(): void {
    this.safeZoneShopPanel.setAttribute("aria-hidden", "true");
  }

  private buySafeZoneItem(item: string): void {
    const costs: Record<string, number> = {
      "hp-small": 30,
      "hp-large": 60,
      "max-hp": 100,
      "full-heal": 80,
    };
    const cost = costs[item] ?? 0;
    if (!this.economy.trySpend(cost)) {
      this.showToast("\u8d44\u91d1\u4e0d\u8db3\uff01");
      return;
    }
    switch (item) {
      case "hp-small":
        this.exploreProgress.clampHeal(50);
        this.showToast("HP +50 \ud83d\udc8a");
        break;
      case "hp-large":
        this.exploreProgress.clampHeal(150);
        this.showToast("HP +150 \ud83d\udc89");
        break;
      case "max-hp":
        this.exploreProgress.maxHp += 50;
        this.exploreProgress.hp = this.exploreProgress.maxHp;
        this.showToast("\u6700\u5927 HP +50\uff0c\u5b8c\u5168\u6062\u590d \u2764\ufe0f");
        break;
      case "full-heal":
        this.exploreProgress.hp = this.exploreProgress.maxHp;
        this.showToast("\u5b8c\u5168\u6062\u590d \u2728");
        break;
    }
  }

  private addInventoryItem(item: InventoryItem): void {
    this.exploreInventory.mergeAdd(item);
    if (this.inventoryOpen) this.renderInventoryGrid();
  }

  private toggleInventory(): void {
    this.inventoryOpen = !this.inventoryOpen;
    this.inventoryPanel.setAttribute("aria-hidden", String(!this.inventoryOpen));
    if (this.inventoryOpen) this.renderInventoryGrid();
  }

  private renderInventoryGrid(): void {
    if (!this.inventoryGrid) return;
    this.inventoryGrid.innerHTML = buildExploreInventoryGridHtml(this.exploreInventory.getItemsSnapshot());
    this.inventoryGrid.querySelectorAll<HTMLButtonElement>(".inventory-item-use").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.idx);
        this.useInventoryItem(idx);
      });
    });
  }

  private useInventoryItem(idx: number): void {
    const result = this.exploreInventory.tryHealFromItem(idx, this.exploreProgress);
    if (!result.message) {
      return;
    }
    this.showToast(result.message);
    if (result.consumed) {
      this.renderInventoryGrid();
    }
  }

  private updateExploreHud(): void {
    const p = this.exploreProgress;
    const c = this.exploreCombat;
    const hpPct = p.maxHp > 0 ? (p.hp / p.maxHp) * 100 : 100;
    this.exploreHpBar.style.width = `${hpPct}%`;
    this.exploreHpText.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    this.exploreLevelBadge.textContent = String(p.level);
    const xpPct = p.xpToNext > 0 ? (p.xp / p.xpToNext) * 100 : 0;
    this.exploreXpBar.style.width = `${xpPct}%`;
    const atkMax = c.getAttackMaxCooldown();
    const eMax = c.getSkillEMaxCooldown();
    const rMax = c.getSkillRMaxCooldown();
    this.exploreSkillAttackCd.style.height =
      c.getAttackCooldown() > 0 ? `${(c.getAttackCooldown() / atkMax) * 100}%` : "0%";
    this.exploreSkillECd.style.height =
      c.getSkillECooldown() > 0 ? `${(c.getSkillECooldown() / eMax) * 100}%` : "0%";
    this.exploreSkillRCd.style.height =
      c.getSkillRCooldown() > 0 ? `${(c.getSkillRCooldown() / rMax) * 100}%` : "0%";
  }

  private movePlayer(dt: number): void {
    const gp = this.resolveCurrentExploreGameplay();
    const moveIntent = getExploreMoveIntent(this.keys, this.exploreCameraYaw, this.exploreWalkMode, {
      walk: gp.moveSpeedWalk,
      run: gp.moveSpeedRun,
    });

    if (!moveIntent.isMoving) {
      this.playerAnimator.fadeTo("idle");
    } else {
      this.playerAnimator.fadeTo(moveIntent.isRunning ? "run" : "walk");
    }
    this.playerAnimator.update(dt);

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

  private syncExploreFollowCameraSmoothing(): void {
    const s = this.playfieldVisualScale;
    this.exploreFollowPivotSmoothed.set(
      this.player.position.x * s,
      1.35,
      this.player.position.z * s,
    );
    this.exploreCameraYawSmoothed = this.exploreCameraYaw;
    this.exploreCameraPitchSmoothed = this.exploreCameraPitch;
  }

  private dampAngleRad(current: number, target: number, lambda: number, dt: number): number {
    const delta =
      THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
    return current + delta * (1 - Math.exp(-lambda * dt));
  }

  private updateCamera(dt: number): void {
    if (this.mode === "explore") {
      this.exploreCameraYawSmoothed = this.dampAngleRad(
        this.exploreCameraYawSmoothed,
        this.exploreCameraYaw,
        18,
        dt,
      );
      const pitchGap = this.exploreCameraPitch - this.exploreCameraPitchSmoothed;
      this.exploreCameraPitchSmoothed += pitchGap * (1 - Math.exp(-16 * dt));
      tickExploreFollowCamera(
        {
          camera: this.camera,
          playerPosition: this.player.position,
          playfieldVisualScale: this.playfieldVisualScale,
          exploreCameraYaw: this.exploreCameraYawSmoothed,
          exploreCameraPitch: this.exploreCameraPitchSmoothed,
          exploreCameraDistance: this.exploreCameraDistance,
          smoothedPivot: this.exploreFollowPivotSmoothed,
        },
        dt,
      );
      return;
    }

    tickDefenseSceneCamera(
      {
        camera: this.camera as THREE.PerspectiveCamera,
        mode: this.mode,
        cameraMode: this.cameraMode,
        cameraPan: this.cameraPan,
        playfieldVisualScale: this.playfieldVisualScale,
        playfieldYOffset: this.playfieldYOffset,
        topdownDistance: this.topdownDistance,
        freeCameraYaw: this.freeCameraYaw,
        freeCameraPitch: this.freeCameraPitch,
        freeCameraDistance: this.freeCameraDistance,
      },
      dt,
    );
  }

  private allocateNextDropUid(): number {
    const uid = this.nextUid;
    this.nextUid += 1;
    return uid;
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
    const rolled = spawnExploreMoneyDropOnGrid({
      buildings: this.buildings,
      obstacleCells: this.obstacleCells,
      drops: this.drops,
      dropGroup: this.dropGroup,
      allocateUid: () => this.allocateNextDropUid(),
      createMesh: (amount) => this.createMoneyDropMesh(amount),
    });
    if (rolled === false) {
      return false;
    }
    this.updateDropVisibility();
    if (showFeedback) {
      this.showToast(`\u5730\u56fe\u4e0a\u6389\u843d $${rolled}`);
    }
    return true;
  }

  private spawnMoneyDropAt(position: THREE.Vector3, amount: number, autoCollect: boolean): void {
    spawnDefenseMoneyDropAtWorld(
      {
        drops: this.drops,
        dropGroup: this.dropGroup,
        allocateUid: () => this.allocateNextDropUid(),
        createMesh: (amt) => this.createMoneyDropMesh(amt),
      },
      position,
      amount,
      autoCollect,
    );
    this.updateDropVisibility();
  }

  private createMoneyDropMesh(amount: number): THREE.Group {
    // Do NOT apply GEO squash compensation here: drops live in dropGroup which
    // already has scale (playfieldScale, 1, playfieldScale). Compensating Y
    // would make coins 20x taller than intended on GEO maps.
    return createRenderedMoneyDropMesh({
      amount,
      customDropModel: this.modelCustomization.customDropModel,
      getClampedUserScale: (target) => this.modelCustomization.getClampedScale(target),
    });
  }

  private updateDrops(dt: number): void {
    this.drops = updateAutoCollectDrops({
      drops: this.drops,
      mode: this.mode,
      elapsed: this.elapsed,
      dt,
      dropGroup: this.dropGroup,
      onCollect: (amount) => {
        this.economy.addMoney(Math.round(amount));
        this.showToast(`\u51fb\u6740\u6389\u843d +$${amount}`);
      },
    });
  }

  private updateDropVisibility(): void {
    updateMoneyDropVisibility(this.drops, this.mode);
  }

  private addBeam(from: THREE.Vector3, to: THREE.Vector3, color: number): void {
    this.effectsFacade.addBeam(from, to, color);
  }

  private addAuroraLaser(from: THREE.Vector3, to: THREE.Vector3): void {
    this.effectsFacade.addAuroraLaser(from, to);
  }

  private addExplosion(center: THREE.Vector3, radius: number, color: number): void {
    this.effectsFacade.addExplosion(center, radius, color);
  }

  private updateEffects(dt: number): void {
    this.effectsFacade.tick(dt);
  }

  private updateToast(dt: number): void {
    this.toasts.tick(dt);
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
    this.gachaPresenter.open();
  }

  private closeGacha(): void {
    this.gachaPresenter.close();
  }

  private drawGacha(requestedCount: number): void {
    this.gachaPresenter.draw(requestedCount);
  }

  private showToast(message: string, critical = false): void {
    this.toasts.show(message, critical);
  }

  private updateUi(): void {
    const map = this.currentMap();
    refreshGameplayHud(
      {
        modeElement: this.modeElement,
        moneyElement: this.moneyElement,
        cameraModeElement: this.cameraElement,
        baseHpElement: this.baseElement,
        waveElement: this.waveElement,
        mapNameElement: this.mapElement,
        dropHudElement: this.dropElement,
        selectedBuildSummaryElement: this.selectedElement,
        gachaPullsElement: this.gachaPullsElement,
        gachaPityElement: this.gachaPityElement,
        gachaUnlockElement: this.gachaUnlockElement,
        selectedUnitPanel: this.selectedUnitPanel,
        selectedUnitName: this.selectedUnitName,
        selectedUnitStats: this.selectedUnitStats,
        activeSkillMeta: this.activeSkillMeta,
        activeSkillButton: this.activeSkillButton,
      },
      {
        mode: this.mode,
        cameraMode: this.cameraMode,
        economy: this.economy,
        baseHp: this.baseHp,
        wave: this.wave,
        waveActive: this.waveActive,
        nextWaveDelay: this.nextWaveDelay,
        spawnRemaining: this.spawnRemaining,
        enemiesAlive: this.enemies.length,
        activeMapLabel: map.name,
        dropTimerRemaining: this.dropTimer,
        selectedBuild: this.selectedBuild,
        selectedGachaPool: this.selectedGachaPool,
        selectedBuilding: this.selectedBuilding,
        currentCityCode: this.currentCity,
        currentMapId: map.id,
        buildings: this.buildings,
      },
    );
    if (this.gachaOpen) {
      this.gachaPresenter.updatePoolDisplay();
    }
    refreshMapButtonsActiveState(this.activeMapIndex());
    refreshBuildCardModelFlags(this.modelCustomization.customModels);
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

