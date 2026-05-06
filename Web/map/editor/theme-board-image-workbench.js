import { escapeAttr, escapeHtml } from './utils.js';

var CITY_STYLE_HINTS = {
    '\u5317\u4eac': '\u4e2d\u8f74\u7ebf\u3001\u6545\u5bab\u7ea2\u5899\u91d1\u74e6\u3001\u80e1\u540c\u56db\u5408\u9662\u3001\u73b0\u4ee3 CBD \u5929\u9645\u7ebf\u3001\u94f6\u674f\u8857\u9053',
    '\u6d4e\u5357': '\u6cc9\u6c34\u3001\u8001\u57ce\u77f3\u6865\u3001\u6e56\u7574\u7eff\u836b\u3001\u6cc9\u57ce\u5efa\u7b51\u808c\u7406',
    '\u4e0a\u6d77': '\u5916\u6ee9\u5929\u9645\u7ebf\u3001\u77f3\u5e93\u95e8\u3001\u6ee8\u6c5f\u5927\u9053\u3001\u8d85\u73b0\u4ee3\u57ce\u5e02\u706f\u5f71',
    '\u5e7f\u5dde': '\u73e0\u6c5f\u6cbf\u5cb8\u3001\u9a91\u697c\u8857\u533a\u3001\u73b0\u4ee3\u5546\u5708\u3001\u4e9a\u70ed\u5e26\u690d\u88ab',
    '\u6df1\u5733': '\u6ee8\u6d77\u7eff\u9053\u3001\u79d1\u6280\u56ed\u533a\u3001\u73b0\u4ee3\u9ad8\u697c\u3001\u5e74\u8f7b\u5316\u57ce\u5e02\u808c\u7406',
    '\u897f\u5b89': '\u57ce\u5899\u3001\u949f\u9f13\u697c\u3001\u53e4\u57ce\u8857\u5df7\u3001\u5510\u98ce\u5efa\u7b51\u706f\u5149',
    '\u6210\u90fd': '\u516c\u56ed\u7eff\u9053\u3001\u5ddd\u897f\u8857\u533a\u3001\u7af9\u5f71\u4e0e\u8336\u9986\u6c14\u606f\u3001\u6162\u751f\u6d3b\u57ce\u5e02\u808c\u7406',
    '\u83ab\u65af\u79d1': '\u7ea2\u573a\u3001\u6d0b\u8471\u5934\u5706\u9876\u3001\u4e1c\u6b27\u77f3\u783c\u8857\u533a\u3001\u51ac\u5b63\u96ea\u666f\u3001\u51b7\u8272\u5929\u7a7a',
    '\u5df4\u9ece': '\u585e\u7eb3\u6cb3\u3001\u6b27\u5f0f\u8857\u533a\u3001\u57ce\u5e02\u5730\u6807\u526a\u5f71\u3001\u6cd5\u5f0f\u77f3\u7b51\u5efa\u7b51'
};

function getLevelLocation(level) {
    var location = (level && level.location) || {};
    var cityName = String((level && level.cityName) || location.cityName || '').trim();
    var countryName = String((level && level.countryName) || location.countryName || '').trim();
    return {
        cityName: cityName,
        countryName: countryName,
        placeName: cityName || String((level && level.name) || '\u5f53\u524d\u5173\u5361').trim() || '\u5f53\u524d\u5173\u5361'
    };
}

function getBoardGridLabel(level) {
    var grid = level && level.map && level.map.grid;
    var cols = Number(grid && grid.cols) || 0;
    var rows = Number(grid && grid.rows) || 0;
    return cols > 0 && rows > 0 ? cols + 'x' + rows : '\u672a\u8bbe\u7f6e\u68cb\u76d8\u5c3a\u5bf8';
}

function getCityStyleHint(level) {
    var cityName = getLevelLocation(level).cityName;
    if (!cityName) return '\u8be5\u5730\u57ce\u5e02\u7684\u5730\u6807\u3001\u8857\u533a\u7eb9\u7406\u4e0e\u5730\u57df\u5efa\u7b51\u98ce\u683c';
    var keys = Object.keys(CITY_STYLE_HINTS);
    for (var i = 0; i < keys.length; i += 1) {
        if (cityName.indexOf(keys[i]) !== -1) return CITY_STYLE_HINTS[keys[i]];
    }
    return cityName + '\u7684\u5730\u6807\u3001\u8857\u533a\u7eb9\u7406\u4e0e\u5730\u57df\u5efa\u7b51\u98ce\u683c';
}

