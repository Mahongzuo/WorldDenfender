/**
 * 收集关卡引用的 public 资源路径，并请求开发服务器删除磁盘文件。
 */

export var DELETE_PROJECT_FILES_URL = '/api/delete-project-files';

var ASSET_PATH_KEYS = new Set([
    'modelPath',
    'src',
    'url',
    'projectPath',
    'boardTextureUrl',
    'defenseBgmUrl',
    'exploreBgmUrl',
]);

/**
 * @param {string} value
 * @returns {string|null} 形如 public/GameModels/foo.gltf
 */
export function toPublicProjectPath(value) {
    if (typeof value !== 'string') return null;
    var s = value.trim().replace(/\\/g, '/');
    if (!s) return null;
    if (/^public\//i.test(s)) return s.replace(/^public\//i, 'public/');
    if (s.charAt(0) === '/') return 'public' + s;
    return null;
}

/**
 * @param {object} level
 * @returns {string[]}
 */
export function collectLevelAssetPaths(level) {
    var out = new Set();

    function add(value) {
        var pub = toPublicProjectPath(value);
        if (pub) out.add(pub);
    }

    function walk(node, key) {
        if (node == null) return;
        if (typeof node === 'string') {
            if (key && ASSET_PATH_KEYS.has(key)) add(node);
            else if (/\/(GameModels|Arts|uploads)\//i.test(node)) add(node);
            return;
        }
        if (Array.isArray(node)) {
            node.forEach(function (item) {
                walk(item, key);
            });
            return;
        }
        if (typeof node !== 'object') return;
        Object.keys(node).forEach(function (childKey) {
            walk(node[childKey], childKey);
        });
    }

    walk(level, '');
    return Array.from(out);
}

/**
 * 仅保留未被其他关卡引用的资源路径。
 * @param {string} levelId
 * @param {string[]} paths
 * @param {object[]} allLevels
 */
export function filterExclusiveAssetPaths(levelId, paths, allLevels) {
    var others = (allLevels || []).filter(function (level) {
        return level && level.id !== levelId;
    });
    var shared = new Set();
    others.forEach(function (level) {
        collectLevelAssetPaths(level).forEach(function (p) {
            shared.add(p);
        });
    });
    return paths.filter(function (p) {
        return !shared.has(p);
    });
}

/**
 * @param {object} level
 * @param {object[]} allLevels
 */
export function summarizeLevelDeleteAssets(level, allLevels) {
    var all = collectLevelAssetPaths(level);
    var exclusive = filterExclusiveAssetPaths(level.id, all, allLevels);
    var sharedCount = all.length - exclusive.length;
    return {
        allPaths: all,
        exclusivePaths: exclusive,
        sharedCount: sharedCount,
    };
}

/**
 * @param {object} summary
 * @param {string} levelName
 */
export function formatLevelDeleteConfirmMessage(levelName, summary) {
    var lines = ['将删除关卡数据，并尝试删除以下仅本关卡使用的资源文件：'];
    if (!summary.exclusivePaths.length) {
        lines.push('（无独占磁盘资源；' + (summary.sharedCount ? '其余 ' + summary.sharedCount + ' 个资源仍被其他关卡引用，将保留。' : '本关卡未引用可删除的 public 文件。') + '）');
    } else {
        summary.exclusivePaths.slice(0, 12).forEach(function (p) {
            lines.push('• ' + p.replace(/^public\//, ''));
        });
        if (summary.exclusivePaths.length > 12) {
            lines.push('• … 另有 ' + (summary.exclusivePaths.length - 12) + ' 个文件');
        }
        if (summary.sharedCount > 0) {
            lines.push('另有 ' + summary.sharedCount + ' 个资源被其他关卡共用，将保留。');
        }
    }
    lines.push('');
    lines.push('删除后请点击顶部「保存」写入项目 JSON。此操作不可撤销。');
    return '确定删除关卡「' + levelName + '」？\n\n' + lines.join('\n');
}

/**
 * @param {string[]} projectPaths
 * @returns {Promise<{ deleted: string[], missing: string[], failed: { path: string, error: string }[] }>}
 */
export async function deleteProjectFiles(projectPaths) {
    var response = await fetch(DELETE_PROJECT_FILES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: projectPaths || [] }),
    });
    var payload = null;
    try {
        payload = await response.json();
    } catch (_err) {
        payload = null;
    }
    if (!response.ok) {
        throw new Error((payload && payload.error) || '删除资源失败: ' + response.status);
    }
    return payload || { deleted: [], missing: [], failed: [] };
}
