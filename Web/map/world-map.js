/**
 * World Map - Interactive logic
 * Loads world GeoJSON, renders to SVG, handles hover/click.
 * Taiwan is merged into China. Clicking China navigates to china.html.
 */

const COUNTRY_NAMES_CN = {
    AFG:'阿富汗',AGO:'安哥拉',ALB:'阿尔巴尼亚',ARE:'阿联酋',ARG:'阿根廷',
    ARM:'亚美尼亚',ATA:'南极洲',ATF:'法属南方领地',AUS:'澳大利亚',AUT:'奥地利',
    AZE:'阿塞拜疆',BDI:'布隆迪',BEL:'比利时',BEN:'贝宁',BFA:'布基纳法索',
    BGD:'孟加拉国',BGR:'保加利亚',BHS:'巴哈马',BIH:'波黑',BLR:'白俄罗斯',
    BLZ:'伯利兹',BOL:'玻利维亚',BRA:'巴西',BRN:'文莱',BTN:'不丹',
    BWA:'博茨瓦纳',CAF:'中非',CAN:'加拿大',CHE:'瑞士',CHL:'智利',
    CHN:'中国',CIV:'科特迪瓦',CMR:'喀麦隆',COD:'刚果(金)',COG:'刚果(布)',
    COL:'哥伦比亚',CRI:'哥斯达黎加',CUB:'古巴',CYP:'塞浦路斯',CZE:'捷克',
    DEU:'德国',DJI:'吉布提',DNK:'丹麦',DOM:'多米尼加',DZA:'阿尔及利亚',
    ECU:'厄瓜多尔',EGY:'埃及',ERI:'厄立特里亚',ESP:'西班牙',EST:'爱沙尼亚',
    ETH:'埃塞俄比亚',FIN:'芬兰',FJI:'斐济',FLK:'福克兰群岛',FRA:'法国',
    GAB:'加蓬',GBR:'英国',GEO:'格鲁吉亚',GHA:'加纳',GIN:'几内亚',
    GMB:'冈比亚',GNB:'几内亚比绍',GNQ:'赤道几内亚',GRC:'希腊',GRL:'格陵兰',
    GTM:'危地马拉',GUF:'法属圭亚那',GUY:'圭亚那',HND:'洪都拉斯',HRV:'克罗地亚',
    HTI:'海地',HUN:'匈牙利',IDN:'印度尼西亚',IND:'印度',IRL:'爱尔兰',
    IRN:'伊朗',IRQ:'伊拉克',ISL:'冰岛',ISR:'以色列',ITA:'意大利',
    JAM:'牙买加',JOR:'约旦',JPN:'日本',KAZ:'哈萨克斯坦',KEN:'肯尼亚',
    KGZ:'吉尔吉斯斯坦',KHM:'柬埔寨',KOR:'韩国',KWT:'科威特',LAO:'老挝',
    LBN:'黎巴嫩',LBR:'利比里亚',LBY:'利比亚',LKA:'斯里兰卡',LSO:'莱索托',
    LTU:'立陶宛',LUX:'卢森堡',LVA:'拉脱维亚',MAR:'摩洛哥',MDA:'摩尔多瓦',
    MDG:'马达加斯加',MEX:'墨西哥',MKD:'北马其顿',MLI:'马里',MMR:'缅甸',
    MNE:'黑山',MNG:'蒙古',MOZ:'莫桑比克',MRT:'毛里塔尼亚',MWI:'马拉维',
    MYS:'马来西亚',NAM:'纳米比亚',NCL:'新喀里多尼亚',NER:'尼日尔',NGA:'尼日利亚',
    NIC:'尼加拉瓜',NLD:'荷兰',NOR:'挪威',NPL:'尼泊尔',NZL:'新西兰',
    OMN:'阿曼',PAK:'巴基斯坦',PAN:'巴拿马',PER:'秘鲁',PHL:'菲律宾',
    PNG:'巴布亚新几内亚',POL:'波兰',PRI:'波多黎各',PRK:'朝鲜',PRT:'葡萄牙',
    PRY:'巴拉圭',QAT:'卡塔尔',ROU:'罗马尼亚',RUS:'俄罗斯',RWA:'卢旺达',
    SAU:'沙特阿拉伯',SDN:'苏丹',SEN:'塞内加尔',SLB:'所罗门群岛',SLE:'塞拉利昂',
    SLV:'萨尔瓦多',SOM:'索马里',SRB:'塞尔维亚',SSD:'南苏丹',SUR:'苏里南',
    SVK:'斯洛伐克',SVN:'斯洛文尼亚',SWE:'瑞典',SWZ:'斯威士兰',SYR:'叙利亚',
    TCD:'乍得',TGO:'多哥',THA:'泰国',TJK:'塔吉克斯坦',TKM:'土库曼斯坦',
    TLS:'东帝汶',TTO:'特立尼达和多巴哥',TUN:'突尼斯',TUR:'土耳其',TWN:'中国台湾',
    TZA:'坦桑尼亚',UGA:'乌干达',UKR:'乌克兰',URY:'乌拉圭',USA:'美国',
    UZB:'乌兹别克斯坦',VEN:'委内瑞拉',VNM:'越南',VUT:'瓦努阿图',PSE:'巴勒斯坦',
    YEM:'也门',ZAF:'南非',ZMB:'赞比亚',ZWE:'津巴布韦',
    '-99':'北塞浦路斯',OSA:'科索沃',SOL:'索马里兰',
    XKX:'科索沃',ESH:'西撒哈拉'
};

