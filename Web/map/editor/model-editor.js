import { MODEL_CATEGORY_CONFIG } from './content.js';
import { clamp, escapeAttr, escapeHtml, fileToBase64, slugify } from './utils.js';
import { parseFetchErrorBody } from './fetch-utils.js';
import { modelBindShortLabel, uniqueCatalogId } from './display-utils.js';

function getActiveModelCategory(env) {
    return env.getActiveModelCategory() || 'all';
}

function getSelectedModelId(env) {
    return env.getSelectedModelId() || '';
}

function setSelectedModelId(env, value) {
    env.setSelectedModelId(value || '');
}

function setActiveModelCategory(env, value) {
    env.setActiveModelCategory(value || 'all');
}

function getModelAssetCategoryFolder(asset) {
    var rel = String(asset && (asset.relativePath || asset.summary || asset.path || asset.publicUrl) || '').replace(/\\/g, '/');
    rel = rel.replace(/^\/?GameModels\//i, '');
    rel = rel.replace(/^\/?public\/GameModels\//i, '');
    var first = rel.split('/').filter(Boolean)[0] || '';
    if (/^characters?$/i.test(first) || /^charactor$/i.test(first)) return 'Charactor';
    if (/^buildings?$/i.test(first)) return 'Buildings';
    if (/^props?$|^terrain$/i.test(first)) return 'Props';
    if (/^towers?$/i.test(first)) return 'Tower';
    if (/^enem(y|ies)$/i.test(first)) return 'Enemy';
    return first;
}

function getModelsByCategory(env, category) {
    var assets = env.getBrowsableModelAssets();
    if (category === 'all') return assets;
    var folder = MODEL_CATEGORY_CONFIG[category] ? MODEL_CATEGORY_CONFIG[category].folder : '';
    if (!folder) return [];
    return assets.filter(function (asset) {
        return getModelAssetCategoryFolder(asset).toLowerCase() === folder.toLowerCase();
    });
}

function syncModelCategoryTabs(refs, env) {
    if (!refs.modelCategoryTabs) return;
    refs.modelCategoryTabs.querySelectorAll('[data-model-category]').forEach(function (item) {
        item.classList.toggle('active', item.getAttribute('data-model-category') === getActiveModelCategory(env));
    });
}

function renderModelDetail(refs, env, asset) {
    if (refs.modelDetailTitle) refs.modelDetailTitle.textContent = asset ? asset.name : '模型详情';
    if (refs.modelDetailMeta) refs.modelDetailMeta.textContent = asset ? '已选择' : '未选择';
    if (refs.modelDetailName) refs.modelDetailName.value = asset ? asset.name : '';
    var catLabel = '';
    if (asset) {
        var firstDir = getModelAssetCategoryFolder(asset);
        var matchedKey = Object.keys(MODEL_CATEGORY_CONFIG).find(function (key) {
            return key !== 'all' && MODEL_CATEGORY_CONFIG[key].folder.toLowerCase() === firstDir.toLowerCase();
        });
        catLabel = matchedKey ? MODEL_CATEGORY_CONFIG[matchedKey].label : firstDir || '未分类';
    }
    if (refs.modelDetailCategory) refs.modelDetailCategory.value = catLabel;
    if (refs.modelDetailPath) refs.modelDetailPath.value = asset ? asset.path || asset.publicUrl || '' : '';

    if (refs.modelPreviewEmpty) refs.modelPreviewEmpty.classList.toggle('view-hidden', !!asset);
    if (refs.modelPreviewHost) refs.modelPreviewHost.classList.toggle('view-hidden', !asset);
    if (refs.modelPreviewMeta) refs.modelPreviewMeta.textContent = asset ? asset.name + ' · 模型预览' : '未绑定模型';

    if (!asset) {
        env.disposeModelAssetPreview();
        return;
    }
    env.ensureModelAssetPreview(asset.publicUrl || asset.path || '');
}

function renderModelInspector(refs, env, counts) {
    if (!refs.modelInspectorStats) return;
    refs.modelInspectorStats.innerHTML = Object.keys(MODEL_CATEGORY_CONFIG)
        .map(function (key) {
            var cfg = MODEL_CATEGORY_CONFIG[key];
            return [
                '<button type="button" class="list-item" data-inspector-category="' + escapeAttr(key) + '" style="cursor:pointer">',
                '  <strong>' + escapeHtml(cfg.label) + '</strong>',
                '  <span>' + escapeHtml(String(counts[key] || 0)) + ' 个模型</span>',
                '</button>'
            ].join('');
        })
        .join('');

    refs.modelInspectorStats.querySelectorAll('[data-inspector-category]').forEach(function (button) {
        button.addEventListener('click', function () {
            setActiveModelCategory(env, button.getAttribute('data-inspector-category') || 'all');
            setSelectedModelId(env, '');
            syncModelCategoryTabs(refs, env);
            renderModelEditor(refs, env);
        });
    });
}

export function renderModelEditor(refs, env) {
    if (env.getActiveWorkbench() !== 'model') return;
    var allAssets = env.getBrowsableModelAssets();
    var categoryAssets = getModelsByCategory(env, getActiveModelCategory(env));
    var keyword = refs.modelSearch ? String(refs.modelSearch.value || '').trim().toLowerCase() : '';
    var filtered = categoryAssets.filter(function (asset) {
        if (!keyword) return true;
        var haystack = [asset.name, asset.id, asset.summary, asset.path].join(' ').toLowerCase();
        return haystack.indexOf(keyword) !== -1;
    });

    var counts = {};
    Object.keys(MODEL_CATEGORY_CONFIG).forEach(function (key) {
        counts[key] = key === 'all' ? allAssets.length : getModelsByCategory(env, key).length;
    });

    if (refs.modelOverviewStats) {
        refs.modelOverviewStats.innerHTML = Object.keys(MODEL_CATEGORY_CONFIG)
            .map(function (key) {
                var cfg = MODEL_CATEGORY_CONFIG[key];
                return '<div class="stat-card"><strong>' + escapeHtml(String(counts[key] || 0)) + '</strong><span>' + escapeHtml(cfg.label) + '</span></div>';
            })
            .join('');
    }

    if (refs.modelListCount) refs.modelListCount.textContent = '共 ' + filtered.length + ' 项';

    if (refs.modelEntryList) {
        if (!filtered.length) {
            refs.modelEntryList.innerHTML = '<div class="empty-state">当前分类暂无模型。点击右侧「上传新模型」或扫描 public/GameModels。</div>';
        } else {
            if (!getSelectedModelId(env) || !filtered.some(function (asset) { return asset.id === getSelectedModelId(env); })) {
                setSelectedModelId(env, filtered[0].id);
            }
            refs.modelEntryList.innerHTML = filtered
                .map(function (asset) {
                    var active = asset.id === getSelectedModelId(env) ? ' active' : '';
                    var categoryText = String(asset.summary || asset.relativePath || '');
                    var folder = getModelAssetCategoryFolder(asset);
                    var matchedKey = Object.keys(MODEL_CATEGORY_CONFIG).find(function (key) {
                        return key !== 'all' && MODEL_CATEGORY_CONFIG[key].folder.toLowerCase() === folder.toLowerCase();
                    });
                    var categoryLabel = matchedKey ? MODEL_CATEGORY_CONFIG[matchedKey].label : folder || '未分类';
                    return [
                        '<button type="button" class="list-item gameplay-entry-card' + active + '" data-model-id="' + escapeAttr(asset.id) + '">',
                        '  <strong>' + escapeHtml(asset.name) + '</strong>',
                        '  <span>' + escapeHtml(categoryText) + '</span>',
                        '  <div class="gameplay-entry-meta">',
                        '    <span class="gameplay-chip">' + escapeHtml(categoryLabel) + '</span>',
                        '  </div>',
                        '</button>'
                    ].join('');
                })
                .join('');
        }
    }

    var selected = filtered.find(function (asset) {
        return asset.id === getSelectedModelId(env);
    }) || null;
    renderModelDetail(refs, env, selected);
    renderModelInspector(refs, env, counts);
}

export async function replaceSelectedModel(refs, env, file) {
    var selected = getModelsByCategory(env, getActiveModelCategory(env)).find(function (asset) {
        return asset.id === getSelectedModelId(env);
    });
    if (!selected) {
        env.setStatus('请先选择一个要替换的模型。', 'error');
        if (refs.modelUploadReplace) refs.modelUploadReplace.value = '';
        return;
    }
    var subdir = getModelAssetCategoryFolder(selected);
    try {
        env.setStatus('正在替换模型 ' + file.name + '…', 'idle');
        var content = await fileToBase64(file);
        var response = await fetch('/api/game-models/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: file.name,
                content: content,
                subdirectory: subdir
            })
        });
        var responseText = await response.text();
        if (!response.ok) throw new Error(parseFetchErrorBody(response.status, responseText));
        var payload = JSON.parse(responseText);
        await env.refreshGameModelsCatalog();
        setSelectedModelId(env, '');
        if (refs.modelUploadReplace) refs.modelUploadReplace.value = '';
        env.markDirty('已替换模型');
        renderModelEditor(refs, env);
        env.setStatus('模型已替换: ' + String(payload.projectPath || ''), 'success');
    } catch (error) {
        if (refs.modelUploadReplace) refs.modelUploadReplace.value = '';
        env.setStatus('模型替换失败: ' + error.message, 'error');
    }
}

