import type * as THREE from "three";
import type {
  DefenseElement,
  DefenseEffectSpec,
  DefenseFunctionTag,
  DefenseResistanceProfile,
  DefenseRuntimeStatus,
  DefenseStatusId,
} from "./defense-types";

export type GameMode = "defense" | "explore";
export type CameraMode = "topdown" | "free";
export type BuildId = "machine" | "cannon" | "frost" | "mine" | "beacon" | "stellar" | "qinqiong" | "liqingzhao" | "bianque";
export type BuildCategory = "tower" | "device";
export type BuildRole = "melee" | "ranged" | "mage" | "healer" | "support" | "device";
export type EnemyType = "basic" | "scout" | "hacker" | "tank" | "swarm";
export type GachaRarity = "S" | "A" | "B";
export type ModelTarget = BuildId | "moneyDrop" | "player";

export interface PlayerExploreTransform {
  offsetMeters: { x: number; y: number; z: number };
  rotationDeg: { x: number; y: number; z: number };
}

/** 全局音效（写入 level-editor-state.json → gameAssetConfig.globalAudio） */
export interface GlobalGameAudioConfig {
  /** 进入关卡前主界面 / 选关循环 BGM */
  menuBgmUrl?: string;
  /** 0–1，默认约 0.55 */
  menuBgmVolume?: number;
  towerBuildSfxUrl?: string;
  towerBuildSfxVolume?: number;
  /** 未按塔型指定时使用 */
  towerAttackDefaultSfxUrl?: string;
  towerAttackSfxVolume?: number;
  towerAttackSfxByBuildId?: Partial<Record<BuildId, string>>;
  /** 塔防模式敌人被击杀 */
  defenseEnemyDeathSfxUrl?: string;
  defenseEnemyDeathSfxVolume?: number;
  exploreBasicAttackSfxUrl?: string;
  exploreBasicAttackSfxVolume?: number;
  exploreEnemyDeathSfxUrl?: string;
  exploreEnemyDeathSfxVolume?: number;
  /** 探索模式玩家受击 */
  explorePlayerHitSfxUrl?: string;
  explorePlayerHitSfxVolume?: number;
}

/** 单关卡配乐与塔型开火覆盖（写入 map.levelAudio，同步到运行时 MapDefinition） */
export interface LevelMapAudioConfig {
  defenseBgmUrl?: string;
  defenseBgmVolume?: number;
  exploreBgmUrl?: string;
  exploreBgmVolume?: number;
  /** 本关塔开火音量系数（0–1），探索/塔防共用 */
  towerAttackSfxVolume?: number;
  towerAttackSfxByBuildId?: Partial<Record<BuildId, string>>;
}

/** 全项目 UI 背景（首页 / 选关等），写入 gameAssetConfig.globalScreenUi */
export interface GlobalScreenUiConfig {
  /** 开始游戏 / 主菜单页背景图 URL */
  startScreenBackgroundUrl?: string;
  /** 城市选关页背景图 URL */
  levelSelectBackgroundUrl?: string;
  /** 选关页兜底底色（含透明时请配合背景图） */
  levelSelectBackgroundColor?: string;
  /** 选关页强调色（标题、高亮等，可选） */
  levelSelectAccentColor?: string;
}

export interface GameAssetConfig {
  customModelUrls: Partial<Record<BuildId, string>>;
  customDropModelUrl: string;
  customPlayerModelUrl: string;
  customAnimationUrls: Partial<Record<string, string>>;
  modelScales: Partial<Record<ModelTarget, number>>;
  playerExploreTransform?: PlayerExploreTransform;
  globalAudio?: GlobalGameAudioConfig;
  globalScreenUi?: GlobalScreenUiConfig;
}

export interface SaveData {
  version: number;
  savedAt: string;
  mode: GameMode;
  money: number;
  freePulls: number;
  pityCounter: number;
  sTowerUnlocked: boolean;
  defenseMapIndex: number;
  exploreMapIndex: number;
  baseHp: number;
  wave: number;
  nextWaveDelay: number;
  spawnRemaining: number;
  spawnCooldown: number;
  waveActive: boolean;
  buildings: Array<{ id: BuildId; cell: GridCell }>;
  customModelUrls: Partial<Record<BuildId, string>>;
  customDropModelUrl: string;
  customPlayerModelUrl: string;
  customAnimationUrls: Partial<Record<string, string>>;
  modelScales: Partial<Record<ModelTarget, number>>;
}

