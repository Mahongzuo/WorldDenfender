/**
 * 关卡编辑器「项目模型」条目下方的小型 3D 预览（与预览主场景分离）。
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
  scene.background = new THREE.Color(0x0b1218);

  var camera = new THREE.PerspectiveCamera(40, 1, 0.08, 48);
  camera.position.set(1.6, 1.1, 2.2);

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setSize(host.clientWidth || 1, host.clientHeight || 1, false);

  host.innerHTML = '';
  host.appendChild(renderer.domElement);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';

  var ambient = new THREE.HemisphereLight(0xb8d4ff, 0x34425a, 2.2);
  var key = new THREE.DirectionalLight(0xfff0dd, 2.4);
  key.position.set(3, 6, 4);
  scene.add(ambient, key);

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
        reject
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
