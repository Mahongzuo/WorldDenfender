/**
 * Theme / cutscene workbench — 关卡过场面板与远端打开路径辅助。
 */
import { escapeHtml, escapeAttr } from './utils.js';
import { formatIntroVideoStatusLines, effectiveCutsceneVideoOpenPath, effectiveCutsceneVideoProjectPath } from './cutscene-utils.js';

export function ensureLevelCutscenesForLevel(level) {
    if (!level || !level.map) return null;
    if (!level.map.cutscenes) level.map.cutscenes = {};
    return level.map.cutscenes;
}

export async function revealProjectPathInExplorer(projectPath) {
    var res = await fetch('/api/reveal-project-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: projectPath })
    });
    var text = await res.text();
    var data = {};
    try {
        data = JSON.parse(text);
    } catch (e) {
        throw new Error(text.slice(0, 200) || '服务器返回异常');
    }
    if (!res.ok) throw new Error(data.error || text || '打开失败');
}

/** @param env {{ getLevel: function (): object }} */
export function renderCutsceneEditor(refs, env) {
    if (!refs.introVideoInfo) return;
    var level = env.getLevel();
    var cutscenes = (level && level.map && level.map.cutscenes) || {};
    var intro = cutscenes.introVideo || {};
    var st = formatIntroVideoStatusLines(intro);
    var openPath = effectiveCutsceneVideoOpenPath(intro, level);
    refs.introVideoInfo.textContent = st.text + (!st.openPath && openPath ? '\n项目视频目录：' + openPath : '');
    if (refs.btnOpenIntroVideoLocation) {
        refs.btnOpenIntroVideoLocation.disabled = !openPath;
        refs.btnOpenIntroVideoLocation.title = effectiveCutsceneVideoProjectPath(intro)
            ? '在文件管理器中定位当前视频文件，便于手动替换'
            : openPath
                ? '打开该关卡的视频保存目录'
                : '无法推断当前关卡的视频保存目录';
    }

    if (refs.introVideoTitle) refs.introVideoTitle.value = intro.title || '';

    var bossVc = cutscenes.exploreBossVictoryVideo || {};
    if (refs.exploreBossCutsceneInfo) {
        var bst = formatIntroVideoStatusLines(bossVc);
        refs.exploreBossCutsceneInfo.textContent = bst.text || '未配置 Boss 击败过场视频';
    }
    if (refs.exploreBossCutsceneTitle) {
        refs.exploreBossCutsceneTitle.value = bossVc.title || '';
    }

    if (!refs.waveVideoList) return;
    var waveVideos = Array.isArray(cutscenes.waveVideos) ? cutscenes.waveVideos : [];
    if (!waveVideos.length) {
        refs.waveVideoList.innerHTML = '<p class="section-hint" style="margin:8px 0;">暂无波次视频，点击"＋ 添加"新增。</p>';
        return;
    }
    refs.waveVideoList.innerHTML = waveVideos.map(function (wv, idx) {
        var hasUrl = !!wv.url;
        return [
            '<div class="wave-video-item" data-wv-idx="' + idx + '" style="border:1px solid var(--border,#354);border-radius:6px;padding:10px 12px;margin-bottom:8px;">',
            '  <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap;">',
            '    <label style="flex:0 0 auto;font-size:12px;opacity:.7;">第',
            '      <input type="number" class="wv-wave-input" min="1" max="999" value="' + (wv.afterWave || 1) + '"',
            '        style="width:52px;margin:0 3px;" data-wv-idx="' + idx + '">',
            '    波后</label>',
            '    <button type="button" class="mini-button wv-upload-btn" data-wv-idx="' + idx + '" style="flex:1;position:relative;">',
            '      ' + (hasUrl ? '替换视频' : '上传视频'),
            '      <input type="file" class="wv-file-input" accept="video/mp4,video/webm,video/ogg,video/*"',
            '        data-wv-idx="' + idx + '" style="position:absolute;inset:0;opacity:0;cursor:pointer;">',
            '    </button>',
            '    <button type="button" class="mini-button wv-ai-gen accent" data-wv-idx="' + idx + '">AI 生成</button>',
            '    <button type="button" class="mini-button wv-remove-btn" data-wv-idx="' + idx + '" style="color:var(--error-color,#d87880);">✕</button>',
            '  </div>',
            '  <div class="section-hint wv-url-info" style="word-break:break-all;min-height:1.2em;font-size:11px;">',
            '    ' + escapeHtml(hasUrl ? wv.url : '未上传视频'),
            '  </div>',
            '  <label class="field-block" style="margin-top:6px;">',
            '    <span style="font-size:12px;">字幕标题（可选）</span>',
            '    <input type="text" class="wv-title-input" placeholder="留空则不显示字幕"',
            '      value="' + escapeAttr(wv.title || '') + '" data-wv-idx="' + idx + '">',
            '  </label>',
            '</div>'
        ].join('');
    }).join('');
}

