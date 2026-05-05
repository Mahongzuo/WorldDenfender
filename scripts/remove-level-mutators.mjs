/**
 * scripts/remove-level-mutators.mjs
 * 删除 level-editor.js 中已迁移到 editor/level-mutators.js 的函数定义。
 */
import fs from 'fs';
import path from 'path';

const FILE = path.resolve('Web/map/level-editor.js');
const src = fs.readFileSync(FILE, 'utf8');
const TARGETS = new Set(['renumberBoardImageOrders', 'moveBoardLayerOrder', 'ensureWorldOffset', 'mergeGameplayEntryList']);

const lines = src.split('\n');
const funcStartRe = /^\s{4}function (\w+)\s*\(/;

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
let idx = 0;
while (idx < lines.length) {
    const m = funcStartRe.exec(lines[idx]);
    if (m && TARGETS.has(m[1])) {
        let commentStart = idx;
        for (let j = idx - 1; j >= Math.max(0, idx - 8); j--) {
            const prev = lines[j];
            if (/^\s*$/.test(prev) || /^\s{4}(\s*\*|\/\*\*)/.test(prev) || /^\s{4}\/\//.test(prev) || /^\s{4}\*\//.test(prev)) {
                commentStart = j;
            } else break;
        }
        const funcEnd = findFunctionEnd(lines, idx);
        removeRanges.push({ start: commentStart, end: funcEnd, name: m[1] });
        idx = funcEnd + 1;
        continue;
    }
    idx++;
}

const removeSet = new Set();
for (const r of removeRanges) for (let li = r.start; li <= r.end; li++) removeSet.add(li);
const newLines = lines.filter((_, i) => !removeSet.has(i));

console.log(`删除 ${lines.length - newLines.length} 行，从 ${lines.length} → ${newLines.length}`);
removeRanges.forEach(r => console.log(`  [${r.start + 1}-${r.end + 1}] ${r.name}`));
fs.writeFileSync(FILE, newLines.join('\n'), 'utf8');
console.log('完成。');
