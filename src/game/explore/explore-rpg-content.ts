import type { ExploreBossDefinition, ExploreElement } from "../core/types";

export const EXPLORE_ELEMENT_COLORS: Record<ExploreElement, number> = {
  force: 0x9b6a3f,
  thermal: 0xff5c3b,
  light: 0xffd85a,
  electric: 0x4aa8ff,
  sound: 0xb76cff,
};

export const EXPLORE_ELEMENT_LABELS: Record<ExploreElement, string> = {
  force: "力",
  thermal: "热",
  light: "光",
  electric: "电",
  sound: "声",
};

export const EXPLORE_PLAYER_ELEMENTS: readonly ExploreElement[] = ["force", "thermal", "light", "electric", "sound"] as const;

export const DEFAULT_EXPLORE_BOSSES: ExploreBossDefinition[] = [
  {
    id: "ai-atlas",
    name: "重构者 Atlas",
    aiArchetype: "infrastructure-ai",
    cityTheme: "道路、桥梁、管线和施工机械的失控自治",
    element: "force",
    maxHp: 900,
    attack: 18,
    defense: 8,
    speed: 1.35,
    aggroRange: 11,
    attackCooldown: 1.65,
    resistances: { sound: 0.85, thermal: 1.15 },
    skills: [
      { id: "foundation-quake", name: "地基震荡", cooldownSec: 6, radius: 3.8, damage: 34 },
      { id: "armor-rebuild", name: "装甲重构", cooldownSec: 11, radius: 0, damage: 0 },
      { id: "roadblock-charge", name: "路径封锁冲撞", cooldownSec: 8, range: 7, damage: 28 },
    ],
    rewards: [{ money: 240, xp: 80, itemName: "基础设施 AI 核心", itemIcon: "AI", quantity: 1 }],
    dialogueHint: "城市骨架已接管，你的路线将被重写。",
  },
  {
    id: "ai-vulcan",
    name: "熔核调度员 Vulcan",
    aiArchetype: "energy-dispatch-ai",
    cityTheme: "电网、热力站和工业炉的灾难化控制",
    element: "thermal",
    maxHp: 780,
    attack: 22,
    defense: 4,
    speed: 1.65,
    aggroRange: 12,
    attackCooldown: 1.45,
    resistances: { force: 0.85, light: 1.15 },
    skills: [
      { id: "heat-ring", name: "热浪环", cooldownSec: 5.5, radius: 4.2, damage: 30 },
      { id: "core-vent", name: "熔核泄放", cooldownSec: 9, radius: 2.8, damage: 44 },
      { id: "overburn", name: "过载自燃", cooldownSec: 12, radius: 5, damage: 24 },
    ],
    rewards: [{ money: 260, xp: 85, itemName: "熔核调度模块", itemIcon: "TH", quantity: 1 }],
    dialogueHint: "能源曲线已失控，城市温度正在成为武器。",
  },
  {
    id: "ai-prism",
    name: "棱镜审计官 Prism",
    aiArchetype: "surveillance-audit-ai",
    cityTheme: "摄像头、雷达、光学识别和算法审计",
    element: "light",
    maxHp: 720,
    attack: 24,
    defense: 3,
    speed: 1.9,
    aggroRange: 13,
    attackCooldown: 1.3,
    resistances: { thermal: 0.85, electric: 1.15 },
    skills: [
      { id: "refracted-verdict", name: "折射审判", cooldownSec: 5, range: 10, damage: 32 },
      { id: "identity-mirror", name: "镜像身份", cooldownSec: 10, radius: 3, damage: 22 },
      { id: "white-noise-glare", name: "白噪眩光", cooldownSec: 8, radius: 4.5, damage: 26 },
    ],
    rewards: [{ money: 280, xp: 90, itemName: "棱镜审计密钥", itemIcon: "PR", quantity: 1 }],
    dialogueHint: "身份校验失败，目标将被光学抹除。",
  },
  {
    id: "ai-gridmind",
    name: "雷网中枢 Gridmind",
    aiArchetype: "network-swarm-ai",
    cityTheme: "基站、信号塔、自动巡逻和云端调度",
    element: "electric",
    maxHp: 760,
    attack: 21,
    defense: 4,
    speed: 2.25,
    aggroRange: 12,
    attackCooldown: 1.2,
    resistances: { light: 0.85, sound: 1.15 },
    skills: [
      { id: "chain-overload", name: "链式过载", cooldownSec: 5, range: 9, damage: 34 },
      { id: "magnetic-trap", name: "磁场陷阱", cooldownSec: 8.5, radius: 3.4, damage: 24 },
      { id: "data-blink", name: "数据迁跃", cooldownSec: 7, range: 6, damage: 20 },
    ],
    rewards: [{ money: 270, xp: 88, itemName: "雷网中枢芯片", itemIcon: "EL", quantity: 1 }],
    dialogueHint: "所有节点已上线，城市网络开始反向追踪。",
  },
  {
    id: "ai-echo",
    name: "回声协议 Echo",
    aiArchetype: "cognition-noise-ai",
    cityTheme: "舆情、语音助手和广播系统融合后的认知污染",
    element: "sound",
    maxHp: 740,
    attack: 20,
    defense: 5,
    speed: 1.8,
    aggroRange: 12,
    attackCooldown: 1.35,
    resistances: { electric: 0.85, force: 1.15 },
    skills: [
      { id: "sonic-fan", name: "音波扇形", cooldownSec: 4.8, radius: 4, damage: 29 },
      { id: "resonance-mark", name: "共鸣标记", cooldownSec: 9, range: 8, damage: 25 },
      { id: "silent-scream", name: "沉默尖啸", cooldownSec: 11, radius: 5, damage: 38 },
    ],
    rewards: [{ money: 275, xp: 92, itemName: "回声协议残片", itemIcon: "SO", quantity: 1 }],
    dialogueHint: "请重复指令：放弃抵抗，交出城市。",
  },
];

export function getDefaultExploreBoss(id: string): ExploreBossDefinition {
  return DEFAULT_EXPLORE_BOSSES.find((boss) => boss.id === id) ?? DEFAULT_EXPLORE_BOSSES[0];
}
