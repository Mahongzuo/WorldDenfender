import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = new Map();

function resolveAssetPath(path) {
  if (!path) return '';
  var value = String(path);
  if (value.startsWith('http') || value.startsWith('/')) return value;
  return '/' + value.replace(/^\/+/, '');
}

async function loadModel(url) {
  if (cache.has(url)) return cache.get(url);
  const root = await loader.loadAsync(url).then(function (gltf) {
    return gltf.scene || gltf.scenes[0];
  });
  cache.set(url, root);
  return root;
}

export function createGameplayAssetPreview(options) {
  var host = options.host;
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x08111b);

  var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
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
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 1.8;
  controls.maxDistance = 10;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.6;
  controls.target.set(0, 0.25, 0);

  var stage = new THREE.Group();
  scene.add(stage);

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
  }

  function frameObject(object) {
    var box = new THREE.Box3().setFromObject(object);
    var size = box.getSize(new THREE.Vector3());
    var center = box.getCenter(new THREE.Vector3());
    object.position.sub(center);
    object.position.y -= box.min.y;
    var maxSide = Math.max(size.x, size.y, size.z) || 1;
    var scale = 1.8 / maxSide;
    object.scale.setScalar(scale);
    controls.target.set(0, 0.55, 0);
    camera.position.set(2.6, 2.2, 3.8);
    controls.update();
  }

  async function setAsset(path) {
    clearStage();
    if (!path) return;
    var url = resolveAssetPath(path);
    try {
      if (/\.(glb|gltf)(\?|$)/i.test(url)) {
        var root = (await loadModel(url)).clone(true);
        root.traverse(function (child) {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        stage.add(root);
        frameObject(root);
        return;
      }
      var fallback = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 1.5, 1.5),
        new THREE.MeshNormalMaterial({ wireframe: false })
      );
      stage.add(fallback);
      frameObject(fallback);
    } catch (error) {
      var errorMesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1, 0),
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.55, metalness: 0.12 })
      );
      stage.add(errorMesh);
      frameObject(errorMesh);
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
    dispose: function () {
      disposed = true;
      if (observer) observer.disconnect();
      controls.dispose();
      renderer.dispose();
      host.innerHTML = '';
    },
  };
}