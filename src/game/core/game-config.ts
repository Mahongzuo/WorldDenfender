import { TILE_SIZE } from "./runtime-grid";

export const INITIAL_MONEY = 360;
export const INITIAL_BASE_HP = 20;

/** 塔防「标准通关」所需完成的波次数；清完该波后出现无尽模式选项（全关卡一致） */
export const DEFENSE_STANDARD_WAVE_COUNT = 20;

/** 未读档或未选择时采用的塔防运行时难度档位 */
export const DEFENSE_DIFFICULTY_DEFAULT = 3 as const;

export const DEFAULT_PLAYER_MODEL_URLS = [
  "/Soldier.glb",
  "/models/gltf/Soldier.glb",
  "/RobotExpressive.glb",
  "/models/gltf/RobotExpressive/RobotExpressive.glb",
  "https://threejs.org/examples/models/gltf/Soldier.glb",
  "https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb",
];

export const STELLAR_BLAST_COOLDOWN = 5;
export const STELLAR_LASER_COOLDOWN = 10;
export const STELLAR_BLAST_RADIUS = 3 * TILE_SIZE;
export const STELLAR_BLAST_DAMAGE = 140;
export const STELLAR_LASER_DAMAGE = 260;
export const STELLAR_LASER_WIDTH = 0.72 * TILE_SIZE;