export async function uploadNewModelFromInspector(refs, env, file) {
    var category = refs.modelInspectorUploadCategory ? refs.modelInspectorUploadCategory.value : 'Enemy';
    var nameHint = refs.modelInspectorUploadName ? String(refs.modelInspectorUploadName.value || '').trim() : '';
    var subdir = String(category || '');
    var uploadName = nameHint || file.name;
    try {
        env.setStatus('正在上传新模型 ' + uploadName + '…', 'idle');
        var content = await fileToBase64(file);
        var response = await fetch('/api/game-models/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: uploadName + (file.name.match(/\.[^.]+$/) ? '' : '.glb'),
                content: content,
                subdirectory: subdir
            })
        });
        var responseText = await response.text();
        if (!response.ok) throw new Error(parseFetchErrorBody(response.status, responseText));
        var payload = JSON.parse(responseText);
        await env.refreshGameModelsCatalog();
        if (refs.modelInspectorUploadName) refs.modelInspectorUploadName.value = '';
        if (refs.modelInspectorUpload) refs.modelInspectorUpload.value = '';
        setActiveModelCategory(env, category);
        setSelectedModelId(env, '');
        syncModelCategoryTabs(refs, env);
        env.markDirty('已上传新模型');
        renderModelEditor(refs, env);
        env.setStatus('新模型已保存: ' + String(payload.projectPath || ''), 'success');
    } catch (error) {
        if (refs.modelInspectorUpload) refs.modelInspectorUpload.value = '';
        env.setStatus('模型上传失败: ' + error.message, 'error');
    }
}

