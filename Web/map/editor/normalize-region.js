/**
 * Region / locality label helpers extracted from normalizers.js for smaller chunks.
 */

export function splitRegion(region) {
    var parts = String(region || '')
        .split(/[·・\-\/]/)
        .map(function (part) {
            return part.trim();
        })
        .filter(Boolean);
    return { country: parts[0] || region || '', city: parts[1] || '' };
}

export function buildRegionLabel(location, fallback) {
    if (location.countryName && location.cityName) return location.countryName + ' · ' + location.cityName;
    return fallback || location.countryName || '未设置地区';
}

export function inferCountryCode(countryName) {
    if (countryName === '中国') return 'CN';
    if (countryName === '美国') return 'US';
    if (countryName === '日本') return 'JP';
    if (countryName === '法国') return 'FR';
    return '';
}
