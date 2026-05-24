export const SAVE_KEY = "earthguard-td-save-v1";
export function createSaveData(snapshot) {
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
export function readSaveData() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
        return null;
    }
    return JSON.parse(raw);
}
export function writeSaveData(data) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}
export function getSaveSummaryText() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
        return "暂无存档";
    }
    try {
        const data = JSON.parse(raw);
        return `存档：第 ${data.wave ?? 1} 波 · $${data.money ?? 0} · ${new Date(data.savedAt).toLocaleString()}`;
    }
    catch {
        return "存档损坏";
    }
}
