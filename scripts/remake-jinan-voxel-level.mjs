/**
 * 济南·泉港曲栈 — 参考微缩体素沙盘重制关卡底景。
 * 运行：node scripts/remake-jinan-voxel-level.mjs
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
  water: [0.08, 0.52, 0.62, 0.86],
  waterLight: [0.35, 0.78, 0.82, 0.72],
  pondDeep: [0.05, 0.42, 0.55, 0.92],
  earthDark: [0.28, 0.16, 0.08, 1],
  earthMid: [0.42, 0.28, 0.14, 1],
  earthLight: [0.58, 0.42, 0.24, 1],
  stone: [0.62, 0.6, 0.54, 1],
  stoneDark: [0.38, 0.36, 0.34, 1],
  stonePath: [0.72, 0.68, 0.58, 1],
  grass: [0.22, 0.52, 0.24, 1],
  grassLight: [0.32, 0.64, 0.28, 1],
  grassDark: [0.14, 0.4, 0.16, 1],
  roofGrey: [0.48, 0.5, 0.52, 1],
  roofDark: [0.32, 0.34, 0.36, 1],
  wallWhite: [0.9, 0.88, 0.82, 1],
  wallGrey: [0.78, 0.76, 0.7, 1],
  woodDark: [0.28, 0.16, 0.08, 1],
  woodBrown: [0.42, 0.24, 0.12, 1],
  roofGold: [0.94, 0.68, 0.12, 1],
  roofGoldDark: [0.72, 0.42, 0.06, 1],
  vermilion: [0.82, 0.12, 0.08, 1],
  lanternRed: [0.9, 0.06, 0.04, 1],
  lanternGlow: [1, 0.72, 0.18, 1],
  tigerOrange: [0.92, 0.48, 0.08, 1],
  tigerWhite: [0.94, 0.9, 0.82, 1],
  tigerBlack: [0.12, 0.1, 0.08, 1],
  leaf: [0.18, 0.58, 0.2, 1],
  willow: [0.42, 0.72, 0.28, 1],
  willowLight: [0.58, 0.82, 0.38, 1],
  pine: [0.1, 0.42, 0.16, 1],
  pineLight: [0.18, 0.55, 0.22, 1],
  trunk: [0.35, 0.2, 0.1, 1],
  lotus: [0.22, 0.62, 0.28, 1],
  lotusPink: [0.95, 0.52, 0.72, 1],
  boatWood: [0.52, 0.32, 0.14, 1],
  boatCover: [0.38, 0.22, 0.1, 1],
  tabletBlue: [0.12, 0.32, 0.58, 1],
  black: [0.06, 0.06, 0.06, 1],
  white: [0.96, 0.94, 0.88, 1],
};

class VoxelModel {
  constructor() {
    /** @type {Map<string, number[][]>} */
    this.boxes = new Map();
  }

  /** @param {string} mat */
  box(x0, y0, z0, x1, y1, z1, mat) {
    if (!this.boxes.has(mat)) this.boxes.set(mat, []);
    this.boxes.get(mat).push([x0, y0, z0, x1, y1, z1]);
  }

  vox(x, y, z, s, mat) {
    this.box(x, y, z, x + s, y + s, z + s, mat);
  }

  /** centered column */
  col(cx, y0, cz, w, h, d, mat) {
    this.box(cx - w / 2, y0, cz - d / 2, cx + w / 2, y0 + h, cz + d / 2, mat);
  }

  writeGltf(outPath, generator) {
    const matNames = [...this.boxes.keys()];
    const allMaterialNames = Object.keys(MATERIALS);
    const gltfMaterials = allMaterialNames.map((name) => {
      const c = MATERIALS[name];
      const alpha = c[3] < 0.999;
      return {
        name,
        pbrMetallicRoughness: {
          baseColorFactor: c,
          metallicFactor: alpha ? 0.08 : 0,
          roughnessFactor: alpha ? 0.24 : 0.82,
        },
        ...(alpha ? { alphaMode: 'BLEND', doubleSided: true } : {}),
      };
    });

    const posChunks = [];
    const nrmChunks = [];
    const idxChunks = [];
    const matNamesUsed = [];
    for (const mat of matNames) {
      const p = [];
      const n = [];
      const idx = [];
      for (const [x0, y0, z0, x1, y1, z1] of this.boxes.get(mat)) {
        pushBox(p, n, idx, x0, y0, z0, x1, y1, z1);
      }
      if (!p.length) continue;
      posChunks.push(p);
      nrmChunks.push(n);
      idxChunks.push(idx);
      matNamesUsed.push(mat);
    }

    const parts = [];
    let byteOffset = 0;
    const bufferViews = [];
    const accessors = [];
    const finalPrims = [];
    for (let i = 0; i < posChunks.length; i += 1) {
      const p = posChunks[i];
      const n = nrmChunks[i];
      const idx = idxChunks[i];
      const posBuf = Buffer.from(new Float32Array(p).buffer);
      const nrmBuf = Buffer.from(new Float32Array(n).buffer);
      const idxBuf = Buffer.from(new Uint16Array(idx).buffer);
      parts.push(posBuf, nrmBuf, idxBuf);
      const posMin = [Infinity, Infinity, Infinity];
      const posMax = [-Infinity, -Infinity, -Infinity];
      for (let j = 0; j < p.length; j += 3) {
        posMin[0] = Math.min(posMin[0], p[j]);
        posMin[1] = Math.min(posMin[1], p[j + 1]);
        posMin[2] = Math.min(posMin[2], p[j + 2]);
        posMax[0] = Math.max(posMax[0], p[j]);
        posMax[1] = Math.max(posMax[1], p[j + 1]);
        posMax[2] = Math.max(posMax[2], p[j + 2]);
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
      const posAcc = accessors.length;
      accessors.push({
        bufferView: posBv,
        componentType: 5126,
        count: p.length / 3,
        type: 'VEC3',
        min: posMin,
        max: posMax,
      });
      const nrmAcc = accessors.length;
      accessors.push({ bufferView: nrmBv, componentType: 5126, count: n.length / 3, type: 'VEC3' });
      const idxAcc = accessors.length;
      accessors.push({
        bufferView: idxBv,
        componentType: 5123,
        count: idx.length,
        type: 'SCALAR',
        min: [0],
        max: [p.length / 3 - 1],
      });
      finalPrims.push({
        attributes: { POSITION: posAcc, NORMAL: nrmAcc },
        indices: idxAcc,
        material: allMaterialNames.indexOf(matNamesUsed[i]),
      });
    }
    const finalBin = Buffer.concat(parts);
    const gltf = {
      asset: { version: '2.0', generator },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }],
      meshes: [{ primitives: finalPrims }],
      materials: gltfMaterials,
      buffers: [{ uri: `data:application/octet-stream;base64,${finalBin.toString('base64')}`, byteLength: finalBin.length }],
      bufferViews,
      accessors,
    };
    fs.writeFileSync(outPath, JSON.stringify(gltf));
    return { primitives: finalPrims.length, bytes: finalBin.length, mats: matNamesUsed.length };
  }
}

