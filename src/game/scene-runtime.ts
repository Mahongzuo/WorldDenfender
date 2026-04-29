import * as THREE from "three";

import { TILE_SIZE } from "./runtime-grid";

export interface GameSceneGroups {
  mapGroup: THREE.Group;
  buildGroup: THREE.Group;
  enemyGroup: THREE.Group;
  dropGroup: THREE.Group;
  actorGroup: THREE.Group;
  fxGroup: THREE.Group;
}

export function configureGameRenderer(renderer: THREE.WebGLRenderer, sceneHost: HTMLElement): void {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  sceneHost.append(renderer.domElement);
}

export function createHoverMesh(): THREE.Mesh {
  const hoverGeometry = new THREE.BoxGeometry(TILE_SIZE * 0.96, 0.08, TILE_SIZE * 0.96);
  const hoverMaterial = new THREE.MeshBasicMaterial({
    color: 0x8be9ff,
    transparent: true,
    opacity: 0.42,
  });
  const hoverMesh = new THREE.Mesh(hoverGeometry, hoverMaterial);
  hoverMesh.visible = false;
  return hoverMesh;
}

export function configureGameScene(options: {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  groups: GameSceneGroups;
  hoverMesh: THREE.Mesh;
  onCreatePlayer: () => void;
  onResize: () => void;
}): void {
  const { scene, camera, groups, hoverMesh, onCreatePlayer, onResize } = options;

  camera.position.set(0, 54, 0.01);
  camera.lookAt(0, 0, 0);
  scene.add(camera);

  const ambient = new THREE.HemisphereLight(0xf7fbff, 0x8aa0b8, 1.85);
  const sun = new THREE.DirectionalLight(0xfff6df, 3.45);
  sun.position.set(-48, 72, 34);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 260;
  sun.shadow.camera.left = -90;
  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;
  sun.shadow.camera.bottom = -90;
  const skyFill = new THREE.DirectionalLight(0xbfdcff, 0.75);
  skyFill.position.set(36, 34, -52);
  scene.add(ambient, sun, skyFill);

  scene.add(
    groups.mapGroup,
    groups.buildGroup,
    groups.enemyGroup,
    groups.dropGroup,
    groups.actorGroup,
    groups.fxGroup,
  );

  groups.actorGroup.visible = false;
  groups.mapGroup.add(hoverMesh);

  onCreatePlayer();
  onResize();
}

export function clearGroup(group: THREE.Group): void {
  while (group.children.length > 0) {
    group.remove(group.children[0]);
  }
}
