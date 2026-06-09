import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import {
  configureLevelStyleOrbitControls,
  centerPreviewObjectOnGround,
  framePreviewCameraToObject,
} from './editor/asset-preview-orbit.js';

const gltfLoader = new GLTFLoader();
const objLoader = new OBJLoader();
const cache = new Map();

function resolveAssetPath(path) {
  if (!path) return '';
  var value = String(path);
  if (value.startsWith('http') || value.startsWith('/')) return value;
  return '/' + value.replace(/^\/+/, '');
}

async function loadGltf(url) {
  if (cache.has(url)) return cache.get(url);
  const root = await gltfLoader.loadAsync(url).then(function (gltf) {
    return gltf.scene || gltf.scenes[0];
  });
  cache.set(url, root);
  return root;
}

async function loadObj(url) {
  if (cache.has(url)) return cache.get(url);
  const objRoot = await objLoader.loadAsync(url);
  cache.set(url, objRoot);
  return objRoot;
}

export function createGameplayAssetPreview(options) {
  var host = options.host;
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x08111b);

  var camera = new THREE.PerspectiveCamera(55, 1, 0.05, 10000);
  camera.position.set(2.6, 2.2, 3.8);

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setSize(host.clientWidth || 1, host.clientHeight || 1, false);

  host.innerHTML = '';
  host.appendChild(renderer.domElement);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';

  var ambient = new THREE.HemisphereLight(0xf4fbff, 0x39516a, 2.8);
  var key = new THREE.DirectionalLight(0xfff3d4, 2.6);
  key.position.set(4, 8, 5);
  var rim = new THREE.DirectionalLight(0x7dd3fc, 1.2);
  rim.position.set(-4, 3, -3);
  scene.add(ambient, key, rim);

  var ground = new THREE.Mesh(
    new THREE.CircleGeometry(2.8, 48),
    new THREE.MeshStandardMaterial({ color: 0x132332, roughness: 0.9, metalness: 0.05 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.9;
  scene.add(ground);

  var controls = new OrbitControls(camera, renderer.domElement);
  configureLevelStyleOrbitControls(controls, camera);
  controls.target.set(0, 0.25, 0);

  var stage = new THREE.Group();
  scene.add(stage);

  var modelRoot = null;
  var autoFitScale = 1;
  var pathScaleMultiplier = 1;

  function resize() {
    var width = host.clientWidth || 1;
    var height = host.clientHeight || 1;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  var observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (observer) observer.observe(host);
  resize();

  function clearStage() {
    while (stage.children.length) {
      var child = stage.children.pop();
      if (child) stage.remove(child);
    }
    modelRoot = null;
    autoFitScale = 1;
    pathScaleMultiplier = 1;
  }

  function applyModelScale() {
    if (!modelRoot) return;
    modelRoot.scale.setScalar(autoFitScale * pathScaleMultiplier);
  }

  function frameObject(object) {
    var centered = centerPreviewObjectOnGround(object);
    autoFitScale = 1.8 / centered.maxSide;
    applyModelScale();
    framePreviewCameraToObject(object, camera, controls, {
      displayScale: autoFitScale * pathScaleMultiplier,
    });
  }

  function setPathScaleMultiplier(mult) {
    pathScaleMultiplier =
      mult != null && Number.isFinite(Number(mult)) && Number(mult) > 0 ? Number(mult) : 1;
    if (!modelRoot) return;
    applyModelScale();
    framePreviewCameraToObject(modelRoot, camera, controls, {
      displayScale: autoFitScale * pathScaleMultiplier,
    });
  }

  function refitModelFrame() {
    if (!modelRoot) return;
    frameObject(modelRoot);
  }

  async function setAsset(path, pathScale) {
    clearStage();
    if (!path) return;
    pathScaleMultiplier =
      pathScale != null && Number.isFinite(Number(pathScale)) && Number(pathScale) > 0
        ? Number(pathScale)
        : 1;
    var url = resolveAssetPath(path);
    try {
      if (/\.(glb|gltf)(\?|$)/i.test(url)) {
        var gltfRoot = (await loadGltf(url)).clone(true);
        gltfRoot.traverse(function (child) {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.geometry && !child.geometry.boundingBox) child.geometry.computeBoundingBox();
          }
        });
        modelRoot = gltfRoot;
        stage.add(modelRoot);
        frameObject(modelRoot);
        return;
      }
      if (/\.obj(\?|$)/i.test(url)) {
        var objRoot = (await loadObj(url)).clone(true);
        objRoot.traverse(function (child) {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.geometry && !child.geometry.boundingBox) child.geometry.computeBoundingBox();
          }
        });
        modelRoot = objRoot;
        stage.add(modelRoot);
        frameObject(modelRoot);
        return;
      }
      var fallback = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 1.5, 1.5),
        new THREE.MeshNormalMaterial({ wireframe: false })
      );
      modelRoot = fallback;
      stage.add(modelRoot);
      frameObject(modelRoot);
    } catch (error) {
      var errorMesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1, 0),
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.55, metalness: 0.12 })
      );
      modelRoot = errorMesh;
      stage.add(modelRoot);
      frameObject(modelRoot);
      console.warn('[GameplayAssetPreview]', error);
    }
  }

  var disposed = false;
  function loop() {
    if (disposed) return;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  loop();

  return {
    setAsset: setAsset,
    setPathScaleMultiplier: setPathScaleMultiplier,
    refitModelFrame: refitModelFrame,
    dispose: function () {
      disposed = true;
      if (observer) observer.disconnect();
      controls.dispose();
      renderer.dispose();
      host.innerHTML = '';
    },
  };
}
