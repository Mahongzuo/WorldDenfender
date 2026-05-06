import { Buffer } from "node:buffer";
import { exec, spawn } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { defineConfig, loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loadedEnv = loadEnv(process.env.NODE_ENV === "production" ? "production" : "development", __dirname, "");
const uploadDir = path.resolve(process.cwd(), "public", "uploads");
const publicDir = path.resolve(process.cwd(), "public");
const artsDir = path.resolve(publicDir, "Arts");
const gameModelsDir = path.resolve(publicDir, "GameModels");
const editorConfigFile = path.resolve(__dirname, "Web", "data", "level-editor-state.json");
const runtimeSourceFile = path.resolve(__dirname, "src", "game", "data", "content.ts");
const meshyImageTo3dApiUrl = "https://api.meshy.ai/openapi/v1/image-to-3d";

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-90);
}

function sanitizeProjectSegment(name) {
  const normalized = String(name ?? "")
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return (normalized || "untitled").slice(0, 80);
}

function buildPublicUrl(...segments) {
  return `/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
}

function ensureUniqueFilename(directory, baseName, extension) {
  let serial = 0;
  let fileName = `${baseName}${extension}`;
  while (existsSync(path.join(directory, fileName))) {
    serial += 1;
    fileName = `${baseName}-${String(serial).padStart(3, "0")}${extension}`;
  }
  return fileName;
}

function extractObjectLiteral(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) return "";
  const assignIndex = source.indexOf("=", markerIndex);
  if (assignIndex === -1) return "";
  const start = source.indexOf("{", assignIndex);
  if (start === -1) return "";
  let depth = 0;
  let quote = "";
  let escaping = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaping) {
        escaping = false;
        continue;
      }
      if (char === "\\") {
        escaping = true;
        continue;
      }
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return "";
}

function createRuntimeContentEvalContext() {
  const geoConfigStub = new Proxy(Object.create(null), {
    get() {
      return {};
    },
  });
  return {
    DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID: "",
    CITY_GEO_CONFIG: geoConfigStub,
  };
}

function evaluateObjectLiteral(literal, context = Object.create(null)) {
  return literal ? runInNewContext(`(${literal})`, context) : {};
}

function inferCityCode(aliases) {
  return aliases.find((alias) => /^\d{6}$/.test(String(alias))) || "";
}

function buildRuntimeCityGameplaySeeds(source) {
  const evalContext = createRuntimeContentEvalContext();
  const buildSpecs = evaluateObjectLiteral(extractObjectLiteral(source, "const BUILD_SPECS"), evalContext);
  const cityAliases = evaluateObjectLiteral(extractObjectLiteral(source, "const CITY_EDITOR_ALIASES"), evalContext);
  const cityMap = evaluateObjectLiteral(extractObjectLiteral(source, "const CITY_MAP"), evalContext);
  const seeds = {};

  Object.values(buildSpecs).forEach((spec) => {
    if (!spec || !spec.city) return;
    const aliases = Array.isArray(cityAliases[spec.city]) ? cityAliases[spec.city].map(String) : [];
    const cityCode = inferCityCode(aliases);
    const cityName = String((cityMap[spec.city] && cityMap[spec.city].label) || aliases.find((alias) => /[\u4e00-\u9fa5]/.test(alias) && !/^\d+$/.test(alias)) || spec.city);
    const configKey = cityCode || String(spec.city);
    const imageCandidate = `/Arts/Cards/char_${spec.id}.png`;
    const imagePath = existsSync(path.join(publicDir, "Arts", "Cards", `char_${spec.id}.png`)) ? imageCandidate : "";

    if (!seeds[configKey]) {
      seeds[configKey] = {
        cityCode,
        cityName,
        aliases,
        characters: [],
        skills: [],
        enemies: [],
        items: [],
        updatedAt: "",
      };
    }

    seeds[configKey].characters.push({
      id: String(spec.id || ""),
      name: String(spec.name || spec.id || "未命名角色"),
      summary: String(spec.description || ""),
      tags: [cityName, spec.role, spec.rank].filter(Boolean),
      rarity: String(spec.rank || "common"),
      placement: spec.id === "mine" || spec.id === "qinqiong" ? "road" : "roadside",
      element: String(spec.element || ""),
      functionTags: Array.isArray(spec.functionTags) ? spec.functionTags.map(String) : [],
      effects: Array.isArray(spec.effects) ? spec.effects.map((effect) => String(effect.statusId || "")).filter(Boolean) : [],
      cleanseEffects: [],
      stats: {
        hp: Number(spec.maxHp) || 100,
        attack: Number(spec.damage) || 0,
        cost: Number(spec.cost) || 0,
        range: Number(spec.range || spec.healRange) || 0,
        fireRate: Number(spec.fireRate) || 0,
        healAmount: Number(spec.healAmount) || 0,
        healRange: Number(spec.healRange) || 0,
        splash: Number(spec.splash) || 0,
        maxBlockCount: Number(spec.maxBlockCount) || 0,
      },
      assetRefs: imagePath ? { imagePath } : {},
      cityCode,
      cityName,
      source: "runtime-sync",
    });

    if (spec.activeSkill) {
      seeds[configKey].skills.push({
        id: `${String(spec.id || "skill")}-skill`,
        name: String(spec.activeSkill.name || `${spec.name}技能`),
        summary: String(spec.activeSkill.description || ""),
        tags: [cityName, String(spec.name || "")].filter(Boolean),
        rarity: String(spec.rank || "common"),
        element: String(spec.element || ""),
        functionTags: Array.isArray(spec.functionTags) ? spec.functionTags.map(String) : [],
        effects: Array.isArray(spec.effects) ? spec.effects.map((effect) => String(effect.statusId || "")).filter(Boolean) : [],
        cleanseEffects: [],
        stats: {
          cooldown: Number(spec.activeSkill.cooldown) || 0,
          cost: Number(spec.cost) || 0,
          range: Number(spec.range || spec.healRange) || 0,
          damage: Number(spec.damage || spec.healAmount) || 0,
        },
        assetRefs: imagePath ? { imagePath } : {},
        cityCode,
        cityName,
        source: "runtime-sync",
      });
    }
  });

  return seeds;
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload, null, 2));
}

function resolveVolcArkApiKey() {
  return [
    process.env.VOLCENGINE_ARK_API_KEY,
    loadedEnv.VOLCENGINE_ARK_API_KEY,
    process.env.ARK_API_KEY,
    loadedEnv.ARK_API_KEY,
  ]
    .map((item) => String(item || "").trim())
    .find(Boolean) || "";
}

function resolveMeshyApiKey() {
  return [process.env.MESHY_API_KEY, loadedEnv.MESHY_API_KEY]
    .map((item) => String(item || "").trim())
    .find(Boolean) || "";
}

async function readJsonResponse(response, fallbackMessage) {
  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (_error) {
      payload = {};
    }
  }
  if (!response.ok) {
    throw new Error(String(payload.error || payload.message || fallbackMessage || `Request failed: ${response.status}`));
  }
  return payload;
}

function inferRemoteModelExtension(contentType, assetUrl) {
  const normalizedType = String(contentType || "").toLowerCase();
  const cleanUrl = String(assetUrl || "").split("#")[0].split("?")[0];
  const ext = path.extname(cleanUrl).toLowerCase();
  if ([".glb", ".gltf", ".obj", ".fbx"].includes(ext)) {
    return ext;
  }
  if (normalizedType.includes("model/gltf+json")) return ".gltf";
  if (normalizedType.includes("text/plain")) return ".obj";
  return ".glb";
}

function extractGeneratedImageUrl(payload) {
  if (!payload || typeof payload !== "object") return "";
  const directCandidates = [payload.url, payload.image_url, payload?.output?.url, payload?.result?.url];
  for (const candidate of directCandidates) {
    const value = String(candidate || "").trim();
    if (value) return value;
  }
  if (Array.isArray(payload.data)) {
    for (const item of payload.data) {
      const value = String((item && item.url) || "").trim();
      if (value) return value;
    }
  }
  return "";
}

function inferRemoteImageExtension(contentType, assetUrl) {
  const loweredType = String(contentType || "").toLowerCase();
  if (loweredType.includes("png")) return ".png";
  if (loweredType.includes("webp")) return ".webp";
  if (loweredType.includes("jpeg") || loweredType.includes("jpg")) return ".jpg";
  try {
    const parsed = new URL(String(assetUrl || ""));
    const ext = path.extname(parsed.pathname || "").toLowerCase();
    if (ext === ".png" || ext === ".webp" || ext === ".jpg" || ext === ".jpeg") {
      return ext === ".jpeg" ? ".jpg" : ext;
    }
  } catch {
    // ignore malformed URLs and fall back to png
  }
  return ".png";
}

function gmEntryId(relPathPosix) {
  const s = String(relPathPosix || "").replace(/\\/g, "/");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  const tail = sanitizeName(path.basename(s)).slice(0, 48).toLowerCase() || "model";
  return `gm-${Math.abs(h).toString(36)}-${tail}`;
}

async function collectGameModelEntries(absRoot, publicFolder) {
  const modelExt = /\.(glb|gltf|obj)$/i;
  /** @type {Array<{ id: string; relativePath: string; publicUrl: string; name: string }>} */
  const out = [];

  async function walk(currentAbs, relPosix) {
    let dirents;
    try {
      dirents = await readdir(currentAbs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of dirents) {
      if (ent.name.startsWith(".")) continue;
      const joined = path.join(currentAbs, ent.name);
      const nextRel = relPosix ? `${relPosix}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        await walk(joined, nextRel);
      } else if (modelExt.test(ent.name)) {
        const relToPublicPath = path.relative(publicFolder, joined).replace(/\\/g, "/");
        const segments = relToPublicPath.split("/").filter(Boolean);
        const publicUrl =
          "/" +
          segments.map((segment) => encodeURIComponent(segment)).join("/");
        const stem = path.basename(ent.name, path.extname(ent.name));
        out.push({
          id: gmEntryId(relToPublicPath),
          relativePath: nextRel.replace(/\\/g, "/"),
          publicUrl,
          name: stem,
        });
      }
    }
  }

  await mkdir(absRoot, { recursive: true });
  await walk(absRoot, "");
  out.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return out;
}