/**
 * @param env {{
 *   getLevel: function (): object,
 *   ensureLevelCutscenes: function (): object|null,
 *   uploadVideoFile: function (File, object): Promise<{ url: string, projectPath?: string }>,
 *   markDirty: function (string): void,
 *   setStatus: function (string, string): void,
 *   renderGlobalCutsceneOverview: function (): void,
 *   revealProjectPathInExplorer: function (string): Promise<void>,
 *   refreshCutscenePanel: function (): void,
 *   refreshAllCutsceneUis: function (): void,
 *   generateCutsceneVideo: function ({ scope: string, afterWave?: number, prompt?: string, imageFile?: File|null, imagePublicUrl?: string, level?: object|null, onProgress?: function(object): void, maxWaitMs?: number }): Promise<object>,
 *   rememberEditorCutsceneAsset: function (object): void
 * }}
 */
export function bindCutsceneEditorEvents(refs, env) {
    var cutsceneAiRefObjectUrl = '';
    function revokeCutsceneAiThumbObjectUrl() {
        if (!cutsceneAiRefObjectUrl) return;
        try {
            URL.revokeObjectURL(cutsceneAiRefObjectUrl);
        } catch (_e) {}
        cutsceneAiRefObjectUrl = '';
    }

    function refreshCutsceneAiRefPickUi() {
        var thumb = refs.cutsceneAiRefThumb;
        var metaLine = refs.cutsceneAiRefMetaLine;
        var clearBtn = refs.btnCutsceneAiClearRefPhoto;
        if (!metaLine && !thumb) return;

        var urlTrim = refs.cutsceneAiRefUrl && refs.cutsceneAiRefUrl.value.trim();
        var file =
            refs.cutsceneAiRefImage && refs.cutsceneAiRefImage.files && refs.cutsceneAiRefImage.files[0]
                ? refs.cutsceneAiRefImage.files[0]
                : null;

        revokeCutsceneAiThumbObjectUrl();
        if (thumb) {
            thumb.hidden = true;
            thumb.removeAttribute('src');
        }
        if (clearBtn) clearBtn.hidden = true;

        if (file && metaLine) {
            if (thumb) {
                try {
                    cutsceneAiRefObjectUrl = URL.createObjectURL(file);
                    thumb.src = cutsceneAiRefObjectUrl;
                    thumb.hidden = false;
                } catch (_err) {
                    thumb.hidden = true;
                }
            }
            if (clearBtn) clearBtn.hidden = false;
            metaLine.innerHTML =
                '已选择本地照片：<strong>' +
                escapeHtml(file.name || '未命名') +
                '</strong>（约 ' +
                (file.size < 1048576
                    ? Math.max(1, Math.round(file.size / 1024)) + ' KB'
                    : Math.round((file.size / 1048576) * 10) / 10 + ' MB') +
                '，类型 ' +
                escapeHtml(file.type || '未知') +
                '）。图生视频时将以内联方式提交给方舟；若图很大或生成失败提示图过大，可压缩分辨率，或配置 VOLCENGINE_ARK_PUBLIC_BASE_URL / 改用公网图片 URL（环境变量 VOLCENGINE_ARK_IMAGE_INLINE_MAX_MB 可调内联上限）。';
            return;
        }
        if (!file && metaLine && urlTrim) {
            metaLine.textContent =
                '将使用上方「公网图片 URL」——方舟会直接拉取该地址；外链无法在此页内嵌预览（若失败请检查 HTTPS、防盗链与对方 CORS）。';
            return;
        }
        if (metaLine)
            metaLine.textContent =
                '未绑定参考：请点击「共用参考照片」选择本地文件，或为「公网图片 URL」填入 https 开头的可访问链接，再填写提示词并点 AI 生成。';
    }

    if (refs.cutsceneAiRefImage) {
        refs.cutsceneAiRefImage.addEventListener('change', function () {
            var f =
                refs.cutsceneAiRefImage.files && refs.cutsceneAiRefImage.files[0]
                    ? refs.cutsceneAiRefImage.files[0]
                    : null;
            if (refs.cutsceneAiRefUrl && f) refs.cutsceneAiRefUrl.value = '';
            refreshCutsceneAiRefPickUi();
        });
    }

    if (refs.cutsceneAiRefUrl) {
        refs.cutsceneAiRefUrl.addEventListener('input', function () {
            if (refs.cutsceneAiRefUrl.value.trim() && refs.cutsceneAiRefImage) refs.cutsceneAiRefImage.value = '';
            refreshCutsceneAiRefPickUi();
        });
    }

    if (refs.btnCutsceneAiClearRefPhoto) {
        refs.btnCutsceneAiClearRefPhoto.addEventListener('click', function () {
            if (refs.cutsceneAiRefImage) refs.cutsceneAiRefImage.value = '';
            revokeCutsceneAiThumbObjectUrl();
            refreshCutsceneAiRefPickUi();
        });
    }

    refreshCutsceneAiRefPickUi();
    if (refs.introVideoFile) {
        refs.introVideoFile.addEventListener('change', async function () {
            var file = refs.introVideoFile.files && refs.introVideoFile.files[0];
            if (!file) return;
            try {
                env.setStatus('正在上传开场视频 ' + file.name + '…', 'idle');
                var up = await env.uploadVideoFile(file, env.getLevel());
                var cutscenes = env.ensureLevelCutscenes();
                if (!cutscenes) return;
                cutscenes.introVideo = { url: up.url };
                if (up.projectPath) cutscenes.introVideo.projectPath = up.projectPath;
                var titleTrim = (refs.introVideoTitle && refs.introVideoTitle.value.trim()) || '';
                if (titleTrim) cutscenes.introVideo.title = titleTrim;
                else delete cutscenes.introVideo.title;
                refs.introVideoFile.value = '';
                env.markDirty('已上传开场视频');
                env.refreshAllCutsceneUis();
                env.setStatus('开场视频已上传', 'idle');
            } catch (err) {
                refs.introVideoFile.value = '';
                env.setStatus('视频上传失败: ' + err.message, 'error');
            }
        });
    }

    if (refs.introVideoTitle) {
        refs.introVideoTitle.addEventListener('change', function () {
            var cutscenes = env.ensureLevelCutscenes();
            if (!cutscenes || !cutscenes.introVideo) return;
            var t = refs.introVideoTitle.value.trim();
            if (t) {
                cutscenes.introVideo.title = t;
            } else {
                delete cutscenes.introVideo.title;
            }
            env.markDirty('已更新开场视频标题');
        });
    }

    if (refs.btnClearIntroVideo) {
        refs.btnClearIntroVideo.addEventListener('click', function () {
            var cutscenes = env.ensureLevelCutscenes();
            if (!cutscenes) return;
            delete cutscenes.introVideo;
            env.markDirty('已清除开场视频');
            env.refreshAllCutsceneUis();
        });
    }
    if (refs.btnOpenIntroVideoLocation && refs.btnOpenIntroVideoLocation.dataset.bound !== '1') {
        refs.btnOpenIntroVideoLocation.dataset.bound = '1';
        refs.btnOpenIntroVideoLocation.addEventListener('click', function () {
            var level = env.getLevel();
            var intro = level && level.map && level.map.cutscenes && level.map.cutscenes.introVideo;
            var p = effectiveCutsceneVideoOpenPath(intro, level);
            if (!p) {
                env.setStatus('无法推断该关卡的项目视频目录，请先设置城市信息或上传视频', 'error');
                return;
            }
            void env.revealProjectPathInExplorer(p).catch(function (err) {
                env.setStatus((err && err.message) || '打开资源管理器失败', 'error');
            });
        });
    }

    if (refs.btnAddWaveVideo) {
        refs.btnAddWaveVideo.addEventListener('click', function () {
            var cutscenes = env.ensureLevelCutscenes();
            if (!cutscenes) return;
            if (!Array.isArray(cutscenes.waveVideos)) cutscenes.waveVideos = [];
            var usedWaves = cutscenes.waveVideos.map(function (w) { return w.afterWave; });
            var nextWave = 1;
            while (usedWaves.indexOf(nextWave) !== -1) nextWave++;
            cutscenes.waveVideos.push({ afterWave: nextWave, url: '' });
            env.markDirty('已新增波次视频槽');
            env.refreshAllCutsceneUis();
        });
    }

    function readCutsceneAiInputs() {
        var imgFile =
            refs.cutsceneAiRefImage && refs.cutsceneAiRefImage.files && refs.cutsceneAiRefImage.files[0]
                ? refs.cutsceneAiRefImage.files[0]
                : null;
        var imgUrl =
            refs.cutsceneAiRefUrl && refs.cutsceneAiRefUrl.value ? refs.cutsceneAiRefUrl.value.trim() : '';
        var promptText =
            refs.cutsceneAiPrompt && refs.cutsceneAiPrompt.value ? refs.cutsceneAiPrompt.value.trim() : '';
        return { imgFile: imgFile, imgUrl: imgUrl, promptText: promptText };
    }

    async function runCutsceneAi(scope, opts) {
        opts = opts || {};
        var inp = readCutsceneAiInputs();
        if (!inp.promptText) {
            env.setStatus('请先填写共用提示词', 'error');
            return;
        }
        if (!inp.imgUrl && !inp.imgFile) {
            env.setStatus('请上传参考照片或填写公网图片 URL', 'error');
            return;
        }
        var level = env.getLevel();

        var cs0 = env.ensureLevelCutscenes();
        var waveListIndex = opts.listIndex;
        var waveApiAfter = opts.waveAfter;
        if (scope === 'wave' && typeof waveListIndex === 'number' && cs0 && cs0.waveVideos) {
            var curW = cs0.waveVideos[waveListIndex];
            waveApiAfter = Math.max(1, parseInt(String((curW && curW.afterWave) || 1), 10));
        }

        try {
            env.setStatus(
                scope === 'intro'
                    ? '方舟图生视频中（开场），请耐心等待…'
                    : scope === 'boss'
                      ? '方舟图生视频中（Boss），请耐心等待…'
                      : '方舟图生视频中（波次 ' + (waveApiAfter || 1) + '），请耐心等待…',
                'idle'
            );
            /** @type {any} */
            var payload = await env.generateCutsceneVideo({
                scope: scope,
                afterWave: scope === 'wave' ? waveApiAfter : undefined,
                prompt: inp.promptText,
                imageFile: inp.imgFile,
                imagePublicUrl: inp.imgUrl || '',
                level: level,
                onProgress: function (p) {
                    var st = (p && (p.arkStatusDisplay || p.arkStatus)) || '';
                    var tid = (p && p.taskId) || '';
                    env.setStatus(
                        '方舟生成中… ' + (st ? '[' + st + '] ' : '') + (tid ? '任务 ' + tid : ''),
                        'idle'
                    );
                }
            });
            env.rememberEditorCutsceneAsset(payload);
            var cs = env.ensureLevelCutscenes();
            if (!cs) return;
            if (scope === 'intro') {
                cs.introVideo = { url: payload.publicUrl };
                if (payload.projectPath) cs.introVideo.projectPath = payload.projectPath;
            } else if (scope === 'boss') {
                cs.exploreBossVictoryVideo = { url: payload.publicUrl };
                if (payload.projectPath) cs.exploreBossVictoryVideo.projectPath = payload.projectPath;
                var bt =
                    refs.exploreBossCutsceneTitle && refs.exploreBossCutsceneTitle.value.trim();
                if (bt) cs.exploreBossVictoryVideo.title = bt;
                else delete cs.exploreBossVictoryVideo.title;
            } else if (scope === 'wave') {
                if (!Array.isArray(cs.waveVideos) || typeof waveListIndex !== 'number') return;
                if (!cs.waveVideos[waveListIndex]) return;
                cs.waveVideos[waveListIndex].url = payload.publicUrl;
                if (payload.projectPath) cs.waveVideos[waveListIndex].projectPath = payload.projectPath;
                else delete cs.waveVideos[waveListIndex].projectPath;
            }
            env.markDirty('AI 生成过场视频');
            env.refreshAllCutsceneUis();
            env.setStatus('方舟视频已生成并写入关卡', 'success');
        } catch (err) {
            env.setStatus((err && err.message) || 'AI 生成失败', 'error');
        }
    }

    if (refs.btnCutsceneAiGenerateIntro) {
        refs.btnCutsceneAiGenerateIntro.addEventListener('click', function () {
            void runCutsceneAi('intro');
        });
    }

    if (refs.btnExploreBossCutsceneAi) {
        refs.btnExploreBossCutsceneAi.addEventListener('click', function () {
            void runCutsceneAi('boss');
        });
    }

    if (refs.exploreBossCutsceneFile) {
        refs.exploreBossCutsceneFile.addEventListener('change', async function () {
            var file =
                refs.exploreBossCutsceneFile.files && refs.exploreBossCutsceneFile.files[0];
            if (!file) return;
            try {
                env.setStatus('正在上传 Boss 过场视频 ' + file.name + '…', 'idle');
                var up = await env.uploadVideoFile(file, env.getLevel());
                var cs = env.ensureLevelCutscenes();
                if (!cs) return;
                cs.exploreBossVictoryVideo = { url: up.url };
                if (up.projectPath) cs.exploreBossVictoryVideo.projectPath = up.projectPath;
                var bt =
                    refs.exploreBossCutsceneTitle && refs.exploreBossCutsceneTitle.value.trim();
                if (bt) cs.exploreBossVictoryVideo.title = bt;
                refs.exploreBossCutsceneFile.value = '';
                env.markDirty('已上传 Boss 击败过场视频');
                env.refreshAllCutsceneUis();
                env.setStatus('Boss 过场视频已上传', 'idle');
            } catch (err) {
                refs.exploreBossCutsceneFile.value = '';
                env.setStatus((err && err.message) || '上传失败', 'error');
            }
        });
    }

    if (refs.btnClearExploreBossCutscene) {
        refs.btnClearExploreBossCutscene.addEventListener('click', function () {
            var cs = env.ensureLevelCutscenes();
            if (!cs) return;
            delete cs.exploreBossVictoryVideo;
            env.markDirty('已清除 Boss 过场视频');
            env.refreshAllCutsceneUis();
        });
    }

    if (refs.exploreBossCutsceneTitle) {
        refs.exploreBossCutsceneTitle.addEventListener('change', function () {
            var cs = env.ensureLevelCutscenes();
            if (!cs || !cs.exploreBossVictoryVideo) return;
            var t = refs.exploreBossCutsceneTitle.value.trim();
            if (t) cs.exploreBossVictoryVideo.title = t;
            else delete cs.exploreBossVictoryVideo.title;
            env.markDirty('已更新 Boss 过场字幕');
        });
    }

    if (refs.waveVideoList && refs.waveVideoList.dataset.wvAiBound !== '1') {
        refs.waveVideoList.dataset.wvAiBound = '1';
        refs.waveVideoList.addEventListener('click', function (ev) {
            var btn = ev.target.closest('.wv-ai-gen');
            if (!btn || !refs.waveVideoList.contains(btn)) return;
            var wrap = btn.closest('.wave-video-item');
            var ix = wrap ? parseInt(wrap.getAttribute('data-wv-idx') || '', 10) : NaN;
            if (isNaN(ix)) return;
            void runCutsceneAi('wave', { listIndex: ix });
        });
    }

    if (refs.waveVideoList) {
        refs.waveVideoList.addEventListener('change', function (e) {
            var target = e.target;
            var idx = parseInt(target.getAttribute('data-wv-idx') || '', 10);
            if (isNaN(idx)) return;
            var cutscenes = env.ensureLevelCutscenes();
            if (!cutscenes || !Array.isArray(cutscenes.waveVideos) || !cutscenes.waveVideos[idx]) return;
            if (target.classList.contains('wv-wave-input')) {
                cutscenes.waveVideos[idx].afterWave = Math.max(1, parseInt(target.value, 10) || 1);
                env.markDirty('已更新波次');
            } else if (target.classList.contains('wv-title-input')) {
                var t = target.value.trim();
                if (t) { cutscenes.waveVideos[idx].title = t; } else { delete cutscenes.waveVideos[idx].title; }
                env.markDirty('已更新波次视频标题');
            } else if (target.classList.contains('wv-file-input') && target.files && target.files[0]) {
                var fileInner = target.files[0];
                var idxInner = parseInt(target.getAttribute('data-wv-idx') || '', 10);
                void (async function () {
                    try {
                        env.setStatus('正在上传波次视频 ' + fileInner.name + '…', 'idle');
                        var up = await env.uploadVideoFile(fileInner, env.getLevel());
                        var cs = env.ensureLevelCutscenes();
                        if (cs && Array.isArray(cs.waveVideos) && cs.waveVideos[idxInner]) {
                            cs.waveVideos[idxInner].url = up.url;
                            if (up.projectPath) cs.waveVideos[idxInner].projectPath = up.projectPath;
                            else delete cs.waveVideos[idxInner].projectPath;
                            env.markDirty('已上传波次视频');
                            env.refreshAllCutsceneUis();
                            env.setStatus('波次视频已上传', 'idle');
                        }
                        target.value = '';
                    } catch (err) {
                        target.value = '';
                        env.setStatus('波次视频上传失败: ' + err.message, 'error');
                    }
                })();
            }
        });

        refs.waveVideoList.addEventListener('click', function (e) {
            var btn = e.target.closest('.wv-remove-btn');
            if (!btn) return;
            var idx = parseInt(btn.getAttribute('data-wv-idx') || '', 10);
            if (isNaN(idx)) return;
            var cutscenes = env.ensureLevelCutscenes();
            if (!cutscenes || !Array.isArray(cutscenes.waveVideos)) return;
            cutscenes.waveVideos.splice(idx, 1);
            if (cutscenes.waveVideos.length === 0) delete cutscenes.waveVideos;
            env.markDirty('已删除波次视频');
            env.refreshAllCutsceneUis();
        });
    }
}
