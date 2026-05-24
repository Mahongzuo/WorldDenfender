/** 与 public/GameModels/Enemy 下的两个默认 GLB 对应：basic / scout */
const DEFAULT_ENEMY_GLB = {
    basic: "/GameModels/Enemy/monsterA.glb",
    scout: "/GameModels/Enemy/monsterB.glb",
};
export function getDefaultEnemyGlbUrl(type) {
    return DEFAULT_ENEMY_GLB[type];
}
/** 与 defense-runtime 球体半径规则一致，用于把 GLB 缩放到与原先占位球相近的占地。 */
export function getDefaultEnemyBodyRadius(type) {
    let scale = 1;
    switch (type) {
        case "scout":
            scale = 0.8;
            break;
        case "tank":
            scale = 1.3;
            break;
        case "swarm":
            scale = 1.1;
            break;
        default:
            break;
    }
    return 0.9 * scale;
}
export function getEnemyTargetBodyDiameter(enemy) {
    const r = enemy.bodyRadius ?? getDefaultEnemyBodyRadius(enemy.type);
    return r * 2;
}
/**
 * 关卡/城市配置里的 modelScale 作为 auto-fit 后的微调倍率（0.05–8）。
 * 旧编辑器数据有时用极小值（如 0.01）手动缩小超大 GLB；在已有 auto-fit 后
 * 再乘这些值会把正常尺寸的模型缩到不可见。
 */
export function resolveEnemyModelUserScale(enemy) {
    const raw = enemy.modelScale ?? 1;
    if (!Number.isFinite(raw) || raw <= 0) {
        return 1;
    }
    const customPath = enemy.modelPath?.trim();
    const defaultPath = getDefaultEnemyGlbUrl(enemy.type);
    const hasCustomModel = !!customPath && customPath !== defaultPath;
    if (hasCustomModel && raw < 0.05) {
        return 1;
    }
    return Math.min(8, Math.max(0.05, raw));
}
