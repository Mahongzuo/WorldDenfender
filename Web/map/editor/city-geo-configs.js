/**
 * editor/city-geo-configs.js
 * 城市地理信息静态配置 — 在 level-editor.js 与 level-editor-preview.js 之间共享。
 * 纯数据，无副作用，无依赖。
 */

export var DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID = '2275207';
export var JINAN_MAP_TEXTURE_URL = '/Arts/Maps/jinan_full_map.png';

export var CITY_GEO_CONFIGS = {
    beijing: {
        enabled: true,
        provider: 'cesium-ion',
        assetId: DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID,
        center: { lat: 39.9163447, lon: 116.3971555, heightMeters: 45 },
        extentMeters: 1400,
        rotationDeg: 0,
        boardHeightMeters: 32
    },
    shanghai: {
        enabled: true,
        provider: 'cesium-ion',
        assetId: DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID,
        center: { lat: 31.2401, lon: 121.4908, heightMeters: 8 },
        extentMeters: 1400,
        rotationDeg: 0,
        boardHeightMeters: 32
    },
    guangzhou: {
        enabled: true,
        provider: 'cesium-ion',
        assetId: DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID,
        center: { lat: 23.1064, lon: 113.3245, heightMeters: 12 },
        extentMeters: 1400,
        rotationDeg: 0,
        boardHeightMeters: 34
    },
    shenzhen: {
        enabled: true,
        provider: 'cesium-ion',
        assetId: DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID,
        center: { lat: 22.5409, lon: 113.9507, heightMeters: 20 },
        extentMeters: 1400,
        rotationDeg: 0,
        boardHeightMeters: 34
    },
    jinan: {
        enabled: true,
        provider: 'cesium-ion',
        assetId: DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID,
        center: { lat: 36.6616, lon: 117.0204, heightMeters: 32 },
        extentMeters: 1200,
        rotationDeg: 0,
        boardHeightMeters: 62
    },
    jinanOlympic: {
        enabled: true,
        provider: 'cesium-ion',
        assetId: DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID,
        center: { lat: 36.655, lon: 117.118, heightMeters: 35 },
        extentMeters: 1200,
        rotationDeg: 0,
        boardHeightMeters: 42
    },
    paris: {
        enabled: true,
        provider: 'cesium-ion',
        assetId: DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID,
        center: { lat: 48.8583736, lon: 2.2944813, heightMeters: 40 },
        extentMeters: 2000,
        rotationDeg: 0,
        boardHeightMeters: 80,
        scale: 1
    }
};
