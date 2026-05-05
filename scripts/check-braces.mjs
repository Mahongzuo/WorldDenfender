// scripts/check-braces.mjs
import { readFileSync } from 'fs';
const src = readFileSync('Web/map/level-editor.js', 'utf8');
const lines = src.split('\n');
let depth = 0;
const stackOpens = [];
let inLineComment = false;
let inString = false;
let quote = '';
let inImportBlock = false;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (inImportBlock) {
        if (/;\s*$/.test(line)) inImportBlock = false;
        continue;
    }
    if (/^\s*import\s/.test(line)) {
        if (!/;\s*$/.test(line)) inImportBlock = true;
        continue;
    }
    inLineComment = false;
    let j = 0;
    while (j < line.length) {
        const ch = line[j];
        if (inLineComment) break;
        if (inString) {
            if (ch === quote) inString = false;
        } else if (ch === '/' && line[j+1] === '/') {
            break; // line comment
        } else if (ch === '"' || ch === "'" || ch === '`') {
            inString = true; quote = ch;
        } else if (ch === '{') {
            stackOpens.push(i+1); depth++;
        } else if (ch === '}') {
            stackOpens.pop(); depth--;
        }
        j++;
    }
}
console.log('Final depth:', depth);
console.log('Unclosed opens (line numbers):', stackOpens);
