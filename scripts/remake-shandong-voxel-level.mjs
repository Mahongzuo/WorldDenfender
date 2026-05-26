/**
 * 泉城浮生录：闯荡山东 — 按竖图参考重做为横版体素沙盘。
 * 运行：node scripts/remake-shandong-voxel-level.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const statePath = path.join(root, 'Web', 'data', 'level-editor-state.json');
const buildingDir = path.join(root, 'public', 'GameModels', 'Buildings');
const propsDir = path.join(root, 'public', 'GameModels', 'Props');
fs.mkdirSync(buildingDir, { recursive: true });
fs.mkdirSync(propsDir, { recursive: true });

const MATERIALS = {
  asphalt: [0.16, 0.17, 0.17, 1],
  lane: [0.92, 0.86, 0.58, 1],
  roadWhite: [0.96, 0.96, 0.9, 1],
  plaza: [0.74, 0.72, 0.66, 1],
  stone: [0.62, 0.6, 0.55, 1],
  stoneDark: [0.38, 0.38, 0.36, 1],
  water: [0.05, 0.48, 0.58, 0.88],
  waterLight: [0.35, 0.82, 0.84, 0.72],
  grass: [0.2, 0.48, 0.2, 1],
  grassLight: [0.34, 0.64, 0.28, 1],
  hedge: [0.1, 0.36, 0.12, 1],
  earthDark: [0.27, 0.16, 0.08, 1],
  earthMid: [0.44, 0.29, 0.15, 1],
  wallWhite: [0.86, 0.84, 0.76, 1],
  wallGrey: [0.72, 0.72, 0.68, 1],
  roofGrey: [0.38, 0.42, 0.44, 1],
  roofDark: [0.22, 0.25, 0.27, 1],
  gateRed: [0.7, 0.1, 0.06, 1],
  wood: [0.34, 0.18, 0.08, 1],
  glassBlue: [0.42, 0.66, 0.82, 0.88],
  glassDark: [0.14, 0.28, 0.36, 0.92],
  metal: [0.62, 0.66, 0.68, 1],
  white: [0.92, 0.92, 0.86, 1],
  blue: [0.02, 0.44, 0.84, 1],
  black: [0.05, 0.05, 0.05, 1],
  sakura: [0.96, 0.58, 0.78, 1],
  lotus: [0.22, 0.62, 0.28, 1],
  lotusPink: [0.94, 0.5, 0.72, 1],
  bamboo: [0.28, 0.62, 0.2, 1],
  carRed: [0.84, 0.06, 0.05, 1],
  carBlue: [0.08, 0.36, 0.82, 1],
  carYellow: [0.92, 0.64, 0.12, 1],
};

class VoxelModel {
  constructor() {
    this.boxes = new Map();
  }
  box(x0, y0, z0, x1, y1, z1, mat) {
    if (!this.boxes.has(mat)) this.boxes.set(mat, []);
    this.boxes.get(mat).push([x0, y0, z0, x1, y1, z1]);
  }
  col(cx, y0, cz, w, h, d, mat) {
    this.box(cx - w / 2, y0, cz - d / 2, cx + w / 2, y0 + h, cz + d / 2, mat);
  }
  vox(x, y, z, s, mat) {
    this.box(x, y, z, x + s, y + s, z + s, mat);
  }
  writeGltf(outPath, generator) {
    const materialNames = Object.keys(MATERIALS);
    const materials = materialNames.map((name) => {
      const c = MATERIALS[name];
      const alpha = c[3] < 0.999;
      return {
        name,
        pbrMetallicRoughness: {
          baseColorFactor: c,
          metallicFactor: alpha ? 0.08 : 0,
          roughnessFactor: alpha ? 0.25 : 0.82,
        },
        ...(alpha ? { alphaMode: 'BLEND', doubleSided: true } : {}),
      };
    });
    const bufferViews = [];
    const accessors = [];
    const primitives = [];
    const parts = [];
    let byteOffset = 0;

    for (const [mat, boxes] of this.boxes.entries()) {
      const p = [];
      const n = [];
      const idx = [];
      boxes.forEach(([x0, y0, z0, x1, y1, z1]) => pushBox(p, n, idx, x0, y0, z0, x1, y1, z1));
      if (!p.length) continue;
      const posBuf = Buffer.from(new Float32Array(p).buffer);
      const nrmBuf = Buffer.from(new Float32Array(n).buffer);
      const idxBuf = Buffer.from(new Uint16Array(idx).buffer);
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < p.length; i += 3) {
        min[0] = Math.min(min[0], p[i]);
        min[1] = Math.min(min[1], p[i + 1]);
        min[2] = Math.min(min[2], p[i + 2]);
        max[0] = Math.max(max[0], p[i]);
        max[1] = Math.max(max[1], p[i + 1]);
        max[2] = Math.max(max[2], p[i + 2]);
      }
      const posBv = bufferViews.length;
      bufferViews.push({ buffer: 0, byteOffset, byteLength: posBuf.length, target: 34962 });
      byteOffset += posBuf.length;
      const nrmBv = bufferViews.length;
      bufferViews.push({ buffer: 0, byteOffset, byteLength: nrmBuf.length, target: 34962 });
      byteOffset += nrmBuf.length;
      const idxBv = bufferViews.length;
      bufferViews.push({ buffer: 0, byteOffset, byteLength: idxBuf.length, target: 34963 });
      byteOffset += idxBuf.length;
      parts.push(posBuf, nrmBuf, idxBuf);

      const posAcc = accessors.length;
      accessors.push({ bufferView: posBv, componentType: 5126, count: p.length / 3, type: 'VEC3', min, max });
      const nrmAcc = accessors.length;
      accessors.push({ bufferView: nrmBv, componentType: 5126, count: n.length / 3, type: 'VEC3' });
      const idxAcc = accessors.length;
      accessors.push({ bufferView: idxBv, componentType: 5123, count: idx.length, type: 'SCALAR', min: [0], max: [p.length / 3 - 1] });
      primitives.push({
        attributes: { POSITION: posAcc, NORMAL: nrmAcc },
        indices: idxAcc,
        material: materialNames.indexOf(mat),
      });
    }

    const bin = Buffer.concat(parts);
    const gltf = {
      asset: { version: '2.0', generator },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }],
      meshes: [{ primitives }],
      materials,
      buffers: [{ uri: `data:application/octet-stream;base64,${bin.toString('base64')}`, byteLength: bin.length }],
      bufferViews,
      accessors,
    };
    fs.writeFileSync(outPath, JSON.stringify(gltf));
    return { materials: this.boxes.size, bytes: bin.length };
  }
}

function pushBox(p, n, idx, x0, y0, z0, x1, y1, z1) {
  const faces = [
    { no: [0, 0, -1], v: [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]] },
    { no: [0, 0, 1], v: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]] },
    { no: [0, -1, 0], v: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]] },
    { no: [0, 1, 0], v: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]] },
    { no: [-1, 0, 0], v: [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]] },
    { no: [1, 0, 0], v: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]] },
  ];
  for (const f of faces) {
    const base = p.length / 3;
    for (const v of f.v) {
      p.push(v[0], v[1], v[2]);
      n.push(f.no[0], f.no[1], f.no[2]);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

function roadSegment(m, x0, z0, x1, z1, width = 2.0) {
  const minX = Math.min(x0, x1) - width / 2;
  const maxX = Math.max(x0, x1) + width / 2;
  const minZ = Math.min(z0, z1) - width / 2;
  const maxZ = Math.max(z0, z1) + width / 2;
  m.box(minX, 0.16, minZ, maxX, 0.24, maxZ, 'asphalt');
  const midX = (x0 + x1) / 2;
  const midZ = (z0 + z1) / 2;
  if (Math.abs(x1 - x0) > Math.abs(z1 - z0)) {
    m.box(minX, 0.245, midZ - 0.05, maxX, 0.27, midZ + 0.05, 'lane');
    m.box(minX, 0.248, minZ + 0.25, maxX, 0.272, minZ + 0.32, 'roadWhite');
    m.box(minX, 0.248, maxZ - 0.32, maxX, 0.272, maxZ - 0.25, 'roadWhite');
  } else {
    m.box(midX - 0.05, 0.245, minZ, midX + 0.05, 0.27, maxZ, 'lane');
    m.box(minX + 0.25, 0.248, minZ, minX + 0.32, 0.272, maxZ, 'roadWhite');
    m.box(maxX - 0.32, 0.248, minZ, maxX - 0.25, 0.272, maxZ, 'roadWhite');
  }
}

function buildBase() {
  const m = new VoxelModel();
  // 仅保留参考图中的铺装、水系与道路；不生成整块地形底座或边框。
  roadSegment(m, -16, 0, -8, 0, 2.2);
  roadSegment(m, -8, 0, -2, -2.5, 2.1);
  roadSegment(m, -2, -2.5, 5, -2.5, 2.1);
  roadSegment(m, 5, -2.5, 12, 1.2, 2.1);
  roadSegment(m, 12, 1.2, 16, 1.2, 2.1);
  roadSegment(m, -6, 4.5, 1.5, 4.5, 1.8);
  roadSegment(m, 1.5, 4.5, 8, 2.2, 1.8);
  roadSegment(m, 9.5, -7.5, 15.5, -7.5, 1.8);

  // 左侧曲水与桥位
  m.box(-16, 0.05, -8.6, -10.8, 0.18, 7.5, 'water');
  m.box(-14.8, 0.08, -8.0, -12.0, 0.2, 7.0, 'waterLight');
  m.box(-16.3, 0.18, -8.8, -10.5, 0.36, -8.2, 'stone');
  m.box(-16.3, 0.18, 7.2, -10.5, 0.36, 7.8, 'stone');
  m.box(-16.3, 0.18, -8.8, -15.7, 0.36, 7.8, 'stone');
  m.box(-11.1, 0.18, -8.8, -10.5, 0.36, 7.8, 'stone');

  // 右侧上下两个莲池
  m.box(7.5, 0.05, 2.5, 15.5, 0.18, 8.8, 'water');
  m.box(8.1, 0.08, 3.1, 14.9, 0.2, 8.2, 'waterLight');
  m.box(8.0, 0.05, -8.6, 15.2, 0.18, -4.1, 'water');
  m.box(8.6, 0.08, -8.0, 14.6, 0.2, -4.7, 'waterLight');
  for (const [x, z] of [[9, 3.5], [10.2, 5.1], [13.4, 7.2], [14, 4.2], [10.1, -5.5], [12.4, -7.2], [14.2, -6.0]]) {
    m.box(x - 0.18, 0.22, z - 0.12, x + 0.18, 0.28, z + 0.12, 'lotus');
    m.box(x - 0.04, 0.28, z - 0.04, x + 0.04, 0.36, z + 0.04, 'lotusPink');
  }

  // 前广场、中心绿岛与小雕塑底座
  m.box(-5.6, 0.18, -8.4, 3.6, 0.28, -4.6, 'plaza');
  m.box(-2.5, 0.28, -7.5, 0.7, 0.42, -5.2, 'stone');
  m.box(-1.35, 0.42, -6.9, -0.15, 0.52, -5.8, 'plaza');
  m.box(-4.5, 0.18, -0.7, -2.4, 0.3, 1.0, 'grassLight');
  m.box(2.6, 0.18, 0.6, 4.4, 0.3, 2.0, 'grassLight');

  // 后方城墙基线（视觉元素，不作为棋盘边框）
  m.box(-16, 0.2, 8.8, 16, 1.15, 9.25, 'wallGrey');
  m.box(-16, 1.15, 8.65, 16, 1.35, 9.4, 'roofDark');
  return m;
}

function buildGate() {
  const m = new VoxelModel();
  m.box(-2.4, 0, -0.35, 2.4, 0.35, 0.35, 'stone');
  m.box(-2.2, 0.35, -0.25, -1.25, 2.0, 0.25, 'wallGrey');
  m.box(1.25, 0.35, -0.25, 2.2, 2.0, 0.25, 'wallGrey');
  m.box(-0.55, 0.35, -0.25, 0.55, 1.25, 0.25, 'black');
  m.box(-2.4, 2.0, -0.4, 2.4, 2.35, 0.4, 'roofGrey');
  m.box(-2.65, 2.35, -0.52, 2.65, 2.62, 0.52, 'roofDark');
  m.box(-1.0, 1.25, -0.28, 1.0, 1.55, 0.28, 'gateRed');
  m.box(-0.75, 1.33, -0.31, 0.75, 1.48, -0.25, 'lane');
  return m;
}

function buildTallTower() {
  const m = new VoxelModel();
  m.box(-1.4, 0, -1.2, 1.4, 0.45, 1.2, 'stone');
  for (let i = 0; i < 18; i += 1) {
    const y0 = 0.45 + i * 0.28;
    const r = 1.05 - i * 0.018;
    m.box(-r, y0, -0.72, r, y0 + 0.24, 0.72, i % 2 ? 'glassBlue' : 'glassDark');
    m.box(-r * 0.85, y0 + 0.24, -0.66, r * 0.85, y0 + 0.27, 0.66, 'metal');
  }
  m.box(-0.65, 5.5, -0.45, 0.65, 6.4, 0.45, 'glassBlue');
  m.box(-0.32, 6.4, -0.28, 0.32, 6.8, 0.28, 'metal');
  return m;
}

function buildStadium() {
  const m = new VoxelModel();
  m.box(-3.2, 0, -2.4, 3.2, 0.4, 2.4, 'stone');
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    const x = Math.cos(a) * 2.6;
    const z = Math.sin(a) * 1.8;
    m.box(x - 0.18, 0.4, z - 0.18, x + 0.18, 1.0, z + 0.18, 'white');
  }
  m.box(-2.6, 1.0, -1.8, 2.6, 1.3, 1.8, 'white');
  m.box(-1.9, 1.3, -1.3, 1.9, 1.58, 1.3, 'wallWhite');
  m.box(-0.45, 1.58, -0.35, 0.45, 1.78, 0.35, 'stone');
  return m;
}

function buildBlueSculpture() {
  const m = new VoxelModel();
  m.box(-1.5, 0, -1.5, 1.5, 0.28, 1.5, 'stone');
  m.box(-0.35, 0.28, -0.35, 0.35, 0.55, 0.35, 'plaza');
  m.box(-0.18, 0.55, -0.16, 0.18, 2.7, 0.16, 'blue');
  m.box(-0.9, 1.75, -0.16, 0.9, 2.1, 0.16, 'blue');
  m.box(-0.95, 0.75, -0.14, -0.58, 2.05, 0.14, 'blue');
  m.box(0.58, 0.75, -0.14, 0.95, 2.05, 0.14, 'blue');
  m.box(-0.38, 2.7, -0.18, 0.38, 3.25, 0.18, 'blue');
  m.box(-0.22, 1.72, -0.2, 0.22, 2.15, 0.2, 'white');
  return m;
}

function buildPavilion() {
  const m = new VoxelModel();
  m.box(-0.9, 0, -0.9, 0.9, 0.18, 0.9, 'stone');
  for (const [x, z] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) {
    m.box(x - 0.06, 0.18, z - 0.06, x + 0.06, 1.15, z + 0.06, 'wood');
  }
  m.box(-1.05, 1.15, -1.05, 1.05, 1.35, 1.05, 'roofGrey');
  m.box(-1.25, 1.35, -1.25, 1.25, 1.55, 1.25, 'roofDark');
  return m;
}

function buildBridge() {
  const m = new VoxelModel();
  m.box(-1.9, 0, -0.45, 1.9, 0.32, 0.45, 'stone');
  m.box(-1.5, 0.32, -0.36, 1.5, 0.55, 0.36, 'plaza');
  for (let x = -1.6; x <= 1.6; x += 0.45) {
    m.box(x - 0.04, 0.55, -0.48, x + 0.04, 0.95, -0.36, 'stone');
    m.box(x - 0.04, 0.55, 0.36, x + 0.04, 0.95, 0.48, 'stone');
  }
  return m;
}

function buildTrees(kind) {
  const m = new VoxelModel();
  const leaf = kind === 'sakura' ? 'sakura' : kind === 'bamboo' ? 'bamboo' : 'grassLight';
  for (const [x, z, h] of [[0, 0, 1.2], [0.45, 0.35, 1.5], [-0.4, 0.25, 1.3], [0.1, -0.45, 1.4]]) {
    m.box(x - 0.05, 0, z - 0.05, x + 0.05, h, z + 0.05, 'wood');
    m.box(x - 0.35, h * 0.65, z - 0.35, x + 0.35, h * 1.05, z + 0.35, leaf);
    if (kind === 'bamboo') m.box(x - 0.08, h * 0.95, z - 0.08, x + 0.08, h * 1.75, z + 0.08, leaf);
  }
  return m;
}

function buildCar() {
  const m = new VoxelModel();
  m.box(-0.45, 0.12, -0.22, 0.45, 0.38, 0.22, 'carRed');
  m.box(-0.22, 0.38, -0.16, 0.22, 0.56, 0.16, 'glassBlue');
  m.box(-0.48, 0, -0.24, -0.28, 0.14, -0.08, 'black');
  m.box(0.28, 0, -0.24, 0.48, 0.14, -0.08, 'black');
  m.box(-0.48, 0, 0.08, -0.28, 0.14, 0.24, 'black');
  m.box(0.28, 0, 0.08, 0.48, 0.14, 0.24, 'black');
  return m;
}

const MODELS = [
  ['Props/voxel-shandong-horizontal-base.gltf', buildBase],
  ['Buildings/voxel-shandong-heritage-gate.gltf', buildGate],
  ['Buildings/voxel-shandong-tall-glass-tower.gltf', buildTallTower],
  ['Buildings/voxel-shandong-stadium-dome.gltf', buildStadium],
  ['Props/voxel-shandong-blue-sculpture.gltf', buildBlueSculpture],
  ['Buildings/voxel-shandong-pavilion.gltf', buildPavilion],
  ['Buildings/voxel-shandong-canal-bridge.gltf', buildBridge],
  ['Props/voxel-shandong-bamboo-grove.gltf', () => buildTrees('bamboo')],
  ['Props/voxel-shandong-sakura-tree.gltf', () => buildTrees('sakura')],
  ['Props/voxel-shandong-tree-cluster.gltf', () => buildTrees('green')],
  ['Props/voxel-shandong-car.gltf', buildCar],
];

const stats = {
  hp: 1,
  attack: 0,
  range: 1.5,
  fireRate: 0,
  cost: 0,
  cooldown: 0,
  speed: 0,
  reward: 0,
  targeting: 'nearest',
  projectileModelId: '',
};

function actor(id, name, modelPath, col, row, opts = {}) {
  return {
    id,
    templateId: 'explore-item',
    name,
    category: 'model',
    icon: 'M',
    modelId: '',
    col,
    row,
    rotation: opts.rotation ?? 0,
    scale: opts.scale ?? 1,
    worldOffsetMeters: opts.offset ?? { x: 0, y: 0, z: 0 },
    modelPath,
    team: 'neutral',
    stats: { ...stats },
  };
}

const ACTORS = [
  actor('sd-voxel-surface', '体素横版泉城铺装水系', '/GameModels/Props/voxel-shandong-horizontal-base.gltf', 20, 12, { scale: 1.0 }),
  actor('sd-voxel-glass-tower', '体素超高玻璃塔', '/GameModels/Buildings/voxel-shandong-tall-glass-tower.gltf', 21, 6, { scale: 1.35 }),
  actor('sd-voxel-stadium', '体素圆形会展场馆', '/GameModels/Buildings/voxel-shandong-stadium-dome.gltf', 28, 15, { scale: 1.08 }),
  actor('sd-voxel-sculpture', '体素蓝色泉标雕塑', '/GameModels/Props/voxel-shandong-blue-sculpture.gltf', 17, 19, { scale: 0.92 }),
  actor('sd-voxel-gate-left', '体素城门-西', '/GameModels/Buildings/voxel-shandong-heritage-gate.gltf', 5, 4, { scale: 0.88, rotation: 90 }),
  actor('sd-voxel-gate-north', '体素城门-北', '/GameModels/Buildings/voxel-shandong-heritage-gate.gltf', 24, 3, { scale: 0.84 }),
  actor('sd-voxel-gate-front-a', '体素城门-前左', '/GameModels/Buildings/voxel-shandong-heritage-gate.gltf', 10, 21, { scale: 0.68 }),
  actor('sd-voxel-gate-front-b', '体素城门-前右', '/GameModels/Buildings/voxel-shandong-heritage-gate.gltf', 33, 21, { scale: 0.68 }),
  actor('sd-voxel-bridge-1', '体素水渠石桥', '/GameModels/Buildings/voxel-shandong-canal-bridge.gltf', 6, 13, { scale: 0.78, rotation: 90 }),
  actor('sd-voxel-bridge-2', '体素水渠石桥', '/GameModels/Buildings/voxel-shandong-canal-bridge.gltf', 8, 7, { scale: 0.72, rotation: 90 }),
  actor('sd-voxel-pavilion-pond-a', '体素荷塘亭', '/GameModels/Buildings/voxel-shandong-pavilion.gltf', 32, 8, { scale: 0.78 }),
  actor('sd-voxel-pavilion-pond-b', '体素荷塘亭', '/GameModels/Buildings/voxel-shandong-pavilion.gltf', 30, 17, { scale: 0.68 }),
  actor('sd-voxel-bamboo-1', '体素竹林', '/GameModels/Props/voxel-shandong-bamboo-grove.gltf', 5, 7, { scale: 1.08 }),
  actor('sd-voxel-bamboo-2', '体素竹林', '/GameModels/Props/voxel-shandong-bamboo-grove.gltf', 6, 15, { scale: 1.02 }),
  actor('sd-voxel-sakura-1', '体素樱花树', '/GameModels/Props/voxel-shandong-sakura-tree.gltf', 14, 16, { scale: 0.78 }),
  actor('sd-voxel-sakura-2', '体素樱花树', '/GameModels/Props/voxel-shandong-sakura-tree.gltf', 33, 6, { scale: 0.76 }),
  actor('sd-voxel-sakura-3', '体素樱花树', '/GameModels/Props/voxel-shandong-sakura-tree.gltf', 35, 16, { scale: 0.78 }),
  actor('sd-voxel-tree-1', '体素园林树丛', '/GameModels/Props/voxel-shandong-tree-cluster.gltf', 25, 8, { scale: 0.82 }),
  actor('sd-voxel-tree-2', '体素园林树丛', '/GameModels/Props/voxel-shandong-tree-cluster.gltf', 31, 13, { scale: 0.92 }),
  actor('sd-voxel-tree-3', '体素园林树丛', '/GameModels/Props/voxel-shandong-tree-cluster.gltf', 34, 12, { scale: 0.86 }),
  actor('sd-voxel-car-red', '体素道路车辆', '/GameModels/Props/voxel-shandong-car.gltf', 16, 13, { scale: 0.58, rotation: 12 }),
  actor('sd-voxel-car-blue', '体素道路车辆', '/GameModels/Props/voxel-shandong-car.gltf', 24, 12, { scale: 0.56, rotation: -8 }),
  actor('sd-voxel-car-yellow', '体素道路车辆', '/GameModels/Props/voxel-shandong-car.gltf', 31, 20, { scale: 0.54, rotation: 90 }),
];

function emptyExplorationLayout(grid, theme) {
  return {
    grid: { ...grid },
    theme: { ...theme },
    path: [],
    obstacles: [],
    safeZones: [],
    startPoint: null,
    exitPoint: null,
    gameplay: {},
  };
}

function main() {
  for (const [rel, build] of MODELS) {
    const out = path.join(root, 'public', 'GameModels', rel);
    const info = build().writeGltf(out, 'EarthGuardian Shandong horizontal voxel scene');
    console.log(`wrote ${rel} (${info.materials} mats, ${info.bytes} bytes)`);
  }

  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const level = state.levels.find((item) => item.id === 'CN_shandong_370100');
  if (!level) throw new Error('CN_shandong_370100 not found');

  const grid = { cols: 40, rows: 24, tileSize: 2 };
  const theme = {
    ...level.map.theme,
    ground: '#5f7d65',
    groundAlt: '#4d6f58',
    road: '#303438',
    path: '#303438',
    obstacle: '#7f8178',
    accent: '#6fb5c7',
    fog: '#40545b',
    boardTextureUrl: '',
    hoverColorOk: '#7ea08f',
    hoverColorBad: '#c28e89',
  };

  level.status = 'designed';
  level.difficulty = 4;
  level.description =
    '按参考图横版重制的体素泉城沙盘：曲水、S 型道路、城墙城门、超高玻璃塔、圆形会展场馆、蓝色泉标雕塑、莲池亭榭、竹林与樱花共同构成可重新设计玩法的三维底景。';
  level.environment = {
    ...level.environment,
    lightingProfile: 'warm-voxel-daylight',
    entryScene: 'shandong-horizontal-voxel-diorama',
    notes: '已清空底图、棋盘布局与探索布局；体素铺装水系不包含地形底座和外框，供关卡编辑器重新设计玩法。',
  };
  level.map.grid = grid;
  level.map.theme = theme;
  level.map.terrain = [];
  level.map.roads = [];
  level.map.enemyPaths = [{ id: 'path-main', name: '主敌人路径（待设计）', cells: [] }];
  level.map.obstacles = [];
  level.map.buildSlots = [];
  level.map.spawnPoints = [];
  level.map.enemyExits = [];
  level.map.objectivePoint = null;
  level.map.explorationPoints = [];
  level.map.explorationLayout = emptyExplorationLayout(grid, theme);
  level.map.geo = { ...(level.map.geo || {}), enabled: false };
  level.map.actors = ACTORS;
  level.map.exploreBosses = [];
  level.map.exploreSpawners = [];
  level.map.explorePickups = [];
  level.map.boardImageLayers = [];
  if (level.modeProfiles) {
    level.modeProfiles.defense = {
      ...(level.modeProfiles.defense || {}),
      enabled: true,
      enemyPaths: level.map.enemyPaths,
      spawnPoints: [],
      waveRules: [],
      maxWaves: 0,
    };
    level.modeProfiles.exploration = {
      ...(level.modeProfiles.exploration || {}),
      enabled: true,
      points: [],
      encounterDensity: 0,
    };
  }
  level.waveRules = [];
  level.extensions = {
    ...(level.extensions || {}),
    sceneRemake: {
      style: 'high-detail-horizontal-3d-voxel',
      reference: 'shandong-portrait-reference-adapted-to-landscape',
      disableJinanRegionalFlatPreset: true,
      note: '参考图竖构图已改成横版地图；已关闭济南默认底图，当前道路、塔位、出生点、目标点、探索点和探索路径均已清空。',
    },
  };

  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  console.log(`updated ${level.id}: actors=${ACTORS.length}, roads=${level.map.roads.length}, explorationPath=${level.map.explorationLayout.path.length}`);
}

main();
