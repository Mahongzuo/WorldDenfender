/**
 * Batch download all 34 province-level city GeoJSON from DataV,
 * then generate corresponding -data.js files for file:// usage.
 *
 * Usage: node Web/scripts/download-provinces.js
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const PROVINCES_DIR = path.join(__dirname, '..', 'data', 'provinces');

const ADCODES = [
    '110000','120000','130000','140000','150000',
    '210000','220000','230000',
    '310000','320000','330000','340000','350000','360000','370000',
    '410000','420000','430000','440000','450000','460000',
    '500000','510000','520000','530000','540000',
    '610000','620000','630000','640000','650000',
    '710000','810000','820000'
];

function download(url) {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                res.resume();
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function main() {
    if (!fs.existsSync(PROVINCES_DIR)) fs.mkdirSync(PROVINCES_DIR, { recursive: true });

    let ok = 0, fail = 0;
    for (const code of ADCODES) {
        const url = `https://geo.datav.aliyun.com/areas_v3/bound/${code}_full.json`;
        const jsonPath = path.join(PROVINCES_DIR, `${code}.json`);
        const jsPath   = path.join(PROVINCES_DIR, `${code}-data.js`);

        if (fs.existsSync(jsonPath)) {
            console.log(`[skip] ${code}.json already exists`);
            if (!fs.existsSync(jsPath)) {
                const raw = fs.readFileSync(jsonPath, 'utf8');
                fs.writeFileSync(jsPath, `window.__PROVINCE_${code}_GEOJSON__ = ${raw};\n`);
                console.log(`  -> generated ${code}-data.js`);
            }
            ok++;
            continue;
        }

        try {
            console.log(`[download] ${code} ...`);
            const raw = await download(url);
            JSON.parse(raw); // validate
            fs.writeFileSync(jsonPath, raw);
            fs.writeFileSync(jsPath, `window.__PROVINCE_${code}_GEOJSON__ = ${raw};\n`);
            console.log(`  -> ${code}.json + ${code}-data.js  OK`);
            ok++;
        } catch (err) {
            console.error(`  [FAIL] ${code}: ${err.message}`);
            fail++;
        }
        await new Promise(r => setTimeout(r, 300));
    }
    console.log(`\nDone: ${ok} ok, ${fail} failed out of ${ADCODES.length}`);
}

main();
