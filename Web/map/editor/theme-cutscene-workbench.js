/**
 * Theme / cutscene workbench — 关卡过场面板与远端打开路径辅助。
 */
import { escapeHtml, escapeAttr } from './utils.js';
import { formatIntroVideoStatusLines, effectiveCutsceneVideoProjectPath } from './cutscene-utils.js';

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
    refs.introVideoInfo.textContent = st.text;
    if (refs.btnOpenIntroVideoLocation) {
        refs.btnOpenIntroVideoLocation.disabled = !st.openPath;
        refs.btnOpenIntroVideoLocation.title = st.openPath
            ? '在文件管理器中打开该文件，便于手动替换'
            : '上传并保存到项目 public 目录后可在此打开';
    }

    if (refs.introVideoTitle) refs.introVideoTitle.value = intro.title || '';

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
            '  <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">',
            '    <label style="flex:0 0 auto;font-size:12px;opacity:.7;">第',
            '      <input type="number" class="wv-wave-input" min="1" max="999" value="' + (wv.afterWave || 1) + '"',
            '        style="width:52px;margin:0 3px;" data-wv-idx="' + idx + '">',
            '    波后</label>',
            '    <button type="button" class="mini-button wv-upload-btn" data-wv-idx="' + idx + '" style="flex:1;">',
            '      ' + (hasUrl ? '替换视频' : '上传视频'),
            '      <input type="file" class="wv-file-input" accept="video/mp4,video/webm,video/ogg,video/*"',
            '        data-wv-idx="' + idx + '" style="position:absolute;inset:0;opacity:0;cursor:pointer;">',
            '    </button>',
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
 *   refreshCutscenePanel: function (): void
 * }}
 */
export function bindCutsceneEditorEvents(refs, env) {
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
                env.refreshCutscenePanel();
                env.renderGlobalCutsceneOverview();
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
            env.refreshCutscenePanel();
            env.renderGlobalCutsceneOverview();
        });
    }
    if (refs.btnOpenIntroVideoLocation && refs.btnOpenIntroVideoLocation.dataset.bound !== '1') {
        refs.btnOpenIntroVideoLocation.dataset.bound = '1';
        refs.btnOpenIntroVideoLocation.addEventListener('click', function () {
            var level = env.getLevel();
            var intro = level && level.map && level.map.cutscenes && level.map.cutscenes.introVideo;
            var p = effectiveCutsceneVideoProjectPath(intro);
            if (!p) {
                env.setStatus('无法定位项目内文件：请使用「上传开场视频」写入 public 目录', 'error');
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
            env.refreshCutscenePanel();
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
                            env.refreshCutscenePanel();
                            env.renderGlobalCutsceneOverview();
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
            env.refreshCutscenePanel();
        });
    }
}
