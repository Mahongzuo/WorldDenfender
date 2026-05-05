import { TOWER_MODEL_SPECS } from './content.js';
import { defaultGameAssetConfig } from './normalizers.js';
import { escapeAttr, escapeHtml, uid, clamp } from './utils.js';
import { modelBindShortLabel } from './display-utils.js';

/** @param {{ getState: function():object }} env */
export function normalizeGameModelsForCatalog(env) {
    var state = env.getState();
    return (state && Array.isArray(state.gameModelsCatalog) ? state.gameModelsCatalog : []).map(function (entry) {
        var pub = String(entry.publicUrl || '');
        return {
            id: String(entry.id || ''),
            name: String(entry.name || entry.relativePath || '模型'),
            path: pub,
            publicUrl: pub,
            relativePath: String(entry.relativePath || ''),
            summary: entry.relativePath ? 'GameModels/' + String(entry.relativePath) : 'GameModels',
            source: 'gameModels'
        };
    });
}

/**
 * @param {{ getState: function():object }} env
 */
export function rememberEditorAsset(env, payload, resourceKind) {
    if (!payload || !payload.projectPath) return;
    var state = env.getState();
    state.editorAssetsCatalog = state.editorAssetsCatalog || [];
    var nextAsset = {
        id: String(payload.id || uid('editor-asset')),
        name: String(payload.name || '未命名资源'),
        assetType: String(payload.assetType || 'LevelAssets'),
        resourceKind: String(resourceKind || payload.resourceKind || 'level-asset'),
        cityCode: String(payload.cityCode || ''),
        cityName: String(payload.cityName || ''),
        path: String(payload.projectPath || ''),
        projectPath: String(payload.projectPath || ''),
        publicUrl: String(payload.publicUrl || ''),
        summary: String(payload.cityName || '') + ' · ' + String(payload.name || ''),
        updatedAt: new Date().toISOString()
    };
    state.editorAssetsCatalog = state.editorAssetsCatalog.filter(function (item) {
        return item.id !== nextAsset.id;
    });
    state.editorAssetsCatalog.push(nextAsset);
}

/** @param {object} refs @param {*} env — gameAssetEnv from level-editor */
export function renderGameAssetPanel(refs, env) {
    var state = env.getState();
    if (!state || !state.gameAssetConfig || !refs.towerModelList) return;
    var g = state.gameAssetConfig;
    refs.towerModelList.innerHTML = TOWER_MODEL_SPECS.map(function (spec) {
        var url = g.customModelUrls[spec.id] || '';
        var sc = g.modelScales[spec.id] != null ? g.modelScales[spec.id] : 1;
        return [
            '<div class="game-asset-tower-row">',
            '  <div class="game-asset-tower-title">' + escapeHtml(spec.key + ' · ' + spec.name) + '</div>',
            '  <div class="game-asset-tower-upload-col" data-tower-drop="' +
                escapeAttr(spec.id) +
                '" title="从底部「项目模型」拖入到此列（整块区域均可接住）">',
            '    <label class="game-asset-upload tight">替换模型',
            '      <input type="file" data-tower-file="' + escapeAttr(spec.id) + '" accept=".glb,.gltf,.obj,model/gltf-binary,model/gltf+json" />',
            '    </label>',
            '    <div class="game-asset-tower-drop">拖入项目模型</div>',
            '  </div>',
            '  <label class="field-block game-asset-scale-tower"><span>缩放</span>',
            '    <input type="number" data-tower-scale="' + escapeAttr(spec.id) + '" min="0.1" max="8" step="0.1" value="' + String(sc) + '" />',
            '  </label>',
            '  <div class="asset-url-hint" title="' + escapeAttr(url || '未绑定塔防模型文件') + '">' + escapeHtml(url ? modelBindShortLabel(url) : '未配置') + '</div>',
            '</div>'
        ].join('');
    }).join('');

    var ps = document.getElementById('gaPropScale');
    var ys = document.getElementById('gaPlayerScale');
    if (ps) ps.value = String(g.modelScales.moneyDrop != null ? g.modelScales.moneyDrop : 1);
    if (ys) ys.value = String(g.modelScales.player != null ? g.modelScales.player : 1);

    var pt = g.playerExploreTransform || defaultGameAssetConfig().playerExploreTransform;
    var om = pt.offsetMeters || { x: 0, y: 0, z: 0 };
    var rd = pt.rotationDeg || { x: 0, y: 0, z: 0 };
    var elOx = document.getElementById('gaOffX');
    var elOy = document.getElementById('gaOffY');
    var elOz = document.getElementById('gaOffZ');
    var elRx = document.getElementById('gaRotX');
    var elRy = document.getElementById('gaRotY');
    var elRz = document.getElementById('gaRotZ');
    if (elOx) elOx.value = String(om.x != null ? om.x : 0);
    if (elOy) elOy.value = String(om.y != null ? om.y : 0);
    if (elOz) elOz.value = String(om.z != null ? om.z : 0);
    if (elRx) elRx.value = String(rd.x != null ? rd.x : 0);
    if (elRy) elRy.value = String(rd.y != null ? rd.y : 0);
    if (elRz) elRz.value = String(rd.z != null ? rd.z : 0);
}

