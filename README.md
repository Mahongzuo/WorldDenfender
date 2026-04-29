# 地球守卫者：AI 入侵

> ⚠️ **项目目前处于早期开发阶段，存在较多 Bug，功能尚不完善。后续将有大量玩法内容、系统和关卡陆续更新，敬请期待！**

---

## 简介

**地球守卫者：AI 入侵** 是一款基于浏览器的 3D 塔防 + 探索类游戏，使用 [Three.js](https://threejs.org/) 渲染引擎构建。玩家需要在真实地理场景中部署防御塔、抵御 AI 入侵浪潮，并在城市中自由探索收集资源。

游戏以真实世界城市为关卡背景，通过 [Cesium Ion](https://cesium.com/platform/cesium-ion/) 加载 3D 瓦片地图，让每一场战斗都发生在你熟悉的城市上空。

---

## 主要特性

### 🗼 塔防模式
- 多种防御建筑：机枪塔、加农炮、冰霜塔、感应地雷、能量信标等
- 敌人波次系统，难度随关卡递进
- 棋盘格式地图，支持自定义路径、障碍、建造位

### 🧭 探索模式
- 第三人称自由探索城市场景
- 击杀掉落金币与资源，积累战斗储备

### 🎰 抽卡系统（干员补给）
- 含保底机制的抽卡池
- 特定城市限定 UP 池
- 解锁 S 级建筑奖励

### 🌍 真实城市关卡
支持关卡包括（持续扩展中）：
- 🇨🇳 北京 · 上海 · 广州 · 深圳 · 济南
- 🇫🇷 巴黎

### 🗺️ 关卡编辑器
- 内置可视化关卡编辑器（`/Web/map/level-editor.html`）
- 支持编辑棋盘格尺寸、路径、障碍、Geo 地图配置（含棋盘高度）
- 保存后游戏端实时同步

---

## 技术栈

| 技术 | 用途 |
|------|------|
| [Three.js](https://threejs.org/) | 3D 渲染引擎 |
| [3d-tiles-renderer](https://github.com/NASA-AMMOS/3DTilesRendererJS) | Cesium 3D 瓦片加载 |
| [Vite](https://vitejs.dev/) | 构建工具与开发服务器 |
| TypeScript | 主要开发语言 |

---

## 快速开始

### 环境要求

- Node.js 18+
- npm 9+

### 安装与运行

```bash
# 克隆仓库
git clone git@github.com:Mahongzuo/WorldDenfender.git
cd WorldDenfender

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的 Cesium Ion Token：
# VITE_CESIUM_ION_TOKEN=your_token_here

# 启动开发服务器
npm run dev
```

启动后访问 `http://localhost:5173`。

### 获取 Cesium Ion Token

1. 前往 [https://cesium.com/ion/](https://cesium.com/ion/) 注册免费账号
2. 在 **Access Tokens** 页面创建或复制默认 Token
3. 填入 `.env` 文件中的 `VITE_CESIUM_ION_TOKEN`

> ⚠️ 请勿将 `.env` 文件提交到 Git，Token 已通过 `.gitignore` 自动排除。

### 构建生产包

```bash
npm run build
```

---

## 项目结构

```
EarthGuardian/
├── src/
│   ├── main.ts                  # 应用入口 / 游戏流程编排
│   └── game/
│       ├── types.ts             # 共享类型契约
│       ├── content.ts           # 静态游戏数据（建筑、抽卡池等）
│       ├── maps.ts              # 内置地图定义
│       ├── tower-defense-game.ts# 游戏主逻辑
│       ├── editor-sync.ts       # 编辑器关卡同步到运行时
│       ├── geo-levels.ts        # 地理信息关卡水合
│       ├── gacha.ts             # 抽卡系统
│       ├── save-system.ts       # 存档序列化
│       └── ...
├── public/
│   ├── Arts/                    # 卡牌、地标、地图贴图
│   └── GameModels/              # 3D 模型资产
├── Web/
│   ├── map/
│   │   └── level-editor.html    # 关卡编辑器
│   └── data/
│       └── level-editor-state.json  # 编辑器保存的关卡数据
├── .env.example                 # 环境变量模板
└── vite.config.mjs              # Vite 配置 + 开发 API 中间件
```

---

## 路线图

- [ ] 更多城市关卡（全国 / 全球扩展）
- [ ] 完整剧情与过场动画
- [ ] 更多建筑与敌人类型
- [ ] 联机 / 排行榜系统
- [ ] 移动端适配
- [ ] 音效与背景音乐

---

## 许可

本项目为私有项目，代码仅供学习参考，未经授权请勿商用。