function pushBox(positions, normals, indices, x0, y0, z0, x1, y1, z1) {
  const faces = [
    { n: [0, 0, -1], v: [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]] },
    { n: [0, 0, 1], v: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]] },
    { n: [0, -1, 0], v: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]] },
    { n: [0, 1, 0], v: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]] },
    { n: [-1, 0, 0], v: [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]] },
    { n: [1, 0, 0], v: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]] },
  ];
  for (const f of faces) {
    const i0 = positions.length / 3;
    for (const v of f.v) {
      positions.push(v[0], v[1], v[2]);
      normals.push(f.n[0], f.n[1], f.n[2]);
    }
    indices.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
  }
}

function buildDioramaBase() {
  const m = new VoxelModel();
  const half = 16;
  // 浮岛顶面
  m.box(-half, 0, -half, half, 0.12, half, 'grass');
  // 侧壁土层（四层）
  m.box(-half, -0.65, -half, half, 0, half, 'earthLight');
  m.box(-half, -1.25, -half, half, -0.65, half, 'earthMid');
  m.box(-half, -1.85, -half, half, -1.25, half, 'earthMid');
  m.box(-half, -2.45, -half, half, -1.85, half, 'earthDark');
  // 外缘土台露出
  m.box(-half, -2.45, -half, -half + 1.2, 0.12, half, 'earthLight');
  m.box(half - 1.2, -2.45, -half, half, 0.12, half, 'earthLight');
  m.box(-half, -2.45, -half, half, 0.12, -half + 1.2, 'earthLight');
  m.box(-half, -2.45, half - 1.2, half, 0.12, half, 'earthLight');
  // 中央碧泉池
  m.box(-4.2, -0.35, -2.8, 5.4, -0.05, 4.6, 'pondDeep');
  m.box(-3.6, -0.08, -2.2, 4.8, 0.02, 4.0, 'water');
  m.box(-3.0, -0.05, -1.6, 4.2, 0.04, 3.4, 'waterLight');
  // 池岸石栏
  m.box(-5.0, 0, -3.4, 6.2, 0.18, -2.4, 'stone');
  m.box(-5.0, 0, 4.0, 6.2, 0.18, 5.0, 'stone');
  m.box(-5.0, 0, -3.4, -4.0, 0.18, 5.0, 'stone');
  m.box(5.2, 0, -3.4, 6.2, 0.18, 5.0, 'stone');
  // 环园石径（四段）
  m.box(-12.5, 0.14, -10.5, 12.5, 0.22, -8.5, 'stonePath');
  m.box(-12.5, 0.14, 8.5, 12.5, 0.22, 10.5, 'stonePath');
  m.box(-12.5, 0.14, -10.5, -10.5, 0.22, 10.5, 'stonePath');
  m.box(10.5, 0.14, -10.5, 12.5, 0.22, 10.5, 'stonePath');
  // 右侧瀑布基池
  m.box(8.0, -0.2, -2.0, 13.0, 0.05, 3.2, 'waterLight');
  m.box(8.5, 0.05, -1.5, 12.5, 0.12, 2.7, 'water');
  // 前景曲栈街面
  m.box(-6.5, 0.13, 7.5, 6.5, 0.21, 13.5, 'stonePath');
  m.box(-6.0, 0.13, 8.0, 6.0, 0.19, 13.0, 'stone');
  // 连接桥位铺装
  m.box(17.0, 0.14, -1.0, 19.5, 0.22, 1.0, 'stonePath');
  // 点缀草丘
  for (const [bx, bz, w] of [
    [-11, -7, 1.8], [-9, 5, 1.4], [7, -9, 1.6], [11, 3, 1.5], [-13, 1, 1.2], [12, -6, 1.3],
  ]) {
    m.box(bx - w / 2, 0.12, bz - w / 2, bx + w / 2, 0.35, bz + w / 2, 'grassLight');
    m.box(bx - w / 3, 0.35, bz - w / 3, bx + w / 3, 0.55, bz + w / 3, 'grassDark');
  }
  return m;
}