function buildCommonConstraints(level, themeScope) {
    var gridLabel = getBoardGridLabel(level);
    var isExplore = themeScope === 'explore';
    return [
        '\u659c\u4fef\u89c6\u89d2\u6216\u822a\u62cd\u5730\u56fe\u89c6\u89d2',
        '\u9002\u5408\u4f5c\u4e3a ' + gridLabel + ' \u68cb\u76d8\u5173\u5361\u5e95\u56fe',
        isExplore
            ? '\u6b65\u884c\u8def\u7ebf\u3001\u63a2\u7d22\u8282\u70b9\u3001\u5b89\u5168\u533a\u4e0e\u5730\u5f62\u8d77\u4f0f\u6e05\u6670\u53ef\u8bfb'
            : '\u4e3b\u9053\u8def\u3001\u62d0\u70b9\u3001\u5f00\u9614\u5e03\u9632\u533a\u4e0e\u6838\u5fc3\u76ee\u6807\u533a\u6e05\u6670\u53ef\u8bfb',
        '\u4e3a\u540e\u7eed\u6446\u653e\u9053\u8def\u3001\u5730\u6807\u3001\u969c\u788d\u548c Actor \u6a21\u578b\u9884\u7559\u7a7a\u5730\u4e0e\u5e73\u53f0',
        '\u5730\u9762\u7eb9\u7406\u6e05\u6670\u3001\u5149\u7167\u7edf\u4e00\u3001\u65e0\u4eba\u7269\u3001\u65e0 UI\u3001\u65e0\u6587\u5b57\u3001\u65e0 logo\u3001\u65e0\u6c34\u5370'
    ].join('\uff0c');
}

function buildPromptPresets(level, themeScope) {
    var location = getLevelLocation(level);
    var placeName = location.placeName;
    var styleHint = getCityStyleHint(level);
    var common = buildCommonConstraints(level, themeScope);
    var countryPrefix = location.countryName ? location.countryName + '\u5730\u57df\u6c14\u8d28\uff0c' : '';
    var isExplore = themeScope === 'explore';
    return [
        {
            id: 'landmark',
            title: '\u57ce\u5e02\u5730\u6807\u7248',
            summary: '\u4fdd\u7559\u5730\u6807\u4e0e\u57ce\u5e02\u808c\u7406\uff0c\u4fbf\u4e8e\u540e\u7eed\u6446\u5730\u6807\u6a21\u578b',
            prompt:
                placeName +
                '\u5173\u5361\u68cb\u76d8\u5730\u56fe\uff0c' +
                countryPrefix +
                styleHint +
                '\uff0c\u4e3b\u5730\u6807\u51fa\u73b0\u5728\u753b\u9762\u8fb9\u7f18\u6216\u80cc\u666f\uff0c\u4e2d\u90e8\u4fdd\u7559\u53ef\u7f16\u8f91\u7684\u9053\u8def\u4e0e\u5e73\u53f0\uff0c' +
                common
        },
        {
            id: 'routes',
            title: isExplore ? '\u63a2\u7d22\u8def\u7ebf\u7248' : '\u9053\u8def\u89c4\u5212\u7248',
            summary: isExplore ? '\u5f3a\u8c03\u6b65\u884c\u8def\u5f84\u3001\u5730\u5f62\u5c42\u6b21\u548c\u63a2\u7d22\u8282\u70b9' : '\u5f3a\u8c03\u4e3b\u9053\u8def\u3001\u4fa7\u8fb9\u90e8\u7f72\u533a\u4e0e\u5173\u5361\u8282\u594f',
            prompt:
                placeName +
                (isExplore ? '\u63a2\u7d22\u5173\u5361\u5730\u56fe\uff0c' : '\u5854\u9632\u5173\u5361\u5730\u56fe\uff0c') +
                styleHint +
                '\uff0c' +
                (isExplore
                    ? '\u5f62\u6210\u6e05\u6670\u7684\u5f92\u6b65\u8def\u7ebf\u3001\u6808\u9053\u3001\u89c2\u666f\u70b9\u548c\u6536\u96c6\u533a\u57df\uff0c\u8fdb\u9000\u8def\u7ebf\u6e05\u6670\u3002'
                    : '\u5f62\u6210\u6e05\u6670\u7684\u4e3b\u8def\u3001\u652f\u8def\u4e0e\u62d0\u70b9\uff0c\u9053\u8def\u4e24\u4fa7\u9884\u7559\u53ef\u90e8\u7f72\u533a\u57df\u3002') +
                common
        },
        {
            id: 'open-space',
            title: '\u5e03\u7f6e\u7559\u767d\u7248',
            summary: '\u66f4\u591a\u5e7f\u573a\u3001\u7a7a\u5730\u548c\u6a21\u578b\u5bb9\u7eb3\u533a\uff0c\u9002\u5408\u81ea\u5b9a\u4e49\u642d\u5efa',
            prompt:
                placeName +
                '\u98ce\u683c\u5730\u56fe\u5e95\u56fe\uff0c' +
                styleHint +
                '\uff0c\u591a\u4e2a\u5f00\u9614\u5e73\u53f0\u3001\u5e7f\u573a\u3001\u5e73\u7f13\u7a7a\u5730\u548c\u53ef\u6446\u653e\u5730\u6807\u7684\u8282\u70b9\uff0c\u9053\u8def\u5c3d\u91cf\u7b80\u6d01\u6e05\u6670\uff0c' +
                common
        },
        {
            id: 'cinematic',
            title: '\u6c1b\u56f4\u6444\u5f71\u7248',
            summary: '\u98ce\u683c\u611f\u66f4\u5f3a\uff0c\u4f46\u4f9d\u7136\u4fdd\u6301\u68cb\u76d8\u53ef\u7528\u6027',
            prompt:
                placeName +
                '\u7535\u5f71\u611f\u5173\u5361\u5730\u56fe\uff0c' +
                styleHint +
                '\uff0c\u9ad8\u7ea7\u5149\u5f71\u6c1b\u56f4\u3001\u5bcc\u6709\u5c42\u6b21\u7684\u4e91\u5f71\u4e0e\u7a7a\u6c14\u900f\u89c6\uff0c\u4f46\u5730\u9762\u9053\u8def\u3001\u5e73\u53f0\u4e0e\u7ed3\u6784\u5fc5\u987b\u6e05\u6670\u3001\u53ef\u7528\u4e8e\u5173\u5361\u7f16\u6392\uff0c' +
                common
        }
    ];
}

