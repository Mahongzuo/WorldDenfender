/**
 * editor/built-in-layouts.js
 * 内置城市关卡布局预设（路径、障碍、主题色）+ matchBuiltInCity 匹配助手。
 * 依赖：city-geo-configs.js
 */

import { CITY_GEO_CONFIGS } from './city-geo-configs.js';

function cellsRect(col, row, width, height) {
    var cells = [];
    for (var y = row; y < row + height; y += 1) {
        for (var x = col; x < col + width; x += 1) {
            cells.push({ col: x, row: y });
        }
    }
    return cells;
}

export var BUILT_IN_CITY_LAYOUTS = {
    beijing: {
        aliases: ['北京', '北京市', '中国·北京', '中国 · 北京'],
        defenseName: '北京·帝都枢纽',
        exploreName: '北京·霓虹街区',
        geo: CITY_GEO_CONFIGS.beijing,
        defense: {
            theme: { ground: '#6f746e', groundAlt: '#636861', road: '#9da08f', obstacle: '#97877c', accent: '#b7b39a', fog: '#545650' },
            path: [{ col: 0, row: 13 }, { col: 5, row: 13 }, { col: 5, row: 9 }, { col: 10, row: 9 }, { col: 10, row: 4 }, { col: 18, row: 4 }, { col: 18, row: 11 }, { col: 27, row: 11 }],
            obstacles: cellsRect(2, 2, 4, 2).concat(cellsRect(12, 7, 3, 2), cellsRect(21, 3, 3, 3), cellsRect(2, 15, 5, 2), cellsRect(22, 14, 4, 2))
        },
        explore: {
            theme: { ground: '#2e3840', groundAlt: '#253038', road: '#53656d', obstacle: '#6d625b', accent: '#9da68f', fog: '#1f292f' },
            path: [{ col: 3, row: 9 }, { col: 10, row: 9 }, { col: 10, row: 4 }, { col: 17, row: 4 }, { col: 17, row: 13 }, { col: 24, row: 13 }],
            obstacles: cellsRect(1, 1, 5, 3).concat(cellsRect(21, 1, 5, 4), cellsRect(3, 14, 4, 3), cellsRect(12, 8, 4, 2), cellsRect(22, 8, 3, 3))
        }
    },
    shanghai: {
        aliases: ['上海', '上海市', '中国·上海', '中国 · 上海'],
        defenseName: '上海·外滩沙城',
        exploreName: '上海·学院环廊',
        geo: CITY_GEO_CONFIGS.shanghai,
        defense: {
            theme: { ground: '#7b8f92', groundAlt: '#6f8387', road: '#9fb1b3', obstacle: '#a18d7f', accent: '#c3b7a1', fog: '#596a6d' },
            path: [{ col: 0, row: 3 }, { col: 8, row: 3 }, { col: 8, row: 14 }, { col: 15, row: 14 }, { col: 15, row: 7 }, { col: 23, row: 7 }, { col: 23, row: 15 }, { col: 27, row: 15 }],
            obstacles: cellsRect(3, 8, 3, 3).concat(cellsRect(11, 2, 4, 2), cellsRect(18, 11, 3, 4), cellsRect(24, 2, 3, 3), cellsRect(1, 15, 4, 2))
        },
        explore: {
            theme: { ground: '#31484b', groundAlt: '#2a3f42', road: '#59777a', obstacle: '#75695c', accent: '#a6a084', fog: '#223236' },
            path: [{ col: 4, row: 3 }, { col: 23, row: 3 }, { col: 23, row: 14 }, { col: 4, row: 14 }, { col: 4, row: 3 }],
            obstacles: cellsRect(8, 6, 4, 6).concat(cellsRect(16, 6, 4, 6), cellsRect(1, 7, 2, 4), cellsRect(25, 7, 2, 4))
        }
    },
    guangzhou: {
        aliases: ['广州', '广州市', '中国·广州', '中国 · 广州', '中国 · 广州市'],
        defenseName: '广州·南岭雪径',
        exploreName: '广州·夜港平台',
        geo: CITY_GEO_CONFIGS.guangzhou,
        defense: {
            theme: { ground: '#738671', groundAlt: '#677965', road: '#93a28b', obstacle: '#9a8578', accent: '#b8ac90', fog: '#546251' },
            path: [{ col: 0, row: 9 }, { col: 4, row: 9 }, { col: 4, row: 3 }, { col: 12, row: 3 }, { col: 12, row: 12 }, { col: 20, row: 12 }, { col: 20, row: 5 }, { col: 27, row: 5 }],
            obstacles: cellsRect(1, 1, 3, 2).concat(cellsRect(7, 7, 3, 4), cellsRect(15, 2, 3, 3), cellsRect(22, 10, 4, 4), cellsRect(9, 15, 8, 2))
        },
        explore: {
            theme: { ground: '#334350', groundAlt: '#2c3a46', road: '#5c7380', obstacle: '#74696f', accent: '#9aa88e', fog: '#253039' },
            path: [{ col: 2, row: 5 }, { col: 9, row: 5 }, { col: 9, row: 11 }, { col: 18, row: 11 }, { col: 18, row: 6 }, { col: 26, row: 6 }],
            obstacles: cellsRect(1, 13, 7, 3).concat(cellsRect(12, 2, 5, 3), cellsRect(20, 10, 5, 5), cellsRect(3, 8, 3, 2))
        }
    },
    shenzhen: {
        aliases: ['深圳', '深圳市', '中国·深圳', '中国 · 深圳', '中国 · 深圳市', '广东·深圳'],
        defenseName: '深圳·科技裂谷',
        exploreName: '深圳·欢乐海岸',
        geo: CITY_GEO_CONFIGS.shenzhen,
        defense: {
            theme: { ground: '#748892', groundAlt: '#697b85', road: '#95a8b1', obstacle: '#8e8595', accent: '#b0b4a1', fog: '#576771' },
            path: [{ col: 0, row: 15 }, { col: 6, row: 15 }, { col: 6, row: 11 }, { col: 14, row: 11 }, { col: 14, row: 6 }, { col: 8, row: 6 }, { col: 8, row: 2 }, { col: 21, row: 2 }, { col: 21, row: 9 }, { col: 27, row: 9 }],
            obstacles: cellsRect(2, 3, 4, 4).concat(cellsRect(10, 14, 5, 3), cellsRect(17, 5, 3, 5), cellsRect(23, 12, 4, 4), cellsRect(11, 8, 2, 2))
        },
        explore: {
            theme: { ground: '#39414c', groundAlt: '#313944', road: '#646f7f', obstacle: '#746b7d', accent: '#a0aaa0', fog: '#262c36' },
            path: [{ col: 5, row: 15 }, { col: 5, row: 9 }, { col: 12, row: 9 }, { col: 12, row: 3 }, { col: 21, row: 3 }, { col: 21, row: 12 }, { col: 26, row: 12 }],
            obstacles: cellsRect(1, 2, 5, 5).concat(cellsRect(8, 13, 5, 3), cellsRect(15, 7, 4, 4), cellsRect(22, 15, 4, 2))
        }
    },
    jinan: {
        aliases: ['济南', '济南市', '山东·济南', '山东 · 济南', '中国·济南', '中国 · 济南', '中国 · 济南市'],
        defenseName: '济南·泉港曲栈',
        exploreName: '济南·趵突露台',
        geo: CITY_GEO_CONFIGS.jinan,
        defense: {
            theme: { ground: '#78918a', groundAlt: '#6b837c', road: '#9ab0a8', obstacle: '#9c8f79', accent: '#c2bb9e', fog: '#586d66' },
            path: [{ col: 0, row: 6 }, { col: 7, row: 6 }, { col: 7, row: 12 }, { col: 13, row: 12 }, { col: 13, row: 8 }, { col: 19, row: 8 }, { col: 19, row: 3 }, { col: 24, row: 3 }, { col: 24, row: 13 }, { col: 27, row: 13 }],
            obstacles: cellsRect(1, 1, 5, 3).concat(cellsRect(10, 3, 4, 3), cellsRect(15, 13, 5, 3), cellsRect(21, 6, 3, 4), cellsRect(3, 14, 5, 3))
        },
        explore: {
            theme: { ground: '#4b5f67', groundAlt: '#41535b', road: '#70838a', obstacle: '#857b68', accent: '#b1b29a', fog: '#36454b' },
            path: [{ col: 2, row: 8 }, { col: 8, row: 8 }, { col: 8, row: 3 }, { col: 19, row: 3 }, { col: 19, row: 14 }, { col: 26, row: 14 }],
            obstacles: cellsRect(1, 1, 4, 3).concat(cellsRect(10, 10, 4, 4), cellsRect(15, 6, 3, 3), cellsRect(23, 2, 4, 4), cellsRect(4, 14, 5, 2))
        }
    }
};

/**
 * 从关卡 metadata 中识别匹配的内置城市 key。
 * 与 level-editor.js 中的同名函数保持一致。
 */
export function matchBuiltInCity(level) {
    var haystack = [
        level.id,
        level.name,
        level.location.countryName,
        level.location.cityName,
        level.location.regionLabel,
        level.location.cityCode
    ].join(' ').replace(/\s+/g, '');
    var keys = Object.keys(BUILT_IN_CITY_LAYOUTS);
    for (var index = 0; index < keys.length; index += 1) {
        var key = keys[index];
        if (BUILT_IN_CITY_LAYOUTS[key].aliases.some(function (alias) {
            return haystack.indexOf(alias.replace(/\s+/g, '')) !== -1;
        })) {
            return key;
        }
    }
    return '';
}