/** 关卡侧边栏模型列表 →「变成 Actor 模板」（非 Model 工作台页）。 */
export function renderModelAssets(refs, env) {
    var assets = env.getBrowsableModelAssets();
    if (!assets.length) {
        refs.modelAssetList.innerHTML = '<div class="empty-state">暂无模型资产。上传模型后可作为 Actor 使用。</div>';
        return;
    }
    refs.modelAssetList.innerHTML = assets
        .map(function (asset) {
            return [
                '<div class="list-item">',
                '  <strong>' + escapeHtml(asset.name) + '</strong>',
                '  <span>' + escapeHtml(asset.path || asset.url || '未设置路径') + '</span>',
                '  <div class="inline-controls">',
                '    <button class="mini-button" data-model-template="' + escapeAttr(asset.id) + '">变成 Actor 模板</button>',
                '  </div>',
                '</div>'
            ].join('');
        })
        .join('');
    refs.modelAssetList.querySelectorAll('[data-model-template]').forEach(function (button) {
        button.addEventListener('click', function () {
            env.createActorTemplateFromModel(button.getAttribute('data-model-template'));
        });
    });
}

/**
 * 顶栏模型上传 input：写入 catalog 并创建 Actor 模板。
 */
export async function uploadModelAsset(refs, env, file) {
    try {
        env.setStatus('正在上传模型 ' + file.name + '…', 'idle');
        var url = await env.uploadFileToProjectUrl(file, { gameModelsUpload: true, gameModelsSubdir: '' });
        var st = env.getState();
        var id = uniqueCatalogId(
            st.catalog.modelAssets,
            slugify(file.name.replace(/\.[^.]+$/, '')) || 'uploaded-model'
        );
        st.catalog.modelAssets.push({
            id: id,
            name: file.name.replace(/\.[^.]+$/, ''),
            summary: '上传的自定义模型',
            path: url || ''
        });
        env.createActorTemplateFromModel(id);
        if (refs.modelUpload) refs.modelUpload.value = '';
        env.markDirty('已上传模型');
        env.renderAll();
    } catch (error) {
        if (refs.modelUpload) refs.modelUpload.value = '';
        env.setStatus('模型上传失败: ' + error.message, 'error');
    }
}

