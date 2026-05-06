/**
 * editor/cutscene-utils.js
 * 过场视频路径解析与状态格式化——纯函数，无全局状态依赖。
 */
import { levelVideoCityContext, modelBindShortLabel } from './display-utils.js';

function sanitizeProjectPathSegment(value) {
    return String(value || '')
        .normalize('NFC')
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[. ]+$/g, '')
        .slice(0, 80);
}

/**
 * 将 public 目录下的公共 URL 转换为项目相对路径。
 * 拒绝包含 `..` 的路径，防止路径遍历。
 * @param {string} url
 * @returns {string}
 */
export function projectPathFromVideoPublicUrl(url) {
    var raw = String(url || '').trim();
    if (!raw) return '';
    var pathOnly = raw.split('#')[0].split('?')[0];
    if (!pathOnly || pathOnly.charAt(0) !== '/') return '';
    var pieces = pathOnly.split('/').filter(Boolean);
    if (!pieces.length) return '';
    var decoded = [];
    for (var i = 0; i < pieces.length; i += 1) {
        var part = pieces[i];
        try {
            part = decodeURIComponent(part);
        } catch (_error) {
            return '';
        }
        if (!part || part === '.' || part === '..' || /[\\/]/.test(part)) return '';
        decoded.push(part);
    }
    return ['public'].concat(decoded).join('/');
}

/**
 * 根据关卡城市上下文推断项目内过场视频目录。
 * @param {object|null} level
 * @returns {string}
 */
export function cutsceneVideoProjectDirectory(level) {
    var cityContext = levelVideoCityContext(level);
    if (!cityContext || !cityContext.cityName) return '';
    var cityDir = sanitizeProjectPathSegment(cityContext.cityName);
    if (!cityDir) return '';
    return ['public', 'Arts', 'LevelVideos', cityDir].join('/');
}

/**
 * 获取过场视频条目的有效项目路径。
 * 优先返回已记录的 projectPath，否则从 url 推断。
 * @param {{ projectPath?: string, url?: string }} entry
 * @returns {string}
 */
export function effectiveCutsceneVideoProjectPath(entry) {
    if (!entry || typeof entry !== 'object') return '';
    var p = String(entry.projectPath || '').trim();
    if (p) return p;
    return projectPathFromVideoPublicUrl(entry.url);
}

/**
 * 获取「打开保存位置」应使用的最佳项目路径。
 * 优先当前视频文件，其次当前关卡的视频目录。
 * @param {{ projectPath?: string, url?: string }|null} entry
 * @param {object|null} level
 * @returns {string}
 */
export function effectiveCutsceneVideoOpenPath(entry, level) {
    return effectiveCutsceneVideoProjectPath(entry) || cutsceneVideoProjectDirectory(level);
}

/**
 * 格式化开场视频状态文字（供 UI 展示）。
 * @param {{ url?: string, projectPath?: string }} intro
 * @returns {{ text: string, openPath: string }}
 */
export function formatIntroVideoStatusLines(intro) {
    var introUrl = typeof intro.url === 'string' ? intro.url.trim() : '';
    var introPath = effectiveCutsceneVideoProjectPath(intro);
    var lines = [];
    if (introUrl) {
        lines.push('已设置开场视频：' + modelBindShortLabel(introUrl));
        lines.push('引用地址：' + introUrl);
        if (introPath) {
            lines.push('项目内备份：' + introPath + '（可随仓库分享）');
        } else {
            lines.push('提示：未检测到项目 public 下的备份路径，若引用本机绝对路径，分享工程后他人可能无法播放。');
        }
    } else if (introPath) {
        lines.push('已保存项目内视频文件：' + introPath);
        lines.push('提示：缺少引用地址 URL，请重新上传开场视频或检查关卡 JSON 是否已保存。');
    } else {
        lines.push('未设置开场视频');
    }
    return { text: lines.join('\n'), openPath: introPath };
}