/** 世界图标签锚点 [lon, lat]：与主陆块算法配合，大国仍偏时固定到本洲/主国土 */
const LABEL_ANCHOR_LONLAT = {
    USA: [-98, 39.5],
    CAN: [-102, 58],
    FRA: [2.3, 46.8],
    RUS: [96, 64],
    GBR: [-2.3, 53.8],
    CHN: [104, 35],
    AUS: [134, -25],
    NZL: [172.5, -41.5],
    BRA: [-54, -14],
    IND: [77, 22],
    IDN: [118, -2],
    MEX: [-102, 23]
};

let _tooltip, _svg, _loadingEl, _viewport, _contentGroup;

const CHINA_CENTER_LON = 105;
const CHINA_CENTER_LAT = 35;
const INITIAL_ZOOM = 1.5;

async function initWorldMap() {
    _tooltip = document.getElementById('tooltip');
    _svg = document.getElementById('mapSvg');
    _loadingEl = document.getElementById('loading');

    try {
        const geojson = await loadWorldGeoJson();

        processAndRender(geojson);
        if (_loadingEl) _loadingEl.remove();
    } catch (err) {
        console.error('Load error:', err);
        if (_loadingEl) _loadingEl.textContent = '地图数据加载失败';
    }
}

async function loadWorldGeoJson() {
    if (typeof window !== 'undefined' && window.__WORLD_GEOJSON__) {
        return window.__WORLD_GEOJSON__;
    }
    const resp = await fetch('../data/world.json');
    if (!resp.ok) throw new Error('Failed to load world.json');
    return resp.json();
}

function processAndRender(geojson) {
    _contentGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    _contentGroup.setAttribute('id', 'mapContent');
    _svg.appendChild(_contentGroup);

    const cfg = MapRenderer.render(_svg, geojson, {
        container: _contentGroup,
        bounds: { minLon: -180, maxLon: 180, minLat: -60, maxLat: 84 },
        padding: 30,
        getId(feature) {
            if (feature.id === 'TWN') return 'CHN';
            return feature.id || '';
        },
        getClass(feature) {
            if (feature.id === 'CHN' || feature.id === 'TWN') return 'land-china';
            if (feature.id === 'ATA') return 'land';
            return 'land';
        },
        groupBy(feature) {
            if (feature.id === 'TWN') return 'CHN';
            if (feature.id === 'CHN') return 'CHN';
            return null;
        }
    });

    const MAP_LABEL_DISPLAY = {
        '-99': '北塞'
    };

    MapRenderer.appendLabelLayer(_contentGroup, geojson.features, cfg, {
        shouldInclude(feature) {
            return feature && feature.id !== 'TWN';
        },
        getLabel(feature) {
            const fid = feature.id || '';
            if (MAP_LABEL_DISPLAY[fid]) return MAP_LABEL_DISPLAY[fid];
            return COUNTRY_NAMES_CN[fid] || feature.properties?.name || fid;
        },
        getAnchorLonLat(feature) {
            const id = feature && feature.id;
            if (!id || !LABEL_ANCHOR_LONLAT[id]) return null;
            return LABEL_ANCHOR_LONLAT[id];
        },
        sizeRatio: 0.056,
        maxFontSize: 11,
        maxCoverageOfMinSide: 0.33,
        cjkCharWidthFactor: 0.88,
        maxLabelWidthRatio: 0.9,
        skipIfBelowFont: 0.32,
        lengthAdjust(text, fs) {
            const n = text.length;
            if (n >= 10) return fs * 0.78;
            if (n >= 6) return fs * 0.88;
            return fs;
        }
    });

    _viewport = new MapViewport(_svg, _contentGroup, {
        initialScale: INITIAL_ZOOM,
        minScale: 0.6,
        maxScale: 15
    });

    const chinaPos = MapRenderer.projectPoint(CHINA_CENTER_LON, CHINA_CENTER_LAT, cfg);
    _viewport.centerOnSvgPoint(chinaPos[0], chinaPos[1]);

    bindEvents();
}

function bindEvents() {
    _contentGroup.addEventListener('mouseenter', onMouseEnter, true);
    _contentGroup.addEventListener('mousemove', onMouseMove, true);
    _contentGroup.addEventListener('mouseleave', onMouseLeave, true);
    _contentGroup.addEventListener('click', onClick, true);
}

function _isLand(el) {
    return el && (el.classList.contains('land') || el.classList.contains('land-china'));
}

function onMouseEnter(e) {
    if (!_isLand(e.target)) return;
    const fid = e.target.dataset.featureId || e.target.id;
    const cnName = COUNTRY_NAMES_CN[fid] || e.target.dataset.name || fid;

    let hint = '点击进入关卡';
    if (fid === 'CHN') hint = '点击展开中国地图';
    if (fid === 'ATA') hint = '';

    _tooltip.querySelector('.tip-name').textContent = cnName;
    _tooltip.querySelector('.tip-sub').textContent = e.target.dataset.name || '';
    _tooltip.querySelector('.tip-hint').textContent = hint;
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

    const fid = e.target.dataset.featureId || e.target.id;
    if (!fid || fid === 'ATA') return;

    if (fid === 'CHN') {
        window.location.href = 'china.html';
        return;
    }

    const cnName = COUNTRY_NAMES_CN[fid] || e.target.dataset.name || fid;
    e.target.classList.add('active');
    setTimeout(() => e.target.classList.remove('active'), 300);

    if (UEBridge.isInUE()) {
        var nav =
            typeof EarthGuardianCountryGeo !== 'undefined' &&
            EarthGuardianCountryGeo.getNavigationCenter(fid);
        UEBridge.loadLevel(fid, cnName, nav || undefined);
    } else {
        window.location.href = 'categories.html?code=' +
            encodeURIComponent(fid) + '&name=' + encodeURIComponent(cnName);
    }
}

document.addEventListener('DOMContentLoaded', initWorldMap);
