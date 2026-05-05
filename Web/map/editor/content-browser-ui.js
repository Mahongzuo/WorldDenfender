/**
 * Global content browser: docked list + floating panel, mini 3D preview, drag payloads.
 */
import { CONTENT_BROWSER_FLOAT_GEOM_KEY } from './content.js';
import { escapeAttr, escapeHtml } from './utils.js';
import { clampContentBrowserGeom } from './html-builders.js';

export function isContentBrowserFloatOpen(refs) {
    return refs.contentBrowserFloatPanel && !refs.contentBrowserFloatPanel.classList.contains('view-hidden');
}

export function persistContentBrowserFloatGeometry(refs, env) {
    if (!refs.contentBrowserFloatPanel || !isContentBrowserFloatOpen(refs)) return;
    var el = refs.contentBrowserFloatPanel;
    var r = el.getBoundingClientRect();
    try {
        window.localStorage.setItem(
            CONTENT_BROWSER_FLOAT_GEOM_KEY,
            JSON.stringify({
                left: Math.round(r.left),
                top: Math.round(r.top),
                width: Math.round(el.offsetWidth),
                height: Math.round(el.offsetHeight)
            })
        );
    } catch (_e) {}
}

export function schedulePersistContentBrowserFloatGeometry(refs, env) {
    env.clearContentBrowserFloatGeomTimer();
    var id = window.setTimeout(function () {
        persistContentBrowserFloatGeometry(refs, env);
    }, 220);
    env.setContentBrowserFloatGeomTimer(id);
}

export function clampContentBrowserFloatPanelIntoViewport(refs, env) {
    var p = refs.contentBrowserFloatPanel;
    if (!p || !isContentBrowserFloatOpen(refs)) return;
    var w = clampContentBrowserGeom(p.offsetWidth, 380, Math.max(400, window.innerWidth - 16));
    var h = clampContentBrowserGeom(p.offsetHeight, 280, Math.max(300, window.innerHeight - 80));
    p.style.width = w + 'px';
    p.style.height = h + 'px';
    var r = p.getBoundingClientRect();
    var maxL = Math.max(8, window.innerWidth - w - 8);
    var maxT = Math.max(8, window.innerHeight - h - 72);
    p.style.left = clampContentBrowserGeom(r.left, 8, maxL) + 'px';
    p.style.top = clampContentBrowserGeom(r.top, 8, maxT) + 'px';
    schedulePersistContentBrowserFloatGeometry(refs, env);
}

export function applyContentBrowserFloatGeometryFromStorage(refs, env) {
    var raw = '';
    try {
        raw = window.localStorage.getItem(CONTENT_BROWSER_FLOAT_GEOM_KEY) || '';
    } catch (_e) {
        raw = '';
    }
    var p = refs.contentBrowserFloatPanel;
    if (!p || !raw) return false;
    var o;
    try {
        o = JSON.parse(raw);
    } catch (_e) {
        return false;
    }
    if (
        typeof o.left !== 'number' ||
        typeof o.top !== 'number' ||
        typeof o.width !== 'number' ||
        typeof o.height !== 'number' ||
        !Number.isFinite(o.width) ||
        !Number.isFinite(o.height)
    ) {
        return false;
    }
    var ww = clampContentBrowserGeom(o.width, 380, Math.max(400, window.innerWidth - 16));
    var hh = clampContentBrowserGeom(o.height, 280, Math.max(300, window.innerHeight - 80));
    var maxL = Math.max(8, window.innerWidth - ww - 8);
    var maxT = Math.max(8, window.innerHeight - hh - 72);
    p.style.right = 'auto';
    p.style.bottom = 'auto';
    p.style.left = clampContentBrowserGeom(o.left, 8, maxL) + 'px';
    p.style.top = clampContentBrowserGeom(o.top, 8, maxT) + 'px';
    p.style.width = ww + 'px';
    p.style.height = hh + 'px';
    return true;
}

export function observeContentBrowserFloatResize(refs, env) {
    if (!refs.contentBrowserFloatPanel || typeof ResizeObserver === 'undefined') return;
    env.disconnectContentBrowserFloatRo();
    var ro = new ResizeObserver(function () {
        schedulePersistContentBrowserFloatGeometry(refs, env);
        var mini = env.getContentBrowserMiniApi();
        if (mini && typeof mini.resize === 'function') {
            window.requestAnimationFrame(function () {
                mini.resize();
            });
        }
    });
    ro.observe(refs.contentBrowserFloatPanel);
    env.setContentBrowserFloatRo(ro);
}

