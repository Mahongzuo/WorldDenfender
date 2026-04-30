/**
 * 关卡编辑器「项目模型」条目下方的小型 3D 预览（与预览主场景分离）。
 * 仅在 WebGL 视口内使用浅灰演播室光照与深色背景偏 lookdev。
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = new Map();

function resolveUrl(path) {
  if (!path) return '';
  var v = String(path);
  if (v.startsWith('http') || v.startsWith('/')) return v;
  return '/' + v.replace(/^\/+/, '');
}

export function createContentBrowserMiniPreview(options) {
  var host = options.host;
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x383e47);

  var camera = new THREE.PerspectiveCamera(40, 1, 0.08, 48);
  camera.position.set(1.6, 1.1, 2.2);

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(host.clientWidth || 1, host.clientHeight || 1, false);

  host.innerHTML = '';
  host.appendChild(renderer.domElement);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';

  var ambient = new THREE.HemisphereLight(0xbec4cc, 0x2c3238, 1.35);
  var key = new THREE.DirectionalLight(0xfff4ec, 1.75);
  key.position.set(4.8, 9.5, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0002;
  var fill = new THREE.DirectionalLight(0xd4dcff, 0.52);
  fill.position.set(-4.8, 5.6, -2.6);
  var rim = new THREE.DirectionalLight(0xfff0e6, 0.36);
  rim.position.set(-1.9, 3.9, -4.9);
  scene.add(ambient, key, fill, rim);

  var ground = new THREE.Mesh(
    new THREE.CircleGeometry(4.25, 56),
    new THREE.MeshStandardMaterial({
      color: 0x4a525c,
      roughness: 0.93,
      metalness: 0.05,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  var controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 0.95;
  controls.maxDistance = 8;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.4;
  controls.target.set(0, 0.45, 0);

  var stage = new THREE.Group();
  scene.add(stage);

  var pending = 0;
  var rafId = 0;

  function tick() {
    rafId = requestAnimationFrame(tick);
    controls.update();
    renderer.render(scene, camera);
  }

  function resize() {
    var w = host.clientWidth || 1;
    var h = host.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  var ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(host);
  resize();
  tick();

  function clearStage() {
    while (stage.children.length > 0) {
      stage.remove(stage.children[0]);
    }
  }

  function frameObject(object) {
    var box = new THREE.Box3().setFromObject(object);
    var size = box.getSize(new THREE.Vector3());
    var center = box.getCenter(new THREE.Vector3());
    object.position.sub(center);
    object.position.y -= box.min.y;
    var maxSide = Math.max(size.x, size.y, size.z) || 1;
    var scl = Math.min(1.5 / maxSide, 36);
    object.scale.setScalar(scl);
    controls.target.set(0, scl * maxSide * 0.42, 0);
    camera.position.set(1.65, scl * maxSide * 0.62, 2.1);
    controls.update();
  }

  async function loadGltf(url) {
    if (cache.has(url)) return cache.get(url).clone(true);
    return new Promise(function (resolve, reject) {
      loader.load(
        url,
        function (gltf) {
          cache.set(url, gltf.scene);
          resolve(gltf.scene.clone(true));
        },
        undefined,
        reject,
      );
    });
  }

  return {
    setUrl: async function (pathOrUrl) {
      clearStage();
      var url = resolveUrl(pathOrUrl);
      if (!url || !/\.(glb|gltf)(\?|$)/i.test(url)) {
        return;
      }
      pending += 1;
      var token = pending;
      try {
        var root = await loadGltf(url);
        if (token !== pending) return;
        root.traverse(function (ch) {
          if (ch.isMesh) {
            ch.castShadow = true;
            ch.receiveShadow = true;
          }
        });
        stage.add(root);
        frameObject(root);
      } catch {
        /* 忽略单个模型预览失败 */
      }
    },
    resize,
    dispose: function () {
      pending += 1;
      cancelAnimationFrame(rafId);
      if (ro) ro.disconnect();
      renderer.dispose();
      host.innerHTML = '';
    },
  };
}
