/**
 * editor/fetch-utils.js
 * HTTP/fetch 辅助工具——纯函数，无全局状态依赖。
 */

/**
 * 从 fetch 响应体中提取可读的错误信息。
 * @param {number} status  - HTTP 状态码
 * @param {string} text    - 响应体文本
 * @returns {string}
 */
export function parseFetchErrorBody(status, text) {
    var detail = String(text || '').trim();
    if (!detail) return 'HTTP ' + status;
    try {
        var j = JSON.parse(detail);
        if (j && typeof j === 'object' && j.error) return String(j.error);
    } catch (ignore) {}
    return detail.length > 220 ? detail.slice(0, 220) + '\u2026' : detail;
}
