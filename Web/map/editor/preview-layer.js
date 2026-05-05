/**
 * 3D 关卡预览：viewport 切换、预览实例生命周期、拖拽落点、刷新节流。
 */

export function prefetchCesiumIonTokenForEditor() {
    try {
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_CESIUM_ION_TOKEN) {
            var injected = String(import.meta.env.VITE_CESIUM_ION_TOKEN).trim();
            if (injected) {
                window.CESIUM_ION_TOKEN = injected;
                return;
            }
        }
    } catch (_err) {}
    var cached = String(
        window.CESIUM_ION_TOKEN || window.localStorage.getItem('earth-guardian.cesiumIonToken') || ''
    ).trim();
    if (cached) {
        window.CESIUM_ION_TOKEN = cached;
        return;
    }
    fetch('/api/app-config', { cache: 'no-store' })
        .then(function (res) {
            return res && res.ok ? res.json() : null;
        })
        .then(function (cfg) {
            var token = cfg && cfg.cesiumIonToken ? String(cfg.cesiumIonToken).trim() : '';
            if (token) {
                window.CESIUM_ION_TOKEN = token;
                try {
                    window.localStorage.setItem('earth-guardian.cesiumIonToken', token);
                } catch (_ignore) {}
            }
        })
        .catch(function () {});
}

export function schedulePreviewRefresh(env) {
    if (env.getViewportViewMode() !== 'preview') return;
    env.clearPreviewRefreshTimer();
    var tid = window.setTimeout(function () {
        refreshPreviewNow(env);
    }, 80);
    env.setPreviewRefreshTimer(tid);
}

export function refreshPreviewNow(env) {
    var previewApi = env.getPreviewApi();
    if (env.getViewportViewMode() !== 'preview' || !previewApi || typeof previewApi.refresh !== 'function') return;
    if (typeof previewApi.resize === 'function') previewApi.resize();
    var sel = env.getSelectedObject();
    var sid = sel && sel.kind === 'actor' ? sel.id : null;
    previewApi.refresh({ preserveView: true, selectActorId: sid });
}

export function syncViewportPanels(refs, env) {
    var board = env.getViewportViewMode() === 'board';
    var levelPreviewShown =
        !board && (env.getActiveWorkbench() === 'level' || env.getActiveWorkbench() === 'theme');
    if (refs.boardViewport) refs.boardViewport.classList.toggle('view-hidden', !board);
    if (refs.previewStageWrap) {
        refs.previewStageWrap.classList.toggle('view-hidden', board);
        refs.previewStageWrap.setAttribute('aria-hidden', board ? 'true' : 'false');
    }
    if (refs.editorToolRibbon) refs.editorToolRibbon.classList.toggle('view-hidden', !board);
    if (refs.mapStageWrap) refs.mapStageWrap.classList.toggle('map-stage-wrap--level-preview', levelPreviewShown);
    updateStageHintText(refs, env);
    var previewApi = env.getPreviewApi();
    if (!board && previewApi && typeof previewApi.resize === 'function') {
        previewApi.resize();
    }
    env.renderPreviewSceneOutline();
}

export function updateStageHintText(refs, env) {
    if (!refs.stageHintExtra) return;
    if (env.getViewportViewMode() === 'preview') {
        refs.stageHintExtra.textContent =
            '鼠标左键拖拽旋转场景，滚轮缩放，右键平移；左键点中 Actor（或拖拽 Gizmo：移动·旋转·缩放）会优先编辑对象。Esc 取消选择；F 聚焦所选 Actor；顶部「内容浏览器」或 Ctrl+空格 弹出项目模型（可拖拽缩放窗口），卡片拖入三维场景；右侧「关卡内容浏览器」可点选并按 Delete；Inspector 可精确数值。';
        return;
    }
    if (env.getActiveTool() === 'boardImage') {
        refs.stageHintExtra.textContent =
            '拖入配图到棋盘；图层叠在格子上方、路径与标记手柄之下。棋盘配图工具下拖拽移动，四角/四边手柄或滚轮调宽度；右侧「棋盘配图」可排序与删除；Esc 取消选中。亦可切到「选择/拖拽」后点选配图编辑。';
        return;
    }
    refs.stageHintExtra.textContent =
        '点击格子放置道路/障碍等；拖拽移动 Actor。「选择/拖拽」下仍可点选棋盘配图并用边角手柄调整大小；配图列表在画布右侧；Esc 取消配图选中后再点格子以避免误拖图层。';
}