export function bindGameAssetPanel(refs, env) {
    if (!refs.gameAssetSection) return;
    refs.gameAssetSection.addEventListener('change', function (e) {
        var t = e.target;
        if (!t || !env.getState()) return;
        (async function () {
            var state = env.getState();
            if (t.classList && t.classList.contains('ga-pt')) {
                if (!state.gameAssetConfig.playerExploreTransform) {
                    state.gameAssetConfig.playerExploreTransform = defaultGameAssetConfig().playerExploreTransform;
                }
                var pt2 = state.gameAssetConfig.playerExploreTransform;
                var n = Number(t.value);
                if (!Number.isFinite(n)) n = 0;
                var k = t.getAttribute('data-ga-pt');
                if (k === 'ox') pt2.offsetMeters.x = n;
                if (k === 'oy') pt2.offsetMeters.y = n;
                if (k === 'oz') pt2.offsetMeters.z = n;
                if (k === 'rx') pt2.rotationDeg.x = n;
                if (k === 'ry') pt2.rotationDeg.y = n;
                if (k === 'rz') pt2.rotationDeg.z = n;
                env.markDirty('已更新探索出生点变换');
                return;
            }
            if (t.getAttribute('data-tower-file')) {
                var tid = t.getAttribute('data-tower-file');
                var file = t.files && t.files[0];
                t.value = '';
                if (!file) return;
                try {
                    env.setStatus('正在上传「' + file.name + '」…', 'idle');
                    var url = await env.uploadFileToProjectUrl(file, { gameModelsUpload: true, gameModelsSubdir: 'Tower' });
                    if (url) {
                        state.gameAssetConfig.customModelUrls[tid] = url;
                        env.markDirty('已更新塔防单位模型');
                        env.setStatus(
                            '已成功绑定塔防模型「' +
                                file.name +
                                '」 · ' +
                                modelBindShortLabel(url) +
                                '（悬停「当前文件」格可见完整路径）',
                            'success'
                        );
                    } else {
                        env.setStatus('模型上传后未返回公开 URL（需 dev /api/game-models/upload）', 'error');
                    }
                } catch (err) {
                    env.setStatus((err && err.message) || '上传失败', 'error');
                }
                renderGameAssetPanel(refs, env);
                return;
            }
            if (t.getAttribute('data-tower-scale')) {
                var sid = t.getAttribute('data-tower-scale');
                state.gameAssetConfig.modelScales[sid] = clamp(Number(t.value) || 1, 0.1, 8);
                env.markDirty('已更新塔防单位缩放');
                return;
            }
            if (t.classList && t.classList.contains('ga-scale-input') && t.getAttribute('data-ga-scale')) {
                var gk = t.getAttribute('data-ga-scale');
                state.gameAssetConfig.modelScales[gk] = clamp(Number(t.value) || 1, 0.1, 8);
                env.markDirty('已更新探索缩放');
                return;
            }
            if (t.getAttribute('data-ga') === 'propModel') {
                var pf = t.files && t.files[0];
                t.value = '';
                if (!pf) return;
                try {
                    env.setStatus('正在上传探索掉落模型…', 'idle');
                    var purl = await env.uploadFileToProjectUrl(pf, {
                        assetType: 'LevelProps',
                        resourceKind: 'drop-model',
                        assetName: 'money-drop'
                    });
                    if (purl) {
                        state.gameAssetConfig.customDropModelUrl = purl;
                        env.markDirty('已更新探索掉落模型');
                    }
                } catch (err2) {
                    env.setStatus((err2 && err2.message) || '上传失败', 'error');
                }
                renderGameAssetPanel(refs, env);
                return;
            }
            if (t.getAttribute('data-ga') === 'playerModel') {
                var pfile = t.files && t.files[0];
                t.value = '';
                if (!pfile) return;
                try {
                    env.setStatus('正在上传角色模型…', 'idle');
                    var plurl = await env.uploadFileToProjectUrl(pfile, {
                        assetType: 'Characters',
                        resourceKind: 'player-model',
                        assetName: 'explore-player'
                    });
                    if (plurl) {
                        state.gameAssetConfig.customPlayerModelUrl = plurl;
                        env.markDirty('已更新探索角色模型');
                    }
                } catch (err3) {
                    env.setStatus((err3 && err3.message) || '上传失败', 'error');
                }
                renderGameAssetPanel(refs, env);
                return;
            }
            if (t.getAttribute('data-ga-anim')) {
                var anim = t.getAttribute('data-ga-anim');
                var af = t.files && t.files[0];
                t.value = '';
                if (!af) return;
                try {
                    env.setStatus('正在上传 ' + anim + ' 动画…', 'idle');
                    var aurl = await env.uploadFileToProjectUrl(af, {
                        assetType: 'Animations',
                        resourceKind: 'mixamo-' + anim,
                        assetName: anim + '-animation'
                    });
                    if (aurl) {
                        state.gameAssetConfig.customAnimationUrls[anim] = aurl;
                        env.markDirty('已更新 ' + anim + ' 动画');
                    }
                } catch (err4) {
                    env.setStatus((err4 && err4.message) || '上传失败', 'error');
                }
                renderGameAssetPanel(refs, env);
            }
        })();
    });

    if (refs.gameAssetSection && !refs.gameAssetSection.__towerCatalogDropBound) {
        refs.gameAssetSection.__towerCatalogDropBound = true;
        function towerDropZoneFromTarget(t) {
            if (!t) return null;
            var el = t.nodeType === 3 && t.parentElement ? t.parentElement : t;
            return el.closest ? el.closest('[data-tower-drop]') : null;
        }
        function readCatalogPayloadFromDrag(dataTransfer) {
            if (!dataTransfer) return null;
            var rawJson = '';
            try {
                rawJson = String(dataTransfer.getData('application/json') || '').trim();
            } catch (e1) {
                rawJson = '';
            }
            if (!rawJson) {
                try {
                    rawJson = String(dataTransfer.getData('text/plain') || '').trim();
                } catch (e2) {
                    rawJson = '';
                }
            }
            if (!rawJson || rawJson.charAt(0) !== '{') return null;
            try {
                var o = JSON.parse(rawJson);
                return o && typeof o === 'object' ? o : null;
            } catch (e3) {
                return null;
            }
        }
        refs.gameAssetSection.addEventListener('dragover', function (e) {
            var zone = towerDropZoneFromTarget(e.target);
            if (!zone) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });
        refs.gameAssetSection.addEventListener('dragenter', function (e) {
            var zone = towerDropZoneFromTarget(e.target);
            if (!zone) return;
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        });
        refs.gameAssetSection.addEventListener('drop', function (e) {
            var zone = towerDropZoneFromTarget(e.target);
            var state = env.getState();
            if (!zone || !state || !state.gameAssetConfig) return;
            e.preventDefault();
            var tid = zone.getAttribute('data-tower-drop');
            if (!tid) return;
            var payload = readCatalogPayloadFromDrag(e.dataTransfer);
            if (!payload || payload.kind !== 'catalogModel') return;
            var aid = payload.assetId || payload.id || '';
            var asset = env.getBrowsableModelAssets().find(function (item) {
                return item.id === aid;
            });
            var url = asset ? asset.path || asset.publicUrl || '' : '';
            if (!url) {
                env.setStatus('无法解析该模型路径，请先在「项目模型」中刷新列表。', 'error');
                return;
            }
            state.gameAssetConfig.customModelUrls[tid] = url;
            env.markDirty('已从项目模型绑定塔防替换模型');
            env.setStatus('已绑定塔防模型：' + modelBindShortLabel(url) + '（路径见格内 / 悬停）', 'success');
            renderGameAssetPanel(refs, env);
        });
    }
}