/**
 * Actor 调色盘内模板缩略控件、本地上传与拖放绑定模型。
 */
export function bindActorTemplateModelControls(refs, env) {
    if (!refs.actorPalette) return;
    refs.actorPalette.querySelectorAll('[data-actor-template-scale]').forEach(function (input) {
        input.addEventListener('change', function () {
            var id = input.getAttribute('data-actor-template-scale');
            var st = env.getState();
            var t = st.actorTemplates.find(function (x) {
                return x.id === id;
            });
            if (!t) return;
            t.templateModelScale = clamp(Number(input.value) || 1, 0.1, 8);
            env.markDirty('已更新模板缩放');
            env.schedulePreviewRefresh();
        });
    });
    refs.actorPalette.querySelectorAll('[data-actor-template-file]').forEach(function (inp) {
        inp.addEventListener('change', function () {
            var id = inp.getAttribute('data-actor-template-file');
            if (!inp.files || !inp.files[0]) return;
            applyActorTemplateUploadedModel(refs, env, id, inp.files[0]);
            inp.value = '';
        });
    });
    refs.actorPalette.querySelectorAll('[data-actor-template-drop]').forEach(function (zone) {
        zone.addEventListener('dragover', function (e) {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        });
        zone.addEventListener('drop', async function (e) {
            e.preventDefault();
            var id = zone.getAttribute('data-actor-template-drop');
            var f = e.dataTransfer.files && e.dataTransfer.files[0] ? e.dataTransfer.files[0] : null;
            if (f) await applyActorTemplateUploadedModel(refs, env, id, f);
        });
    });
}

export async function applyActorTemplateUploadedModel(refs, env, templateId, file) {
    try {
        env.setStatus('正在上传「' + file.name + '」…', 'idle');
        var url = await env.uploadFileToProjectUrl(file, { gameModelsUpload: true, gameModelsSubdir: 'ActorTemplates' });
        var st = env.getState();
        var tpl = st.actorTemplates.find(function (x) {
            return x.id === templateId;
        });
        if (!tpl) {
            env.setStatus('仅能修改「项目 Actor 模板」。城市玩法库条目请在 Gameplay 工作台绑定模型。', 'error');
            return;
        }
        if (!url) {
            env.setStatus('上传成功但未返回 publicUrl（请查看终端 /api 报错）', 'error');
            return;
        }
        tpl.modelPath = url;
        env.markDirty('已绑定模板模型');
        env.renderActorPalette();
        env.schedulePreviewRefresh();
        env.setStatus(
            'Actor 模板已绑定「' +
                file.name +
                '」 · 当前：' +
                modelBindShortLabel(url) +
                '（悬停右侧格可看完整路径）',
            'success'
        );
    } catch (error) {
        env.setStatus('上传失败：' + ((error && error.message) || String(error)), 'error');
    }
}