function ensureStateForLevel(state, level, themeScope, presets) {
    var levelId = String((level && level.id) || '');
    var nextKey = levelId + '|' + themeScope;
    if (state.contextKey !== nextKey) {
        state.contextKey = nextKey;
        state.prompt = presets[0] ? presets[0].prompt : '';
        state.lastPresetId = presets[0] ? presets[0].id : '';
        if (!state.lastResult || state.lastResult.levelId !== levelId) state.lastResult = null;
        state.statusText = '\u82e5\u5f53\u524d\u5df2\u9009\u4e2d\u68cb\u76d8\u914d\u56fe\uff0c\u4f1a\u76f4\u63a5\u539f\u4f4d\u66ff\u6362\u8be5\u56fe\u5c42\uff1b\u5426\u5219\u4f1a\u65b0\u589e\u4e00\u5f20\u94fa\u6ee1\u68cb\u76d8\u7684\u914d\u56fe\u3002';
        state.statusTone = 'idle';
    }
}

function setStatusEl(element, text, tone) {
    if (!element) return;
    element.textContent = text || '';
    element.classList.remove('is-success', 'is-error', 'is-pending');
    if (tone === 'success') element.classList.add('is-success');
    else if (tone === 'error') element.classList.add('is-error');
    else if (tone === 'pending') element.classList.add('is-pending');
}