function buildPagoda() {
  const m = new VoxelModel();
  const s = 0.08;
  // 石基台
  m.col(0, 0, 0, 2.4, 0.35, 2.4, 'stone');
  m.col(0, 0.35, 0, 2.0, 0.15, 2.0, 'stoneDark');
  // 四层塔身
  const tiers = [
    { y: 0.5, w: 1.7, h: 1.0, roof: 2.2 },
    { y: 1.5, w: 1.45, h: 0.9, roof: 1.95 },
    { y: 2.4, w: 1.2, h: 0.85, roof: 1.7 },
    { y: 3.25, w: 0.95, h: 0.75, roof: 1.45 },
  ];
  for (const t of tiers) {
    m.col(0, t.y, 0, t.w, t.h, t.w, 'woodDark');
    m.box(-t.w / 2, t.y + t.h * 0.15, t.w / 2 - s, t.w / 2, t.y + t.h * 0.85, t.w / 2 + s * 0.2, 'vermilion');
    m.box(-t.w / 2, t.y + t.h * 0.15, -t.w / 2 - s * 0.2, t.w / 2, t.y + t.h * 0.85, -t.w / 2, 'vermilion');
    const ry = t.y + t.h;
    m.box(-t.roof / 2, ry, -t.roof / 2, t.roof / 2, ry + s * 2.5, t.roof / 2, 'roofGoldDark');
    m.box(-t.roof / 2 + s * 2, ry + s * 2.5, -t.roof / 2 + s * 2, t.roof / 2 - s * 2, ry + s * 4, t.roof / 2 - s * 2, 'roofGold');
    m.col(0, ry + s * 4.2, 0, t.roof * 0.5, s * 1.4, t.roof * 0.5, 'roofGold');
    m.vox(-t.roof / 2, ry + s, -t.roof / 2, s * 1.2, 'roofGold');
    m.vox(t.roof / 2 - s, ry + s, -t.roof / 2, s * 1.2, 'roofGold');
    m.vox(-t.roof / 2, ry + s, t.roof / 2 - s, s * 1.2, 'roofGold');
    m.vox(t.roof / 2 - s, ry + s, t.roof / 2 - s, s * 1.2, 'roofGold');
  }
  // 塔刹
  m.col(0, 4.05, 0, 0.12, 0.55, 0.12, 'roofGold');
  m.col(0, 4.62, 0, 0.28, 0.12, 0.28, 'roofGold');
  return m;
}

