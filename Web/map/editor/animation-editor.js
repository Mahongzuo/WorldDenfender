import { MODEL_CATEGORY_CONFIG } from './content.js';
import { escapeAttr, escapeHtml, fileToBase64 } from './utils.js';
import { parseFetchErrorBody } from './fetch-utils.js';
import { lookupGlobalModelPathScale, clampGlobalPathModelScale, canonicalModelPathScaleKey } from './model-path-scale.js';

var DEFAULT_STATE_TRIGGERS = ['auto', 'move', 'stop', 'attack', 'skill', 'hit', 'death'];

function modelProfileKey(modelPath) {
  return String(modelPath || '')
    .trim()
    .replace(/\\/g, '/');
}

function getActiveAnimationCategory(env) {
  return env.getActiveAnimationCategory() || 'all';
}

function getSelectedAnimationModelId(env) {
  return env.getSelectedAnimationModelId() || '';
}

function setSelectedAnimationModelId(env, value) {
  env.setSelectedAnimationModelId(value || '');
}

function setActiveAnimationCategory(env, value) {
  env.setActiveAnimationCategory(value || 'all');
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

function getAnimatableModelsByCategory(env, category) {
  var assets = env.getAnimatableModelEntries();
  if (category === 'all') return assets;
  var folder = MODEL_CATEGORY_CONFIG[category] ? MODEL_CATEGORY_CONFIG[category].folder : '';
  if (!folder) return [];
  return assets.filter(function (asset) {
    return getModelAssetCategoryFolder(asset).toLowerCase() === folder.toLowerCase();
  });
}

function ensureModelAnimationProfile(state, modelPath) {
  if (!state.gameAssetConfig) state.gameAssetConfig = {};
  if (!state.gameAssetConfig.modelAnimationProfiles || typeof state.gameAssetConfig.modelAnimationProfiles !== 'object') {
    state.gameAssetConfig.modelAnimationProfiles = {};
  }
  var key = modelProfileKey(modelPath);
  if (!state.gameAssetConfig.modelAnimationProfiles[key]) {
    state.gameAssetConfig.modelAnimationProfiles[key] = {
      defaultState: '',
      states: {},
      transitions: [],
      clipOverrides: {}
    };
  }
  return state.gameAssetConfig.modelAnimationProfiles[key];
}

function guessDefaultStates(clipNames) {
  var states = {};
  var preferred = ['idle', 'walk', 'run', 'attack', 'skill', 'death', 'hit'];
  preferred.forEach(function (name) {
    var match = clipNames.find(function (clip) {
      return String(clip).toLowerCase().indexOf(name) !== -1;
    });
    if (match) {
      states[name] = { clipName: match, loop: name !== 'attack' && name !== 'hit' && name !== 'death', speed: 1 };
    }
  });
  if (!Object.keys(states).length && clipNames.length) {
    states.default = { clipName: clipNames[0], loop: true, speed: 1 };
  }
  return states;
}

function allClipNamesForModel(entry) {
  var names = [];
  (entry.embeddedClipNames || []).forEach(function (n) {
    if (names.indexOf(n) === -1) names.push(n);
  });
  (entry.externalAnimations || []).forEach(function (ext) {
    if (ext && ext.name && names.indexOf(ext.name) === -1) names.push(ext.name);
  });
  return names.sort();
}

function syncAnimationCategoryTabs(refs, env) {
  if (!refs.animationCategoryTabs) return;
  refs.animationCategoryTabs.querySelectorAll('[data-animation-category]').forEach(function (item) {
    item.classList.toggle('active', item.getAttribute('data-animation-category') === getActiveAnimationCategory(env));
  });
}

function renderStateMachinePanel(profile, clipNames, disabled) {
  var states = profile.states && typeof profile.states === 'object' ? profile.states : {};
  var transitions = Array.isArray(profile.transitions) ? profile.transitions : [];
  var stateNames = Object.keys(states);
  var defaultState = profile.defaultState || stateNames[0] || '';

  var stateRows = stateNames
    .map(function (stateId) {
      var st = states[stateId] || {};
      var clipOptions = clipNames
        .map(function (clip) {
          var sel = st.clipName === clip ? ' selected' : '';
          return '<option value="' + escapeAttr(clip) + '"' + sel + '>' + escapeHtml(clip) + '</option>';
        })
        .join('');
      return [
        '<tr data-anim-state-row="' + escapeAttr(stateId) + '">',
        '  <td><input type="text" data-anim-state-id="' + escapeAttr(stateId) + '" value="' + escapeAttr(stateId) + '"' + (disabled ? ' disabled' : '') + '></td>',
        '  <td><select data-anim-state-clip="' + escapeAttr(stateId) + '"' + (disabled ? ' disabled' : '') + '>' + clipOptions + '</select></td>',
        '  <td><input type="checkbox" data-anim-state-loop="' + escapeAttr(stateId) + '"' + (st.loop !== false ? ' checked' : '') + (disabled ? ' disabled' : '') + '></td>',
        '  <td><input type="number" data-anim-state-speed="' + escapeAttr(stateId) + '" min="0.1" max="10" step="0.1" value="' + escapeAttr(String(st.speed != null ? st.speed : 1)) + '"' + (disabled ? ' disabled' : '') + '></td>',
        '  <td><button type="button" class="mini-button" data-anim-state-preview="' + escapeAttr(stateId) + '"' + (disabled ? ' disabled' : '') + '>预览</button></td>',
        '  <td><button type="button" class="mini-button" data-anim-state-remove="' + escapeAttr(stateId) + '"' + (disabled ? ' disabled' : '') + '>删除</button></td>',
        '</tr>'
      ].join('');
    })
    .join('');

  var transitionRows = transitions
    .map(function (tr, index) {
      var fromOpts = ['<option value="*"' + (tr.from === '*' ? ' selected' : '') + '>*</option>']
        .concat(
          stateNames.map(function (sn) {
            return '<option value="' + escapeAttr(sn) + '"' + (tr.from === sn ? ' selected' : '') + '>' + escapeHtml(sn) + '</option>';
          })
        )
        .join('');
      var toOpts = stateNames
        .map(function (sn) {
          return '<option value="' + escapeAttr(sn) + '"' + (tr.to === sn ? ' selected' : '') + '>' + escapeHtml(sn) + '</option>';
        })
        .join('');
      var triggerOpts = DEFAULT_STATE_TRIGGERS.map(function (tg) {
        return '<option value="' + escapeAttr(tg) + '"' + (tr.trigger === tg ? ' selected' : '') + '>' + escapeHtml(tg) + '</option>';
      }).join('');
      return [
        '<tr data-anim-transition-index="' + String(index) + '">',
        '  <td><select data-anim-transition-from="' + String(index) + '"' + (disabled ? ' disabled' : '') + '>' + fromOpts + '</select></td>',
        '  <td><select data-anim-transition-to="' + String(index) + '"' + (disabled ? ' disabled' : '') + '>' + toOpts + '</select></td>',
        '  <td><select data-anim-transition-trigger="' + String(index) + '"' + (disabled ? ' disabled' : '') + '>' + triggerOpts + '</select></td>',
        '  <td><button type="button" class="mini-button" data-anim-transition-remove="' + String(index) + '"' + (disabled ? ' disabled' : '') + '>删除</button></td>',
        '</tr>'
      ].join('');
    })
    .join('');

  var defaultOpts = stateNames
    .map(function (sn) {
      return '<option value="' + escapeAttr(sn) + '"' + (defaultState === sn ? ' selected' : '') + '>' + escapeHtml(sn) + '</option>';
    })
    .join('');

  return [
    '<div class="animation-state-machine-panel">',
    '  <div class="section-title-row">',
    '    <h3>状态机</h3>',
    '    <button type="button" class="mini-button" data-anim-add-state' + (disabled ? ' disabled' : '') + '>添加状态</button>',
    '  </div>',
    '  <p class="section-hint">为模型配置动画状态与过渡；预览区可即时播放各状态对应剪辑。配置保存在 <code>gameAssetConfig.modelAnimationProfiles</code>。</p>',
    '  <label class="field-block"><span>默认状态</span><select id="animationDefaultState"' + (disabled ? ' disabled' : '') + '>' + defaultOpts + '</select></label>',
    '  <div class="animation-state-table-wrap">',
    '    <table class="animation-state-table">',
    '      <thead><tr><th>状态</th><th>剪辑</th><th>循环</th><th>速度</th><th></th><th></th></tr></thead>',
    '      <tbody>' + (stateRows || '<tr><td colspan="6" class="empty-state">暂无状态，点击「添加状态」或「从剪辑自动生成」。</td></tr>') + '</tbody>',
    '    </table>',
    '  </div>',
    '  <div class="section-title-row" style="margin-top:12px;">',
    '    <h3>过渡</h3>',
    '    <button type="button" class="mini-button" data-anim-add-transition' + (disabled ? ' disabled' : '') + '>添加过渡</button>',
    '  </div>',
    '  <div class="animation-state-table-wrap">',
    '    <table class="animation-state-table">',
    '      <thead><tr><th>从</th><th>到</th><th>触发</th><th></th></tr></thead>',
    '      <tbody>' + (transitionRows || '<tr><td colspan="4" class="empty-state">暂无过渡规则。</td></tr>') + '</tbody>',
    '    </table>',
    '  </div>',
    '</div>'
  ].join('');
}

function renderClipPanel(entry, profile, disabled) {
  var clipNames = allClipNamesForModel(entry);
  var overrides = profile.clipOverrides && typeof profile.clipOverrides === 'object' ? profile.clipOverrides : {};
  var rows = clipNames
    .map(function (clipName) {
      var overrideUrl = overrides[clipName] || '';
      var extMatch = (entry.externalAnimations || []).find(function (ext) {
        return ext.name === clipName;
      });
      var sourceLabel = overrideUrl
        ? '外部替换'
        : extMatch
          ? '已导入'
          : (entry.embeddedClipNames || []).indexOf(clipName) !== -1
            ? '内嵌'
            : '未知';
      return [
        '<div class="animation-clip-row">',
        '  <div class="animation-clip-row__head">',
        '    <strong>' + escapeHtml(clipName) + '</strong>',
        '    <span class="gameplay-chip">' + escapeHtml(sourceLabel) + '</span>',
        '  </div>',
        '  <div class="animation-clip-row__actions">',
        '    <button type="button" class="mini-button" data-anim-play-clip="' + escapeAttr(clipName) + '"' + (disabled ? ' disabled' : '') + '>播放</button>',
        '    <label class="mini-button upload-button">',
        '      导入/替换',
        '      <input type="file" data-anim-upload-clip="' + escapeAttr(clipName) + '" accept=".glb,.gltf,model/gltf-binary,model/gltf+json"' + (disabled ? ' disabled' : '') + '>',
        '    </label>',
        '    <button type="button" class="mini-button" data-anim-clear-override="' + escapeAttr(clipName) + '"' + (disabled || !overrideUrl ? ' disabled' : '') + '>清除替换</button>',
        '  </div>',
        overrideUrl ? '<p class="section-hint">替换路径：<code>' + escapeHtml(overrideUrl) + '</code></p>' : '',
        '</div>'
      ].join('');
    })
    .join('');

  return [
    '<div class="animation-clip-panel">',
    '  <div class="section-title-row">',
    '    <h3>动画剪辑</h3>',
    '    <button type="button" class="mini-button" data-anim-auto-states' + (disabled ? ' disabled' : '') + '>从剪辑自动生成状态</button>',
    '  </div>',
    '  <p class="section-hint">内嵌剪辑来自模型 GLB/GLTF；导入文件保存到 <code>' + escapeHtml(entry.animationsDir || 'GameModels/…/animations') + '</code>。</p>',
    rows || '<div class="empty-state">该模型暂无可识别动画剪辑。</div>',
    '  <div class="section-title-row" style="margin-top:12px;">',
    '    <h3>导入新动画</h3>',
    '    <label class="mini-button upload-button">',
    '      上传 GLB/GLTF',
    '      <input type="file" id="animationImportNew" accept=".glb,.gltf,model/gltf-binary,model/gltf+json"' + (disabled ? ' disabled' : '') + '>',
    '    </label>',
    '  </div>',
    '  <label class="field-block"><span>文件名（不含扩展名）</span><input id="animationImportName" type="text" placeholder="例如 walk"' + (disabled ? ' disabled' : '') + '></label>',
    '</div>'
  ].join('');
}

function renderAnimationDetail(refs, env, entry) {
  if (refs.animationDetailTitle) refs.animationDetailTitle.textContent = entry ? entry.name : '动画详情';
  if (refs.animationDetailMeta) refs.animationDetailMeta.textContent = entry ? '已选择' : '未选择';
  if (refs.animationPreviewEmpty) refs.animationPreviewEmpty.classList.toggle('view-hidden', !!entry);
  if (refs.animationPreviewHost) refs.animationPreviewHost.classList.toggle('view-hidden', !entry);
  if (refs.animationPreviewMeta) {
    refs.animationPreviewMeta.textContent = entry
      ? entry.name + ' · ' + (entry.embeddedClipNames || []).length + ' 内嵌 / ' + (entry.externalAnimations || []).length + ' 导入'
      : '未绑定模型';
  }

  var st = typeof env.getState === 'function' ? env.getState() : null;
  var scaleTable = st && st.gameAssetConfig ? st.gameAssetConfig.globalModelPathScales || {} : {};
  var pathForScale = entry ? entry.publicUrl || '' : '';
  var pathKey = canonicalModelPathScaleKey(pathForScale);
  var persisted = pathKey ? scaleTable[pathKey] : undefined;
  var curScale =
    persisted != null && Number.isFinite(Number(persisted)) ? clampGlobalPathModelScale(Number(persisted)) : 1;
  if (refs.animationDetailGlobalScale) {
    refs.animationDetailGlobalScale.disabled = !entry;
    refs.animationDetailGlobalScale.value = String(entry ? curScale : 1);
  }
  if (refs.animationPreviewRefit) refs.animationPreviewRefit.disabled = !entry;

  if (!entry) {
    env.disposeAnimationAssetPreview();
    if (refs.animationClipPanel) refs.animationClipPanel.innerHTML = '';
    if (refs.animationStateMachinePanel) refs.animationStateMachinePanel.innerHTML = '';
    return;
  }

  var modelPath = entry.publicUrl || '';
  var profile = ensureModelAnimationProfile(st, modelPath);
  if (!Object.keys(profile.states || {}).length && (entry.embeddedClipNames || []).length) {
    profile.states = guessDefaultStates(allClipNamesForModel(entry));
    profile.defaultState = Object.keys(profile.states)[0] || '';
  }

  if (refs.animationClipPanel) refs.animationClipPanel.innerHTML = renderClipPanel(entry, profile, false);
  if (refs.animationStateMachinePanel) refs.animationStateMachinePanel.innerHTML = renderStateMachinePanel(profile, allClipNamesForModel(entry), false);

  var mult = lookupGlobalModelPathScale(scaleTable, modelPath);
  var externalUrls = (entry.externalAnimations || []).map(function (ext) {
    return ext.publicUrl;
  });
  Object.keys(profile.clipOverrides || {}).forEach(function (key) {
    var url = profile.clipOverrides[key];
    if (url && externalUrls.indexOf(url) === -1) externalUrls.push(url);
  });
  env.ensureAnimationAssetPreview(modelPath, mult, externalUrls);
}

export function renderAnimationEditor(refs, env) {
  if (env.getActiveWorkbench() !== 'animation') return;
  var allAssets = env.getAnimatableModelEntries();
  var categoryAssets = getAnimatableModelsByCategory(env, getActiveAnimationCategory(env));
  var keyword = refs.animationSearch ? String(refs.animationSearch.value || '').trim().toLowerCase() : '';
  var filtered = categoryAssets.filter(function (asset) {
    if (!keyword) return true;
    var haystack = [asset.name, asset.id, asset.relativePath, (asset.embeddedClipNames || []).join(' ')].join(' ').toLowerCase();
    return haystack.indexOf(keyword) !== -1;
  });

  var counts = {};
  Object.keys(MODEL_CATEGORY_CONFIG).forEach(function (key) {
    counts[key] = key === 'all' ? allAssets.length : getAnimatableModelsByCategory(env, key).length;
  });

  if (refs.animationOverviewStats) {
    refs.animationOverviewStats.innerHTML = Object.keys(MODEL_CATEGORY_CONFIG)
      .map(function (key) {
        var cfg = MODEL_CATEGORY_CONFIG[key];
        return '<div class="stat-card"><strong>' + escapeHtml(String(counts[key] || 0)) + '</strong><span>' + escapeHtml(cfg.label) + '</span></div>';
      })
      .join('');
  }

  if (refs.animationListCount) refs.animationListCount.textContent = '共 ' + filtered.length + ' 项';

  if (refs.animationEntryList) {
    if (!filtered.length) {
      refs.animationEntryList.innerHTML =
        '<div class="empty-state">当前分类暂无带骨骼/动画的模型。请确认 public/GameModels 中有含 skins 或 animations 的 GLB/GLTF，或点击右侧「重新扫描」。</div>';
    } else {
      if (
        !getSelectedAnimationModelId(env) ||
        !filtered.some(function (asset) {
          return asset.id === getSelectedAnimationModelId(env);
        })
      ) {
        setSelectedAnimationModelId(env, filtered[0].id);
      }
      refs.animationEntryList.innerHTML = filtered
        .map(function (asset) {
          var active = asset.id === getSelectedAnimationModelId(env) ? ' active' : '';
          var folder = getModelAssetCategoryFolder(asset);
          var matchedKey = Object.keys(MODEL_CATEGORY_CONFIG).find(function (key) {
            return key !== 'all' && MODEL_CATEGORY_CONFIG[key].folder.toLowerCase() === folder.toLowerCase();
          });
          var categoryLabel = matchedKey ? MODEL_CATEGORY_CONFIG[matchedKey].label : folder || '未分类';
          var clipCount = (asset.embeddedClipNames || []).length + (asset.externalAnimations || []).length;
          return [
            '<button type="button" class="list-item gameplay-entry-card' + active + '" data-animation-model-id="' + escapeAttr(asset.id) + '">',
            '  <strong>' + escapeHtml(asset.name) + '</strong>',
            '  <span>' + escapeHtml(asset.relativePath || '') + '</span>',
            '  <div class="gameplay-entry-meta">',
            '    <span class="gameplay-chip">' + escapeHtml(categoryLabel) + '</span>',
            '    <span class="gameplay-chip">' + escapeHtml(String(clipCount)) + ' 剪辑</span>',
            asset.hasSkins ? '<span class="gameplay-chip">骨骼</span>' : '',
            '  </div>',
            '</button>'
          ].join('');
        })
        .join('');
    }
  }

  var selected =
    filtered.find(function (asset) {
      return asset.id === getSelectedAnimationModelId(env);
    }) || null;
  renderAnimationDetail(refs, env, selected);
}

function findSelectedEntry(env) {
  return env.getAnimatableModelEntries().find(function (asset) {
    return asset.id === getSelectedAnimationModelId(env);
  });
}

export function readAnimationProfileFromDom(refs, env) {
  var entry = findSelectedEntry(env);
  if (!entry || !refs.animationStateMachinePanel) return;
  var st = env.getState();
  var profile = ensureModelAnimationProfile(st, entry.publicUrl);
  var tbody = refs.animationStateMachinePanel.querySelector('.animation-state-table tbody');
  if (tbody) {
    var nextStates = {};
    tbody.querySelectorAll('[data-anim-state-row]').forEach(function (row) {
      var oldId = row.getAttribute('data-anim-state-row') || '';
      var idInput = row.querySelector('[data-anim-state-id]');
      var clipSelect = row.querySelector('[data-anim-state-clip]');
      var loopInput = row.querySelector('[data-anim-state-loop]');
      var speedInput = row.querySelector('[data-anim-state-speed]');
      var newId = idInput ? String(idInput.value || oldId).trim() : oldId;
      if (!newId) return;
      nextStates[newId] = {
        clipName: clipSelect ? String(clipSelect.value || '') : '',
        loop: loopInput ? !!loopInput.checked : true,
        speed: speedInput ? Number(speedInput.value) || 1 : 1
      };
    });
    profile.states = nextStates;
  }
  var transBody = refs.animationStateMachinePanel.querySelectorAll('.animation-state-table')[1];
  if (transBody) {
    var tbody2 = transBody.querySelector('tbody');
    if (tbody2) {
      profile.transitions = [];
      tbody2.querySelectorAll('[data-anim-transition-index]').forEach(function (row) {
        var idx = row.getAttribute('data-anim-transition-index') || '';
        var fromSel = row.querySelector('[data-anim-transition-from="' + idx + '"]');
        var toSel = row.querySelector('[data-anim-transition-to="' + idx + '"]');
        var triggerSel = row.querySelector('[data-anim-transition-trigger="' + idx + '"]');
        profile.transitions.push({
          from: fromSel ? String(fromSel.value || '*') : '*',
          to: toSel ? String(toSel.value || '') : '',
          trigger: triggerSel ? String(triggerSel.value || 'auto') : 'auto'
        });
      });
    }
  }
  if (refs.animationDefaultState) {
    profile.defaultState = String(refs.animationDefaultState.value || '');
  }
}

export async function uploadAnimationClip(refs, env, clipName, file) {
  var entry = findSelectedEntry(env);
  if (!entry || !file) return;
  var uploadName = clipName ? clipName + (file.name.match(/\.[^.]+$/) ? '' : '.glb') : file.name;
  try {
    env.setStatus('正在上传动画 ' + uploadName + '…', 'idle');
    var content = await fileToBase64(file);
    var response = await fetch('/api/game-models/upload-animation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelUrl: entry.publicUrl,
        name: uploadName,
        content: content,
        replaceExisting: true
      })
    });
    var responseText = await response.text();
    if (!response.ok) throw new Error(parseFetchErrorBody(response.status, responseText));
    var payload = JSON.parse(responseText);
    var st = env.getState();
    var profile = ensureModelAnimationProfile(st, entry.publicUrl);
    profile.clipOverrides = profile.clipOverrides || {};
    profile.clipOverrides[clipName || payload.name] = payload.publicUrl;
    await env.refreshAnimatableModelsCatalog();
    env.markDirty('已导入动画');
    readAnimationProfileFromDom(refs, env);
    renderAnimationEditor(refs, env);
    if (env.getAnimationPreviewApi && env.getAnimationPreviewApi()) {
      await env.getAnimationPreviewApi().loadExternalClip(payload.publicUrl);
      env.getAnimationPreviewApi().playClip(clipName || payload.name, true);
    }
    env.setStatus('动画已保存: ' + String(payload.projectPath || ''), 'success');
  } catch (error) {
    env.setStatus('动画上传失败: ' + error.message, 'error');
  }
}