export interface GridCell {
  col: number;
  row: number;
}

export interface MapTheme {
  ground: number;
  groundAlt: number;
  path: number;
  obstacle: number;
  accent: number;
  fog: number;
  /** 整块棋盘贴图（相对站点根路径，如 /Arts/Maps/foo.png）。设置后与济南默认图一样走「平面底板 + 路径叠层」逻辑 */
  boardTextureUrl?: string;
  /** Cesium / 地理底板模式下格子瓦片透明度，默认约 0.48 */
  geoTileOpacity?: number;
  geoPathOpacity?: number;
  /** 地理模式下深色承托管透明度 */
  boardBaseOpacity?: number;
  /** 叠在底板上的网格线透明度 */
  gridLineOpacity?: number;
  rimOpacity?: number;
  pathGlowOpacity?: number;
  pathDetailOpacity?: number;
  /** 塔防建造指针所在格半透明度 */
  hoverCellOpacity?: number;
  hoverColorOk?: number;
  hoverColorBad?: number;
}

export interface GeoMapConfig {
  enabled?: boolean;
  provider?: "cesium-ion";
  assetId?: string;
  center: {
    lat: number;
    lon: number;
    heightMeters?: number;
  };
  extentMeters?: number;
  rotationDeg?: number;
  yOffsetMeters?: number;
  boardHeightMeters?: number;
  scale?: number;
}

export interface MapActorDef {
  id: string;
  modelPath: string;
  col: number;
  row: number;
  worldOffsetMeters?: { x?: number; y?: number; z?: number };
  rotation?: number;
  scale?: number;
}

export type ExploreElement = DefenseElement;

export type ExplorePickupType = "money" | "item";

export interface ExploreRewardSpec {
  money?: number;
  xp?: number;
  itemId?: string;
  itemName?: string;
  itemType?: InventoryItem["type"];
  itemIcon?: string;
  quantity?: number;
}

export interface ExploreBossSkillSpec {
  id: string;
  name: string;
  description?: string;
  cooldownSec: number;
  range?: number;
  radius?: number;
  damage?: number;
  effect?: DefenseStatusId;
}

export interface ExploreBossDefinition {
  id: string;
  name: string;
  aiArchetype: string;
  cityTheme: string;
  element: ExploreElement;
  modelPath?: string;
  modelScale?: number;
  maxHp: number;
  attack: number;
  defense?: number;
  speed?: number;
  aggroRange?: number;
  attackCooldown?: number;
  resistances?: DefenseResistanceProfile;
  skills: ExploreBossSkillSpec[];
  rewards?: ExploreRewardSpec[];
  dialogueHint?: string;
}

export interface ExploreBossPlacement {
  id: string;
  bossId: string;
  name?: string;
  col: number;
  row: number;
  modelId?: string;
  modelPath?: string;
  modelScale?: number;
  element?: ExploreElement;
  level?: number;
  triggerRadius?: number;
  respawn?: boolean;
  overrideStats?: Partial<{
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;
    rewardMoney: number;
    rewardXp: number;
  }>;
}

export interface ExploreSpawnerPlacement {
  id: string;
  name: string;
  col: number;
  row: number;
  enemyTypeId: string;
  element?: ExploreElement;
  modelId?: string;
  modelPath?: string;
  modelScale?: number;
  maxConcurrent: number;
  spawnIntervalSec: number;
  spawnCount: number;
  triggerRadius: number;
  activeRadius: number;
  totalLimit?: number;
  disableWhenBossDefeated?: boolean;
  rewards?: ExploreRewardSpec[];
}

export interface ExplorePickupPlacement {
  id: string;
  type: ExplorePickupType;
  name: string;
  col: number;
  row: number;
  moneyAmount?: number;
  itemId?: string;
  itemName?: string;
  itemType?: InventoryItem["type"];
  itemIcon?: string;
  quantity?: number;
  modelId?: string;
  modelPath?: string;
  modelScale?: number;
  collectRadius?: number;
}