function buildStreetBlock() {
  const m = new VoxelModel();
  const s = 0.08;
  // 主街面
  m.box(-4.5, 0, -1.5, 4.5, 0.08, 2.5, 'stonePath');
  // 两侧铺面
  const shops = [
    { x: -3.6, z: -0.8, w: 1.6, d: 1.4 },
    { x: -1.2, z: -1.0, w: 1.8, d: 1.5 },
    { x: 1.2, z: -0.9, w: 1.7, d: 1.4 },
    { x: 3.2, z: -0.7, w: 1.5, d: 1.3 },
    { x: -3.0, z: 1.0, w: 1.5, d: 1.2 },
    { x: 0.0, z: 1.2, w: 2.0, d: 1.3 },
    { x: 2.8, z: 1.1, w: 1.6, d: 1.2 },
  ];
  for (const sh of shops) {
    const h = 1.2 + (Math.abs(sh.x) % 3) * 0.25;
    m.box(sh.x - sh.w / 2, 0.08, sh.z - sh.d / 2, sh.x + sh.w / 2, h, sh.z + sh.d / 2, 'wallWhite');
    // 灰瓦屋顶
    m.box(sh.x - sh.w / 2 - s * 2, h, sh.z - sh.d / 2 - s, sh.x + sh.w / 2 + s * 2, h + 0.28, sh.z + sh.d / 2 + s, 'roofGrey');
    m.box(sh.x - sh.w / 2 - s, h + 0.28, sh.z - sh.d / 2, sh.x + sh.w / 2 + s, h + 0.42, sh.z + sh.d / 2, 'roofDark');
    // 木门
    m.box(sh.x - 0.18, 0.08, sh.z + sh.d / 2 - s, sh.x + 0.18, 0.72, sh.z + sh.d / 2 + s, 'woodBrown');
    // 红灯笼
    m.vox(sh.x - sh.w / 2 + s, h - 0.1, sh.z + sh.d / 2 + s * 2, s * 1.4, 'lanternRed');
    m.vox(sh.x + sh.w / 2 - s * 2, h - 0.1, sh.z + sh.d / 2 + s * 2, s * 1.4, 'lanternGlow');
  }
  // 中央院落与大树
  m.box(-1.2, 0.08, 2.6, 1.2, 0.08, 4.2, 'grass');
  m.col(0, 0.08, 3.4, 0.18, 1.1, 0.18, 'trunk');
  for (let i = 0; i < 20; i += 1) {
    const a = (i / 20) * Math.PI * 2;
    const r = 0.5 + (i % 4) * 0.12;
    m.vox(Math.cos(a) * r, 1.0 + (i % 3) * 0.15, 3.4 + Math.sin(a) * r, s * 2.2, i % 2 ? 'leaf' : 'grassLight');
  }
  return m;
}

