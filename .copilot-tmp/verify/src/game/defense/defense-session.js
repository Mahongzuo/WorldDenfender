/** 组装塔防每帧 tick：摄像机、刷怪、敌兵、炮台、地雷 */
export class DefenseSession {
    constructor(deps) {
        Object.defineProperty(this, "deps", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: deps
        });
    }
    tick(dt) {
        if (this.deps.isDefenseMode()) {
            this.deps.moveDefenseCamera(dt);
        }
        this.deps.updateSpawner(dt);
        this.deps.updateEnemies(dt);
        this.deps.updateTowers(dt);
        this.deps.updateMines();
    }
}
