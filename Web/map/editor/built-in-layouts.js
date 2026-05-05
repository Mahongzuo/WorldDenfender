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
            theme: { ground: '#3d524c', groundAlt: '#344844', road: '#4d6560', obstacle: '#5c4d56', accent: '#7fb5a5', fog: '#263832' },
            path: [{ col: 0, row: 13 }, { col: 5, row: 13 }, { col: 5, row: 9 }, { col: 10, row: 9 }, { col: 10, row: 4 }, { col: 18, row: 4 }, { col: 18, row: 11 }, { col: 27, row: 11 }],
            obstacles: cellsRect(2, 2, 4, 2).concat(cellsRect(12, 7, 3, 2), cellsRect(21, 3, 3, 3), cellsRect(2, 15, 5, 2), cellsRect(22, 14, 4, 2))
        },
        explore: {
            theme: { ground: '#05080f', groundAlt: '#0a1220', road: '#1e3040', obstacle: '#382428', accent: '#4a9eaa', fog: '#03060c' },
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
            theme: { ground: '#6f9fa7', groundAlt: '#5f8f97', road: '#82b5bc', obstacle: '#b88772', accent: '#c9a882', fog: '#507880' },
            path: [{ col: 0, row: 3 }, { col: 8, row: 3 }, { col: 8, row: 14 }, { col: 15, row: 14 }, { col: 15, row: 7 }, { col: 23, row: 7 }, { col: 23, row: 15 }, { col: 27, row: 15 }],
            obstacles: cellsRect(3, 8, 3, 3).concat(cellsRect(11, 2, 4, 2), cellsRect(18, 11, 3, 4), cellsRect(24, 2, 3, 3), cellsRect(1, 15, 4, 2))
        },
        explore: {
            theme: { ground: '#1a4d3f', groundAlt: '#154038', road: '#276658', obstacle: '#3d8068', accent: '#6b9888', fog: '#0f3028' },
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
            theme: { ground: '#79967c', groundAlt: '#6a876e', road: '#8daa91', obstacle: '#a86878', accent: '#c49a7a', fog: '#536956' },
            path: [{ col: 0, row: 9 }, { col: 4, row: 9 }, { col: 4, row: 3 }, { col: 12, row: 3 }, { col: 12, row: 12 }, { col: 20, row: 12 }, { col: 20, row: 5 }, { col: 27, row: 5 }],
            obstacles: cellsRect(1, 1, 3, 2).concat(cellsRect(7, 7, 3, 4), cellsRect(15, 2, 3, 3), cellsRect(22, 10, 4, 4), cellsRect(9, 15, 8, 2))
        },
        explore: {
            theme: { ground: '#2a4480', groundAlt: '#264078', road: '#3a5c9c', obstacle: '#5a78b0', accent: '#7a94b8', fog: '#1a2850' },
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
            theme: { ground: '#9ebfcf', groundAlt: '#8babbf', road: '#b0ccd8', obstacle: '#957dad', accent: '#c4ae88', fog: '#708898' },
            path: [{ col: 0, row: 15 }, { col: 6, row: 15 }, { col: 6, row: 11 }, { col: 14, row: 11 }, { col: 14, row: 6 }, { col: 8, row: 6 }, { col: 8, row: 2 }, { col: 21, row: 2 }, { col: 21, row: 9 }, { col: 27, row: 9 }],
            obstacles: cellsRect(2, 3, 4, 4).concat(cellsRect(10, 14, 5, 3), cellsRect(17, 5, 3, 5), cellsRect(23, 12, 4, 4), cellsRect(11, 8, 2, 2))
        },
        explore: {
            theme: { ground: '#5a2878', groundAlt: '#663090', road: '#7848a8', obstacle: '#8860b8', accent: '#a890c8', fog: '#3c1858' },
            path: [{ col: 5, row: 15 }, { col: 5, row: 9 }, { col: 12, row: 9 }, { col: 12, row: 3 }, { col: 21, row: 3 }, { col: 21, row: 12 }, { col: 26, row: 12 }],
            obstacles: cellsRect(1, 2, 5, 5).concat(cellsRect(8, 13, 5, 3), cellsRect(15, 7, 4, 4), cellsRect(22, 15, 4, 2))
        }
    },
    jinan: {
        aliases: ['济南', '济南市', '山东·济南', '山东 · 济南', '中国·济南', '中国 · 济南', '中国 · 济南市'],
        defenseName: '济南·泉港栈桥',
        exploreName: '济南·趵突露台',
        geo: CITY_GEO_CONFIGS.jinan,
        defense: {
            theme: { ground: '#6e9e96', groundAlt: '#5f8e86', road: '#82b0a6', obstacle: '#a89458', accent: '#b8a078', fog: '#4a7068' },
            path: [{ col: 0, row: 6 }, { col: 7, row: 6 }, { col: 7, row: 12 }, { col: 13, row: 12 }, { col: 13, row: 8 }, { col: 19, row: 8 }, { col: 19, row: 3 }, { col: 24, row: 3 }, { col: 24, row: 13 }, { col: 27, row: 13 }],
            obstacles: cellsRect(1, 1, 5, 3).concat(cellsRect(10, 3, 4, 3), cellsRect(15, 13, 5, 3), cellsRect(21, 6, 3, 4), cellsRect(3, 14, 5, 3))
        },
        explore: {
            theme: { ground: '#8898a8', groundAlt: '#7a8a9c', road: '#9cacb8', obstacle: '#607890', accent: '#80b0a8', fog: '#687884' },
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
