import { clamp } from "../core/runtime-grid";

/** 规范化模型 URL 用作 globalModelPathScales 的键（解码、统一前导 `/`） */
export function normalizeEditorModelPathKey(raw: string | null | undefined): string {
  if (raw == null) return "";
  let s = String(raw).trim();
  const qMark = s.indexOf("?");
  if (qMark >= 0) s = s.slice(0, qMark);
  const hash = s.indexOf("#");
  if (hash >= 0) s = s.slice(0, hash);
  s = s.replace(/\\/g, "/");
  if (!s.startsWith("/")) s = "/" + s.replace(/^\/+/, "");
  try {
    s = decodeURIComponent(s);
  } catch {
    /* keep encoded */
  }
  return s;
}

/** 用于表中键对齐：同源路径不同大小写/编码可先归一再找 */
export function canonicalModelPathScaleKey(raw: string | null | undefined): string {
  return normalizeEditorModelPathKey(raw).toLowerCase();
}

export function clampGlobalPathModelScale(n: number): number {
  return clamp(n, 0.01, 1000);
}

export function lookupGlobalModelPathScale(
  table: Readonly<Record<string, number>> | null | undefined,
  rawPath: string | null | undefined,
): number {
  if (!table || rawPath == null || rawPath === "") return 1;
  const want = canonicalModelPathScaleKey(rawPath);
  if (!want) return 1;

  let raw: unknown = table[normalizeEditorModelPathKey(rawPath)];
  if (raw === undefined) {
    raw = table[want];
  }
  if (raw === undefined) {
    for (const tk of Object.keys(table)) {
      if (canonicalModelPathScaleKey(tk) === want) {
        raw = table[tk];
        break;
      }
    }
  }

  const parsed = typeof raw === "number" && Number.isFinite(raw) ? raw : Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }
  return clampGlobalPathModelScale(parsed);
}