const threePackageRoot = path.resolve(__dirname, "node_modules", "three");
const tilesRendererBuildRoot = path.resolve(__dirname, "node_modules", "3d-tiles-renderer", "build");

function contentTypeForVendorFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".js" || ext === ".mjs") return "application/javascript; charset=utf-8";
  if (ext === ".json" || ext === ".map") return "application/json; charset=utf-8";
  if (ext === ".wasm") return "application/wasm";
  return "application/octet-stream";
}

/** 关卡编辑器预览：从 node_modules 提供 3D 依赖，避免 import map 走 CDN 时被断开/拦截 */
function editorPreviewVendorPlugin() {
  return {
    name: "editor-preview-vendor",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        try {
          const pathname = (req.url || "").split("?")[0];
          let absPath = "";
          if (pathname.startsWith("/eg-vendor/three/build/")) {
            const rel = pathname.slice("/eg-vendor/three/build/".length);
            if (rel.includes("..")) return next();
            absPath = path.join(threePackageRoot, "build", decodeURIComponent(rel));
          } else if (pathname.startsWith("/eg-vendor/three/examples/jsm/")) {
            const rel = pathname.slice("/eg-vendor/three/examples/jsm/".length);
            if (rel.includes("..")) return next();
            absPath = path.join(threePackageRoot, "examples", "jsm", decodeURIComponent(rel));
          } else if (pathname.startsWith("/eg-vendor/3d-tiles-renderer/build/")) {
            const rel = pathname.slice("/eg-vendor/3d-tiles-renderer/build/".length);
            if (rel.includes("..")) return next();
            absPath = path.join(tilesRendererBuildRoot, decodeURIComponent(rel));
          } else {
            return next();
          }
          let st;
          try {
            st = statSync(absPath);
          } catch {
            return next();
          }
          if (!st.isFile()) return next();
          res.statusCode = 200;
          res.setHeader("Content-Type", contentTypeForVendorFile(absPath));
          res.setHeader("Cache-Control", "public, max-age=86400");
          const stream = createReadStream(absPath);
          stream.on("error", () => {
            if (!res.writableEnded) next();
          });
          stream.pipe(res);
        } catch {
          next();
        }
      });
    },
    async closeBundle() {
      const distRoot = path.resolve(__dirname, "dist");
      if (!existsSync(distRoot)) return;
      if (!existsSync(threePackageRoot) || !existsSync(tilesRendererBuildRoot)) return;
      const destThreeBuild = path.join(distRoot, "eg-vendor", "three", "build");
      const destThreeJsm = path.join(distRoot, "eg-vendor", "three", "examples", "jsm");
      const destTiles = path.join(distRoot, "eg-vendor", "3d-tiles-renderer", "build");
      await mkdir(destThreeBuild, { recursive: true });
      await cp(path.join(threePackageRoot, "build"), destThreeBuild, { recursive: true });
      await mkdir(path.dirname(destThreeJsm), { recursive: true });
      await cp(path.join(threePackageRoot, "examples", "jsm"), destThreeJsm, { recursive: true });
      await mkdir(path.dirname(destTiles), { recursive: true });
      await cp(tilesRendererBuildRoot, destTiles, { recursive: true });
    },
  };
}

