/**
 * scripts/remove-extracted-pure.mjs
 * 从 level-editor.js 中删除已迁移到 path-utils.js / display-utils.js 的纯函数。
 *
 * 被删除的函数（按函数名）：
 *   path-utils.js 来源:
 *     cellsInEraserBrush, clampBoardAspect,
 *     expandPathWaypointPolyline, uniqueDefenseCells,
 *     manhattanDefense, sameDefenseCell, orderEditorPathCellsDefense,
 *     projectGridCellDefense, defensePathSourceCells,
 *     buildDefenseFallbackVertexList, getDefenseEditorPathKeys
 *   display-utils.js 来源:
 *     statusLabel, actorCategoryLabel, summaryStats,
 *     gameplayPlacementLabel, modelBindShortLabel,
 *     isImageAssetPath, isModelAssetPath,
 *     groupLevels, compareRegionKeys,
 *     hasDefenseLayout, hasExploreLayout, isJinanLevel
 *
 * 还需要：
 *   - 将 cellsInEraserBrush(  →  _cellsInEraserBrush(  的所有调用点都已通过导入别名处理，
 *     但 level-editor.js 内部仍直接用 cellsInEraserBrush —— 保留原名即可，
 *     因为 path-utils 已导出同名，不需要别名，直接改 import alias。
 *
 * 运行：node scripts/remove-extracted-pure.mjs
 */

import fs from 'fs';
import path from 'path';

const FILE = path.resolve('Web/map/level-editor.js');
let src = fs.readFileSync(FILE, 'utf8');
const lines = src.split('\n');

// 需要删除的函数名集合
const TARGETS = new Set([
    'cellsInEraserBrush',
    'clampBoardAspect',
    'expandPathWaypointPolyline',
    'uniqueDefenseCells',
    'manhattanDefense',
    'sameDefenseCell',
    'orderEditorPathCellsDefense',
    'projectGridCellDefense',
    'defensePathSourceCells',
    'buildDefenseFallbackVertexList',
    'getDefenseEditorPathKeys',
    'statusLabel',
    'actorCategoryLabel',
    'summaryStats',
    'gameplayPlacementLabel',
    'modelBindShortLabel',
    'isImageAssetPath',
    'isModelAssetPath',
    'groupLevels',
    'compareRegionKeys',
    'hasDefenseLayout',
    'hasExploreLayout',
    'isJinanLevel',
]);

// 精确的函数开头正则：function <name>(
const funcStartRe = /^\s{4}function (\w+)\s*\(/;
// JSDoc 注释行
const jsdocStartRe = /^\s{4}\/\*\*/;
const jsdocEndRe = /\*\//;
// 单行注释行（紧贴函数的）
const lineCommentRe = /^\s{4}\/\*[^*].*\*\/\s*$|^\s{4}\/\/.*/;

/**
 * 计算从 startIdx 行开始的函数体的结束行索引（包含）。
 * 使用带字符串/正则字面量感知的括号计数。
 */
function findFunctionEnd(lines, startIdx) {
    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;
    let inRegex = false;
    let started = false;

    for (let li = startIdx; li < lines.length; li++) {
        const line = lines[li];
        let i = 0;
        while (i < line.length) {
            const ch = line[i];
            if (inSingle) {
                if (ch === '\\') { i += 2; continue; }
                if (ch === "'") inSingle = false;
                i++; continue;
            }
            if (inDouble) {
                if (ch === '\\') { i += 2; continue; }
                if (ch === '"') inDouble = false;
                i++; continue;
            }
            if (inTemplate) {
                if (ch === '\\') { i += 2; continue; }
                if (ch === '`') inTemplate = false;
                i++; continue;
            }
            if (inRegex) {
                if (ch === '\\') { i += 2; continue; }
                if (ch === '/') inRegex = false;
                i++; continue;
            }
            // line comment
            if (ch === '/' && line[i+1] === '/') break;
            // block comment — simple skip
            if (ch === '/' && line[i+1] === '*') {
                i += 2;
                while (i < line.length - 1 && !(line[i] === '*' && line[i+1] === '/')) i++;
                i += 2; continue;
            }
            if (ch === "'") { inSingle = true; i++; continue; }
            if (ch === '"') { inDouble = true; i++; continue; }
            if (ch === '`') { inTemplate = true; i++; continue; }
            if (ch === '{') {
                depth++;
                started = true;
                i++; continue;
            }
            if (ch === '}') {
                depth--;
                if (started && depth === 0) return li;
                i++; continue;
            }
            i++;
        }
    }
    return lines.length - 1;
}

const keepLines = new Set();
// 先标记所有要保留的行（即不在目标函数范围内的行）

let i = 0;
const removeRanges = []; // [{start, end}]  (inclusive, 0-based)

while (i < lines.length) {
    const line = lines[i];
    const m = funcStartRe.exec(line);
    if (m && TARGETS.has(m[1])) {
        // 向前找 JSDoc / 行注释（最多往上看 10 行）
        let commentStart = i;
        for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
            const prev = lines[j];
            if (jsdocEndRe.test(prev) || jsdocStartRe.test(prev) || lineCommentRe.test(prev) || /^\s*$/.test(prev)) {
                commentStart = j;
            } else {
                break;
            }
        }
        const funcEnd = findFunctionEnd(lines, i);
        removeRanges.push({ start: commentStart, end: funcEnd });
        i = funcEnd + 1;
        continue;
    }
    i++;
}

// 合并重叠范围
removeRanges.sort((a, b) => a.start - b.start);
const merged = [];
for (const r of removeRanges) {
    if (merged.length && r.start <= merged[merged.length - 1].end + 1) {
        merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, r.end);
    } else {
        merged.push({ ...r });
    }
}

// 构建要保留的行号集合
const removeSet = new Set();
for (const r of merged) {
    for (let li = r.start; li <= r.end; li++) removeSet.add(li);
}

const newLines = lines.filter((_, idx) => !removeSet.has(idx));

const removed = lines.length - newLines.length;
console.log(`删除了 ${removed} 行（共 ${merged.length} 个函数块），` +
            `从 ${lines.length} 行 → ${newLines.length} 行`);
merged.forEach(r => {
    const name = funcStartRe.exec(lines.find((l, idx) => idx >= r.start && idx <= r.end && funcStartRe.test(l)) || '');
    console.log(`  [${r.start+1}-${r.end+1}] ${name ? name[1] : '?'}`);
});

fs.writeFileSync(FILE, newLines.join('\n'), 'utf8');
console.log('完成。');
