/**
 * Mirrors src/game/assets/model-path-scale.ts for Web/map 纯 JS 模块。
 */
export function normalizeEditorModelPathKey(raw) {
    if (raw == null || raw === '') return '';
    var s = String(raw).trim();
    var q = s.indexOf('?');
    if (q >= 0) s = s.slice(0, q);
    var h = s.indexOf('#');
    if (h >= 0) s = s.slice(0, h);
    s = s.replace(/\\/g, '/');
    if (!s.startsWith('/')) s = '/' + s.replace(/^\/+/, '');
    try {
        s = decodeURIComponent(s);
    } catch (_e) {
        /* ignore */
    }
    return s;
}

export function canonicalModelPathScaleKey(raw) {
    return normalizeEditorModelPathKey(raw).toLowerCase();
}

export function clampGlobalPathModelScale(n) {
    var x = Number(n);
    if (!Number.isFinite(x)) return 1;
    return Math.min(1000, Math.max(0.01, x));
}

export function lookupGlobalModelPathScale(table, rawPath) {
    if (!table || rawPath == null || rawPath === '') return 1;
    var want = canonicalModelPathScaleKey(rawPath);
    if (!want) return 1;
    var raw = table[normalizeEditorModelPathKey(rawPath)];
    if (raw === undefined) raw = table[want];
    if (raw === undefined) {
        for (var i = 0; i < Object.keys(table).length; i += 1) {
            var tk = Object.keys(table)[i];
            if (canonicalModelPathScaleKey(tk) === want) {
                raw = table[tk];
                break;
            }
        }
    }
    var parsed = typeof raw === 'number' && Number.isFinite(raw) ? raw : Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return 1;
    return clampGlobalPathModelScale(parsed);
}
