/**
 * Removes duplicate normalize function definitions from level-editor.js
 * (functions that have been extracted to editor/normalizers.js)
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../Web/map/level-editor.js', import.meta.url).pathname.slice(1); // remove leading /
const lines = readFileSync(FILE, 'utf8').split('\n');

// 1-indexed start lines of duplicate functions to remove
const STARTS = [
    7888, 7902, 7913,
    8054, 8074, 8092, 8104, 8112, 8126, 8142, 8151, 8176, 8220,
    8392, 8410, 8445, 8570, 8590, 8636, 8652, 8668, 8693, 8728,
    8736, 8740, 8744, 8754, 8758,
    8966, 8971, 8976
];

/** Find the 1-indexed end line of the function starting at `start` (1-indexed) */
function findFunctionEnd(start) {
    let depth = 0, started = false;
    for (let i = start - 1; i < lines.length; i++) {
        const opens = (lines[i].match(/\{/g) || []).length;
        const closes = (lines[i].match(/\}/g) || []).length;
        depth += opens - closes;
        if (opens > 0) started = true;
        if (started && depth <= 0) return i + 1; // 1-indexed
    }
    return start;
}

const deleteSet = new Set();
for (const start of STARTS) {
    const end = findFunctionEnd(start);
    console.log(`Remove lines ${start}-${end}: ${lines[start - 1].trim().slice(0, 60)}`);
    for (let i = start; i <= end; i++) deleteSet.add(i);
    // Also remove the blank line immediately before the function
    const prev = start - 1;
    if (prev >= 1 && lines[prev - 1].trim() === '') deleteSet.add(prev);
}

const kept = lines.filter((_, i) => !deleteSet.has(i + 1));
writeFileSync(FILE, kept.join('\n'), 'utf8');
console.log(`\nDone. Removed ${deleteSet.size} lines. File now has ${kept.length} lines.`);