export function initPreviewLayer(refs, env) {
    if (env.getPreviewApi() || !refs.previewHost) return;
    var gen = env.bumpPreviewInitGenerationForInit();
    import('../level-editor-preview.js')
        .then(function (mod) {
            if (gen !== env.getPreviewInitGeneration() || env.getViewportViewMode() !== 'preview') return;
            var previewApi = mod.createPreview({
                host: refs.previewHost,
                getLevel: env.getLevel,
                getGeoMappingEnabled: env.getGeoMappingEnabled,
                getActiveEditorMode: env.getActiveEditorMode,
                getCatalog: env.getPreviewCatalog,
                onSelectActor: function (actorId) {
                    onPreviewSelectActor(env, actorId);
                },
                onActorModified: function () {
                    onPreviewActorCommitted(env);
                },
                onDropCatalogModel: function (payload) {
                    onDropCatalogModelInPreview(env, payload);
                },
                onDropActorTemplate: function (payload) {
                    onDropActorTemplateInPreview(env, payload);
                },
                onTransformModeChange: function (mode) {
                    setPreviewToolbarMode(refs, env, mode);
                }
            });
            env.setPreviewApi(previewApi);
            setPreviewToolbarMode(refs, env, 'translate');
            var sel = env.getSelectedObject();
            var initSel = sel && sel.kind === 'actor' ? sel.id : null;
            previewApi.refresh({ preserveView: false, selectActorId: initSel });
            env.renderContentBrowser();
            env.renderPreviewSceneOutline();
        })
        .catch(function (err) {
            console.error(err);
            env.setStatus('预览模块加载失败：请确认通过 http(s) 打开本页并能访问 CDN。', 'error');
        });
}

export function disposePreviewLayer(env) {
    env.bumpPreviewInitGenerationForDispose();
    env.clearPreviewRefreshTimer();
    var previewApi = env.getPreviewApi();
    if (!previewApi) return;
    try {
        previewApi.dispose();
    } catch (e) {
        console.warn('[Preview]', e);
    }
    env.setPreviewApi(null);
}

export function onPreviewSelectActor(env, actorId) {
    if (actorId) env.setSelectedObject({ kind: 'actor', id: actorId });
    else env.setSelectedObject(null);
    env.renderSelectionInspector();
    env.renderMap();
    env.renderPreviewSceneOutline();
}

export function onPreviewActorCommitted(env) {
    env.markDirty('已更新 Actor 变换');
    env.renderSelectionInspector();
    env.renderMap();
    env.renderPreviewSceneOutline();
    env.renderOverview();
}

export function onDropCatalogModelInPreview(env, payload) {
    var level = env.getLevel();
    if (!level || !payload || !payload.assetId) return;
    var template = env.findActorTemplate('explore-item');
    if (!template || !template.id) {
        env.setStatus('无法放置模型：缺少可用 Actor 模板（explore-item）。', 'error');
        return;
    }
    var asset = env.getBrowsableModelAssets().find(function (item) {
        return item.id === payload.assetId;
    });
    var col = Math.floor(level.map.grid.cols / 2);
    var row = Math.floor(level.map.grid.rows / 2);
    env.placeActorFromTemplate(template.id, col, row);
    var actor = level.map.actors[level.map.actors.length - 1];
    actor.modelId = payload.assetId;
    actor.modelPath = asset ? asset.path || asset.publicUrl || '' : '';
    env.applyWorldHitToActor(actor, payload.worldX, payload.worldY, payload.worldZ);
    env.setSelectedObject({ kind: 'actor', id: actor.id });
    env.markDirty('已在预览中放置模型');
    env.renderAll();
    refreshPreviewNow(env);
}

export function onDropActorTemplateInPreview(env, payload) {
    var level = env.getLevel();
    if (!level || !payload || !payload.templateId) return;
    var col = Math.floor(level.map.grid.cols / 2);
    var row = Math.floor(level.map.grid.rows / 2);
    env.placeActorFromTemplate(payload.templateId, col, row);
    var actor = level.map.actors[level.map.actors.length - 1];
    var wx =
        payload.worldX != null && Number.isFinite(Number(payload.worldX))
            ? Number(payload.worldX)
            : (level.map.grid.cols / 2 - 0.5) * (level.map.grid.tileSize || 2);
    var wy = payload.worldY != null && Number.isFinite(Number(payload.worldY)) ? Number(payload.worldY) : 0;
    var wz =
        payload.worldZ != null && Number.isFinite(Number(payload.worldZ))
            ? Number(payload.worldZ)
            : (level.map.grid.rows / 2 - 0.5) * (level.map.grid.tileSize || 2);
    env.applyWorldHitToActor(actor, wx, wy, wz);
    env.setSelectedObject({ kind: 'actor', id: actor.id });
    env.markDirty('已在预览中放置 Actor');
    env.renderAll();
    refreshPreviewNow(env);
}

export function setPreviewToolbarMode(refs, env, mode) {
    if (!refs.previewGizmoTranslate) return;
    var map = [
        ['translate', refs.previewGizmoTranslate],
        ['rotate', refs.previewGizmoRotate],
        ['scale', refs.previewGizmoScale]
    ];
    map.forEach(function (entry) {
        if (!entry[1]) return;
        entry[1].classList.toggle('active', entry[0] === mode);
    });
    var previewApi = env.getPreviewApi();
    if (previewApi && typeof previewApi.setTransformMode === 'function') previewApi.setTransformMode(mode);
}
