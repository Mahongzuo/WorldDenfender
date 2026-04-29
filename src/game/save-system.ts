import type { SaveData } from "./types";

export const SAVE_KEY = "earthguard-td-save-v1";

export type SaveGameSnapshot = Omit<SaveData, "version" | "savedAt">;

export function createSaveData(snapshot: SaveGameSnapshot): SaveData {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    ...snapshot,
    buildings: snapshot.buildings.map((building) => ({
      id: building.id,
      cell: { ...building.cell },
    })),
    customModelUrls: { ...snapshot.customModelUrls },
    customAnimationUrls: { ...snapshot.customAnimationUrls },
    modelScales: { ...snapshot.modelScales },
  };
}

export function readSaveData(): SaveData | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as SaveData;
}

export function writeSaveData(data: SaveData): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function getSaveSummaryText(): string {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    return "暂无存档";
  }

  try {
    const data = JSON.parse(raw) as SaveData;
    return `存档：第 ${data.wave ?? 1} 波 · $${data.money ?? 0} · ${new Date(data.savedAt).toLocaleString()}`;
  } catch {
    return "存档损坏";
  }
}