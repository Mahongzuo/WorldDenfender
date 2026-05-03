/** 组装塔防每帧 tick：摄像机、刷怪、敌兵、炮台、地雷 */

export interface DefenseSessionDeps {
  isDefenseMode(): boolean;
  moveDefenseCamera(dt: number): void;
  updateSpawner(dt: number): void;
  updateEnemies(dt: number): void;
  updateTowers(dt: number): void;
  updateMines(): void;
}

export class DefenseSession {
  constructor(private readonly deps: DefenseSessionDeps) {}

  tick(dt: number): void {
    if (this.deps.isDefenseMode()) {
      this.deps.moveDefenseCamera(dt);
    }
    this.deps.updateSpawner(dt);
    this.deps.updateEnemies(dt);
    this.deps.updateTowers(dt);
    this.deps.updateMines();
  }
}
