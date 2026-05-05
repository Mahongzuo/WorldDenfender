/**
 * scripts/migrate-id-utils.mjs
 * 1. 把 level-editor.js 中所有使用旧全局签名的调用替换为新签名（传入显式集合）。
 * 2. 删除已迁移到 editor/id-utils.js 的函数定义。
 * 3. 删除已迁移到 editor/utils.js 的函数定义。
 * 4. 删除已迁移到 editor/display-utils.js 的函数定义。
 */

import fs from 'fs';
import path from 'path';

const FILE = path.resolve('Web/map/level-editor.js');
let src = fs.readFileSync(FILE, 'utf8');

// ─── 1. 替换调用方 ────────────────────────────────────────────────────────────

// pickLevelId(x) -> pickLevelId(state.levels, x)
src = src.replace(/\bpickLevelId\((?!state\.levels,\s*)([^)]+)\)/g, (m, arg) => `pickLevelId(state.levels, ${arg})`);

// uniqueLevelId('custom-level') -> uniqueLevelId(state.levels, 'custom-level')
src = src.replace(/\buniqueLevel Id\((?!state\.levels,\s*)/g, '');  // no-op guard
src = src.replace(/\buniqueLevelId\((?!state\.levels,\s*)(['"])([^'"]+)\1\)/g, (m, q, seed) => `uniqueLevelId(state.levels, ${q}${seed}${q})`);

// uniqueTemplateId(arg) -> uniqueTemplateId(state.actorTemplates, arg)
src = src.replace(/\buniqueTemplateId\((?!state\.actorTemplates,\s*)([^)]+)\)/g, (m, arg) => `uniqueTemplateId(state.actorTemplates, ${arg})`);

// findLevelById(arg) -> findLevelById(state.levels, arg)  (only where state is available in context - i.e., NOT inside function findLevelById itself)
// We can do this globally, the function definition line will be removed anyway
src = src.replace(/\bfindLevelById\((?!state\.levels,\s*)([^)]+)\)/g, (m, arg) => {
    // skip the function definition line
    if (arg.startsWith('levelId') && m === 'findLevelById(levelId)') return m; // keep definition params
    return `findLevelById(state.levels, ${arg})`;
});

// uniqueGameplayEntryId calls are already correct signature (list, baseId)
// ensureUniqueGameplayEntryId stays in level-editor.js - no change needed

console.log('调用方替换完成');

// ─── 2. 删除已迁移函数定义 ────────────────────────────────────────────────────

const TARGETS = new Set([
    // id-utils.js
    'pickLevelId',
    'uniqueLevelId',
    'uniqueTemplateId',
    'findLevelById',
    'uniqueGameplayEntryId',
    // utils.js
    'editorPctFromVol01',
    'clampInspectorWidthPx',
    'isNarrowWorkbenchLayout',
    'readDragPayload',
    'fileToBase64',
    // display-utils.js
    'levelVideoCityContext',
]);

const lines = src.split('\n');
const funcStartRe = /^\s{4}function (\w+)\s*\(/;
const jsdocLineRe = /^\s{4}(\s*\*|\/\*\*).*/;
const lineCommentRe = /^\s{4}\/\/.*/;

function findFunctionEnd(lines, startIdx) {
    let depth = 0, inSingle = false, inDouble = false, inTemplate = false, started = false;
    for (let li = startIdx; li < lines.length; li++) {
        const line = lines[li]; let i = 0;
        while (i < line.length) {
            const ch = line[i];
            if (inSingle) { if (ch === '\\') { i += 2; continue; } if (ch === "'") inSingle = false; i++; continue; }
            if (inDouble) { if (ch === '\\') { i += 2; continue; } if (ch === '"') inDouble = false; i++; continue; }
            if (inTemplate) { if (ch === '\\') { i += 2; continue; } if (ch === '`') inTemplate = false; i++; continue; }
            if (ch === '/' && line[i + 1] === '/') break;
            if (ch === '/' && line[i + 1] === '*') { i += 2; while (i < line.length - 1 && !(line[i] === '*' && line[i + 1] === '/')) i++; i += 2; continue; }
            if (ch === "'") { inSingle = true; i++; continue; }
            if (ch === '"') { inDouble = true; i++; continue; }
            if (ch === '`') { inTemplate = true; i++; continue; }
            if (ch === '{') { depth++; started = true; i++; continue; }
            if (ch === '}') { depth--; if (started && depth === 0) return li; i++; continue; }
            i++;
        }
    }
    return lines.length - 1;
}

const removeRanges = [];
let i = 0;
while (i < lines.length) {
    const line = lines[i];
    const m = funcStartRe.exec(line);
    if (m && TARGETS.has(m[1])) {
        let commentStart = i;
        for (let j = i - 1; j >= Math.max(0, i - 15); j--) {
            const prev = lines[j];
            if (/^\s*$/.test(prev) || jsdocLineRe.test(prev) || lineCommentRe.test(prev) || /^\s{4}\*\//.test(prev)) {
                commentStart = j;
            } else break;
        }
        const funcEnd = findFunctionEnd(lines, i);
        removeRanges.push({ start: commentStart, end: funcEnd, name: m[1] });
        i = funcEnd + 1;
        continue;
    }
    i++;
}

const removeSet = new Set();
for (const r of removeRanges) for (let li = r.start; li <= r.end; li++) removeSet.add(li);
const newLines = lines.filter((_, idx) => !removeSet.has(idx));

console.log(`删除 ${lines.length - newLines.length} 行，从 ${lines.length} → ${newLines.length}`);
removeRanges.forEach(r => console.log(`  [${r.start + 1}-${r.end + 1}] ${r.name}`));

fs.writeFileSync(FILE, newLines.join('\n'), 'utf8');
console.log('完成。');