function buildPaifang() {
  const m = new VoxelModel();
  const s = 0.08;
  m.box(-2.2, 0, -0.35, 2.2, 0.25, 0.35, 'stone');
  // 四柱
  for (const x of [-1.7, 1.7]) {
    m.box(x - 0.12, 0.25, -0.12, x + 0.12, 2.35, 0.12, 'woodDark');
    m.box(x - 0.16, 2.35, -0.16, x + 0.16, 2.55, 0.16, 'vermilion');
  }
  // 额枋与牌匾
  m.box(-2.0, 1.85, -0.22, 2.0, 2.05, 0.22, 'woodBrown');
  m.box(-0.55, 1.95, -0.08, 0.55, 2.18, 0.08, 'vermilion');
  m.box(-0.45, 2.0, -0.04, 0.45, 2.14, 0.04, 'lanternGlow');
  // 顶层牌楼
  m.box(-2.3, 2.55, -0.28, 2.3, 2.75, 0.28, 'roofGrey');
  m.box(-2.5, 2.75, -0.38, 2.5, 2.95, 0.38, 'roofDark');
  return m;
}

function buildStoneBridge() {
  const m = new VoxelModel();
  m.box(-2.5, 0, -0.55, 2.5, 0.2, 0.55, 'stone');
  m.box(-2.0, 0.2, -0.48, -1.2, 0.75, 0.48, 'stoneDark');
  m.box(1.2, 0.2, -0.48, 2.0, 0.75, 0.48, 'stoneDark');
  m.box(-0.35, 0.2, -0.48, 0.35, 0.55, 0.48, 'stone');
  m.box(-2.6, 0.75, -0.65, 2.6, 0.95, 0.65, 'stonePath');
  for (let x = -2.4; x <= 2.4; x += 0.35) {
    m.box(x - 0.04, 0.95, -0.62, x + 0.04, 1.25, -0.52, 'stone');
    m.box(x - 0.04, 0.95, 0.52, x + 0.04, 1.25, 0.62, 'stone');
  }
  m.box(-2.6, 1.25, -0.65, 2.6, 1.35, 0.65, 'stoneDark');
  return m;
}

function buildTigerSpring() {
  const m = new VoxelModel();
  const s = 0.08;
  m.box(-2.0, 0, -0.65, 2.0, 2.6, 0.2, 'stoneDark');
  m.box(-1.6, 1.2, -0.55, 1.6, 2.8, 0.35, 'stone');
  m.box(-1.1, 1.6, 0.0, 1.1, 2.6, 1.2, 'tigerOrange');
  m.box(-0.9, 1.8, 1.15, 0.9, 2.4, 1.35, 'tigerOrange');
  for (let i = 0; i < 5; i += 1) {
    m.vox(-0.7 + i * 0.32, 2.0 + (i % 2) * 0.08, 1.26, s * 1.4, 'tigerBlack');
  }
  m.vox(-0.35, 2.15, 1.32, s * 1.5, 'tigerWhite');
  m.vox(0.25, 2.15, 1.32, s * 1.5, 'tigerWhite');
  m.vox(-0.08, 1.95, 1.34, s * 1.8, 'tigerBlack');
  m.box(-0.12, 0.5, 1.35, 0.12, 1.55, 1.55, 'waterLight');
  m.box(-0.08, 0.85, 1.52, 0.08, 1.2, 1.68, 'water');
  m.box(-1.5, 0, 1.2, 1.5, 0.25, 2.4, 'stone');
  m.box(-1.2, 0.05, 1.35, 1.2, 0.18, 2.2, 'water');
  return m;
}

