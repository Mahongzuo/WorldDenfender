import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import {
  configureLevelStyleOrbitControls,
  centerPreviewObjectOnGround,
  framePreviewCameraToObject,
  computePreviewObjectBounds,
} from './editor/asset-preview-orbit.js';

const gltfLoader = new GLTFLoader();
const gltfCache = new Map();

function resolveAssetPath(path) {
  if (!path) return '';
  var value = String(path);
  if (value.startsWith('http') || value.startsWith('/')) return value;
  return '/' + value.replace(/^\/+/, '');
}

async function loadGltfFull(url) {
  if (gltfCache.has(url)) return gltfCache.get(url);
  var gltf = await gltfLoader.loadAsync(url);
  gltfCache.set(url, gltf);
  return gltf;
}

export function createAnimationAssetPreview(options) {
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

  var mixer = null;
  var activeAction = null;
  var modelRoot = null;
  var clipLibrary = new Map();
  var playing = true;
  var playbackSpeed = 1;
  var clock = new THREE.Clock();
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
    if (mixer) {
      mixer.stopAllAction();
      mixer = null;
    }
    activeAction = null;
    clipLibrary.clear();
    while (stage.children.length) {
      var child = stage.children.pop();
      if (child) stage.remove(child);
    }
    modelRoot = null;
    autoFitScale = 1;
    pathScaleMultiplier = 1;
  }

  function computeObjectBounds(object) {
    return computePreviewObjectBounds(object);
  }

  function refitCamera(object) {
    framePreviewCameraToObject(object, camera, controls, {
      displayScale: autoFitScale * pathScaleMultiplier,
    });
  }

  function frameObject(object) {
    var centered = centerPreviewObjectOnGround(object);
    autoFitScale = 1.8 / centered.maxSide;
    applyModelScale();
    refitCamera(object);
  }

  function setPathScaleMultiplier(mult) {
    pathScaleMultiplier =
      mult != null && Number.isFinite(Number(mult)) && Number(mult) > 0 ? Number(mult) : 1;
    if (!modelRoot) return;
    applyModelScale();
    refitCamera(modelRoot);
  }

  function registerClips(clips, prefix) {
    if (!Array.isArray(clips)) return;
    clips.forEach(function (clip) {
      if (!(clip instanceof THREE.AnimationClip)) return;
      var key = prefix ? prefix + '::' + clip.name : clip.name;
      clipLibrary.set(key, clip);
      clipLibrary.set(clip.name, clip);
    });
  }

  async function loadExternalClip(url) {
    var resolved = resolveAssetPath(url);
    if (!resolved) return null;
    try {
      var gltf = await loadGltfFull(resolved);
      var clip = gltf.animations && gltf.animations[0] ? gltf.animations[0] : null;
      if (clip) {
        registerClips([clip], resolved);
      }
      return clip;
    } catch (error) {
      console.warn('[AnimationAssetPreview] external clip', resolved, error);
      return null;
    }
  }

  function findClipByName(name) {
    if (!name) return null;
    if (clipLibrary.has(name)) return clipLibrary.get(name);
    var lower = String(name).toLowerCase();
    var found = null;
    clipLibrary.forEach(function (clip, key) {
      if (found) return;
      if (String(clip.name).toLowerCase() === lower || String(key).toLowerCase().endsWith('::' + lower)) {
        found = clip;
      }
    });
    return found;
  }

  function playClip(clipName, loop) {
    if (!mixer || !modelRoot) return false;
    var clip = findClipByName(clipName);
    if (!clip) return false;
    var next = mixer.clipAction(clip, modelRoot);
    next.reset();
    next.setLoop(loop === false ? THREE.LoopOnce : THREE.LoopRepeat, loop === false ? 1 : Infinity);
    next.clampWhenFinished = loop === false;
    next.enabled = true;
    next.setEffectiveTimeScale(playbackSpeed);
    if (activeAction && activeAction !== next) {
      activeAction.fadeOut(0.15);
    }
    next.fadeIn(0.15).play();
    activeAction = next;
    return true;
  }

  function applyModelScale() {
    if (!modelRoot) return;
    modelRoot.scale.setScalar(autoFitScale * pathScaleMultiplier);
  }

  async function setModel(modelUrl, userPathScale, externalClipUrls) {
    clearStage();
    if (!modelUrl) return { clipNames: [] };
    pathScaleMultiplier =
      userPathScale != null && Number.isFinite(Number(userPathScale)) && Number(userPathScale) > 0
        ? Number(userPathScale)
        : 1;
    var url = resolveAssetPath(modelUrl);
    try {
      var gltf = await loadGltfFull(url);
      modelRoot = skeletonClone(gltf.scene || gltf.scenes[0]);
      modelRoot.traverse(function (child) {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.geometry && !child.geometry.boundingBox) child.geometry.computeBoundingBox();
        }
      });
      stage.add(modelRoot);
      frameObject(modelRoot);
      registerClips(gltf.animations || [], '');
      if (Array.isArray(externalClipUrls)) {
        for (var i = 0; i < externalClipUrls.length; i += 1) {
          var extUrl = externalClipUrls[i];
          if (extUrl) await loadExternalClip(extUrl);
        }
      }
      mixer = new THREE.AnimationMixer(modelRoot);
      var clipNames = [];
      clipLibrary.forEach(function (clip, key) {
        if (!String(key).includes('::')) clipNames.push(clip.name);
      });
      clipNames.sort();
      if (clipNames.length) playClip(clipNames[0], true);
      return { clipNames: clipNames };
    } catch (error) {
      var errorMesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1, 0),
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.55, metalness: 0.12 })
      );
      stage.add(errorMesh);
      frameObject(errorMesh);
      console.warn('[AnimationAssetPreview]', error);
      return { clipNames: [], error: error.message };
    }
  }

  function setPlaying(value) {
    playing = !!value;
  }

  function setSpeed(value) {
    playbackSpeed = Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 1;
    if (activeAction) activeAction.setEffectiveTimeScale(playbackSpeed);
  }

  function getClipNames() {
    var names = [];
    clipLibrary.forEach(function (clip, key) {
      if (!String(key).includes('::')) names.push(clip.name);
    });
    return names.sort();
  }

  var disposed = false;
  function loop() {
    if (disposed) return;
    var dt = clock.getDelta();
    if (playing && mixer) mixer.update(dt);
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  loop();

  function refitModelFrame() {
    if (!modelRoot) return;
    frameObject(modelRoot);
  }

  return {
    setModel: setModel,
    setPathScaleMultiplier: setPathScaleMultiplier,
    refitModelFrame: refitModelFrame,
    playClip: playClip,
    setPlaying: setPlaying,
    setSpeed: setSpeed,
    getClipNames: getClipNames,
    loadExternalClip: loadExternalClip,
    dispose: function () {
      disposed = true;
      clearStage();
      if (observer) observer.disconnect();
      controls.dispose();
      renderer.dispose();
      host.innerHTML = '';
    }
  };
}
