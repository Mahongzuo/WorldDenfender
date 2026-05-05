// scripts/remove-dup-content.mjs
// Removes from level-editor.js the variable/function declarations that are now in
// editor/content.js and editor/normalizers.js (audio + level normalizers).
// Uses brace-counting to find exact function end boundaries.

import { readFileSync, writeFileSync } from 'fs';

const FILE = 'Web/map/level-editor.js';
const lines = readFileSync(FILE, 'utf8').split('\n');
const total = lines.length;

// ---- Helper: find the closing brace of a block starting at `startLine` (0-based) -----
// `startLine` must contain the opening brace.  Returns the 0-based index of the line
// whose last `}` closes the block opened on `startLine`.
function findBlockEnd(lines, startLine) {
    let depth = 0;
    for (let i = startLine; i < lines.length; i++) {
        const line = lines[i];
        for (const ch of line) {
            if (ch === '{') depth++;
            else if (ch === '}') { depth--; if (depth === 0) return i; }
        }
    }
    return -1; // unclosed
}

// ---- Collect ranges to delete (0-based inclusive [from, to]) -----
// Each entry: [from, to, label]
const ranges = [];

function findVarDecl(name) {
    for (let i = 0; i < lines.length; i++) {
        if (new RegExp(`^    var ${name}\\b`).test(lines[i])) return i;
    }
    return -1;
}

function findFunctionDecl(name) {
    for (let i = 0; i < lines.length; i++) {
        if (new RegExp(`^    function ${name}\\(`).test(lines[i])) return i;
    }
    return -1;
}

// --- Simple var declarations (single line or until semicolon on same/next line) ---
function removeSimpleVar(name) {
    const i = findVarDecl(name);
    if (i === -1) { console.warn('NOT FOUND:', name); return; }
    const line = lines[i];
    // Check if it's a multi-line object/array var
    if (line.includes('{') || line.includes('[')) {
        // find the closing semi at depth 0
        let depth = 0;
        let j = i;
        let found = false;
        for (; j < lines.length; j++) {
            for (const ch of lines[j]) {
                if (ch === '{' || ch === '[') depth++;
                else if (ch === '}' || ch === ']') { depth--; }
            }
            if (depth === 0 && lines[j].trimEnd().endsWith(';')) { found = true; break; }
        }
        if (found) { ranges.push([i, j, name]); return; }
    }
    // Single-line var
    ranges.push([i, i, name]);
}

function removeFunction(name) {
    const i = findFunctionDecl(name);
    if (i === -1) { console.warn('NOT FOUND (func):', name); return; }
    const end = findBlockEnd(lines, i);
    if (end === -1) { console.warn('UNCLOSED (func):', name); return; }
    // Include trailing blank line
    let to = end;
    if (to + 1 < lines.length && lines[to + 1].trim() === '') to++;
    ranges.push([i, to, name]);
}

// ================================================================
// Remove content.js vars (constants)
// ================================================================
['API_URL', 'LOCAL_BACKUP_KEY', 'LEGACY_BACKUP_KEY', 'ENGINE_VERSION',
 'DEFAULT_GRID_COLS', 'DEFAULT_GRID_ROWS', 'DEFAULT_TILE_SIZE',
 'ERASER_RADIUS_STORAGE_KEY', 'ERASER_RADIUS_MAX',
 'GEO_MAPPING_STORAGE_KEY',
 'SHELL_LEFT_COLLAPSE_KEY', 'SHELL_RIGHT_COLLAPSE_KEY', 'SHELL_INSPECTOR_WIDTH_KEY',
 'CONTENT_BROWSER_FLOAT_GEOM_KEY'
].forEach(removeSimpleVar);

// Remove var declarations for data tables
['TOOL_LABELS', 'LEVEL_CONTENT_BROWSER_FILTER_ORDER', 'LCB_CELL_KIND_LABEL',
 'MODEL_CATEGORY_CONFIG', 'DEFAULT_ACTOR_TEMPLATES', 'TOWER_MODEL_SPECS',
 'DEFAULT_TOWER_GAMEPLAY_STATS', 'GAMEPLAY_RESOURCE_CONFIG'
].forEach(removeSimpleVar);

// ================================================================
// Remove audio normalizer functions
// ================================================================
['defaultGlobalAudio', 'normalizeGlobalAudio', 'normalizeLevelAudioSource',
 'defaultGlobalScreenUi', 'normalizeGlobalScreenUi',
 'defaultGameAssetConfig', 'normalizeGameAssetConfig'
].forEach(removeFunction);

// ================================================================
// Remove gameplay entries normalizers
// ================================================================
['mergeDistinctStrings', 'normalizeGameplayPlacement',
 'normalizeGameplayEntries', 'normalizeCityGameplayConfigs'
].forEach(removeFunction);

// Also remove wave1EnemyArchetypeStats, DEFAULT_RUNTIME_ENEMY_ARCHETYPE_META,
// buildDefaultEnemyEntries, buildDefaultTowerEntries, buildDefaultCardEntries
function findVarDeclAny(name) {
    for (let i = 0; i < lines.length; i++) {
        if (new RegExp(`^    var ${name}\\b`).test(lines[i])) return i;
    }
    return -1;
}
removeFunction('wave1EnemyArchetypeStats');
['buildDefaultEnemyEntries', 'buildDefaultTowerEntries', 'buildDefaultCardEntries'].forEach(removeFunction);

// DEFAULT_RUNTIME_ENEMY_ARCHETYPE_META is a var with object value
const dremIdx = findVarDeclAny('DEFAULT_RUNTIME_ENEMY_ARCHETYPE_META');
if (dremIdx >= 0) {
    let depth = 0, j = dremIdx;
    for (; j < lines.length; j++) {
        for (const ch of lines[j]) {
            if (ch === '{') depth++; else if (ch === '}') depth--;
        }
        if (depth === 0 && lines[j].trimEnd().endsWith(';')) break;
    }
    ranges.push([dremIdx, j, 'DEFAULT_RUNTIME_ENEMY_ARCHETYPE_META']);
}

// ================================================================
// Remove map / level normalizers
// ================================================================
['trimMapToBounds', 'createDefaultMap', 'normalizeMap', 'normalizeLevel', 'normalizeState'
].forEach(removeFunction);

// sortLevels — keep level-editor.js callers using sortLevels(state) explicitly
// We only remove the function definition; callers will now use the imported one.
removeFunction('sortLevels');

// ================================================================
// Apply: sort ranges by start line (desc) to delete from bottom up
// ================================================================
ranges.sort((a, b) => b[0] - a[0]);

// Remove overlapping ranges (keep highest-start)
const clean = [];
let prevFrom = Infinity;
for (const [from, to, label] of ranges) {
    if (to >= prevFrom) { console.log('SKIP OVERLAP:', label); continue; }
    clean.push([from, to, label]);
    prevFrom = from;
}

// Apply deletions
const result = [...lines];
for (const [from, to, label] of clean) {
    console.log(`Removing lines ${from + 1}-${to + 1}: ${label}`);
    result.splice(from, to - from + 1);
}

console.log(`\nOriginal: ${total} lines → New: ${result.length} lines (removed ${total - result.length})`);
writeFileSync(FILE, result.join('\n'), 'utf8');