function buildRockery() {
  const m = new VoxelModel();
  const pts = [
    [0, 0, 0, 1.1], [-0.8, 0.4, 0.5, 0.9], [0.7, 0.8, -0.3, 1.0], [-0.5, 1.3, -0.2, 0.85], [0.4, 1.9, 0.35, 0.75],
  ];
  for (const [cx, cy, cz, r] of pts) {
    m.col(cx, cy, cz, r * 1.6, r * 1.1, r * 1.4, 'stoneDark');
    m.col(cx, cy + r * 0.55, cz, r * 1.2, r * 0.55, r * 1.0, 'stone');
  }
  m.box(-0.15, 1.2, 0.45, 0.15, 2.2, 0.65, 'waterLight');
  m.box(-0.12, 1.7, -0.55, 0.12, 2.65, -0.35, 'stone');
  m.box(-0.1, 2.0, -0.53, 0.1, 2.45, -0.37, 'tabletBlue');
  return m;
}

function buildWillow() {
  const m = new VoxelModel();
  const s = 0.12;
  m.col(0, 0, 0, 0.16, 1.2, 0.16, 'trunk');
  for (let i = 0; i < 14; i += 1) {
    const a = (i / 14) * Math.PI * 2;
    m.box(Math.cos(a) * 0.12 - s / 2, 0.55, Math.sin(a) * 0.12 - s / 2, Math.cos(a) * 0.12 + s / 2, 1.05, Math.sin(a) * 0.12 + s / 2, 'willow');
    m.box(Math.cos(a) * 0.28 - s / 2, 0.15, Math.sin(a) * 0.28 + 0.35 - s / 2, Math.cos(a) * 0.28 + s / 2, 0.85, Math.sin(a) * 0.28 + 0.35 + s / 2, 'willowLight');
    m.box(Math.cos(a) * 0.05 - s / 3, 0.05, Math.sin(a) * 0.05 + 0.55 - s / 3, Math.cos(a) * 0.05 + s / 3, 0.55, Math.sin(a) * 0.05 + 0.55 + s / 3, 'willowLight');
  }
  return m;
}

function buildPineCluster() {
  const m = new VoxelModel();
  for (const [ox, oz, h] of [
    [0, 0, 1.8], [-0.5, 0.4, 1.4], [0.45, -0.35, 1.5],
  ]) {
    m.col(ox, 0, oz, 0.14, h * 0.35, 0.14, 'trunk');
    m.col(ox, h * 0.28, oz, 0.95, 0.42, 0.95, 'pine');
    m.col(ox, h * 0.58, oz, 0.72, 0.38, 0.72, 'pineLight');
    m.col(ox, h * 0.86, oz, 0.48, 0.32, 0.48, 'pine');
  }
  return m;
}

function buildBoat() {
  const m = new VoxelModel();
  const s = 0.06;
  m.box(-0.75, 0.08, -0.22, 0.75, 0.18, 0.22, 'boatWood');
  m.box(-0.55, 0.18, -0.18, 0.55, 0.28, 0.18, 'boatWood');
  // 棚顶
  for (let x = -0.45; x <= 0.45; x += s * 2) {
    m.box(x - s, 0.55, -0.16, x + s, 0.62, 0.16, 'boatCover');
  }
  m.box(-0.48, 0.28, -0.16, -0.42, 0.58, 0.16, 'boatWood');
  m.box(0.42, 0.28, -0.16, 0.48, 0.58, 0.16, 'boatWood');
  return m;
}

function buildLilyCluster() {
  const m = new VoxelModel();
  const s = 0.05;
  for (const [x, z] of [[0, 0], [0.35, 0.2], [-0.3, 0.25], [0.15, -0.3], [-0.2, -0.15]]) {
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      m.vox(x + Math.cos(a) * 0.12, 0, z + Math.sin(a) * 0.12, s, 'lotus');
    }
    m.vox(x, 0.04, z, s * 1.2, 'lotusPink');
  }
  return m;
}

