import { GACHA_POOLS } from "../data/content";
import {
  getAvailableGachaPools,
  getGachaPoolDisplayModel,
  performGachaDraw,
  resolveSelectedGachaPoolId,
} from "../economy/gacha";
import type { GameEconomy } from "../economy/game-economy";
import type { BuildId, GachaFocusBanner } from "../core/types";

export interface GachaPanelElements {
  panel: HTMLElement;
  poolTabsElement: HTMLElement;
  focusTabsElement: HTMLElement;
  titleElement: HTMLElement;
  descElement: HTMLElement;
  featuredNameElement: HTMLElement;
  stageImgElement: HTMLImageElement;
  pityDisplayElement: HTMLElement;
  resultElement: HTMLElement;
  stageElement: HTMLElement;
}

/** 经济与选中态由宿主通过 ports 读写，本类只操纵 DOM */
export interface GachaPanelPorts {
  getCurrentCity: () => string;
  economy: GameEconomy;
  getSelectedPool: () => string;
  setSelectedPool: (id: string) => void;
  focusPickByPool: Record<string, string | undefined>;
  getAnimating: () => boolean;
  setAnimating: (v: boolean) => void;
  setPanelOpen: (open: boolean) => void;
  getSelectedBuild: () => BuildId;
  setSelectedBuild: (id: BuildId) => void;
  refreshUi: () => void;
  toast: (m: string, c?: boolean) => void;
  scheduleReveal: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
}

export class GachaPanelPresenter {
  constructor(
    private readonly els: GachaPanelElements,
    private readonly ports: GachaPanelPorts,
  ) {}

  open(): void {
    this.ports.setPanelOpen(true);
    this.els.panel.classList.add("show");
    this.els.panel.setAttribute("aria-hidden", "false");
    this.renderPoolTabs();
    this.ports.refreshUi();
  }

  close(): void {
    if (this.ports.getAnimating()) return;
    this.ports.setPanelOpen(false);
    this.els.panel.classList.remove("show");
    this.els.panel.setAttribute("aria-hidden", "true");
  }

  private resolveFocusBanner(selectedPoolId: string): GachaFocusBanner | null {
    const pool = GACHA_POOLS.find((p) => p.id === selectedPoolId) ?? GACHA_POOLS[0];
    const banners = pool?.focusBanners;
    if (!pool || !banners?.length) return null;
    let pickId = this.ports.focusPickByPool[pool.id];
    if (!pickId || !banners.some((b) => b.id === pickId)) {
      pickId = banners[0]!.id;
      this.ports.focusPickByPool[pool.id] = pickId;
    }
    return banners.find((b) => b.id === pickId) ?? banners[0]!;
  }

  renderPoolTabs(): void {
    const availablePools = getAvailableGachaPools(GACHA_POOLS, this.ports.getCurrentCity());
    this.ports.setSelectedPool(resolveSelectedGachaPoolId(availablePools, this.ports.getSelectedPool()));

    this.els.poolTabsElement.innerHTML = "";
    availablePools.forEach((pool) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "gacha-pool-tab" + (pool.id === this.ports.getSelectedPool() ? " active" : "");
      tab.textContent = pool.name;
      tab.addEventListener("click", () => {
        this.ports.setSelectedPool(pool.id);
        this.renderPoolTabs();
        this.updatePoolDisplay();
      });
      this.els.poolTabsElement.append(tab);
    });