/** 编辑器棋盘配图：叠在程序性格子底板之上；路径高光与标记在它之上 */
export interface MapBoardImageLayer {
  id: string;
  src: string;
  /** 左上角起点水平位置 0–100（相对棋盘格内容区宽度）*/
  centerX: number;
  /** 左上角起点垂直位置 0–100（相对棋盘格内容区高度）*/
  centerY: number;
  /** 宽度占棋盘格内容区宽度的百分比 */
  widthPct: number;
  /** 高/宽像素比（用于边缘缩放）；缺省约为 1 */
  aspect?: number;
  opacity?: number;
  /** 同关多张图 stacking，数值越小越靠下（先绘制） */
  order?: number;
}

/** 单条过场视频（开场或波次间） */
export interface LevelCutscene {
  /** 视频公共 URL，如 /uploads/videos/intro.mp4 */
  url: string;
  /** 可选字幕标题 */
  title?: string;
  /** 编辑器专用：仓库内相对路径（如 public/Arts/...），便于在资源管理器中打开；运行时忽略 */
  projectPath?: string;
}

/** 某个波次结束后播放的过场视频 */
export interface WaveCutscene {
  /** 在第几波结束后播放（1-based） */
  afterWave: number;
  url: string;
  title?: string;
  /** 编辑器专用：见 LevelCutscene.projectPath */
  projectPath?: string;
}

/** 关卡过场视频配置（存于 EditorLevelMap，同步到 MapDefinition） */
export interface LevelCutsceneConfig {
  /** 关卡开始前播放的开场视频 */
  introVideo?: LevelCutscene;
  /** 各波次结束后播放的视频；按 afterWave 排列 */
  waveVideos?: WaveCutscene[];
}

export interface MapDefinition {
  id: string;
  name: string;
  description: string;
  cols?: number;
  rows?: number;
  theme: MapTheme;
  geo?: GeoMapConfig;
  path: GridCell[];
  obstacles: GridCell[];
  actors?: MapActorDef[];
  /** Explore-mode safe zone cells: enemies will not attack the player here */
  safeZones?: GridCell[];
  boardImageLayers?: MapBoardImageLayer[];
  /** 由 explorationLayout.gameplay 同步；探索模式运行时读取 */
  exploreGameplay?: ExploreGameplaySettings;
  /** 过场视频配置（由编辑器同步） */
  cutscenes?: LevelCutsceneConfig;
  /** 关卡配乐与按塔型覆盖的攻击音效（编辑器 map.levelAudio） */
  levelAudio?: LevelMapAudioConfig;
  /** 本关防御玩法在城市玩法库中为各塔 id 绑定的模型 URL（优先于全局 gameAssetConfig.customModelUrls） */
  towerModelUrls?: Partial<Record<BuildId, string>>;
  /** Explore RPG: placed AI bosses, configurable minion spawners and authored pickups. */
  exploreBosses?: ExploreBossPlacement[];
  exploreSpawners?: ExploreSpawnerPlacement[];
  explorePickups?: ExplorePickupPlacement[];
}

export interface EditorCell {
  col: number;
  row: number;
}

export interface EditorLevelMap {
  grid?: { cols?: number; rows?: number; tileSize?: number };
  geo?: GeoMapConfig;
  theme?: Partial<
    Record<
      | "ground"
      | "groundAlt"
      | "road"
      | "path"
      | "obstacle"
      | "accent"
      | "fog"
      | "boardTextureUrl"
      | "geoTileOpacity"
      | "geoPathOpacity"
      | "boardBaseOpacity"
      | "gridLineOpacity"
      | "rimOpacity"
      | "pathGlowOpacity"
      | "pathDetailOpacity"
      | "hoverCellOpacity"
      | "hoverColorOk"
      | "hoverColorBad",
      string | number
    >
  >;
  actors?: Array<Record<string, unknown>>;
  roads?: EditorCell[];
  enemyPaths?: Array<{ id?: string; name?: string; cells?: EditorCell[] }>;
  obstacles?: EditorCell[];
  spawnPoints?: Array<EditorCell & { id?: string; name?: string }>;
  objectivePoint?: EditorCell & { id?: string; name?: string };
  explorationPoints?: Array<EditorCell & { id?: string; name?: string }>;
  exploreBosses?: Array<Record<string, unknown>>;
  exploreSpawners?: Array<Record<string, unknown>>;
  explorePickups?: Array<Record<string, unknown>>;
  explorationLayout?: EditorExplorationLayout;
  boardImageLayers?: MapBoardImageLayer[];
  /** 过场视频配置 */
  cutscenes?: LevelCutsceneConfig;
  /** 关卡配乐与塔型攻击音效覆盖 */
  levelAudio?: LevelMapAudioConfig;
}