function buildLanternString() {
  const m = new VoxelModel();
  const s = 0.06;
  for (let i = 0; i < 5; i += 1) {
    m.vox(i * 0.35 - 0.7, 0.5, 0, s * 0.4, 'woodBrown');
    m.vox(i * 0.35 - 0.7, 0.2, 0, s * 1.6, i % 2 ? 'lanternRed' : 'lanternGlow');
  }
  return m;
}

const MODELS = [
  { file: 'Buildings/voxel-jinan-pagoda.gltf', build: buildPagoda, gen: 'EarthGuardian Jinan pagoda voxels' },
  { file: 'Buildings/voxel-jinan-street-block.gltf', build: buildStreetBlock, gen: 'EarthGuardian Jinan street block voxels' },
  { file: 'Buildings/voxel-jinan-paifang.gltf', build: buildPaifang, gen: 'EarthGuardian Jinan paifang voxels' },
  { file: 'Buildings/voxel-jinan-stone-bridge.gltf', build: buildStoneBridge, gen: 'EarthGuardian Jinan stone bridge voxels' },
  { file: 'Buildings/voxel-jinan-tiger-spring.gltf', build: buildTigerSpring, gen: 'EarthGuardian Jinan tiger spring voxels' },
  { file: 'Props/voxel-jinan-rockery.gltf', build: buildRockery, gen: 'EarthGuardian Jinan rockery voxels' },
  { file: 'Props/voxel-jinan-willow.gltf', build: buildWillow, gen: 'EarthGuardian Jinan willow voxels' },
  { file: 'Props/voxel-jinan-pine-cluster.gltf', build: buildPineCluster, gen: 'EarthGuardian Jinan pine cluster voxels' },
  { file: 'Props/voxel-jinan-boat.gltf', build: buildBoat, gen: 'EarthGuardian Jinan boat voxels' },
  { file: 'Props/voxel-jinan-lily-cluster.gltf', build: buildLilyCluster, gen: 'EarthGuardian Jinan lily cluster voxels' },
  { file: 'Props/voxel-jinan-lantern-string.gltf', build: buildLanternString, gen: 'EarthGuardian Jinan lantern string voxels' },
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
  actor('jn-voxel-pagoda-west', '体素双塔-西', '/GameModels/Buildings/voxel-jinan-pagoda.gltf', 8, 4, { scale: 1.08 }),
  actor('jn-voxel-pagoda-east', '体素双塔-东', '/GameModels/Buildings/voxel-jinan-pagoda.gltf', 11, 4, { scale: 1.08 }),
  actor('jn-voxel-street-main', '体素曲栈街市', '/GameModels/Buildings/voxel-jinan-street-block.gltf', 13, 12, { scale: 1.05 }),
  actor('jn-voxel-paifang', '体素泉港牌楼', '/GameModels/Buildings/voxel-jinan-paifang.gltf', 13, 15, { scale: 0.92 }),
  actor('jn-voxel-bridge', '体素拱石桥', '/GameModels/Buildings/voxel-jinan-stone-bridge.gltf', 19, 8, { scale: 1.0, rotation: 88 }),
  actor('jn-voxel-tiger', '体素虎头泉', '/GameModels/Buildings/voxel-jinan-tiger-spring.gltf', 28, 6, { scale: 1.15 }),
  actor('jn-voxel-rockery', '体素假山瀑布', '/GameModels/Props/voxel-jinan-rockery.gltf', 25, 5, { scale: 1.12 }),
  actor('jn-voxel-willow-n', '体素垂柳-北', '/GameModels/Props/voxel-jinan-willow.gltf', 7, 7, { scale: 1.1 }),
  actor('jn-voxel-willow-s', '体素垂柳-南', '/GameModels/Props/voxel-jinan-willow.gltf', 17, 6, { scale: 0.95 }),
  actor('jn-voxel-willow-e', '体素垂柳-东', '/GameModels/Props/voxel-jinan-willow.gltf', 22, 7, { scale: 1.05 }),
  actor('jn-voxel-pine-rock', '体素松石-岩区', '/GameModels/Props/voxel-jinan-pine-cluster.gltf', 27, 4, { scale: 1.0 }),
  actor('jn-voxel-pine-garden', '体素松石-园林', '/GameModels/Props/voxel-jinan-pine-cluster.gltf', 30, 8, { scale: 0.88 }),
  actor('jn-voxel-boat-1', '体素乌篷船', '/GameModels/Props/voxel-jinan-boat.gltf', 14, 7, { scale: 1.15, rotation: -12 }),
  actor('jn-voxel-boat-2', '体素乌篷船', '/GameModels/Props/voxel-jinan-boat.gltf', 16, 8, { scale: 1.0, rotation: 18 }),
  actor('jn-voxel-boat-3', '体素乌篷船', '/GameModels/Props/voxel-jinan-boat.gltf', 15, 6, { scale: 0.9, rotation: 5 }),
  actor('jn-voxel-lily-1', '体素荷塘睡莲', '/GameModels/Props/voxel-jinan-lily-cluster.gltf', 13, 7, { scale: 1.2 }),
  actor('jn-voxel-lily-2', '体素荷塘睡莲', '/GameModels/Props/voxel-jinan-lily-cluster.gltf', 17, 7, { scale: 1.0 }),
  actor('jn-voxel-lantern-1', '体素红灯串', '/GameModels/Props/voxel-jinan-lantern-string.gltf', 10, 13, { scale: 1.1 }),
  actor('jn-voxel-lantern-2', '体素红灯串', '/GameModels/Props/voxel-jinan-lantern-string.gltf', 16, 13, { scale: 1.0, rotation: 6 }),
];

