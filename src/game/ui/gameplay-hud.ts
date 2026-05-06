import { BUILD_SPECS, GACHA_POOLS } from "../data/content";
import { INITIAL_BASE_HP } from "../core/game-config";
import type { GameEconomy } from "../economy/game-economy";
import type {
  Building,
  BuildId,
  CameraMode,
  GameMode,
  MapDefinition,
} from "../core/types";

export interface GameplayHudDom {
  modeElement: HTMLElement;
  moneyElement: HTMLElement;
  cameraModeElement: HTMLElement;
  baseHpElement: HTMLElement;
  waveElement: HTMLElement;
  mapNameElement: HTMLElement;
  dropHudElement: HTMLElement;
  selectedBuildSummaryElement: HTMLElement;
  gachaPullsElement: HTMLElement;
  gachaPityElement: HTMLElement;
  gachaUnlockElement: HTMLElement;
  selectedUnitPanel: HTMLElement;
  selectedUnitName: HTMLElement;
  selectedUnitStats: HTMLElement;
  activeSkillMeta: HTMLElement;
  activeSkillButton: HTMLButtonElement;
}

export interface GameplayHudModels {
  mode: GameMode;
  cameraMode: CameraMode;
  economy: Pick<GameEconomy, "balance" | "freePulls" | "sTowerUnlocked" | "pityCounter">;
  baseHp: number;
  wave: number;
  waveActive: boolean;
  nextWaveDelay: number;
  spawnRemaining: number;
  enemiesAlive: number;
  activeMapLabel: MapDefinition["name"];
  dropTimerRemaining: number;
  selectedBuild: BuildId;
  selectedGachaPool: string;
  selectedBuilding: Building | null;
  currentCityCode: string;
  currentMapId: string;
  buildings: readonly Building[];
}

