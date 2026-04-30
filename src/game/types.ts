import type * as THREE from "three";

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

export interface GameAssetConfig {
  customModelUrls: Partial<Record<BuildId, string>>;
  customDropModelUrl: string;
  customPlayerModelUrl: string;
  customAnimationUrls: Partial<Record<string, string>>;
  modelScales: Partial<Record<ModelTarget, number>>;
  playerExploreTransform?: PlayerExploreTransform;
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
}

export interface EditorCell {
  col: number;
  row: number;
}

export interface EditorLevelMap {
  grid?: { cols?: number; rows?: number; tileSize?: number };
  geo?: GeoMapConfig;
  theme?: Partial<Record<"ground" | "groundAlt" | "road" | "path" | "obstacle" | "accent" | "fog", string | number>>;
  actors?: Array<Record<string, unknown>>;
  roads?: EditorCell[];
  enemyPaths?: Array<{ id?: string; name?: string; cells?: EditorCell[] }>;
  obstacles?: EditorCell[];
  spawnPoints?: Array<EditorCell & { id?: string; name?: string }>;
  objectivePoint?: EditorCell & { id?: string; name?: string };
  explorationPoints?: Array<EditorCell & { id?: string; name?: string }>;
  explorationLayout?: EditorExplorationLayout;
}

export interface EditorExplorationLayout {
  grid?: { cols?: number; rows?: number; tileSize?: number };
  theme?: Partial<Record<"ground" | "groundAlt" | "road" | "path" | "obstacle" | "accent" | "fog", string | number>>;
  path?: EditorCell[];
  obstacles?: EditorCell[];
  startPoint?: EditorCell & { id?: string; name?: string };
  exitPoint?: EditorCell & { id?: string; name?: string };
  /** Cells where explore enemies will not attack the player */
  safeZones?: EditorCell[];
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  type: "material" | "consumable";
  icon: string;
  collectedAt: number;
}

export interface ExploreEnemy {
  id: string;
  mesh: THREE.Group;
  hpBar: THREE.Mesh;
  hp: number;
  maxHp: number;
  speed: number;
  attackDamage: number;
  aggroRange: number;
  attackCooldown: number;
  attackTimer: number;
  dead: boolean;
}

export interface ExploreProjectile {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  damage: number;
  lifetime: number;
  type: "basic" | "orb" | "blast" | "lightning" | "spark";
  target?: ExploreEnemy | null;
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