export function toggleContentBrowserFloat(refs, env, optOpen) {
    var p = refs.contentBrowserFloatPanel;
    if (!p || env.getActiveWorkbench() !== 'level') return;
    var open = typeof optOpen === 'boolean' ? optOpen : !isContentBrowserFloatOpen(refs);
    p.classList.toggle('view-hidden', !open);
    p.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (refs.btnOpenContentBrowserFloat) refs.btnOpenContentBrowserFloat.setAttribute('aria-pressed', open ? 'true' : 'false');
    if (!open) {
        schedulePersistContentBrowserFloatGeometry(refs, env);
        return;
    }
    applyContentBrowserFloatGeometryFromStorage(refs, env);
    observeContentBrowserFloatResize(refs, env);
    window.requestAnimationFrame(function () {
        renderContentBrowser(refs, env);
        var mini = env.getContentBrowserMiniApi();
        if (mini && typeof mini.resize === 'function') mini.resize();
    });
}

export function wireContentBrowserFloating(refs, env) {
    if (refs.btnOpenContentBrowserFloat) {
        refs.btnOpenContentBrowserFloat.addEventListener('click', function () {
            toggleContentBrowserFloat(refs, env);
        });
    }
    if (refs.contentBrowserFloatClose) {
        refs.contentBrowserFloatClose.addEventListener('click', function () {
            toggleContentBrowserFloat(refs, env, false);
        });
    }
    var panel = refs.contentBrowserFloatPanel;
    var handle = refs.contentBrowserFloatDragHandle;
    if (!panel || !handle) return;
    var drag = false;
    var sx = 0;
    var sy = 0;
    var sl = 0;
    var st = 0;
    handle.addEventListener(
        'pointerdown',
        function (ev) {
            if (ev.button !== 0) return;
            if (ev.target.closest && ev.target.closest('button')) return;
            drag = true;
            handle.setPointerCapture(ev.pointerId);
            var r = panel.getBoundingClientRect();
            sx = ev.clientX;
            sy = ev.clientY;
            sl = r.left;
            st = r.top;
            panel.style.left = sl + 'px';
            panel.style.top = st + 'px';
            panel.style.right = 'auto';
        },
        { passive: true }
    );
    handle.addEventListener(
        'pointermove',
        function (ev) {
            if (!drag) return;
            var nx = sl + (ev.clientX - sx);
            var ny = st + (ev.clientY - sy);
            var maxL = Math.max(8, window.innerWidth - panel.offsetWidth - 8);
            var maxT = Math.max(8, window.innerHeight - panel.offsetHeight - 72);
            panel.style.left = Math.min(Math.max(8, nx), maxL) + 'px';
            panel.style.top = Math.min(Math.max(8, ny), maxT) + 'px';
        },
        { passive: true }
    );
    function endDrag(ev) {
        if (!drag) return;
        drag = false;
        try {
            handle.releasePointerCapture(ev.pointerId);
        } catch (_e) {}
        schedulePersistContentBrowserFloatGeometry(refs, env);
    }
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
}

