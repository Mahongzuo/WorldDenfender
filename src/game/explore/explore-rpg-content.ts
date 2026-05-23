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
    maxHp: 3200,
    attack: 35,
    defense: 12,
    speed: 1.5,
    aggroRange: 13,
    attackCooldown: 1.5,
    resistances: { sound: 0.8, thermal: 1.2 },
    skills: [
      { id: "foundation-quake", name: "地基震荡", cooldownSec: 5, radius: 4.5, damage: 65 },
      { id: "armor-rebuild", name: "装甲重构", cooldownSec: 10, radius: 0, damage: 0 },
      { id: "roadblock-charge", name: "路径封锁冲撞", cooldownSec: 7, range: 8, damage: 50 },
    ],
    rewards: [{ money: 600, xp: 250, itemName: "基础设施 AI 核心", itemIcon: "AI", quantity: 1 }],
    dialogueHint: "城市骨架已接管，你的路线将被重写。",
  },
  {
    id: "ai-vulcan",
    name: "熔核调度员 Vulcan",
    aiArchetype: "energy-dispatch-ai",
    cityTheme: "电网、热力站和工业炉的灾难化控制",
    element: "thermal",
    maxHp: 2800,
    attack: 42,
    defense: 6,
    speed: 1.8,
    aggroRange: 14,
    attackCooldown: 1.3,
    resistances: { force: 0.8, light: 1.2 },
    skills: [
      { id: "heat-ring", name: "热浪环", cooldownSec: 4.5, radius: 5, damage: 55 },
      { id: "core-vent", name: "熔核泄放", cooldownSec: 8, radius: 3.5, damage: 85 },
      { id: "overburn", name: "过载自燃", cooldownSec: 11, radius: 6, damage: 45 },
    ],
    rewards: [{ money: 650, xp: 260, itemName: "熔核调度模块", itemIcon: "TH", quantity: 1 }],
    dialogueHint: "能源曲线已失控，城市温度正在成为武器。",
  },
  {
    id: "ai-prism",
    name: "棱镜审计官 Prism",
    aiArchetype: "surveillance-audit-ai",
    cityTheme: "摄像头、雷达、光学识别和算法审计",
    element: "light",
    maxHp: 2600,
    attack: 48,
    defense: 5,
    speed: 2.1,
    aggroRange: 15,
    attackCooldown: 1.15,
    resistances: { thermal: 0.8, electric: 1.2 },
    skills: [
      { id: "refracted-verdict", name: "折射审判", cooldownSec: 4, range: 12, damage: 60 },
      { id: "identity-mirror", name: "镜像身份", cooldownSec: 9, radius: 4, damage: 40 },
      { id: "white-noise-glare", name: "白噪眩光", cooldownSec: 7, radius: 5.5, damage: 50 },
    ],
    rewards: [{ money: 700, xp: 280, itemName: "棱镜审计密钥", itemIcon: "PR", quantity: 1 }],
    dialogueHint: "身份校验失败，目标将被光学抹除。",
  },
  {
    id: "ai-gridmind",
    name: "雷网中枢 Gridmind",
    aiArchetype: "network-swarm-ai",
    cityTheme: "基站、信号塔、自动巡逻和云端调度",
    element: "electric",
    maxHp: 2900,
    attack: 40,
    defense: 7,
    speed: 2.5,
    aggroRange: 14,
    attackCooldown: 1.1,
    resistances: { light: 0.8, sound: 1.2 },
    skills: [
      { id: "chain-overload", name: "链式过载", cooldownSec: 4, range: 11, damage: 65 },
      { id: "magnetic-trap", name: "磁场陷阱", cooldownSec: 7.5, radius: 4, damage: 45 },
      { id: "data-blink", name: "数据迁跃", cooldownSec: 6, range: 7, damage: 35 },
    ],
    rewards: [{ money: 680, xp: 270, itemName: "雷网中枢芯片", itemIcon: "EL", quantity: 1 }],
    dialogueHint: "所有节点已上线，城市网络开始反向追踪。",
  },
  {
    id: "ai-echo",
    name: "回声协议 Echo",
    aiArchetype: "cognition-noise-ai",
    cityTheme: "舆情、语音助手和广播系统融合后的认知污染",
    element: "sound",
    maxHp: 2700,
    attack: 38,
    defense: 8,
    speed: 2.0,
    aggroRange: 14,
    attackCooldown: 1.2,
    resistances: { electric: 0.8, force: 1.2 },
    skills: [
      { id: "sonic-fan", name: "音波扇形", cooldownSec: 4, radius: 5, damage: 55 },
      { id: "resonance-mark", name: "共鸣标记", cooldownSec: 8, range: 9, damage: 48 },
      { id: "silent-scream", name: "沉默尖啸", cooldownSec: 10, radius: 6, damage: 72 },
    ],
    rewards: [{ money: 690, xp: 280, itemName: "回声协议残片", itemIcon: "SO", quantity: 1 }],
    dialogueHint: "请重复指令：放弃抵抗，交出城市。",
  },
];

export function getDefaultExploreBoss(id: string): ExploreBossDefinition {
  return DEFAULT_EXPLORE_BOSSES.find((boss) => boss.id === id) ?? DEFAULT_EXPLORE_BOSSES[0];
}