export async function importNewAnimation(refs, env, file) {
  var entry = findSelectedEntry(env);
  if (!entry || !file) return;
  var nameHint = refs.animationImportName ? String(refs.animationImportName.value || '').trim() : '';
  var stem = nameHint || file.name.replace(/\.[^.]+$/, '') || 'animation';
  await uploadAnimationClip(refs, env, stem, file);
  if (refs.animationImportName) refs.animationImportName.value = '';
}

export function bindAnimationEditorUi(refs, env) {
  if (refs.animationWorkbench) {
    refs.animationWorkbench.addEventListener(
      'wheel',
      function (event) {
        var target = event.target;
        if (
          target &&
          target.matches &&
          target.matches('input[type="number"]') &&
          document.activeElement === target
        ) {
          target.blur();
        }
      },
      true
    );
  }
  if (refs.animationCategoryTabs) {
    refs.animationCategoryTabs.addEventListener('click', function (event) {
      var button = event.target.closest('[data-animation-category]');
      if (!button) return;
      setActiveAnimationCategory(env, button.getAttribute('data-animation-category') || 'all');
      setSelectedAnimationModelId(env, '');
      syncAnimationCategoryTabs(refs, env);
      renderAnimationEditor(refs, env);
    });
  }
  if (refs.animationSearch) refs.animationSearch.addEventListener('input', function () {
    renderAnimationEditor(refs, env);
  });
  if (refs.animationEntryList) {
    refs.animationEntryList.addEventListener('click', function (event) {
      var item = event.target.closest('[data-animation-model-id]');
      if (!item) return;
      readAnimationProfileFromDom(refs, env);
      setSelectedAnimationModelId(env, item.getAttribute('data-animation-model-id') || '');
      renderAnimationEditor(refs, env);
    });
  }
  if (refs.btnRefreshAnimatableModels) {
    refs.btnRefreshAnimatableModels.addEventListener('click', function () {
      void env.refreshAnimatableModelsCatalog().then(function () {
        renderAnimationEditor(refs, env);
        env.setStatus('已重新扫描带骨骼动画的模型。', 'success');
      });
    });
  }
  if (refs.animationPreviewPlay) {
    refs.animationPreviewPlay.addEventListener('click', function () {
      var api = env.getAnimationPreviewApi ? env.getAnimationPreviewApi() : null;
      if (api) api.setPlaying(true);
      if (refs.animationPreviewPlay) refs.animationPreviewPlay.classList.add('active');
      if (refs.animationPreviewPause) refs.animationPreviewPause.classList.remove('active');
    });
  }
  if (refs.animationPreviewPause) {
    refs.animationPreviewPause.addEventListener('click', function () {
      var api = env.getAnimationPreviewApi ? env.getAnimationPreviewApi() : null;
      if (api) api.setPlaying(false);
      if (refs.animationPreviewPause) refs.animationPreviewPause.classList.add('active');
      if (refs.animationPreviewPlay) refs.animationPreviewPlay.classList.remove('active');
    });
  }
  if (refs.animationPreviewSpeed) {
    refs.animationPreviewSpeed.addEventListener('input', function () {
      var api = env.getAnimationPreviewApi ? env.getAnimationPreviewApi() : null;
      if (api) api.setSpeed(Number(refs.animationPreviewSpeed.value) || 1);
    });
  }
  var animationGlobalScaleDirtyTimer = null;
  if (refs.animationDetailGlobalScale) {
    refs.animationDetailGlobalScale.addEventListener('input', function () {
      if (typeof env.updateAnimationPreviewScale !== 'function') return;
      var entry = findSelectedEntry(env);
      if (!entry) return;
      var sc = Number(refs.animationDetailGlobalScale.value);
      if (!Number.isFinite(sc)) return;
      env.updateAnimationPreviewScale(entry.publicUrl || '', clampGlobalPathModelScale(sc));
      clearTimeout(animationGlobalScaleDirtyTimer);
      animationGlobalScaleDirtyTimer = setTimeout(function () {
        if (typeof env.commitAnimationWorkbenchGlobalScale === 'function') {
          env.commitAnimationWorkbenchGlobalScale();
        }
      }, 360);
    });
  }
  if (refs.animationPreviewRefit) {
    refs.animationPreviewRefit.addEventListener('click', function () {
      if (typeof env.refitAnimationPreview === 'function') env.refitAnimationPreview();
    });
  }

  document.addEventListener('click', function (event) {
    if (env.getActiveWorkbench() !== 'animation') return;
    var target = event.target.closest('[data-anim-play-clip], [data-anim-state-preview], [data-anim-add-state], [data-anim-add-transition], [data-anim-auto-states], [data-anim-state-remove], [data-anim-transition-remove], [data-anim-clear-override]');
    if (!target) return;

    if (target.hasAttribute('data-anim-play-clip') || target.hasAttribute('data-anim-state-preview')) {
      var clip =
        target.getAttribute('data-anim-play-clip') ||
        (function () {
          var stateId = target.getAttribute('data-anim-state-preview') || '';
          var entry = findSelectedEntry(env);
          if (!entry) return '';
          var profile = ensureModelAnimationProfile(env.getState(), entry.publicUrl);
          return profile.states && profile.states[stateId] ? profile.states[stateId].clipName : '';
        })();
      var api = env.getAnimationPreviewApi ? env.getAnimationPreviewApi() : null;
      if (api && clip) api.playClip(clip, true);
      return;
    }

    if (target.hasAttribute('data-anim-add-state')) {
      readAnimationProfileFromDom(refs, env);
      var entryAdd = findSelectedEntry(env);
      if (!entryAdd) return;
      var profileAdd = ensureModelAnimationProfile(env.getState(), entryAdd.publicUrl);
      var baseId = 'state_' + (Object.keys(profileAdd.states || {}).length + 1);
      var clips = allClipNamesForModel(entryAdd);
      profileAdd.states[baseId] = { clipName: clips[0] || '', loop: true, speed: 1 };
      env.markDirty('已添加动画状态');
      renderAnimationEditor(refs, env);
      return;
    }

    if (target.hasAttribute('data-anim-add-transition')) {
      readAnimationProfileFromDom(refs, env);
      var entryTr = findSelectedEntry(env);
      if (!entryTr) return;
      var profileTr = ensureModelAnimationProfile(env.getState(), entryTr.publicUrl);
      profileTr.transitions = profileTr.transitions || [];
      profileTr.transitions.push({ from: '*', to: Object.keys(profileTr.states || {})[0] || '', trigger: 'auto' });
      env.markDirty('已添加状态过渡');
      renderAnimationEditor(refs, env);
      return;
    }

    if (target.hasAttribute('data-anim-auto-states')) {
      var entryAuto = findSelectedEntry(env);
      if (!entryAuto) return;
      var profileAuto = ensureModelAnimationProfile(env.getState(), entryAuto.publicUrl);
      profileAuto.states = guessDefaultStates(allClipNamesForModel(entryAuto));
      profileAuto.defaultState = Object.keys(profileAuto.states)[0] || '';
      env.markDirty('已从剪辑自动生成状态机');
      renderAnimationEditor(refs, env);
      return;
    }

    if (target.hasAttribute('data-anim-state-remove')) {
      readAnimationProfileFromDom(refs, env);
      var rmId = target.getAttribute('data-anim-state-remove') || '';
      var entryRm = findSelectedEntry(env);
      if (!entryRm || !rmId) return;
      var profileRm = ensureModelAnimationProfile(env.getState(), entryRm.publicUrl);
      delete profileRm.states[rmId];
      env.markDirty('已删除动画状态');
      renderAnimationEditor(refs, env);
      return;
    }

    if (target.hasAttribute('data-anim-transition-remove')) {
      readAnimationProfileFromDom(refs, env);
      var rmIdx = Number(target.getAttribute('data-anim-transition-remove'));
      var entryRmTr = findSelectedEntry(env);
      if (!entryRmTr || !Number.isFinite(rmIdx)) return;
      var profileRmTr = ensureModelAnimationProfile(env.getState(), entryRmTr.publicUrl);
      profileRmTr.transitions = (profileRmTr.transitions || []).filter(function (_, i) {
        return i !== rmIdx;
      });
      env.markDirty('已删除状态过渡');
      renderAnimationEditor(refs, env);
      return;
    }

    if (target.hasAttribute('data-anim-clear-override')) {
      var clearClip = target.getAttribute('data-anim-clear-override') || '';
      var entryClr = findSelectedEntry(env);
      if (!entryClr || !clearClip) return;
      var profileClr = ensureModelAnimationProfile(env.getState(), entryClr.publicUrl);
      if (profileClr.clipOverrides) delete profileClr.clipOverrides[clearClip];
      env.markDirty('已清除动画替换');
      renderAnimationEditor(refs, env);
    }
  });

  document.addEventListener('change', function (event) {
    if (env.getActiveWorkbench() !== 'animation') return;
    var uploadTarget = event.target;
    if (uploadTarget && uploadTarget.getAttribute && uploadTarget.getAttribute('data-anim-upload-clip')) {
      var clipId = uploadTarget.getAttribute('data-anim-upload-clip') || '';
      var file = uploadTarget.files && uploadTarget.files[0];
      uploadTarget.value = '';
      if (file) void uploadAnimationClip(refs, env, clipId, file);
      return;
    }
    if (uploadTarget && uploadTarget.id === 'animationImportNew') {
      var newFile = uploadTarget.files && uploadTarget.files[0];
      uploadTarget.value = '';
      if (newFile) void importNewAnimation(refs, env, newFile);
      return;
    }
    if (
      uploadTarget &&
      (uploadTarget.matches('[data-anim-state-id], [data-anim-state-clip], [data-anim-state-loop], [data-anim-state-speed], [data-anim-transition-from], [data-anim-transition-to], [data-anim-transition-trigger], #animationDefaultState'))
    ) {
      readAnimationProfileFromDom(refs, env);
      env.markDirty('已更新动画状态机');
    }
  });
}