export interface EditorExplorationLayout {
  grid?: { cols?: number; rows?: number; tileSize?: number };
  theme?: Partial<
    Record<
      | "ground"
      | "groundAlt"
      | "road"
      | "path"
      | "obstacle"
      | "accent"
      | "fog"
      | "boardTextureUrl"
      | "geoTileOpacity"
      | "geoPathOpacity"
      | "boardBaseOpacity"
      | "gridLineOpacity"
      | "rimOpacity"
      | "pathGlowOpacity"
      | "pathDetailOpacity"
      | "hoverCellOpacity"
      | "hoverColorOk"
      | "hoverColorBad",
      string | number
    >
  >;
  path?: EditorCell[];
  obstacles?: EditorCell[];
  startPoint?: EditorCell & { id?: string; name?: string };
  exitPoint?: EditorCell & { id?: string; name?: string };
  /** Cells where explore enemies will not attack the player */
  safeZones?: EditorCell[];
  /**
   * 探索模式运行时：移动速度、技能 CD、掉落/刷怪间隔、敌人模板等；
   * 同步到运行时 `MapDefinition.exploreGameplay`（见 editor-sync）。
   */
  gameplay?: ExploreGameplaySettings;
}

/** 探索模式可调数值（地图级）；未设置时用游戏内默认 */
export interface ExploreGameplaySettings {
  /** 慢走按住时的世界空间移动速度（与动画速率无关） */
  moveSpeedWalk?: number;
  /** 奔跑时移动速度 */
  moveSpeedRun?: number;
  /** 普攻冷却（秒） */
  attackCooldownSec?: number;
  /** E 技能冷却（秒） */
  skillECooldownSec?: number;
  /** R 技能冷却（秒） */
  skillRCooldownSec?: number;
  /** 地图上批量掉落钱币的倒计时周期（秒） */
  moneyDropRespawnIntervalSec?: number;
  /** 野外敌人生成间隔（秒） */
  exploreEnemySpawnIntervalSec?: number;
  enemyMaxConcurrent?: number;
  /** 敌人生成：基础生命值与每级加成 */
  enemyBaseHp?: number;
  enemyHpPerLevel?: number;
  enemyBaseSpeed?: number;
  enemySpeedPerLevel?: number;
  enemyBaseDamage?: number;
  enemyDamagePerLevel?: number;
  enemyAggroRange?: number;
  enemyAttackCooldown?: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  type: "material" | "consumable";
  icon: string;
  collectedAt: number;
  healAmount?: number;
  cleanseStatuses?: DefenseStatusId[];
  defenseConsumableId?: string;
}

export interface ExploreEnemy {
  id: string;
  name?: string;
  mesh: THREE.Group;
  hpBar: THREE.Mesh;
  hp: number;
  maxHp: number;
  element?: DefenseElement;
  resistances?: DefenseResistanceProfile;
  boss?: boolean;
  placementId?: string;
  sourceSpawnerId?: string;
  rewardMoney?: number;
  rewardXp?: number;
  rewardItems?: ExploreRewardSpec[];
  speed: number;
  attackDamage: number;
  aggroRange: number;
  attackCooldown: number;
  attackTimer: number;
  skillTimer?: number;
  visualRadius?: number;
  dead: boolean;
}