    this.renderFocusTabs();
    this.updatePoolDisplay();
  }

  private renderFocusTabs(): void {
    const pool = GACHA_POOLS.find((p) => p.id === this.ports.getSelectedPool()) ?? GACHA_POOLS[0];
    const banners = pool?.focusBanners;
    if (!pool || !banners?.length) {
      this.els.focusTabsElement.hidden = true;
      this.els.focusTabsElement.innerHTML = "";
      return;
    }

    let pickId = this.ports.focusPickByPool[pool.id];
    if (!pickId || !banners.some((b) => b.id === pickId)) {
      pickId = banners[0]!.id;
      this.ports.focusPickByPool[pool.id] = pickId;
    }

    this.els.focusTabsElement.hidden = false;
    this.els.focusTabsElement.innerHTML = "";
    const label = document.createElement("div");
    label.className = "gacha-focus-tabs-label";
    label.textContent = "当期补给";
    this.els.focusTabsElement.append(label);

    banners.forEach((banner) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "gacha-focus-tab" + (banner.id === pickId ? " active" : "");
      tab.textContent = banner.name;
      tab.title = `\u672c\u6b21 UP\uff1a${banner.name}\uff08\u51fa S \u65f6\u4ec5\u4e3a\u8be5\u5e72\u5458\uff09`;
      tab.addEventListener("click", () => {
        this.ports.focusPickByPool[pool.id] = banner.id;
        this.renderFocusTabs();
        this.updatePoolDisplay();
      });
      this.els.focusTabsElement.append(tab);
    });
  }

  updatePoolDisplay(): void {
    const pool = GACHA_POOLS.find((p) => p.id === this.ports.getSelectedPool()) ?? GACHA_POOLS[0];
    if (!pool) return;
    const focus = this.resolveFocusBanner(pool.id);
    const display = getGachaPoolDisplayModel(pool, this.ports.economy.pityCounter, focus);
    this.els.titleElement.textContent = display.title;
    this.els.descElement.textContent = display.description;
    this.els.featuredNameElement.textContent = display.featuredName;
    this.els.stageImgElement.src = display.featuredImg;
    this.els.pityDisplayElement.textContent = String(display.pityRemaining);
  }

  draw(requestedCount: number): void {
    if (this.ports.getAnimating()) return;

    const pool = GACHA_POOLS.find((p) => p.id === this.ports.getSelectedPool()) ?? GACHA_POOLS[0];
    if (!pool) return;
    const focus = this.resolveFocusBanner(pool.id);
    const drawResult = performGachaDraw(requestedCount, pool, this.ports.economy.getGachaState(), {
      focusedSRollLabel: focus?.sRollLabel ?? null,
    });

    if (drawResult.depleted) {
      this.els.resultElement.textContent =
        "\u5df2\u65e0\u53ef\u7528\u8865\u7ed9\u62bd\u5361\u6b21\u6570";
      this.ports.toast("\u6682\u65e0\u53ef\u7528\u8865\u7ed9\u62bd\u5361\u6b21\u6570");
      return;
    }

    this.ports.economy.applyGachaNextState(drawResult.nextState);

    this.ports.setAnimating(true);
    this.els.stageElement.classList.toggle("s-hit", drawResult.hitS);
    this.els.stageElement.classList.remove("reveal");
    this.els.stageElement.classList.add("pulling");
    this.els.resultElement.innerHTML = `<span>\u73af\u80fd\u626b\u63cf\u4e2d\u2026</span><span>${drawResult.count} \u8fde\u8865\u7ed9\u542f\u52a8</span>`;
    this.ports.refreshUi();

    this.ports.scheduleReveal(() => {
      this.els.stageElement.classList.remove("pulling");
      this.els.stageElement.classList.add("reveal");
      this.els.resultElement.innerHTML = drawResult.results
        .map((result) => `<span class="${result.startsWith("S") ? "rank-s" : ""}">${result}</span>`)
        .join("");
      if (drawResult.unlockedNow) {
        const buildId = drawResult.unlockedBuildId ?? pool.featured.id;
        this.ports.setSelectedBuild(buildId);
        this.ports.toast(
          `${pool.name}\uff1aS \u7ea7\u5e72\u5458\u5df2\u89e3\u9501\uff0c\u53ef\u5728\u5854\u9632\u5730\u56fe\u90e8\u7f72`,
        );
      }
      this.ports.setAnimating(false);
      this.ports.refreshUi();
    }, drawResult.unlockedNow ? 1400 : 900);
  }
}
