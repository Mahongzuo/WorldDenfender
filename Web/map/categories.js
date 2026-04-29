/**
 * categories.js — 关卡选择页
 *
 * URL: categories.html?code=CN_shandong_370100&name=济南市
 *
 * 逻辑：
 *  1. 从 /Web/data/level-editor-state.json 读取关卡列表
 *  2. 根据 URL code 参数匹配该城市 / 国家的已设计关卡
 *  3. 无设计关卡 → 显示通用默认塔防 + 默认探索关卡
 *  4. 点击关卡卡片 → 启动 Three.js 游戏 /?levelId=X
 */

const _urlParams  = new URLSearchParams(window.location.search);
const _locCode    = _urlParams.get('code') || '';   // e.g. CN_shandong_370100 / FRA
const _locName    = _urlParams.get('name') || '';   // e.g. 济南市 / 法国

/* 游戏模式显示名 */
const MODE_LABELS = {
    towerDefense: { name: '塔 防', cls: 'badge-td'  },
    exploration:  { name: '探 索', cls: 'badge-exp' }
};

const DIRECT_CITY_LEVEL_CODES = {
    CN_beijing: 'city-cn-110100',
    CN_tianjin: 'city-cn-120100',
    CN_shanghai: 'city-cn-310100',
    CN_chongqing: 'city-cn-500100',
    CN_hongkong: 'city-cn-810000',
    CN_macao: 'city-cn-820000'
};

function slugify(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 70);
}

/* ─────────────────────────────────────────────
   匹配逻辑：
   - 精确 id 匹配（CN_shandong_370100, FRA …）
   - city-cn-ADCODE 匹配（从 CN_xxx_ADCODE 提取 ADCODE）
   状态过滤：只显示 designed / needs-work / default
   ───────────────────────────────────────────── */
function findLevelsForCode(levels, code) {
    if (!code) return [];

    // 从 CN_province_adcode 格式提取 adcode，构造 city-cn-adcode
    const parts    = code.split('_');
    const adcode   = (parts.length >= 3) ? parts[parts.length - 1] : null;
    const cityKey  = adcode ? 'city-cn-' + adcode : null;
    const directCityKey = DIRECT_CITY_LEVEL_CODES[code] || null;
    const countryKey = 'country-' + slugify(code);

    const validStatuses = new Set(['designed', 'needs-work', 'default']);

    return levels.filter(l => {
        if (!validStatuses.has(l.status)) return false;
        if (l.id === '__DEFAULT_TD__' || l.id === '__DEFAULT_EXP__') return false;
        return l.id === code || l.id === countryKey || (cityKey && l.id === cityKey) || (directCityKey && l.id === directCityKey);
    });
}

/* ─────────────────────────────────────────────
   关卡卡片 HTML
   ───────────────────────────────────────────── */
function buildGameUrl(level, context) {
    const params = new URLSearchParams();
    params.set('levelId', level.id);
    if (context && context.code) params.set('regionCode', context.code);
    if (context && context.name) params.set('regionName', context.name);
    return '/?' + params.toString();
}

function buildCard(level, context) {
    const td  = level.modeProfiles?.towerDefense?.enabled;
    const exp = level.modeProfiles?.exploration?.enabled;

    const badges = [
        td  ? `<span class="mode-badge badge-td">塔 防</span>`  : '',
        exp ? `<span class="mode-badge badge-exp">探 索</span>` : ''
    ].join('');

    const difficulty = level.difficulty || 1;
    const stars = '★'.repeat(difficulty) + '☆'.repeat(5 - difficulty);

    const statusMap = { designed: '已设计', 'needs-work': '进行中', default: '通用默认' };
    const statusLabel = statusMap[level.status] || level.status || '';

    const card = document.createElement('div');
    card.className = 'lv-card';

    card.innerHTML = `
        <div class="lv-card-top">
            <span class="lv-status ${level.status}">${statusLabel}</span>
            <div class="lv-modes">${badges}</div>
        </div>
        <div class="lv-name">${level.name || level.id}</div>
        <div class="lv-region">${level.location?.regionLabel || ''}</div>
        <div class="lv-stars">${stars}</div>
        <div class="lv-desc">${level.description || ''}</div>
        <button class="lv-start-btn">进 入 关 卡</button>`;

    card.querySelector('.lv-start-btn').addEventListener('click', () => {
        window.location.href = buildGameUrl(level, context);
    });

    return card;
}

/* ─────────────────────────────────────────────
   渲染关卡列表
   ───────────────────────────────────────────── */
function renderLevels(levels, defaults, context) {
    const grid    = document.getElementById('lvGrid');
    const countEl = document.getElementById('lvCount');
    grid.innerHTML = '';

    if (levels.length === 0) {
        // 无设计关卡 → 渲染默认
        if (countEl) countEl.textContent = '通用默认关卡';

        const notice = document.createElement('div');
        notice.className = 'lv-default-notice';
        notice.textContent = '该区域暂无专属关卡，已为你加载通用关卡。';
        grid.appendChild(notice);

        defaults.forEach(d => {
            if (d) grid.appendChild(buildCard(d, context));
        });
    } else {
        if (countEl) countEl.textContent = `${levels.length} 个关卡`;
        levels.forEach(l => grid.appendChild(buildCard(l, context)));
    }
}

/* ─────────────────────────────────────────────
   初始化
   ───────────────────────────────────────────── */
async function init() {
    // 设置地点标题
    const locEl  = document.getElementById('lvLocationName');
    const titleEl = document.getElementById('lvTitle');

    if (_locName) {
        if (locEl)  locEl.textContent  = _locName;
        if (titleEl) titleEl.textContent = _locName + ' · 关卡选择';
        document.title = _locName + ' — 地球守卫';
    }

    // 设置返回链接
    const backEl = document.getElementById('lvBack');
    if (backEl) {
        const ref = document.referrer;
        if (ref && ref.includes('province.html')) {
            backEl.href = ref;
        } else if (ref && ref.includes('china.html')) {
            backEl.href = 'china.html';
        } else if (ref && ref.includes('world.html')) {
            backEl.href = 'world.html';
        } else {
            backEl.href = 'china.html';
        }
    }

    try {
        const resp = await fetch('/Web/data/level-editor-state.json', { cache: 'no-cache' });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const payload  = await resp.json();
        const allLevels = Array.isArray(payload.levels) ? payload.levels : [];

        // 找默认关卡
        const defaultTD  = allLevels.find(l => l.id === '__DEFAULT_TD__');
        const defaultExp = allLevels.find(l => l.id === '__DEFAULT_EXP__');

        if (_locCode) {
            /* 地点模式 */
            const matched = findLevelsForCode(allLevels, _locCode);
            renderLevels(matched, [defaultTD, defaultExp].filter(Boolean), { code: _locCode, name: _locName });
        } else {
            /* 全局浏览模式：展示所有已设计关卡，按地区分组 */
            const designed = allLevels.filter(
                l => (l.status === 'designed' || l.status === 'needs-work')
                     && l.id !== '__DEFAULT_TD__' && l.id !== '__DEFAULT_EXP__'
            );
            renderLevels(designed, [defaultTD, defaultExp].filter(Boolean), null);
        }
    } catch (err) {
        console.error('[categories]', err);
        document.getElementById('lvGrid').innerHTML =
            '<div class="lv-error">关卡数据加载失败，请确认 Vite 开发服务器已启动。</div>';
    }
}

document.addEventListener('DOMContentLoaded', init);
