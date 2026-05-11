export interface GameUiShellRefs {
  gameRootEl: HTMLElement;
  sceneHost: HTMLElement;
  gameGeoMappingToggle: HTMLInputElement;
  topGeoMappingToggle: HTMLInputElement;
  toastElement: HTMLElement;
  sideToastElement: HTMLElement;
  modeElement: HTMLElement;
  moneyElement: HTMLElement;
  baseElement: HTMLElement;
  waveElement: HTMLElement;
  mapElement: HTMLElement;
  dropElement: HTMLElement;
  selectedElement: HTMLElement;
  cameraElement: HTMLElement;
  mapButtonsElement: HTMLElement;
  selectedUnitPanel: HTMLElement;
  selectedUnitName: HTMLElement;
  selectedUnitStats: HTMLElement;
  activeSkillMeta: HTMLElement;
  activeSkillButton: HTMLButtonElement;
  gachaPanel: HTMLElement;
  homeOverlay: HTMLElement;
  saveSummaryElement: HTMLElement;
  gachaPullsElement: HTMLElement;
  gachaPityElement: HTMLElement;
  gachaUnlockElement: HTMLElement;
  gachaResultElement: HTMLElement;
  gachaStageElement: HTMLElement;
  gachaTitleElement: HTMLElement;
  gachaDescElement: HTMLElement;
  gachaFeaturedNameElement: HTMLElement;
  gachaStageImgElement: HTMLImageElement;
  gachaPoolTabsElement: HTMLElement;
  gachaFocusTabsElement: HTMLElement;
  pausePanel: HTMLElement;
  toolbar: HTMLElement;
  defenseDifficultyHome: HTMLInputElement;
  defenseDifficultyHomeHint: HTMLElement;
  defenseDifficultyPause: HTMLInputElement;
  defenseDifficultyPauseHint: HTMLElement;
  exploreHud: HTMLElement;
  exploreLevelBadge: HTMLElement;
  exploreXpBar: HTMLElement;
  exploreHpBar: HTMLElement;
  exploreHpText: HTMLElement;
  exploreSkillAttackCd: HTMLElement;
  exploreSkillECd: HTMLElement;
  exploreSkillRCd: HTMLElement;
  inventoryPanel: HTMLElement;
  inventoryGrid: HTMLElement;
  gameOverPanel: HTMLElement;
  defenseVictoryPromptPanel: HTMLElement;
  gameVictoryPanel: HTMLElement;
  gameVictoryTitle: HTMLElement;
  gameVictoryReason: HTMLElement;
  safeZoneShopPanel: HTMLElement;
}

type RequiredElement = <T extends HTMLElement = HTMLElement>(selector: string) => T;