export function renderThemeBoardImageWorkbench(refs, env) {
    if (!refs.themeBoardAiPrompt || !refs.themeBoardAiStatus) return;
    var state = env.getThemeBoardImageState();
    var level = env.getLevel();
    if (!level) {
        refs.themeBoardAiPrompt.value = '';
        refs.themeBoardAiPrompt.disabled = true;
        refs.themeBoardAiGenerate.disabled = true;
        refs.themeBoardAiOpenLocation.disabled = true;
        refs.themeBoardAiFocusLayout.disabled = true;
        if (refs.themeBoardAiPromptPresets) refs.themeBoardAiPromptPresets.innerHTML = '';
        if (refs.themeBoardAiContext) refs.themeBoardAiContext.textContent = '\u8bf7\u5148\u9009\u62e9\u4e00\u4e2a\u5173\u5361\uff0c\u751f\u6210\u7684\u56fe\u7247\u4f1a\u81ea\u52a8\u4fdd\u5b58\u5230\u8be5\u5173\u5361\u7684 Maps \u8d44\u6e90\u76ee\u5f55\u3002';
        setStatusEl(refs.themeBoardAiStatus, '\u6682\u65e0\u53ef\u751f\u6210\u7684\u5173\u5361\u4e0a\u4e0b\u6587\u3002', 'idle');
        if (refs.themeBoardAiResultCard) refs.themeBoardAiResultCard.classList.add('view-hidden');
        return;
    }
    var themeScope = env.getActiveThemeScope();
    var presets = buildPromptPresets(level, themeScope);
    ensureStateForLevel(state, level, themeScope, presets);
    refs.themeBoardAiPrompt.disabled = !!state.generating;
    refs.themeBoardAiPrompt.value = state.prompt || '';
    refs.themeBoardAiGenerate.disabled = !!state.generating || !String(state.prompt || '').trim();
    refs.themeBoardAiGenerate.textContent = state.generating ? '\u6b63\u5728\u751f\u6210\u68cb\u76d8\u56fe...' : '\u751f\u6210\u5e76\u5e94\u7528\u5230\u5f53\u524d\u5173\u5361';
    refs.themeBoardAiOpenLocation.disabled = !state.lastResult || !state.lastResult.projectPath;
    refs.themeBoardAiFocusLayout.disabled = false;
    if (refs.themeBoardAiContext) {
        refs.themeBoardAiContext.textContent =
            '\u5f53\u524d\u5173\u5361\uff1a' +
            String(level.name || '\u672a\u547d\u540d\u5173\u5361') +
            ' \u00b7 \u68cb\u76d8 ' +
            getBoardGridLabel(level) +
            ' \u00b7 \u751f\u6210\u56fe\u7247\u5c06\u4fdd\u5b58\u5230 ' +
            env.getBoardImageDirectoryHint(level) +
            (themeScope === 'explore' ? ' \u00b7 \u63a2\u7d22\u4e3b\u9898' : ' \u00b7 \u9632\u5b88\u4e3b\u9898');
    }
    if (refs.themeBoardAiPromptPresets) {
        refs.themeBoardAiPromptPresets.innerHTML = presets
            .map(function (preset) {
                var active = state.lastPresetId === preset.id ? ' is-active' : '';
                return [
                    '<button type="button" class="theme-board-ai-preset' + active + '" data-board-ai-preset="' + escapeAttr(preset.id) + '">',
                    '  <strong>' + escapeHtml(preset.title) + '</strong>',
                    '  <span>' + escapeHtml(preset.summary) + '</span>',
                    '</button>'
                ].join('');
            })
            .join('');
    }
    setStatusEl(refs.themeBoardAiStatus, state.statusText || '', state.statusTone || 'idle');
    if (refs.themeBoardAiResultCard) {
        var result = state.lastResult;
        var showResult = !!(result && result.publicUrl);
        refs.themeBoardAiResultCard.classList.toggle('view-hidden', !showResult);
        if (showResult) {
            if (refs.themeBoardAiResultImage) refs.themeBoardAiResultImage.src = result.previewUrl || result.publicUrl;
            if (refs.themeBoardAiResultTitle) {
                refs.themeBoardAiResultTitle.textContent = result.replaced
                    ? '\u5df2\u66ff\u6362\u5f53\u524d\u68cb\u76d8\u914d\u56fe'
                    : '\u5df2\u65b0\u589e\u68cb\u76d8\u914d\u56fe';
            }
            if (refs.themeBoardAiResultMeta) {
                refs.themeBoardAiResultMeta.textContent = [
                    result.projectPath || '',
                    result.fileName ? '\u6587\u4ef6\uff1a' + result.fileName : '',
                    result.prompt ? '\u63d0\u793a\u8bcd\uff1a' + result.prompt : ''
                ]
                    .filter(Boolean)
                    .join('\n');
            }
        }
    }
}

