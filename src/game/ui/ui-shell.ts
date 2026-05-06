export interface GameUiShellRefs {
  gameRootEl: HTMLElement;
  sceneHost: HTMLElement;
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
    safeZoneShopPanel: requiredElement("#safeZoneShopPanel"),
  };
}