export function renderGameUiShell(app: HTMLElement, requiredElement: RequiredElement): GameUiShellRefs {
  app.innerHTML = `
      <div class="game-root">
        <div class="scene-host"></div>
        <div class="anime-vignette"></div>
        <section class="home-overlay show" id="homeOverlay">
          <div class="home-card">
            <span class="section-kicker">地球守卫 · AI入侵</span>
            <h1>地球守卫</h1>
            <p id="cityLabel" style="font-size:18px;letter-spacing:3px;color:var(--accent-highlight,#ff6b9d);margin-bottom:8px;"></p>
            <p>AI入侵各大城市！塔防模式与第三人称探索模式，守护人类最后的城市防线。</p>
            <div class="home-geo-mapping-panel" role="group" aria-label="地图与地理底板">
              <div class="home-geo-mapping-panel__text">
                <strong class="home-geo-mapping-panel__title">地理信息映射（Cesium 实景底板）</strong>
                <p class="home-geo-mapping-panel__desc">默认关闭，使用本地棋盘；开启后将按关卡坐标请求真实三维地图（需配置 token，占用流量与 GPU）。</p>
              </div>
              <label class="home-geo-mapping-panel__switch" title="与关卡编辑器中「开启地理信息映射」同类选项，仅作用于本游戏运行时">
                <input type="checkbox" id="gameGeoMappingToggle" />
                <span class="home-geo-mapping-panel__track" aria-hidden="true"><span class="home-geo-mapping-panel__thumb"></span></span>
                <span class="home-geo-mapping-panel__state" id="gameGeoMappingState" data-state-on="已开启" data-state-off="已关闭">已关闭</span>
              </label>
            </div>
            <div class="home-geo-mapping-panel home-geo-mapping-panel--tower-difficulty" role="group" aria-label="塔防运行时难度">
              <div class="home-geo-mapping-panel__text">
                <strong class="home-geo-mapping-panel__title">塔防难度（1最易 · 5最难）</strong>
                <p class="home-geo-mapping-panel__desc">与全关卡通用的敌军强度档位。首页所选为<strong>新开一局</strong>的起点；开战后在<strong>暂停</strong>里也能改，不重载棋盘。已从场上出现的敌人<strong>不重算血量</strong>，仅从随后刷怪与下一波总人数起套用新档位。</p>
              </div>
              <div class="home-geo-mapping-panel__tower-diff-slot">
                <input type="range" id="defenseDifficultyHome" min="1" max="5" step="1" value="3" aria-valuemin="1" aria-valuemax="5" aria-valuenow="3" />
                <span id="defenseDifficultyHomeHint" class="home-geo-mapping-panel__tower-diff-hint"></span>
              </div>
            </div>
            <div class="home-actions">
              <button class="premium" id="newGameButton">新游戏</button>
              <button id="loadGameButton">读取存档</button>
              <button id="saveGameHomeButton">保存存档</button>
            </div>
            <div class="home-actions" style="margin-top:8px;">
              <button id="backToSelectionButton">返回选关</button>
            </div>
            <div class="save-summary" id="saveSummary">暂无存档</div>
            <div class="home-theme-slot">
              <button type="button" class="theme-chip theme-chip--block" id="uiThemeToggleHome">深色模式</button>
            </div>
          </div>
        </section>
        <section class="panel top-panel">
          <div class="stat"><span>模式 / TAB</span><strong id="modeValue" class="mode-badge">塔防模式</strong></div>
          <div class="stat"><span>金钱</span><strong id="moneyValue">$0</strong></div>
          <div class="stat"><span>镜头 / Z</span><strong id="cameraValue">战术俯视</strong></div>
          <div class="stat"><span>基地生命</span><strong id="baseValue">0</strong></div>
          <div class="stat"><span>波次</span><strong id="waveValue">1</strong></div>
          <div class="stat"><span>地图</span><strong id="mapValue">-</strong></div>
          <div class="stat"><span>探索掉落</span><strong id="dropValue">切到探索</strong></div>
          <div class="top-panel-spacer" aria-hidden="true"></div>
          <label class="top-panel-geo-pill" title="开启后加载 Cesium 实景底板（需 token）；关闭为本地棋盘">
            <span class="top-panel-geo-pill__label">地理映射</span>
            <span class="top-panel-geo-pill__switch">
              <input type="checkbox" id="topGeoMappingToggle" />
              <span class="top-panel-geo-pill__track" aria-hidden="true"><span class="top-panel-geo-pill__thumb"></span></span>
            </span>
          </label>
          <button type="button" class="theme-chip" id="levelEditorButton">编辑关卡</button>
          <button type="button" class="theme-chip" id="uiThemeToggleTop">深色模式</button>
        </section>
        <nav class="phone-dock">
          <button class="dock-button" id="homeButton">首页<br />菜单</button>
          <button class="dock-button" id="pauseButton">暂停<br />ESC</button>
          <button class="dock-button" id="modeToggleButton">TAB<br />模式</button>
          <button class="dock-button premium" id="gachaOpenButton">抽卡<br />补给</button>
          <button class="dock-button" id="cameraToggleButton">Z<br />镜头</button>
          <button class="dock-button" id="saveGameButton">保存<br />存档</button>
        </nav>
        <aside class="panel right-panel" id="rightTerminalPanel">
          <header class="right-panel-header">
            <span class="section-kicker">地球守卫终端</span>
            <button type="button" class="right-panel-hide-btn" id="rightTerminalHideBtn" aria-expanded="true" title="收起面板，建造栏与掉落提示将延伸至右侧">隐藏</button>
          </header>
          <h1>AI入侵作战终端</h1>
          <p>塔防模式：左键建造，右键点按拆除；按 Q/W/E/R/T/Y 选塔。WASD 移动镜头，Z 切换视角，右键拖拽或 J/L 旋转。</p>
          <p>自由探索：默认奔跑；Ctrl 在慢走与奔跑之间切换。探索奖励、AI Boss 与刷怪点由「关卡编辑器」放置；1-5 切换力/热/光/电/声属性形态。</p>
          <p id="selectedValue">当前：机枪塔</p>
          <section class="stellar-skill-panel" id="selectedUnitPanel" style="display:none;">
            <span class="section-kicker">已选中干员</span>
            <h3 id="selectedUnitName" style="margin:4px 0;">单位名称</h3>
            <p id="selectedUnitStats" style="font-size:13px; color:#a3a3a3; margin-bottom:8px;">HP: 100/100 | ATK: 50</p>
            <p id="activeSkillMeta" class="active-skill-meta" hidden>快捷键 · 冷却</p>
            <button id="activeSkillButton" class="premium active-skill-cast-btn" style="display:none; width:100%;">释放技能</button>
          </section>
          <div class="map-grid" id="mapButtons"></div>
        </aside>
        <button type="button" class="terminal-help-tab" id="rightTerminalShowBtn" aria-controls="rightTerminalPanel" aria-expanded="false" aria-hidden="true" tabindex="-1" title="打开作战终端与操作说明">帮助</button>
        <nav class="panel toolbar" id="buildToolbar"></nav>
        <section class="gacha-overlay" id="gachaPanel" aria-hidden="true">
          <div class="gacha-card">
            <button class="close-button" id="gachaCloseButton">×</button>
            <span class="section-kicker">限时补给</span>
            <h2 id="gachaTitle">特派干员补给</h2>
            <p id="gachaDesc">通过在探索模式中收取地标资源获得【特派补给卡】。消耗补给卡可召唤S级干员及防御塔。</p>
            <div class="gacha-pool-tabs" id="gachaPoolTabs"></div>
            <div class="gacha-focus-tabs" id="gachaFocusTabs" hidden></div>
            <div class="gacha-feature">
              <div class="s-rank-badge">S</div>
              <div>
                <strong id="gachaFeaturedName">星辉棱镜</strong>
                <span id="gachaUnlockValue">未解锁</span>
              </div>
            </div>
            <div class="gacha-stage" id="gachaStage">
              <div class="gacha-ring"></div>
              <img id="gachaStageImg" src="" alt="S级角色展示" />
              <div class="gacha-flash">S RANK</div>
            </div>
            <div class="gacha-stats">
              <span>剩余抽卡 <strong id="gachaPullsValue">100</strong></span>
              <span>距离保底 <strong id="gachaPityValue">20</strong></span>
            </div>
            <div class="gacha-actions">
              <button id="pullOneButton">抽 1 次</button>
              <button class="premium" id="pullTenButton">抽 10 次</button>
            </div>
            <div class="gacha-result" id="gachaResult">点击抽卡，有机会解锁 S 级干员。</div>
          </div>
        </section>
        <section class="pause-overlay" id="pausePanel">
          <div class="pause-card">
            <h2>游戏暂停</h2>
            <div class="home-geo-mapping-panel home-geo-mapping-panel--tower-difficulty" role="group" aria-label="塔防运行时难度">
              <div class="home-geo-mapping-panel__text">
                <strong class="home-geo-mapping-panel__title">塔防难度</strong>
                <p class="home-geo-mapping-panel__desc">不重载棋盘与存档格子。<strong>已出场敌人不重算血量</strong>；从<strong>下一次刷怪</strong>及<strong>后续未开始的波</strong>起按当前档位缩放。</p>
              </div>
              <div class="home-geo-mapping-panel__tower-diff-slot">
                <input type="range" id="defenseDifficultyPause" min="1" max="5" step="1" value="3" aria-valuemin="1" aria-valuemax="5" aria-valuenow="3" />
                <span id="defenseDifficultyPauseHint" class="home-geo-mapping-panel__tower-diff-hint"></span>
              </div>
            </div>
            <div class="pause-actions">
              <button class="primary" id="resumeButton">继续游戏</button>
              <button id="pauseSaveButton">保存进度</button>
              <button id="pauseHomeButton">回到首页</button>
              <button type="button" class="pause-theme-btn" id="uiThemeTogglePause">深色模式</button>
            </div>
          </div>
        </section>
        <div class="toast-center" id="toastCenter"></div>
        <div class="toast-side-stack" id="toastSide" aria-live="polite"></div>
        <section class="explore-hud" id="exploreHud" aria-hidden="true">
          <div class="explore-hud-level">
            <div class="explore-level-badge" id="exploreLevelBadge">1</div>
            <div class="explore-xp-bar-wrap">
              <div class="explore-xp-bar" id="exploreXpBar" style="width:0%"></div>
            </div>
          </div>
          <div class="explore-hud-hp">
            <span class="explore-hp-label">HP</span>
            <div class="explore-hp-bar-wrap">
              <div class="explore-hp-bar" id="exploreHpBar" style="width:100%"></div>
              <span class="explore-hp-text" id="exploreHpText">100 / 100</span>
            </div>
          </div>
          <div class="explore-hud-skills">
            <div class="explore-skill" title="基础攻击 · 左键">
              <span class="explore-skill-icon">⚡</span>
              <span class="explore-skill-key">LMB</span>
              <div class="explore-skill-cd" id="exploreSkillAttackCd" style="height:0%"></div>
            </div>
            <div class="explore-skill" title="法球技能 · E">
              <span class="explore-skill-icon">🌀</span>
              <span class="explore-skill-key">E</span>
              <div class="explore-skill-cd" id="exploreSkillECd" style="height:0%"></div>
            </div>
            <div class="explore-skill" title="冲击爆发 · R">
              <span class="explore-skill-icon">💥</span>
              <span class="explore-skill-key">R</span>
              <div class="explore-skill-cd" id="exploreSkillRCd" style="height:0%"></div>
            </div>
          </div>
        </section>
        <section class="inventory-panel" id="inventoryPanel" aria-hidden="true">
          <div class="inventory-card">
            <div class="inventory-header">
              <h2>背包</h2>
              <button class="close-button" id="inventoryCloseBtn" aria-label="关闭背包">×</button>
            </div>
            <div class="inventory-grid" id="inventoryGrid"></div>
            <p class="inventory-hint">按 I 关闭背包，点击治疗或塔防净化道具可使用</p>
          </div>
        </section>
        <section class="game-over-overlay" id="gameOverPanel" aria-hidden="true">
          <div class="game-over-vignette"></div>
          <div class="game-over-card">
            <h2 class="game-over-title">失败了</h2>
            <p class="game-over-reason" id="gameOverReason">基地已被摧毁</p>
            <div class="game-over-actions">
              <button class="premium" id="gameOverRestartBtn">重新开始</button>
              <button id="gameOverMapBtn">换一个关卡</button>
            </div>
          </div>
        </section>
        <section class="game-over-overlay" id="defenseVictoryPromptPanel" aria-hidden="true">
          <div class="game-over-vignette"></div>
          <div class="game-over-card">
            <h2 class="game-over-title">防线守住了</h2>
            <p>你已经完成标准 20 波塔防攻势。可以选择<strong>无尽模式</strong>继续挑战不断增强的敌军，或先<strong>确认塔防目标</strong>，再去击败本图全部 Boss。</p>
            <div class="game-over-actions" style="flex-wrap: wrap; gap: 10px; justify-content: center;">
              <button class="premium" type="button" id="defenseEndlessConfirmBtn">开启无尽模式</button>
              <button type="button" id="defenseStandardCompleteBtn">确认塔防目标</button>
            </div>
          </div>
        </section>
        <section class="game-over-overlay game-victory-overlay" id="gameVictoryPanel" aria-hidden="true">
          <div class="game-over-vignette"></div>
          <div class="game-over-card">
            <h2 class="game-over-title" id="gameVictoryTitle">胜利</h2>
            <p class="game-over-reason" id="gameVictoryReason"></p>
            <div class="game-over-actions">
              <button class="premium" type="button" id="gameVictoryRestartBtn">重新开始</button>
              <button type="button" id="gameVictoryMapBtn">换一个关卡</button>
            </div>
          </div>
        </section>
        <section class="safe-zone-shop" id="safeZoneShopPanel" aria-hidden="true">
          <div class="shop-card">
            <div class="shop-header">
              <h3>补给站</h3>
              <button class="close-button" id="shopCloseBtn">×</button>
            </div>
            <p class="shop-hint">按 B 开关商店 · 塔防可直接打开，探索需进入安全区</p>
            <div class="shop-items" id="shopItems"></div>
          </div>
        </section>
      </div>
    `;

  return {
    gameRootEl: requiredElement(".game-root"),
    sceneHost: requiredElement(".scene-host"),
    gameGeoMappingToggle: requiredElement<HTMLInputElement>("#gameGeoMappingToggle"),
    topGeoMappingToggle: requiredElement<HTMLInputElement>("#topGeoMappingToggle"),
    toastElement: requiredElement("#toastCenter"),
    sideToastElement: requiredElement("#toastSide"),
    modeElement: requiredElement("#modeValue"),
    moneyElement: requiredElement("#moneyValue"),
    baseElement: requiredElement("#baseValue"),
    waveElement: requiredElement("#waveValue"),
    mapElement: requiredElement("#mapValue"),
    dropElement: requiredElement("#dropValue"),
    selectedElement: requiredElement("#selectedValue"),
    cameraElement: requiredElement("#cameraValue"),
    mapButtonsElement: requiredElement("#mapButtons"),
    selectedUnitPanel: requiredElement("#selectedUnitPanel"),
    selectedUnitName: requiredElement("#selectedUnitName"),
    selectedUnitStats: requiredElement("#selectedUnitStats"),
    activeSkillMeta: requiredElement("#activeSkillMeta"),
    activeSkillButton: requiredElement<HTMLButtonElement>("#activeSkillButton"),
    gachaPanel: requiredElement("#gachaPanel"),
    homeOverlay: requiredElement("#homeOverlay"),
    saveSummaryElement: requiredElement("#saveSummary"),
    gachaPullsElement: requiredElement("#gachaPullsValue"),
    gachaPityElement: requiredElement("#gachaPityValue"),
    gachaUnlockElement: requiredElement("#gachaUnlockValue"),
    gachaResultElement: requiredElement("#gachaResult"),
    gachaStageElement: requiredElement("#gachaStage"),
    gachaTitleElement: requiredElement("#gachaTitle"),
    gachaDescElement: requiredElement("#gachaDesc"),
    gachaFeaturedNameElement: requiredElement("#gachaFeaturedName"),
    gachaStageImgElement: requiredElement<HTMLImageElement>("#gachaStageImg"),
    gachaPoolTabsElement: requiredElement("#gachaPoolTabs"),
    gachaFocusTabsElement: requiredElement("#gachaFocusTabs"),
    pausePanel: requiredElement("#pausePanel"),
    toolbar: requiredElement("#buildToolbar"),
    defenseDifficultyHome: requiredElement<HTMLInputElement>("#defenseDifficultyHome"),
    defenseDifficultyHomeHint: requiredElement("#defenseDifficultyHomeHint"),
    defenseDifficultyPause: requiredElement<HTMLInputElement>("#defenseDifficultyPause"),
    defenseDifficultyPauseHint: requiredElement("#defenseDifficultyPauseHint"),
    exploreHud: requiredElement("#exploreHud"),
    exploreLevelBadge: requiredElement("#exploreLevelBadge"),
    exploreXpBar: requiredElement("#exploreXpBar"),
    exploreHpBar: requiredElement("#exploreHpBar"),
    exploreHpText: requiredElement("#exploreHpText"),
    exploreSkillAttackCd: requiredElement("#exploreSkillAttackCd"),
    exploreSkillECd: requiredElement("#exploreSkillECd"),
    exploreSkillRCd: requiredElement("#exploreSkillRCd"),
    inventoryPanel: requiredElement("#inventoryPanel"),
    inventoryGrid: requiredElement("#inventoryGrid"),
    gameOverPanel: requiredElement("#gameOverPanel"),
    defenseVictoryPromptPanel: requiredElement("#defenseVictoryPromptPanel"),
    gameVictoryPanel: requiredElement("#gameVictoryPanel"),
    gameVictoryTitle: requiredElement("#gameVictoryTitle"),
    gameVictoryReason: requiredElement("#gameVictoryReason"),
    safeZoneShopPanel: requiredElement("#safeZoneShopPanel"),
  };
}
