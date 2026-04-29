/**
 * 异环·环城防线 — 首页逻辑
 */

const CITY_LIST = [
    { code: 'beijing',  name: '北京' },
    { code: 'shanghai', name: '上海' },
    { code: 'guangzhou', name: '广州' },
    { code: 'shenzhen', name: '深圳' },
    { code: 'jinan',    name: '济南' }
];

function onSettings() {
    UEBridge.sendToUE('navigate', { target: 'settings' });
}

function onAbout() {
    UEBridge.sendToUE('navigate', { target: 'about' });
}

function onRandomStart() {
    const pick = CITY_LIST[Math.floor(Math.random() * CITY_LIST.length)];
    // 跳转到 Vite 塔防页面
    window.location.href = '/index.html?city=' + pick.code;
}
