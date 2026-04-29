/**
 * Province City Map — 省份城市下钻页
 * URL: province.html?code=370000
 */

const PROVINCE_META = {
    '110000':{ name:'北京市',     pinyin:'beijing' },
    '120000':{ name:'天津市',     pinyin:'tianjin' },
    '130000':{ name:'河北省',     pinyin:'hebei' },
    '140000':{ name:'山西省',     pinyin:'shanxi' },
    '150000':{ name:'内蒙古自治区', pinyin:'neimenggu' },
    '210000':{ name:'辽宁省',     pinyin:'liaoning' },
    '220000':{ name:'吉林省',     pinyin:'jilin' },
    '230000':{ name:'黑龙江省',   pinyin:'heilongjiang' },
    '310000':{ name:'上海市',     pinyin:'shanghai' },
    '320000':{ name:'江苏省',     pinyin:'jiangsu' },
    '330000':{ name:'浙江省',     pinyin:'zhejiang' },
    '340000':{ name:'安徽省',     pinyin:'anhui' },
    '350000':{ name:'福建省',     pinyin:'fujian' },
    '360000':{ name:'江西省',     pinyin:'jiangxi' },
    '370000':{ name:'山东省',     pinyin:'shandong' },
    '410000':{ name:'河南省',     pinyin:'henan' },
    '420000':{ name:'湖北省',     pinyin:'hubei' },
    '430000':{ name:'湖南省',     pinyin:'hunan' },
    '440000':{ name:'广东省',     pinyin:'guangdong' },
    '450000':{ name:'广西壮族自治区', pinyin:'guangxi' },
    '460000':{ name:'海南省',     pinyin:'hainan' },
    '500000':{ name:'重庆市',     pinyin:'chongqing' },
    '510000':{ name:'四川省',     pinyin:'sichuan' },
    '520000':{ name:'贵州省',     pinyin:'guizhou' },
    '530000':{ name:'云南省',     pinyin:'yunnan' },
    '540000':{ name:'西藏自治区', pinyin:'xizang' },
    '610000':{ name:'陕西省',     pinyin:'shaanxi' },
    '620000':{ name:'甘肃省',     pinyin:'gansu' },
    '630000':{ name:'青海省',     pinyin:'qinghai' },
    '640000':{ name:'宁夏回族自治区', pinyin:'ningxia' },
    '650000':{ name:'新疆维吾尔自治区', pinyin:'xinjiang' },
    '710000':{ name:'台湾省',     pinyin:'taiwan' },
    '810000':{ name:'香港特别行政区', pinyin:'hongkong' },
    '820000':{ name:'澳门特别行政区', pinyin:'macao' }
};

let _tooltip, _svg, _loadingEl, _viewport, _contentGroup;
let _provinceCode, _provinceMeta;

function getUrlParam(key) {
    const params = new URLSearchParams(window.location.search);
    return params.get(key);
}

async function initProvinceMap() {
    _tooltip = document.getElementById('tooltip');
    _svg = document.getElementById('mapSvg');
    _loadingEl = document.getElementById('loading');

    _provinceCode = getUrlParam('code');
    if (!_provinceCode || !PROVINCE_META[_provinceCode]) {
        if (_loadingEl) _loadingEl.textContent = '无效的省份代码';
        return;
    }

    _provinceMeta = PROVINCE_META[_provinceCode];
    document.getElementById('provinceTitle').textContent =
        _provinceMeta.name.split('').join(' ');

    try {
        const geojson = await loadProvinceGeoJson(_provinceCode);

        const cities = (geojson.features || []).filter(f => {
            const code = String(f.properties.adcode || '');
            return code !== _provinceCode && code !== _provinceCode + '_JD';
        });

        _contentGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        _contentGroup.setAttribute('id', 'mapContent');
        _svg.appendChild(_contentGroup);

        const cityGeo = { type: 'FeatureCollection', features: cities };

        const cfg = MapRenderer.render(_svg, cityGeo, {
            container: _contentGroup,
            padding: 50,
            getId(feature) {
                return 'city_' + (feature.properties.adcode || '');
            },
            getClass() {
                return 'land';
            }
        });

        MapRenderer.appendLabelLayer(_contentGroup, cities, cfg, {
            getLabel(feature) {
                return feature.properties.name || '';
            },
            sizeRatio: 0.1,
            minFontSize: 5,
            maxFontSize: 11,
            skipIfBelowFont: 0.28,
            lengthAdjust(text, fs) {
                if (text.length > 8) return fs * 0.72;
                if (text.length > 5) return fs * 0.85;
                return fs;
            }
        });

        _viewport = new MapViewport(_svg, _contentGroup, {
            initialScale: 1,
            minScale: 0.5,
            maxScale: 15
        });

        bindEvents();
        if (_loadingEl) _loadingEl.remove();
    } catch (err) {
        console.error('Load error:', err);
        if (_loadingEl) _loadingEl.textContent = '地图数据加载失败';
    }
}

async function loadProvinceGeoJson(code) {
    const globalKey = `__PROVINCE_${code}_GEOJSON__`;
    if (typeof window !== 'undefined' && window[globalKey]) {
        return window[globalKey];
    }
    const resp = await fetch(`../data/provinces/${code}.json`);
    if (!resp.ok) throw new Error(`Failed to load province ${code}`);
    return resp.json();
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
    const name = e.target.dataset.name || '未知';
    _tooltip.querySelector('.tip-name').textContent = name;
    _tooltip.querySelector('.tip-sub').textContent = _provinceMeta.name;
    _tooltip.querySelector('.tip-hint').textContent = '点击进入关卡';
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

    const cityName = e.target.dataset.name || '';
    const cityCode = e.target.dataset.adcode || e.target.id.replace('city_', '');

    e.target.classList.add('active');
    setTimeout(() => e.target.classList.remove('active'), 300);

    const levelCode = `CN_${_provinceMeta.pinyin}_${cityCode}`;
    const displayName = `${_provinceMeta.name}·${cityName}`;
    if (UEBridge.isInUE()) {
        UEBridge.loadLevel(levelCode, displayName);
    } else {
        window.location.href = 'categories.html?code=' +
            encodeURIComponent(levelCode) + '&name=' + encodeURIComponent(displayName);
    }
}

document.addEventListener('DOMContentLoaded', initProvinceMap);
