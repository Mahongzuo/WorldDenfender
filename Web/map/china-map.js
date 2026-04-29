/**
 * China Map - Interactive logic
 * Loads China provinces GeoJSON, renders to SVG, handles hover/click.
 * Direct-enter provinces go to UEBridge; others drill down to province.html.
 */

const PROVINCE_NAMES = {
    '110000': '北京市',
    '120000': '天津市',
    '130000': '河北省',
    '140000': '山西省',
    '150000': '内蒙古自治区',
    '210000': '辽宁省',
    '220000': '吉林省',
    '230000': '黑龙江省',
    '310000': '上海市',
    '320000': '江苏省',
    '330000': '浙江省',
    '340000': '安徽省',
    '350000': '福建省',
    '360000': '江西省',
    '370000': '山东省',
    '410000': '河南省',
    '420000': '湖北省',
    '430000': '湖南省',
    '440000': '广东省',
    '450000': '广西壮族自治区',
    '460000': '海南省',
    '500000': '重庆市',
    '510000': '四川省',
    '520000': '贵州省',
    '530000': '云南省',
    '540000': '西藏自治区',
    '610000': '陕西省',
    '620000': '甘肃省',
    '630000': '青海省',
    '640000': '宁夏回族自治区',
    '650000': '新疆维吾尔自治区',
    '710000': '台湾省',
    '810000': '香港特别行政区',
    '820000': '澳门特别行政区'
};

const PROVINCE_PINYIN = {
    '110000': 'beijing',    '120000': 'tianjin',    '130000': 'hebei',
    '140000': 'shanxi',     '150000': 'neimenggu',  '210000': 'liaoning',
    '220000': 'jilin',      '230000': 'heilongjiang','310000': 'shanghai',
    '320000': 'jiangsu',    '330000': 'zhejiang',   '340000': 'anhui',
    '350000': 'fujian',     '360000': 'jiangxi',    '370000': 'shandong',
    '410000': 'henan',      '420000': 'hubei',      '430000': 'hunan',
    '440000': 'guangdong',  '450000': 'guangxi',    '460000': 'hainan',
    '500000': 'chongqing',  '510000': 'sichuan',    '520000': 'guizhou',
    '530000': 'yunnan',     '540000': 'xizang',     '610000': 'shaanxi',
    '620000': 'gansu',      '630000': 'qinghai',    '640000': 'ningxia',
    '650000': 'xinjiang',   '710000': 'taiwan',     '810000': 'hongkong',
    '820000': 'macao'
};

let _tooltip, _svg, _loadingEl, _viewport, _contentGroup;

/* 直接进入关卡的省份（直辖市 + 港澳），其余下钻到城市列表 */
const DIRECT_ENTER_CODES = new Set([
    '110000','120000','310000','500000','810000','820000'
]);

/**
 * 省界 GeoJSON 质心在狭长/多部分省份上易偏，标签手动锚在主体陆块上（[lon, lat]）
 * 数据质心参考: 蒙 114,44.3 / 冀 114.5,38 / 陕 108.9,35.3 / 甘 103.8,36
 */
const PROVINCE_LABEL_ANCHOR_LONLAT = {
    '150000': [111.3, 42.0],  // 内蒙古: 再略西移
    '130000': [115.05, 38.0],  // 河北: 再略东
    '610000': [109.45, 35.35], // 陕西: 再略东
    '620000': [103.6, 36.2]  // 甘肃: 再西北移，入陇中主体
};

async function initChinaMap() {
    _tooltip = document.getElementById('tooltip');
    _svg = document.getElementById('mapSvg');
    _loadingEl = document.getElementById('loading');

    try {
        const geojson = await loadChinaGeoJson();

        const provinces = geojson.features.filter(f => {
            const code = f.properties.adcode;
            return code && code !== '100000_JD' && String(code) !== '100000';
        });
        const scsFeature = geojson.features.find(f => {
            const code = f.properties.adcode;
            return code === '100000_JD' || String(code) === '100000';
        });

        _contentGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        _contentGroup.setAttribute('id', 'mapContent');
        _svg.appendChild(_contentGroup);

        const filteredGeoJson = { type: 'FeatureCollection', features: provinces };

        const cfg = MapRenderer.render(_svg, filteredGeoJson, {
            container: _contentGroup,
            bounds: { minLon: 73, maxLon: 136, minLat: 3, maxLat: 54 },
            padding: 40,
            getId(feature) {
                return 'prov_' + (feature.properties.adcode || '');
            },
            getClass() {
                return 'land';
            }
        });

        MapRenderer.appendLabelLayer(_contentGroup, provinces, cfg, {
            getLabel(feature) {
                const code = String(feature.properties.adcode || '');
                return PROVINCE_NAMES[code] || feature.properties.name || code;
            },
            getAnchorLonLat(feature) {
                const code = String(feature.properties.adcode || '');
                const a = PROVINCE_LABEL_ANCHOR_LONLAT[code];
                return a || null;
            },
            sizeRatio: 0.095,
            minFontSize: 7,
            maxFontSize: 15,
            skipIfBelowFont: 0.35,
            lengthAdjust(text, fs) {
                if (text.length > 14) return fs * 0.68;
                if (text.length > 10) return fs * 0.78;
                if (text.length > 7)  return fs * 0.88;
                return fs;
            }
        });

        if (scsFeature) {
            renderSouthChinaSea(scsFeature);
        }

        _viewport = new MapViewport(_svg, _contentGroup, {
            initialScale: 1,
            minScale: 0.6,
            maxScale: 15
        });

        bindEvents();
        if (_loadingEl) _loadingEl.remove();
    } catch (err) {
        console.error('Load error:', err);
        if (_loadingEl) _loadingEl.textContent = '地图数据加载失败';
    }
}