export function refreshGameplayHud(dom: GameplayHudDom, m: GameplayHudModels): void {
  dom.modeElement.textContent = m.mode === "defense" ? "\u5854\u9632\u6a21\u5f0f" : "\u81ea\u7531\u63a2\u7d22";
  dom.moneyElement.textContent = `$${Math.round(m.economy.balance)}`;
  dom.cameraModeElement.textContent =
    m.mode === "explore"
      ? "\u7b2c\u4e09\u4eba\u79f0"
      : m.cameraMode === "topdown"
        ? "\u6218\u672f\u4fef\u89c6"
        : "\u659c\u89c6\u5de1\u822a";
  dom.baseHpElement.textContent = `${m.baseHp}/${INITIAL_BASE_HP}`;
  const waveText = m.waveActive
    ? `\u7b2c ${m.wave} \u6ce2 \u00b7 \u5269\u4f59 ${m.spawnRemaining + m.enemiesAlive}`
    : `\u7b2c ${m.wave} \u6ce2 \u00b7 ${Math.ceil(m.nextWaveDelay)}s`;
  dom.waveElement.textContent =
    m.mode === "defense" ? waveText : `\u540e\u53f0 ${waveText}`;
  dom.mapNameElement.textContent = m.activeMapLabel;
  dom.dropHudElement.textContent =
    m.mode === "explore"
      ? "编辑器奖励"
      : "\u5207\u5230\u63a2\u7d22";

  const spec = BUILD_SPECS[m.selectedBuild];
  dom.selectedBuildSummaryElement.textContent = `\u5f53\u524d\uff1a${spec.name}\uff08$${spec.cost}\uff09${
    spec.requiresUnlock && !m.economy.sTowerUnlocked ? " \u00b7 \u672a\u89e3\u9501" : ""
  }`;
  dom.gachaPullsElement.textContent = String(m.economy.freePulls);
  const pityPool = GACHA_POOLS.find((p) => p.id === m.selectedGachaPool) ?? GACHA_POOLS[0];
  const hard = pityPool?.hardPity ?? 20;
  dom.gachaPityElement.textContent = String(Math.max(hard - m.economy.pityCounter, 0));
  dom.gachaUnlockElement.textContent = m.economy.sTowerUnlocked
    ? "\u5df2\u89e3\u9501"
    : "\u672a\u89e3\u9501";
  dom.gachaUnlockElement.classList.toggle("unlocked", m.economy.sTowerUnlocked);

  if (m.selectedBuilding) {
    dom.selectedUnitPanel.style.display = "flex";
    dom.selectedUnitName.textContent = m.selectedBuilding.spec.name;
    dom.selectedUnitStats.textContent = `\u751f\u547d\uff1a${Math.ceil(m.selectedBuilding.hp)}/${
      m.selectedBuilding.spec.maxHp ?? 1
    } | \u653b\u51fb\uff1a${m.selectedBuilding.spec.damage ?? 0}`;

    const active = m.mode === "defense" ? m.selectedBuilding.spec.activeSkill : undefined;
    if (active) {
      dom.selectedUnitPanel.classList.toggle("active", true);
      dom.activeSkillMeta.hidden = false;
      const cd = Math.max(0, m.selectedBuilding.skillCooldownTimer);
      const cooldownSec = Math.ceil(cd);
      dom.activeSkillButton.style.display = "block";
      dom.activeSkillMeta.textContent =
        cooldownSec > 0
          ? `\u6280\u80fd\uff1a${active.name}\uff0c\u5feb\u6377\u952e F\uff1b\u51b7\u5374 ${cooldownSec}s\uff08\u603b CD ${Math.round(active.cooldown)}s\uff09`
          : `\u6280\u80fd\uff1a${active.name}\uff0c\u5feb\u6377\u952e F\u6216\u70b9\u4e0b\u65b9\u6309\u94ae\u91ca\u653e`;

      if (cooldownSec > 0) {
        dom.activeSkillButton.textContent = `${active.name} \xb7 CD ${cooldownSec}s`;
        dom.activeSkillButton.disabled = true;
        dom.activeSkillButton.setAttribute(
          "title",
          `${active.description}\uff08\u5269\u4f59 ${cooldownSec}s\uff09`,
        );
      } else {
        dom.activeSkillButton.textContent = `\u91ca\u653e ${active.name}`;
        dom.activeSkillButton.disabled = false;
        dom.activeSkillButton.setAttribute(
          "title",
          `${active.description}\uff08\u6280\u80fd CD ${Math.round(active.cooldown)}s\uff09`,
        );
      }
    } else {
      dom.selectedUnitPanel.classList.toggle("active", false);
      dom.activeSkillMeta.hidden = true;
      dom.activeSkillButton.style.display = "none";
    }
  } else {
    dom.selectedUnitPanel.style.display = "none";
    dom.selectedUnitPanel.classList.toggle("active", false);
    dom.activeSkillMeta.hidden = true;
    dom.activeSkillButton.style.display = "none";
  }

  document.querySelectorAll<HTMLButtonElement>(".build-button").forEach((button) => {
    const buildId = button.dataset.build as BuildId;
    const buildSpec = BUILD_SPECS[buildId];
    const locked = !!buildSpec.requiresUnlock && !m.economy.sTowerUnlocked;
    const deployedUnique =
      buildSpec.rank === "S" && [...m.buildings].some((building) => building.spec.id === buildId);
    button.classList.toggle("active", button.dataset.build === m.selectedBuild);
    button.classList.toggle("locked", locked || deployedUnique);
    button.disabled = locked || deployedUnique;
    button.title = deployedUnique
      ? "\u6bcf\u5f20 S \u5361\u5728\u5355\u5f20\u5730\u56fe\u4e2d\u53ea\u80fd\u90e8\u7f72 1 \u6b21"
      : "";

    if (buildSpec.city) {
      const isCurrentCity = m.currentCityCode === buildSpec.city || m.currentMapId.startsWith(buildSpec.city);
      if (button.parentElement) {
        button.parentElement.style.display = isCurrentCity ? "flex" : "none";
      }
    } else if (button.parentElement) {
      button.parentElement.style.display = "flex";
    }
  });
}

export function refreshMapButtonsActiveState(activeIndex: number): void {
  document.querySelectorAll<HTMLElement>(".map-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.map === String(activeIndex));
  });
}

export function refreshBuildCardModelFlags(customModels: Partial<Record<BuildId, unknown>>): void {
  document.querySelectorAll<HTMLElement>(".build-card").forEach((card) => {
    const buildId = card.dataset.build as BuildId;
    card.classList.toggle("has-model", !!customModels[buildId]);
  });
}
