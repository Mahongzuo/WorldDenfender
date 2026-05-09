import { MODEL_CATEGORY_CONFIG } from './content.js';
import { escapeAttr, escapeHtml, fileToBase64 } from './utils.js';
import { parseFetchErrorBody } from './fetch-utils.js';

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