async function loadChinaGeoJson() {
    if (typeof window !== 'undefined' && window.__CHINA_GEOJSON__) {
        return window.__CHINA_GEOJSON__;
    }
    const resp = await fetch('../data/china.json');
    if (!resp.ok) throw new Error('Failed to load china.json');
    return resp.json();
}

function renderSouthChinaSea(feature) {
    const svgW = _svg.clientWidth || 1200;
    const svgH = _svg.clientHeight || 700;

    const boxW = svgW * 0.12;
    const boxH = svgH * 0.22;
    const boxX = svgW * 0.82;
    const boxY = svgH * 0.72;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', boxX);
    rect.setAttribute('y', boxY);
    rect.setAttribute('width', boxW);
    rect.setAttribute('height', boxH);
    rect.setAttribute('class', 'scs-box');
    rect.setAttribute('vector-effect', 'non-scaling-stroke');
    _contentGroup.appendChild(rect);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', boxX + boxW / 2);
    label.setAttribute('y', boxY + 14);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', '#4a6a8a');
    label.setAttribute('font-size', '10');
    label.textContent = '南海诸岛';
    _contentGroup.appendChild(label);

    if (feature.geometry) {
        const miniSvg = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        miniSvg.setAttribute('transform',
            `translate(${boxX + 2}, ${boxY + 18}) scale(${boxW / 800})`);

        const miniGeo = { type: 'FeatureCollection', features: [feature] };
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.setAttribute('width', '800');
        tempSvg.setAttribute('height', '600');
        document.body.appendChild(tempSvg);

        MapRenderer.render(tempSvg, miniGeo, {
            bounds: { minLon: 104, maxLon: 124, minLat: 2, maxLat: 24 },
            padding: 10
        });

        while (tempSvg.firstChild) {
            const child = tempSvg.firstChild;
            child.setAttribute('class', 'land');
            child.style.pointerEvents = 'none';
            miniSvg.appendChild(child);
        }
        document.body.removeChild(tempSvg);
        _contentGroup.appendChild(miniSvg);
    }
}

function bindEvents() {
    _contentGroup.addEventListener('mouseenter', onMouseEnter, true);
    _contentGroup.addEventListener('mousemove', onMouseMove, true);
    _contentGroup.addEventListener('mouseleave', onMouseLeave, true);
    _contentGroup.addEventListener('click', onClick, true);
}

function _isLand(el) {
    return el && el.classList.contains('land');
}

function onMouseEnter(e) {
    if (!_isLand(e.target)) return;
    const el = e.target;
    const adcode = el.dataset.adcode || el.id.replace('prov_', '');
    const cnName = PROVINCE_NAMES[adcode] || el.dataset.name || adcode;

    _tooltip.querySelector('.tip-name').textContent = cnName;
    _tooltip.querySelector('.tip-sub').textContent = '';
    _tooltip.querySelector('.tip-hint').textContent =
        DIRECT_ENTER_CODES.has(adcode) ? '点击进入关卡' : '点击查看城市';
    _tooltip.classList.add('visible');
}

function onMouseMove(e) {
    if (!_tooltip.classList.contains('visible')) return;
    const x = e.clientX + 15;
    const y = e.clientY + 15;
    const maxX = window.innerWidth - _tooltip.offsetWidth - 10;
    const maxY = window.innerHeight - _tooltip.offsetHeight - 10;
    _tooltip.style.left = Math.min(x, maxX) + 'px';
    _tooltip.style.top = Math.min(y, maxY) + 'px';
}

function onMouseLeave(e) {
    if (!_isLand(e.target)) return;
    _tooltip.classList.remove('visible');
}

function onClick(e) {
    if (_viewport && _viewport.isPanning) return;
    if (!_isLand(e.target)) return;

    const el = e.target;
    const adcode = el.dataset.adcode || el.id.replace('prov_', '');
    if (!adcode) return;

    const cnName = PROVINCE_NAMES[adcode] || el.dataset.name || adcode;
    const pinyin = PROVINCE_PINYIN[adcode] || adcode;

    el.classList.add('active');
    setTimeout(() => el.classList.remove('active'), 300);

    if (DIRECT_ENTER_CODES.has(adcode)) {
        const levelCode = 'CN_' + pinyin;
        if (UEBridge.isInUE()) {
            UEBridge.loadLevel(levelCode, cnName);
        } else {
            window.location.href = 'categories.html?code=' +
                encodeURIComponent(levelCode) + '&name=' + encodeURIComponent(cnName);
        }
    } else {
        window.location.href = 'province.html?code=' + adcode;
    }
}

document.addEventListener('DOMContentLoaded', initChinaMap);