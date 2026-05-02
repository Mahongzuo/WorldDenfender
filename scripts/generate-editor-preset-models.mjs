/**
 * 生成关卡编辑器「模型资源库」用的占位预设（建筑 / 地形·阻挡·地板）。
 * 使用 Wavefront OBJ，避免 Node 环境下 GLTFExporter 依赖浏览器 API。
 * 运行：node scripts/generate-editor-preset-models.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const buildingsDir = path.join(root, "public", "GameModels", "Buildings");
const propsDir = path.join(root, "public", "GameModels", "Props");

/**
 * @param {Array<[number, number, number]>} vertices
 * @param {Array<[number, number, number]>} faces - triples of 0-based vertex indices
 */
function buildObj(name, vertices, faces) {
  let s = `# Earth Guardian · editor preset\no ${name}\n`;
  for (const [x, y, z] of vertices) {
    s += `v ${x.toFixed(5)} ${y.toFixed(5)} ${z.toFixed(5)}\n`;
  }
  for (const [a, b, c] of faces) {
    s += `f ${a + 1} ${b + 1} ${c + 1}\n`;
  }
  return s;
}

/** Axis-aligned box [x0,x1]×[y0,y1]×[z0,z1] → 8 verts + 12 tri faces, verts appended to arrays */
function pushBox(vertices, faces, x0, y0, z0, x1, y1, z1) {
  const base = vertices.length;
  vertices.push(
    [x0, y0, z0],
    [x1, y0, z0],
    [x1, y1, z0],
    [x0, y1, z0],
    [x0, y0, z1],
    [x1, y0, z1],
    [x1, y1, z1],
    [x0, y1, z1],
  );
  const quad = [
    [0, 2, 1],
    [0, 3, 2],
    [4, 5, 6],
    [4, 6, 7],
    [0, 1, 5],
    [0, 5, 4],
    [1, 2, 6],
    [1, 6, 5],
    [2, 3, 7],
    [2, 7, 6],
    [3, 0, 4],
    [3, 4, 7],
  ];
  for (const [a, b, c] of quad) {
    faces.push([base + a, base + b, base + c]);
  }
}

async function writeObj(absPath, name, boxes) {
  const vertices = [];
  const faces = [];
  for (const b of boxes) {
    pushBox(vertices, faces, b.x0, b.y0, b.z0, b.x1, b.y1, b.z1);
  }
  await mkdir(path.dirname(absPath), { recursive: true });
  await writeFile(absPath, buildObj(name, vertices, faces), "utf8");
  console.log("wrote", path.relative(root, absPath));
}

/** Cylinder along Y from y0 to y1, center (cx, 0, cz), r0 bottom r1 top — low-poly */
function pushCylinderY(vertices, faces, cx, cz, y0, y1, r0, r1, segments) {
  const base = vertices.length;
  const n = Math.max(6, segments | 0);
  for (let i = 0; i < n; i += 1) {
    const t = (i / n) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    vertices.push([cx + r0 * c, y0, cz + r0 * s]);
    vertices.push([cx + r1 * c, y1, cz + r1 * s]);
  }
  for (let i = 0; i < n; i += 1) {
    const i0 = i * 2;
    const i1 = ((i + 1) % n) * 2;
    const a = base + i0;
    const b = base + i0 + 1;
    const c = base + i1 + 1;
    const d = base + i1;
    faces.push([a, c, b]);
    faces.push([a, d, c]);
  }
}

async function writeObjWithCylinder(absPath, name, boxes, cylinders) {
  const vertices = [];
  const faces = [];
  for (const b of boxes) {
    pushBox(vertices, faces, b.x0, b.y0, b.z0, b.x1, b.y1, b.z1);
  }
  for (const c of cylinders) {
    pushCylinderY(vertices, faces, c.cx, c.cz, c.y0, c.y1, c.r0, c.r1, c.seg ?? 16);
  }
  await mkdir(path.dirname(absPath), { recursive: true });
  await writeFile(absPath, buildObj(name, vertices, faces), "utf8");
  console.log("wrote", path.relative(root, absPath));
}

async function main() {
  /* 建筑：BOX 为 { x0,y0,z0,x1,y1,z1 } */
  await writeObj(path.join(buildingsDir, "preset-building-office.obj"), "preset-building-office", [
    { x0: -0.6, y0: 0, z0: -0.6, x1: 0.6, y1: 3.4, z1: 0.6 },
  ]);

  await writeObj(path.join(buildingsDir, "preset-building-factory.obj"), "preset-building-factory", [
    { x0: -1.9, y0: 0, z0: -1.4, x1: 1.9, y1: 1.7, z1: 1.4 },
    { x0: 1.15, y0: 0, z0: -1.15, x1: 1.6, y1: 2.4, z1: -0.7 },
  ]);

  await writeObjWithCylinder(
    path.join(buildingsDir, "preset-building-nuclear.obj"),
    "preset-building-nuclear",
    [{ x0: -1.55, y0: 0, z0: -0.75, x1: -0.05, y1: 2.1, z1: 0.75 }],
    [{ cx: 1.0, cz: 0, y0: 0, y1: 2.4, r0: 1.35, r1: 1.1, seg: 18 }],
  );

  await writeObj(path.join(buildingsDir, "preset-building-warehouse.obj"), "preset-building-warehouse", [
    { x0: -1.6, y0: 0, z0: -2.0, x1: 1.6, y1: 2.0, z1: 2.0 },
  ]);

  await writeObj(path.join(buildingsDir, "preset-building-tower.obj"), "preset-building-tower", [
    { x0: -1.1, y0: 0, z0: -1.1, x1: 1.1, y1: 8.0, z1: 1.1 },
    { x0: -1.3, y0: 8.0, z0: -1.3, x1: 1.3, y1: 8.5, z1: 1.3 },
  ]);

  await writeObj(path.join(propsDir, "preset-terrain-floor-grass.obj"), "preset-terrain-floor-grass", [
    { x0: -1.0, y0: 0, z0: -1.0, x1: 1.0, y1: 0.12, z1: 1.0 },
  ]);

  await writeObj(path.join(propsDir, "preset-terrain-block-rock.obj"), "preset-terrain-block-rock", [
    { x0: -0.45, y0: 0, z0: -0.45, x1: 0.45, y1: 1.0, z1: 0.45 },
  ]);

  await writeObj(path.join(propsDir, "preset-terrain-ramp.obj"), "preset-terrain-ramp", [
    { x0: -0.9, y0: 0.15, z0: -0.55, x1: 0.9, y1: 0.35, z1: 0.55 },
  ]);

  await writeObj(path.join(propsDir, "preset-terrain-curb.obj"), "preset-terrain-curb", [
    { x0: -0.8, y0: 0, z0: -0.8, x1: 0.8, y1: 0.35, z1: 0.8 },
  ]);

  await writeObj(path.join(propsDir, "preset-terrain-barrier-strip.obj"), "preset-terrain-barrier-strip", [
    { x0: -1.1, y0: 0, z0: -0.18, x1: 1.1, y1: 1.4, z1: 0.18 },
  ]);

  console.log("All preset models (OBJ) generated.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
