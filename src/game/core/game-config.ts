import { TILE_SIZE } from "./runtime-grid";

export const INITIAL_MONEY = 360;
export const INITIAL_BASE_HP = 20;

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
