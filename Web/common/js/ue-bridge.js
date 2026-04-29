/**
 * UE-Web Communication Bridge
 *
 * Two transport layers:
 *  1. URL hash change  – UE's UWebBrowser fires OnUrlChanged, we parse the fragment.
 *  2. ue:// scheme via hidden iframe – fallback for engines that intercept OnBeforeNavigation.
 *
 * UE C++ side should bind OnUrlChanged and look for fragments starting with "#ue:".
 */
const UEBridge = (() => {
    let _debugMode = true;
    let _seq = 0;

    function sendToUE(action, data) {
        const payload = encodeURIComponent(JSON.stringify(data));
        const tag = `#ue:${action}:${payload}:${++_seq}`;

        if (_debugMode) {
            console.log(`[UEBridge] ${action}:`, data);
        }

        window.location.hash = tag;
        setTimeout(() => { window.location.hash = ''; }, 50);
    }

    function loadLevel(code, name, navigation) {
        var payload = { code: String(code || ''), name: String(name || '') };
        if (
            navigation &&
            typeof navigation === 'object' &&
            Number.isFinite(navigation.lat) &&
            Number.isFinite(navigation.lon)
        ) {
            payload.lat = navigation.lat;
            payload.lon = navigation.lon;
        }
        sendToUE('loadLevel', payload);
    }

    function goBack() {
        sendToUE('goBack', {});
    }

    /** 从关卡内 Web 返回主菜单（与 TowerDefenseHUD / JapanWebHUD 中 action 一致） */
    function returnToMenu() {
        sendToUE('returnToMenu', {});
    }

    function navigate(target, params) {
        sendToUE('navigate', { target, ...(params || {}) });
    }

    function isInUE() {
        return navigator.userAgent.indexOf('UnrealEngine') !== -1;
    }

    _debugMode = !isInUE();

    return { sendToUE, loadLevel, goBack, returnToMenu, navigate, isInUE };
})();
