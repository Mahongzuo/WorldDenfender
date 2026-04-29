/**
 * 国家关卡 / Cesium 底板 / UE 传送用：经纬度中心点（WGS84）
 * - 地标优先（法国埃菲尔铁塔、美国自由女神像等）
 * - 以下为各国首都或与首都同城的常用代表性坐标（供离线回退）；在线时编辑器可再叠加 restcountries capitalInfo
 *
 * longitude 经度, latitude 纬度（与编辑器 map.geo.center 一致）
 */
(function (global) {
    'use strict';

    /** 用户指定的地标或对应用表现中心（优先于静态首都表） */
    var LANDMARK_CENTERS = {
        /** 埃菲尔铁塔附近 */
        FRA: { lat: 48.8583736, lon: 2.2944813 },
        /** 自由女神像（纽约港）——美国「国际关卡」观感 */
        USA: { lat: 40.6892474, lon: -74.0445004 },
        /** 加拿大：渥太华国会区 */
        CAN: { lat: 45.4215296, lon: -75.6971931 },
        /** 日本：东京駅 / 丸之内一带 */
        JPN: { lat: 35.6812363, lon: 139.7671248 },
        /** 韩国：首尔光化门一带 */
        KOR: { lat: 37.5759269, lon: 126.9768153 },
        /** 印度：新德里中央政府区 */
        IND: { lat: 28.6139391, lon: 77.2090213 }
    };

    /**
     * 各国首都近似坐标（与 ISO 3166-1 alpha-3 / 世界 GeoJSON feature.id 一致）
     * 用于：离线、API 不可用、或使用者在编辑器中选择「套用首都默认值」。
     */
    var CAPITAL_CENTERS = {
        ABW: { lat: 12.5211, lon: -70.027 },
        AFG: { lat: 34.5553, lon: 69.2075 },
        AGO: { lat: -8.8383, lon: 13.2344 },
        ALB: { lat: 41.3275, lon: 19.8189 },
        AND: { lat: 42.5063, lon: 1.5218 },
        ARE: { lat: 24.4539, lon: 54.3773 },
        ARG: { lat: -34.6037, lon: -58.3816 },
        ARM: { lat: 40.1816, lon: 44.5146 },
        ATG: { lat: 17.1172, lon: -61.8468 },
        AUS: { lat: -35.2809, lon: 149.13 },
        AUT: { lat: 48.2082, lon: 16.3738 },
        AZE: { lat: 40.4093, lon: 49.8671 },
        BDI: { lat: -3.3822, lon: 29.3644 },
        BEL: { lat: 50.8503, lon: 4.3517 },
        BEN: { lat: 6.4972, lon: 2.605 },
        BFA: { lat: 12.3714, lon: -1.519 },
        BGD: { lat: 23.8103, lon: 90.4125 },
        BGR: { lat: 42.6977, lon: 23.3219 },
        BHR: { lat: 26.0667, lon: 50.5577 },
        BHS: { lat: 25.0582, lon: -77.3431 },
        BIH: { lat: 43.8486, lon: 18.3564 },
        BLR: { lat: 53.9045, lon: 27.5615 },
        BLZ: { lat: 17.2511, lon: -88.759 },
        BOL: { lat: -16.5, lon: -68.15 },
        BRA: { lat: -15.7939, lon: -47.8828 },
        BRB: { lat: 13.1, lon: -59.6167 },
        BRN: { lat: 4.9031, lon: 114.9398 },
        BTN: { lat: 27.4729, lon: 89.639 },
        BWA: { lat: -24.6282, lon: 25.923 },
        CAF: { lat: 4.3947, lon: 18.5582 },
        CHE: { lat: 46.9481, lon: 7.4474 },
        CHL: { lat: -33.4489, lon: -70.6693 },
        CHN: { lat: 39.9042, lon: 116.4074 },
        CIV: { lat: 6.8276, lon: -5.2893 },
        CMR: { lat: 3.848, lon: 11.502 },
        COD: { lat: -4.0383, lon: 15.2663 },
        COG: { lat: -4.2694, lon: 15.2712 },
        COL: { lat: 4.711, lon: -74.0721 },
        CPV: { lat: 14.9169, lon: -23.5092 },
        CRI: { lat: 9.9281, lon: -84.0907 },
        CUB: { lat: 23.1362, lon: -82.388 },
        CUW: { lat: 12.1696, lon: -68.990 },
        CYM: { lat: 19.3134, lon: -81.2546 },
        CYP: { lat: 35.1739, lon: 33.364 },
        CZE: { lat: 50.0755, lon: 14.4378 },
        DEU: { lat: 52.5200, lon: 13.405 },
        DJI: { lat: 11.5949, lon: 43.145 },
        DMA: { lat: 15.301, lon: -61.387 },
        DNK: { lat: 55.6761, lon: 12.5683 },
        DOM: { lat: 18.4861, lon: -69.9312 },
        DZA: { lat: 36.7372, lon: 3.0869 },
        ECU: { lat: -0.1807, lon: -78.4678 },
        EGY: { lat: 30.0444, lon: 31.2357 },
        ERI: { lat: 15.5031, lon: 38.7658 },
        ESP: { lat: 40.4168, lon: -3.7038 },
        EST: { lat: 59.4369, lon: 24.7537 },
        ETH: { lat: 9.145, lon: 40.4897 },
        FIN: { lat: 60.1699, lon: 24.9384 },
        FJI: { lat: -18.1417, lon: 178.4419 },
        FSM: { lat: 5.1602, lon: 158.1621 },
        GAB: { lat: 0.4163, lon: 9.467 },
        GBR: { lat: 51.5074, lon: -0.1278 },
        GEO: { lat: 41.7151, lon: 44.8271 },
        GHA: { lat: 5.556, lon: -0.196 },
        GIN: { lat: 9.6416, lon: -13.5794 },
        GMB: { lat: 13.4426, lon: -16.5785 },
        GNB: { lat: 11.8795, lon: -15.597 },
        GNQ: { lat: 3.7493, lon: 8.7742 },
        GRC: { lat: 37.9838, lon: 23.7275 },
        GRD: { lat: 12.0653, lon: -61.749 },
        GTM: { lat: 14.6133, lon: -90.535 },
        GUY: { lat: 6.7924, lon: -58.163 },
        HND: { lat: 14.0723, lon: -87.192 },
        HRV: { lat: 45.815, lon: 15.982 },
        HTI: { lat: 18.5944, lon: -72.307 },
        HUN: { lat: 47.4979, lon: 19.0402 },
        IDN: { lat: -6.2088, lon: 106.8456 },
        IRL: { lat: 53.3498, lon: -6.2603 },
        IRN: { lat: 35.6892, lon: 51.389 },
        IRQ: { lat: 33.3152, lon: 44.3662 },
        ISL: { lat: 64.1466, lon: -21.9426 },
        ISR: { lat: 31.7683, lon: 35.2137 },
        ITA: { lat: 41.9028, lon: 12.4964 },
        JAM: { lat: 18.0179, lon: -76.793 },
        JOR: { lat: 31.9454, lon: 35.9324 },
        KAZ: { lat: 51.1694, lon: 71.449 },
        KGZ: { lat: 42.8746, lon: 74.5698 },
        KHM: { lat: 11.5564, lon: 104.928 },
        KIR: { lat: 1.3278, lon: 172.981 },
        KNA: { lat: 17.2962, lon: -62.723 },
        LAO: { lat: 17.9749, lon: 102.633 },
        LBN: { lat: 33.885, lon: 35.519 },
        LBR: { lat: 6.2907, lon: -10.7606 },
        LBY: { lat: 32.8925, lon: 13.18 },
        LKA: { lat: 6.9327, lon: 79.8612 },
        LIE: { lat: 47.1393, lon: 9.5215 },
        LSO: { lat: -29.3167, lon: 27.4833 },
        LTU: { lat: 54.6872, lon: 25.2797 },
        LUX: { lat: 49.6116, lon: 6.1319 },
        LVA: { lat: 56.9496, lon: 24.1052 },
        MAR: { lat: 34.0209, lon: -6.8416 },
        MCO: { lat: 43.7384, lon: 7.4246 },
        MDA: { lat: 47.0104, lon: 28.8638 },
        MDG: { lat: -18.8792, lon: 47.5079 },
        MDV: { lat: 4.1755, lon: 73.5093 },
        MEX: { lat: 19.4326, lon: -99.1332 },
        MHL: { lat: 7.1315, lon: 171.184 },
        MKD: { lat: 41.9981, lon: 21.4254 },
        MLI: { lat: 12.6392, lon: -8.0029 },
        MLT: { lat: 35.8989, lon: 14.5146 },
        MMR: { lat: 16.8661, lon: 96.195 },
        MNE: { lat: 42.7087, lon: 19.374 },
        MNG: { lat: 47.9212, lon: 106.905 },
        MOZ: { lat: -25.9655, lon: 32.583 },
        MRT: { lat: 18.0735, lon: -15.958 },
        MSR: { lat: 16.7425, lon: -62.187},
        MTQ: { lat: 14.6136, lon: -61.049 },
        MUS: { lat: -20.1609, lon: 57.501 },
        MWI: { lat: -13.9626, lon: 33.774 },
        MYS: { lat: 3.139, lon: 101.6869 },
        NAM: { lat: -22.5749, lon: 17.0805 },
        NCL: { lat: -22.2758, lon: 166.458 },
        NER: { lat: 13.5317, lon: 2.1098 },
        NGA: { lat: 9.0765, lon: 7.3986 },
        NIC: { lat: 12.1156, lon: -86.236 },
        NIUE: { lat: -19.049, lon: -169.867 },
        NOR: { lat: 59.9139, lon: 10.7522 },
        NLD: { lat: 52.3676, lon: 4.9041 },
        NPL: { lat: 27.7172, lon: 85.324 },
        NRU: { lat: -0.5477, lon: 166.9209 },
        NZL: { lat: -41.2865, lon: 174.7762 },
        OMN: { lat: 23.6139, lon: 58.5922 },
        PAK: { lat: 33.6938, lon: 73.0657 },
        PAN: { lat: 9.0745, lon: -79.502 },
        PER: { lat: -12.0464, lon: -77.0428 },
        PHL: { lat: 14.5995, lon: 120.984 },
        PNG: { lat: -9.478, lon: 147.15 },
        POL: { lat: 52.2297, lon: 21.0122 },
        PRK: { lat: 39.0392, lon: 125.7625 },
        PRY: { lat: -25.2865, lon: -57.647 },
        PSE: { lat: 31.9522, lon: 35.2332 },
        QAT: { lat: 25.2854, lon: 51.531 },
        ROU: { lat: 44.4268, lon: 26.1025 },
        RUS: { lat: 55.7558, lon: 37.6173 },
        RWA: { lat: -1.9441, lon: 30.0619 },
        SAU: { lat: 24.7136, lon: 46.6753 },
        SDN: { lat: 15.5007, lon: 32.5599 },
        SEN: { lat: 14.7167, lon: -17.4677 },
        SGP: { lat: 1.3521, lon: 103.8198 },
        SLB: { lat: -9.4295, lon: 159.949 },
        SLE: { lat: 8.4657, lon: -13.2317 },
        SLV: { lat: 13.6929, lon: -89.2182 },
        SMR: { lat: 43.9424, lon: 12.4578 },
        SOM: { lat: 2.0371, lon: 45.3438 },
        SRB: { lat: 44.7866, lon: 20.4489 },
        SSD: { lat: 4.8594, lon: 31.5713 },
        STP: { lat: 0.3496, lon: 6.6003 },
        SUR: { lat: 5.8520, lon: -55.2038 },
        SVK: { lat: 48.1466, lon: 17.1077 },
        SVN: { lat: 46.0569, lon: 14.5058 },
        SWE: { lat: 59.3293, lon: 18.0686 },
        SWZ: { lat: -26.3054, lon: 31.1368 },
        SYC: { lat: -4.6796, lon: 55.492 },
        TCA: { lat: 21.4608, lon: -71.8108 },
        TGO: { lat: 6.2275, lon: 1.6917 },
        THA: { lat: 13.7525, lon: 100.493 },
        TJK: { lat: 38.5844, lon: 68.7879 },
        TKM: { lat: 37.9838, lon: 58.326 },
        TLS: { lat: -8.5586, lon: 125.579 },
        TON: { lat: -21.179, lon: -175.198 },
        TTO: { lat: 10.6596, lon: -61.5088 },
        TUN: { lat: 36.8545, lon: 10.1826 },
        TUR: { lat: 39.9334, lon: 32.8597 },
        TZA: { lat: -6.7931, lon: 39.2755 },
        UGA: { lat: 0.3476, lon: 32.5825 },
        UKR: { lat: 50.4501, lon: 30.5234 },
        UZB: { lat: 41.3775, lon: 69.2401 },
        VAT: { lat: 41.9029, lon: 12.453 },
        VGB: { lat: 18.4274, lon: -64.618 },
        VIR: { lat: 18.3419, lon: -64.933 },
        URY: { lat: -34.8836, lon: -56.1645 },
        VEN: { lat: 10.4806, lon: -66.9036 },
        VNM: { lat: 21.0278, lon: 105.834 },
        VUT: { lat: -17.7345, lon: 168.3209 },
        WSM: { lat: -13.8333, lon: -171.7667 },
        YEM: { lat: 15.5527, lon: 48.5164 },
        ZAF: { lat: -25.7479, lon: 28.2293 },
        ZMB: { lat: -15.4167, lon: 28.2833 },
        ZWE: { lat: -17.8252, lon: 31.0335 }
    };

    function _mergeLandmarksIntoCapitals() {
        Object.keys(LANDMARK_CENTERS).forEach(function (k) {
            CAPITAL_CENTERS[k] = LANDMARK_CENTERS[k];
        });
    }
    _mergeLandmarksIntoCapitals();

    /**
     * @param {string} iso3
     * @returns {{lat:number, lon:number}|null}
     */
    function getNavigationCenter(iso3) {
        var k = String(iso3 || '').toUpperCase();
        if (LANDMARK_CENTERS[k]) {
            return { lat: LANDMARK_CENTERS[k].lat, lon: LANDMARK_CENTERS[k].lon };
        }
        if (CAPITAL_CENTERS[k]) {
            return { lat: CAPITAL_CENTERS[k].lat, lon: CAPITAL_CENTERS[k].lon };
        }
        return null;
    }

    /**
     * 编辑器：地标 > 远程首都 > 静态首都
     * @param {string} iso3
     * @param {{lat:number, lon:number}|undefined|null} remoteCapital
     */
    function resolveCenterForEditor(iso3, remoteCapital) {
        var k = String(iso3 || '').toUpperCase();
        if (LANDMARK_CENTERS[k]) {
            return { lat: LANDMARK_CENTERS[k].lat, lon: LANDMARK_CENTERS[k].lon };
        }
        if (remoteCapital && Number.isFinite(remoteCapital.lat) && Number.isFinite(remoteCapital.lon)) {
            return { lat: remoteCapital.lat, lon: remoteCapital.lon };
        }
        if (CAPITAL_CENTERS[k]) {
            return { lat: CAPITAL_CENTERS[k].lat, lon: CAPITAL_CENTERS[k].lon };
        }
        return null;
    }

    global.EarthGuardianCountryGeo = {
        getNavigationCenter: getNavigationCenter,
        resolveCenterForEditor: resolveCenterForEditor,
        LANDMARK_CENTERS: LANDMARK_CENTERS,
        CAPITAL_CENTERS: CAPITAL_CENTERS
    };
})(typeof window !== 'undefined' ? window : globalThis);