export function renderContentBrowser(refs, env) {
    var list = refs.contentBrowserList;
    if (!list || !env.getState()) return;
    var assets = env.getBrowsableModelAssets();
    if (!assets.length) {
        env.setSelectedContentBrowserAssetId('');
        list.innerHTML =
            '<div class="empty-state">暂无模型。将 .glb/.gltf 放进项目 <code>public/GameModels/</code> 或使用右侧「上传模型」，在「内容浏览器」窗口中点「刷新」。</div>';
        showContentBrowserMiniPreview(refs, env, '');
        return;
    }

    var sel = env.getSelectedContentBrowserAssetId();
    if (sel && !assets.some(function (a) { return a.id === sel; })) {
        env.setSelectedContentBrowserAssetId('');
        sel = '';
    }

    list.innerHTML = assets
        .map(function (asset) {
            var active = asset.id === env.getSelectedContentBrowserAssetId() ? ' content-browser-chip--active' : '';
            return [
                '<div class="content-browser-chip' +
                    active +
                    '" draggable="true" data-asset-chip="' +
                    escapeAttr(asset.id) +
                    '" data-preview-url="' +
                    escapeAttr(asset.path || asset.publicUrl || '') +
                    '">',
                '  <div class="content-browser-chip-icon">' + escapeHtml(asset.name.slice(0, 2).toUpperCase()) + '</div>',
                '  <div class="content-browser-chip-meta">',
                '    <strong>' + escapeHtml(asset.name || asset.id) + '</strong>',
                '    <span>' + escapeHtml(asset.summary || asset.path || asset.publicUrl || 'GameModels') + '</span>',
                '  </div>',
                '</div>'
            ].join('');
        })
        .join('');

    list.querySelectorAll('[data-asset-chip]').forEach(function (chip) {
        chip.addEventListener('dragstart', function (event) {
            var id = chip.getAttribute('data-asset-chip');
            var asset = assets.find(function (a) {
                return a.id === id;
            });
            var name = asset ? asset.name || id : id || '';
            var modelPath = asset ? asset.path || asset.publicUrl || '' : '';
            var payloadJson = JSON.stringify({
                kind: 'catalogModel',
                assetId: id,
                id: id,
                name: name,
                modelPath: modelPath
            });
            if (typeof window !== 'undefined') {
                window.__egCatalogDragMeta = { assetId: id, name: name, modelPath: modelPath };
            }
            if (event.dataTransfer) {
                event.dataTransfer.setData('application/json', payloadJson);
                event.dataTransfer.setData('text/plain', payloadJson);
                event.dataTransfer.effectAllowed = 'copy';
            }
        });
        chip.addEventListener('dragend', function () {
            if (typeof window !== 'undefined') window.__egCatalogDragMeta = null;
        });
        chip.addEventListener('click', function (event) {
            if (event.target && event.target.closest && event.target.closest('a')) return;
            env.setSelectedContentBrowserAssetId(chip.getAttribute('data-asset-chip') || '');
            var sid = env.getSelectedContentBrowserAssetId();
            list.querySelectorAll('[data-asset-chip]').forEach(function (c) {
                c.classList.toggle('content-browser-chip--active', c.getAttribute('data-asset-chip') === sid);
            });
            showContentBrowserMiniPreview(refs, env, chip.getAttribute('data-preview-url') || '');
        });
    });

    sel = env.getSelectedContentBrowserAssetId();
    if (!sel && assets[0]) {
        env.setSelectedContentBrowserAssetId(assets[0].id);
        sel = assets[0].id;
        list.querySelectorAll('[data-asset-chip]').forEach(function (c) {
            c.classList.toggle('content-browser-chip--active', c.getAttribute('data-asset-chip') === sel);
        });
        showContentBrowserMiniPreview(refs, env, assets[0].path || assets[0].publicUrl || '');
    } else if (sel) {
        var cur = assets.find(function (a) {
            return a.id === sel;
        });
        showContentBrowserMiniPreview(refs, env, cur ? cur.path || cur.publicUrl || '' : '');
    }
}

export function showContentBrowserMiniPreview(refs, env, url) {
    var host = refs.contentBrowserPreviewHost;
    if (!host) return;
    if (!url) {
        var mini0 = env.getContentBrowserMiniApi();
        if (mini0 && typeof mini0.dispose === 'function') {
            mini0.dispose();
        }
        env.setContentBrowserMiniApi(null);
        host.innerHTML =
            '<div class="empty-state content-browser-mini-empty">在「内容浏览器」窗口中选择模型卡片，或拖拽到关卡预览场景。</div>';
        return;
    }
    if (!isContentBrowserFloatOpen(refs)) {
        var mini1 = env.getContentBrowserMiniApi();
        if (mini1 && typeof mini1.dispose === 'function') {
            mini1.dispose();
        }
        env.setContentBrowserMiniApi(null);
        host.innerHTML =
            '<div class="empty-state content-browser-mini-empty">按工具条「内容浏览器」或 Ctrl+空格 打开窗口后查看三维预览。</div>';
        return;
    }
    import('./content-browser-model-preview.js')
        .then(function (mod) {
            if (!refs.contentBrowserPreviewHost) return;
            var prev = env.getContentBrowserMiniApi();
            if (prev && typeof prev.dispose === 'function') {
                prev.dispose();
            }
            var api = mod.createContentBrowserMiniPreview({ host: refs.contentBrowserPreviewHost });
            env.setContentBrowserMiniApi(api);
            return api.setUrl(url);
        })
        .catch(function (e) {
            console.warn('[ContentBrowser preview]', e);
        });
}