export interface ExploreProjectile {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  damage: number;
  lifetime: number;
  type: "basic" | "orb" | "blast" | "lightning" | "spark";
  target?: ExploreEnemy | null;
  element?: DefenseElement;
}

export interface EditorLevel {
  id?: string;
  name?: string;
  description?: string;
  status?: string;
  difficulty?: number;
  location?: {
    countryCode?: string;
    countryName?: string;
    cityName?: string;
    cityCode?: string;
    regionLabel?: string;
    geo?: GeoMapConfig;
  };
  map?: EditorLevelMap;
}

export interface BuildSpec {
  id: BuildId;
  key: string;
  name: string;
  cost: number;
  category: BuildCategory;
  role?: BuildRole;
  city?: string;
  description: string;
  color: number;
  rank?: GachaRarity;
  requiresUnlock?: boolean;
  element?: DefenseElement;
  functionTags?: DefenseFunctionTag[];
  effects?: DefenseEffectSpec[];
  range?: number;
  fireRate?: number;
  damage?: number;
  splash?: number;
  slowFactor?: number;
  slowDuration?: number;
  triggerRadius?: number;
  buffRange?: number;
  buffMultiplier?: number;
  maxHp?: number;
  maxBlockCount?: number;
  healRange?: number;
  healAmount?: number;
  activeSkill?: {
    name: string;
    description: string;
    cooldown: number;
  };
}

export interface Building {
  uid: number;
  spec: BuildSpec;
  cell: GridCell;
  mesh: THREE.Group;
  cooldown: number;
  armed: boolean;
  hp: number;
  blockingEnemies: Enemy[];
  skillCooldownTimer: number;
  activeStatuses?: DefenseRuntimeStatus[];
  damageReductionUntil?: number;
  damageReductionFactor?: number;
  bonusBlockUntil?: number;
  healthBarGroup?: THREE.Group;
  healthBarFill?: THREE.Mesh;
  skillHudBillboard?: THREE.Group;
  skillHudPlane?: THREE.Mesh;
  /** 抵消 buildGroup(scale,1,scale) 对 Sprite billboard 宽高比的破坏（否则地理图中技能牌会变扁横条）。 */
  skillHudAnchor?: THREE.Group;
  skillHudText?: string;
}

export interface Enemy {
  uid: number;
  type: EnemyType;
  /** 占位球体半径（格子单位）；仅用于替换为 GLB 时的缩放；未设时按类型默认（与球体占位一致）。 */
  bodyRadius?: number;
  mesh: THREE.Group;
  healthBar: THREE.Mesh;
  hp: number;
  maxHp: number;
  element?: DefenseElement;
  resistances?: DefenseResistanceProfile;
  activeStatuses?: DefenseRuntimeStatus[];
  speed: number;
  reward: number;
  segment: number;
  slowUntil: number;
  slowFactor: number;
  blockedBy: Building | null;
  stunUntil: number;
}

export interface MoneyDrop {
  uid: number;
  amount: number;
  cell: GridCell | null;
  mesh: THREE.Group;
  autoCollect: boolean;
  collectTimer: number;
  source: GameMode;
  pickup?: ExplorePickupPlacement;
}

export interface TimedEffect {
  object: THREE.Object3D;
  ttl: number;
  maxTtl: number;
  grow: number;
  /** 每帧更新粒子位置等（先于 ttl 递减调用） */
  tick?: (dt: number) => void;
  /** 不进行按 ttl 整体淡出（用于飞向目标的炮弹本体） */
  suppressOpacityFade?: boolean;
}

/** 同一卡池内可选的「当期 UP」干员；选中后出 S 时仅给该干员。 */
export interface GachaFocusBanner {
  id: string;
  buildId: BuildId;
  name: string;
  featuredImg: string;
  /** 与 sPool 中条目一致，用于结算与展示 */
  sRollLabel: string;
}

export interface GachaPool {
  id: string;
  name: string;
  city?: string;
  featured: { name: string; id: BuildId };
  sPool: string[];
  featuredImg: string;
  description: string;
  hardPity: number;
  /** 若存在，补给界面展示子 Tab，仅按选中的 UP 产出 S。 */
  focusBanners?: GachaFocusBanner[];
}