export default defineConfig({
  /** Windows Hyper-V/WSL 等常为 TCP 预留 5097–5196，在此期间默认 5173 会 EACCES */
  server: {
    host: "127.0.0.1",
    port: 5200,
  },
  plugins: [
    editorPreviewVendorPlugin(),
    {
      name: "redirect-root",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === "/" || req.url === "/index.html") {
            res.writeHead(302, { Location: "/Web/map/home.html" });
            res.end();
            return;
          }
          next();
        });
      },
    },
    {
      name: "local-upload-api",
      configureServer(server) {
        server.middlewares.use("/api/app-config", (request, response) => {
          if (request.method !== "GET") {
            sendJson(response, 405, { error: "Method not allowed" });
            return;
          }
          sendJson(response, 200, {
            cesiumIonToken: (process.env.VITE_CESIUM_ION_TOKEN || loadedEnv.VITE_CESIUM_ION_TOKEN || "").trim(),
          });
        });

        server.middlewares.use("/api/upload-model", async (request, response) => {
          if (request.method !== "POST") {
            response.statusCode = 405;
            response.end("Method not allowed");
            return;
          }

          try {
            const body = await readJsonBody(request);
            const originalName = sanitizeName(String(body.name ?? "model.glb"));
            const content = String(body.content ?? "");
            const extension = path.extname(originalName) || ".glb";
            const basename = path.basename(originalName, extension);
            const filename = `${Date.now()}-${basename}${extension}`.toLowerCase();
            const data = Buffer.from(content, "base64");

            await mkdir(uploadDir, { recursive: true });
            await writeFile(path.join(uploadDir, filename), data);

            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify({ url: `/uploads/${filename}` }));
          } catch (error) {
            response.statusCode = 500;
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify({ error: error instanceof Error ? error.message : "upload failed" }));
          }
        });

        server.middlewares.use("/api/editor-assets", async (request, response) => {
          if (request.method !== "POST") {
            sendJson(response, 405, { error: "Method not allowed" });
            return;
          }

          try {
            const body = await readJsonBody(request);
            const originalName = String(body.name ?? "asset.bin");
            const content = String(body.content ?? "");
            const assetType = sanitizeProjectSegment(body.assetType ?? "Misc");
            const resourceKind = sanitizeProjectSegment(body.resourceKind ?? "asset");
            const cityName = sanitizeProjectSegment(body.cityName ?? "未命名城市");
            const cityCode = sanitizeProjectSegment(body.cityCode ?? "");
            const extension = path.extname(originalName) || ".bin";
            const originalBaseName = path.basename(originalName, extension);
            const assetName = sanitizeProjectSegment(body.assetName ?? originalBaseName);
            const directory = path.join(artsDir, assetType, cityName);
            const baseName = sanitizeProjectSegment(`${cityName}-${assetName}`);
            const fileName = ensureUniqueFilename(directory, baseName, extension);
            const absolutePath = path.join(directory, fileName);
            const data = Buffer.from(content, "base64");

            await mkdir(directory, { recursive: true });
            await writeFile(absolutePath, data);

            const relativeSegments = path.relative(publicDir, absolutePath).split(path.sep).filter(Boolean);
            const projectPath = path.posix.join("public", ...relativeSegments);
            const publicUrl = buildPublicUrl(...relativeSegments);

            sendJson(response, 200, {
              id: `${Date.now()}-${sanitizeName(`${cityCode || cityName}-${resourceKind}-${assetName}`)}`,
              name: assetName,
              assetType,
              resourceKind,
              cityCode,
              cityName,
              fileName,
              projectPath,
              publicUrl,
            });
          } catch (error) {
            sendJson(response, 500, {
              error: error instanceof Error ? error.message : "failed to save editor asset",
            });
          }
        });

        server.middlewares.use("/api/generate-board-image", async (request, response) => {
          if (request.method !== "POST") {
            sendJson(response, 405, { error: "Method not allowed" });
            return;
          }

          try {
            const apiKey = resolveVolcArkApiKey();
            if (!apiKey) {
              sendJson(response, 400, {
                error: "Missing VOLCENGINE_ARK_API_KEY. Please add it to .env.local before generating board images.",
              });
              return;
            }

            const body = await readJsonBody(request);
            const prompt = String(body.prompt ?? "").trim();
            if (!prompt) {
              sendJson(response, 400, { error: "Prompt is required" });
              return;
            }

            const cityName = sanitizeProjectSegment(body.cityName ?? body.levelName ?? "未命名城市");
            const cityCode = sanitizeProjectSegment(body.cityCode ?? "");
            const levelName = sanitizeProjectSegment(body.levelName ?? cityName);
            const scope = String(body.scope ?? "defense") === "explore" ? "explore" : "defense";
            const model = String(
              process.env.VOLCENGINE_ARK_IMAGE_MODEL ||
                loadedEnv.VOLCENGINE_ARK_IMAGE_MODEL ||
                "doubao-seedream-5-0-260128",
            ).trim();

            const arkResponse = await fetch("https://ark.cn-beijing.volces.com/api/v3/images/generations", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model,
                prompt,
                sequential_image_generation: "disabled",
                response_format: "url",
                size: "2K",
                stream: false,
                watermark: true,
              }),
            });

            const arkText = await arkResponse.text();
            let arkPayload = {};
            try {
              arkPayload = arkText ? JSON.parse(arkText) : {};
            } catch {
              throw new Error(`Ark returned non-JSON response: ${arkText.slice(0, 240)}`);
            }
            if (!arkResponse.ok) {
              throw new Error(String(arkPayload.error?.message || arkPayload.message || arkText || "image generation failed"));
            }

            const remoteUrl = extractGeneratedImageUrl(arkPayload);
            if (!remoteUrl) {
              throw new Error("Ark did not return an image URL");
            }

            const remoteImageResponse = await fetch(remoteUrl);
            if (!remoteImageResponse.ok) {
              throw new Error(`Failed to download generated image: ${remoteImageResponse.status}`);
            }
            const extension = inferRemoteImageExtension(remoteImageResponse.headers.get("content-type"), remoteUrl);
            const assetType = "Maps";
            const resourceKind = "board-image";
            const directory = path.join(artsDir, assetType, cityName);
            const assetName = sanitizeProjectSegment(`${levelName}-${scope}-board`);
            const baseName = sanitizeProjectSegment(`${cityName}-${assetName}`);
            const fileName = ensureUniqueFilename(directory, baseName, extension);
            const absolutePath = path.join(directory, fileName);

            await mkdir(directory, { recursive: true });
            await writeFile(absolutePath, Buffer.from(await remoteImageResponse.arrayBuffer()));

            const relativeSegments = path.relative(publicDir, absolutePath).split(path.sep).filter(Boolean);
            const projectPath = path.posix.join("public", ...relativeSegments);
            const publicUrl = buildPublicUrl(...relativeSegments);

            sendJson(response, 200, {
              id: `${Date.now()}-${sanitizeName(`${cityCode || cityName}-board-image-${assetName}`)}`,
              name: assetName,
              assetType,
              resourceKind,
              cityCode,
              cityName,
              fileName,
              model,
              prompt,
              remoteUrl,
              projectPath,
              publicUrl,
            });
          } catch (error) {
            sendJson(response, 500, {
              error: error instanceof Error ? error.message : "failed to generate board image",
            });
          }
        });

        /** 在系统文件管理器中定位 public 下的文件（开发机本地体验） */
        server.middlewares.use("/api/reveal-project-path", async (request, response) => {
          if (request.method !== "POST") {
            sendJson(response, 405, { error: "Method not allowed" });
            return;
          }
          try {
            const body = await readJsonBody(request);
            const raw = String(body.projectPath ?? "")
              .trim()
              .replace(/\\/g, "/");
            if (!raw || raw.includes("..")) {
              sendJson(response, 400, { error: "Invalid path" });
              return;
            }
            const cwd = process.cwd();
            const publicRoot = path.resolve(cwd, "public");
            const rel = raw.replace(/^\/+/, "");
            if (!/^public\//i.test(rel)) {
              sendJson(response, 400, { error: "Path must be under public/" });
              return;
            }
            const relNorm = rel.split("/").join(path.sep);
            const abs = path.normalize(path.resolve(cwd, relNorm));
            const relFromPublic = path.relative(publicRoot, abs);
            if (relFromPublic.startsWith("..") || path.isAbsolute(relFromPublic)) {
              sendJson(response, 400, { error: "Path outside public/" });
              return;
            }
            if (!existsSync(abs)) {
              sendJson(response, 404, {
                error: "File not found",
                absolutePath: abs,
              });
              return;
            }
            const platform = process.platform;
            const isDirectory = statSync(abs).isDirectory();

            /** Windows：explorer /select 必须写成 “/select,\"路径\””，且不宜用 execFile 等待退出（易判为失败） */
            if (platform === "win32") {
              const forCmd = abs.replace(/"/g, '""');
              if (isDirectory) {
                exec(`explorer.exe "${forCmd}"`, { windowsHide: true }, () => {});
              } else {
                exec(`explorer.exe /select,"${forCmd}"`, { windowsHide: true }, () => {});
              }
            } else if (platform === "darwin") {
              spawn("open", isDirectory ? [abs] : ["-R", abs], {
                detached: true,
                stdio: "ignore",
                windowsHide: true,
              }).unref();
            } else {
              spawn("xdg-open", [isDirectory ? abs : path.dirname(abs)], {
                detached: true,
                stdio: "ignore",
                windowsHide: true,
              }).unref();
            }
            sendJson(response, 200, { ok: true, absolutePath: abs });
          } catch (error) {
            sendJson(response, 500, {
              error: error instanceof Error ? error.message : "reveal failed",
            });
          }
        });

        server.middlewares.use("/api/game-models/catalog", async (request, response) => {
          if (request.method !== "GET") {
            sendJson(response, 405, { error: "Method not allowed" });
            return;
          }

          try {
            const entries = await collectGameModelEntries(gameModelsDir, publicDir);
            sendJson(response, 200, {
              root: "/GameModels",
              entries,
            });
          } catch (error) {
            sendJson(response, 500, {
              error: error instanceof Error ? error.message : "catalog failed",
              root: "/GameModels",
              entries: [],
            });
          }
        });

        server.middlewares.use("/api/meshy/image-to-3d", async (request, response) => {
          const relativePath = String(request.url || "/").split("?")[0] || "/";
          const meshyApiKey = resolveMeshyApiKey();
          if (!meshyApiKey) {
            sendJson(response, 500, { error: "Missing MESHY_API_KEY in .env.local or environment" });
            return;
          }

          if (request.method === "POST" && (relativePath === "/" || relativePath === "")) {
            try {
              const body = await readJsonBody(request);
              const imageDataUrl = String(body.imageDataUrl ?? "").trim();
              const nameHint = sanitizeProjectSegment(String(body.nameHint ?? "meshy-model"));
              if (!/^data:image\//i.test(imageDataUrl) && !/^https?:\/\//i.test(imageDataUrl)) {
                sendJson(response, 400, { error: "imageDataUrl must be a data:image URL or remote image URL" });
                return;
              }
              const payload = await readJsonResponse(
                await fetch(meshyImageTo3dApiUrl, {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${meshyApiKey}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    image_url: imageDataUrl,
                    name: nameHint,
                  }),
                }),
                "Failed to create Meshy image-to-3D task"
              );
              const taskId = String(payload.result ?? payload.id ?? "").trim();
              if (!taskId) {
                sendJson(response, 502, { error: "Meshy did not return a task id" });
                return;
              }
              sendJson(response, 200, {
                taskId,
                status: String(payload.status || "PENDING"),
              });
            } catch (error) {
              sendJson(response, 500, {
                error: error instanceof Error ? error.message : "failed to create Meshy task",
              });
            }
            return;
          }

          if (request.method === "POST" && relativePath.replace(/\/+$/g, "") === "/import") {
            try {
              const body = await readJsonBody(request);
              const taskId = String(body.taskId ?? "").trim();
              if (!taskId || /\//.test(taskId)) {
                sendJson(response, 400, { error: "Invalid Meshy task id" });
                return;
              }
              const taskPayload = await readJsonResponse(
                await fetch(`${meshyImageTo3dApiUrl}/${encodeURIComponent(taskId)}`, {
                  headers: { Authorization: `Bearer ${meshyApiKey}` },
                }),
                "Failed to retrieve Meshy task"
              );
              const taskStatus = String(taskPayload.status || "").toUpperCase();
              const modelUrl = String(taskPayload?.model_urls?.glb || taskPayload?.model_urls?.gltf || "").trim();
              if (taskStatus !== "SUCCEEDED" && taskStatus !== "COMPLETED") {
                sendJson(response, 409, {
                  error: "Meshy task is not ready for import",
                  status: taskStatus || "PENDING",
                });
                return;
              }
              if (!modelUrl) {
                sendJson(response, 502, { error: "Meshy task succeeded but no downloadable model URL was returned" });
                return;
              }
              const remoteModelResponse = await fetch(modelUrl);
              if (!remoteModelResponse.ok) {
                sendJson(response, 502, { error: `Failed to download Meshy model: ${remoteModelResponse.status}` });
                return;
              }
              const extension = inferRemoteModelExtension(remoteModelResponse.headers.get("content-type"), modelUrl);
              const baseName = sanitizeProjectSegment(String(body.nameHint ?? `meshy-${taskId.slice(0, 8)}`));
              let subRaw = String(body.subdirectory ?? "")
                .replace(/\\/g, "/")
                .replace(/^\/+|\/+$/g, "");
              const subSegments = subRaw
                .split("/")
                .map((segment) => sanitizeProjectSegment(segment))
                .filter(Boolean);
              let targetDir = gameModelsDir;
              for (const segment of subSegments) {
                targetDir = path.join(targetDir, segment);
              }
              await mkdir(targetDir, { recursive: true });
              const fileName = ensureUniqueFilename(targetDir, baseName || "meshy-model", extension);
              const absolutePath = path.join(targetDir, fileName);
              await writeFile(absolutePath, Buffer.from(await remoteModelResponse.arrayBuffer()));
              const relativeSegments = path.relative(publicDir, absolutePath).split(path.sep).filter(Boolean);
              const projectPath = path.posix.join("public", ...relativeSegments);
              const publicUrl = buildPublicUrl(...relativeSegments);
              sendJson(response, 200, {
                taskId,
                fileName,
                projectPath,
                publicUrl,
                relativePath: relativeSegments.slice(1).join("/"),
                modelUrl,
                thumbnailUrl: String(taskPayload.thumbnail_url || ""),
              });
            } catch (error) {
              sendJson(response, 500, {
                error: error instanceof Error ? error.message : "failed to import Meshy model",
              });
            }
            return;
          }

          if (request.method === "GET") {
            const taskId = decodeURIComponent(relativePath.replace(/^\/+|\/+$/g, ""));
            if (!taskId || /\//.test(taskId) || taskId === "import") {
              sendJson(response, 400, { error: "Invalid Meshy task id" });
              return;
            }
            try {
              const payload = await readJsonResponse(
                await fetch(`${meshyImageTo3dApiUrl}/${encodeURIComponent(taskId)}`, {
                  headers: { Authorization: `Bearer ${meshyApiKey}` },
                }),
                "Failed to retrieve Meshy task"
              );
              sendJson(response, 200, {
                taskId,
                status: String(payload.status || ""),
                progress: payload.progress,
                thumbnailUrl: String(payload.thumbnail_url || ""),
                modelUrl: String(payload?.model_urls?.glb || payload?.model_urls?.gltf || ""),
                taskError: payload.task_error || null,
              });
            } catch (error) {
              sendJson(response, 500, {
                error: error instanceof Error ? error.message : "failed to retrieve Meshy task",
              });
            }
            return;
          }

          sendJson(response, 405, { error: "Method not allowed" });
        });

        server.middlewares.use("/api/game-models/upload", async (request, response) => {
          if (request.method !== "POST") {
            sendJson(response, 405, { error: "Method not allowed" });
            return;
          }

          try {
            const body = await readJsonBody(request);
            const originalName = sanitizeName(String(body.name ?? "model.glb"));
            const extension = path.extname(originalName) || ".glb";
            let basenameStem = sanitizeName(path.basename(originalName, extension));
            if (!basenameStem) {
              basenameStem = "model";
            }
            let subRaw = String(body.subdirectory ?? "")
              .replace(/\\/g, "/")
              .replace(/^\/+|\/+$/g, "");
            const subSegments = subRaw
              .split("/")
              .map((segment) => sanitizeProjectSegment(segment))
              .filter(Boolean);
            /** @type {string} */
            let targetDir = gameModelsDir;
            for (const segment of subSegments) {
              targetDir = path.join(targetDir, segment);
            }
            await mkdir(targetDir, { recursive: true });
            const fileName = ensureUniqueFilename(targetDir, basenameStem, extension.toLowerCase());
            const absolutePath = path.join(targetDir, fileName);
            await writeFile(absolutePath, Buffer.from(String(body.content ?? ""), "base64"));
            const relativeSegments = path.relative(publicDir, absolutePath).split(path.sep).filter(Boolean);
            const projectPath = path.posix.join("public", ...relativeSegments);
            const publicUrl = buildPublicUrl(...relativeSegments);
            sendJson(response, 200, {
              id: `${Date.now()}-${sanitizeName(`${subSegments.join("-") || "root"}-${basenameStem}`)}`,
              projectPath,
              publicUrl,
              relativePath: relativeSegments.slice(1).join("/"),
              name: path.basename(originalName),
            });
          } catch (error) {
            sendJson(response, 500, {
              error: error instanceof Error ? error.message : "game model upload failed",
            });
          }
        });

        server.middlewares.use("/api/runtime-city-gameplay", async (request, response) => {
          if (request.method !== "GET") {
            sendJson(response, 405, { error: "Method not allowed" });
            return;
          }

          try {
            const source = await readFile(runtimeSourceFile, "utf8");
            sendJson(response, 200, buildRuntimeCityGameplaySeeds(source));
          } catch (error) {
            sendJson(response, 500, {
              error: error instanceof Error ? error.message : "failed to load runtime city gameplay",
            });
          }
        });

        server.middlewares.use("/api/level-editor-config", async (request, response) => {
          if (request.method === "GET") {
            try {
              const raw = await readFile(editorConfigFile, "utf8");
              response.statusCode = 200;
              response.setHeader("Content-Type", "application/json; charset=utf-8");
              response.end(raw);
            } catch (error) {
              sendJson(response, 500, {
                error: error instanceof Error ? error.message : "failed to read level editor config",
              });
            }
            return;
          }

          if (request.method !== "POST") {
            sendJson(response, 405, { error: "Method not allowed" });
            return;
          }

          try {
            const body = await readJsonBody(request);
            if (!body || typeof body !== "object" || Array.isArray(body)) {
              sendJson(response, 400, { error: "Invalid level editor config payload" });
              return;
            }

            const nextState = {
              ...body,
              savedAt: new Date().toISOString(),
            };

            await mkdir(path.dirname(editorConfigFile), { recursive: true });
            await writeFile(editorConfigFile, `${JSON.stringify(nextState, null, 2)}\n`, "utf8");
            sendJson(response, 200, nextState);
          } catch (error) {
            sendJson(response, 500, {
              error: error instanceof Error ? error.message : "failed to save level editor config",
            });
          }
        });

        /** 通用视频上传：存到 public/uploads/videos/，返回 { url } */
        server.middlewares.use("/api/upload-video", async (request, response) => {
          if (request.method !== "POST") {
            sendJson(response, 405, { error: "Method not allowed" });
            return;
          }
          try {
            const body = await readJsonBody(request);
            const originalName = sanitizeName(String(body.name ?? "video.mp4"));
            const extension = path.extname(originalName) || ".mp4";
            const basename = path.basename(originalName, extension);
            const videoDir = path.join(uploadDir, "videos");
            await mkdir(videoDir, { recursive: true });
            const fileName = ensureUniqueFilename(videoDir, basename, extension.toLowerCase());
            const writtenPath = path.join(videoDir, fileName);
            await writeFile(writtenPath, Buffer.from(String(body.content ?? ""), "base64"));
            const relPosix = path.relative(publicDir, writtenPath).split(path.sep).join("/");
            const projectPath = `public/${relPosix}`;
            sendJson(response, 200, { url: `/uploads/videos/${fileName}`, projectPath });
          } catch (error) {
            sendJson(response, 500, {
              error: error instanceof Error ? error.message : "video upload failed",
            });
          }
        });
      },
    },
    {
      name: "serve-web-static",
      configureServer(server) {
        const webDir = path.resolve(__dirname, "Web");
        const mimeTypes = {
          ".html": "text/html; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".js": "application/javascript; charset=utf-8",
          ".json": "application/json; charset=utf-8",
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".gif": "image/gif",
          ".svg": "image/svg+xml",
          ".ico": "image/x-icon",
        };

        server.middlewares.use("/Web", (req, res, next) => {
          let urlPath = decodeURIComponent(req.url.split("?")[0]);
          // Default to index.html for directory requests
          if (urlPath.endsWith("/")) urlPath += "index.html";
          const filePath = path.join(webDir, urlPath);

          if (existsSync(filePath) && statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const contentType = mimeTypes[ext] || "application/octet-stream";
            res.setHeader("Content-Type", contentType);
            createReadStream(filePath).pipe(res);
          } else {
            next();
          }
        });
      },
    },
    /** 生产预览 / 静态部署时需能 fetch `/Web/data/level-editor-state.json`（与 dev 中间件一致） */
    {
      name: "copy-web-data-to-dist",
      async closeBundle() {
        const src = path.resolve(__dirname, "Web", "data");
        const dest = path.resolve(__dirname, "dist", "Web", "data");
        if (!existsSync(src)) {
          return;
        }
        await mkdir(path.dirname(dest), { recursive: true });
        await cp(src, dest, { recursive: true });
      },
    },
  ],
});