function main() {
  console.log('Generating Jinan voxel models...');
  for (const spec of MODELS) {
    const out = path.join(root, 'public', 'GameModels', spec.file);
    const info = spec.build().writeGltf(out, spec.gen);
    console.log(`  ${spec.file} — ${info.mats} mats, ${info.bytes} bytes`);
  }

  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const level = state.levels.find((l) => l.id === 'city-cn-370100');
  if (!level) throw new Error('Level city-cn-370100 not found');

  level.name = '济南·泉港曲栈';
  level.description =
    '参考济南泉港曲栈微缩沙盘重制的 3D 体素场景：双塔、曲栈街市、泉池乌篷、拱石桥、虎头泉、假山瀑布、垂柳与松石共同构成可继续编辑的关卡底景。';
  level.environment = {
    ...level.environment,
    lightingProfile: 'warm-voxel-daylight',
    entryScene: 'jinan-voxel-diorama',
    notes: '已移除浮岛底座、边框和济南默认底图；仅保留体素地标 Actor，保留现有道路与塔防玩法数据。',
  };
  level.map.grid = { cols: 36, rows: 20, tileSize: 2 };
  level.map.theme = {
    ...level.map.theme,
    ground: '#6a8f72',
    groundAlt: '#5a7d62',
    road: '#8a9488',
    path: '#8a9488',
    obstacle: '#7a7568',
    accent: '#c49a6c',
    fog: '#4a6058',
    boardTextureUrl: '',
    hoverColorOk: '#7ea08f',
    hoverColorBad: '#c28e89',
  };
  level.map.explorationLayout.theme = { ...level.map.theme };
  level.map.explorationLayout.grid = { ...level.map.grid };
  level.map.actors = ACTORS;
  level.map.boardImageLayers = [];
  level.map.geo = { ...level.map.geo, enabled: false };
  level.extensions = {
    ...(level.extensions || {}),
    sceneRemake: {
      style: 'refined-3d-voxel',
      reference: 'jinan-quangang-quzhan-diorama',
      disableJinanRegionalFlatPreset: true,
      note: '泉城曲栈体素微缩：双塔、街市、泉池、虎头泉与假山；移除地形底座与默认底图，保留 14 格道路与既有波次。',
    },
  };

  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  console.log(`Updated level ${level.id} with ${ACTORS.length} actors.`);
}

main();