export function bindThemeBoardImageWorkbenchEvents(refs, env) {
    if (!refs.themeBoardAiPanel || refs.themeBoardAiPanel.dataset.bound === '1') return;
    refs.themeBoardAiPanel.dataset.bound = '1';

    function rerender() {
        renderThemeBoardImageWorkbench(refs, env);
    }

    if (refs.themeBoardAiPrompt) {
        refs.themeBoardAiPrompt.addEventListener('input', function () {
            var state = env.getThemeBoardImageState();
            state.prompt = refs.themeBoardAiPrompt.value;
            if (!state.generating) {
                state.statusText = '\u53ef\u76f4\u63a5\u4fee\u6539\u63d0\u793a\u8bcd\uff0c\u7136\u540e\u91cd\u65b0\u751f\u6210\u3002';
                state.statusTone = 'idle';
            }
            refs.themeBoardAiGenerate.disabled = !String(state.prompt || '').trim() || !!state.generating;
        });
        refs.themeBoardAiPrompt.addEventListener('keydown', function (event) {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && refs.themeBoardAiGenerate && !refs.themeBoardAiGenerate.disabled) {
                event.preventDefault();
                refs.themeBoardAiGenerate.click();
            }
        });
    }

    refs.themeBoardAiPanel.addEventListener('click', function (event) {
        var presetButton = event.target.closest('[data-board-ai-preset]');
        if (presetButton) {
            var level = env.getLevel();
            if (!level) return;
            var themeScope = env.getActiveThemeScope();
            var presets = buildPromptPresets(level, themeScope);
            var presetId = presetButton.getAttribute('data-board-ai-preset') || '';
            var preset = presets.find(function (item) {
                return item.id === presetId;
            });
            if (!preset) return;
            var state = env.getThemeBoardImageState();
            state.prompt = preset.prompt;
            state.lastPresetId = preset.id;
            state.statusText = '\u5df2\u586b\u5165\u300c' + preset.title + '\u300d\u63d0\u793a\u8bcd\u3002';
            state.statusTone = 'idle';
            rerender();
            return;
        }
        if (refs.themeBoardAiOpenLocation && event.target === refs.themeBoardAiOpenLocation) {
            var stateForOpen = env.getThemeBoardImageState();
            if (!stateForOpen.lastResult || !stateForOpen.lastResult.projectPath) return;
            void env.revealProjectPathInExplorer(stateForOpen.lastResult.projectPath).catch(function (error) {
                env.setStatus((error && error.message) || '\u6253\u5f00\u56fe\u7247\u4fdd\u5b58\u4f4d\u7f6e\u5931\u8d25', 'error');
            });
            return;
        }
        if (refs.themeBoardAiFocusLayout && event.target === refs.themeBoardAiFocusLayout) {
            env.focusGeneratedBoardImageLayout();
            return;
        }
        if (refs.themeBoardAiGenerate && event.target === refs.themeBoardAiGenerate) {
            var levelForGenerate = env.getLevel();
            if (!levelForGenerate) return;
            var prompt = String((refs.themeBoardAiPrompt && refs.themeBoardAiPrompt.value) || '').trim();
            if (!prompt) {
                var emptyState = env.getThemeBoardImageState();
                emptyState.statusText = '\u8bf7\u5148\u8f93\u5165\u6216\u9009\u62e9\u4e00\u6bb5\u63d0\u793a\u8bcd\u3002';
                emptyState.statusTone = 'error';
                rerender();
                return;
            }
            var state = env.getThemeBoardImageState();
            state.prompt = prompt;
            state.generating = true;
            state.statusText = '\u6b63\u5728\u8c03\u7528\u706b\u5c71\u5f15\u64ce\u751f\u6210\u56fe\u7247\u5e76\u5199\u5165\u9879\u76ee\u8d44\u6e90\u76ee\u5f55...';
            state.statusTone = 'pending';
            rerender();
            void env.generateBoardImageForCurrentLevel(prompt).then(function (result) {
                state.generating = false;
                state.lastResult = {
                    levelId: String(levelForGenerate.id || ''),
                    publicUrl: String(result.publicUrl || ''),
                    previewUrl: String(result.publicUrl || '') + '?v=' + Date.now(),
                    projectPath: String(result.projectPath || ''),
                    fileName: String(result.fileName || ''),
                    prompt: prompt,
                    replaced: !!result.replaced
                };
                state.statusText = result.replaced
                    ? '\u5df2\u751f\u6210\u5e76\u66ff\u6362\u5f53\u524d\u9009\u4e2d\u7684\u68cb\u76d8\u56fe\u5c42\u3002'
                    : '\u5df2\u751f\u6210\u5e76\u5199\u5165\u5f53\u524d\u5173\u5361\u7684\u65b0\u68cb\u76d8\u914d\u56fe\u3002';
                state.statusTone = 'success';
                rerender();
            }).catch(function (error) {
                state.generating = false;
                state.statusText = '\u751f\u6210\u5931\u8d25\uff1a' + ((error && error.message) || '\u672a\u77e5\u9519\u8bef');
                state.statusTone = 'error';
                rerender();
            });
        }
    });
}
