import { LEVEL_CONTENT_BROWSER_FILTER_ORDER, TOOL_LABELS } from './content.js';
import { escapeAttr, escapeHtml } from './utils.js';
import { lcbSection, sortCells } from './html-builders.js';
import { ensureExplorationLayout } from './layout-presets.js';

function lcbBtnActive(env, selKind, probe) {
    var selectedObject = env.getSelectedObject();
    if (!selectedObject || selectedObject.kind !== selKind) return false;
    if (probe.id != null && selectedObject.id !== probe.id) return false;
    if (probe.col != null && (selectedObject.col !== probe.col || selectedObject.row !== probe.row)) return false;
    return true;
}

function lcbItemButton(env, meta) {
    var sk = meta.selKind;
    var active = lcbBtnActive(env, sk, meta.probe || {}) ? ' lcb-item--active' : '';
    var attrs = ['type="button"', 'class="lcb-item' + active + '"', 'data-lcb-sel-kind="' + escapeAttr(sk) + '"'];
    if (meta.id != null) attrs.push('data-lcb-id="' + escapeAttr(meta.id) + '"');
    if (meta.col != null) attrs.push('data-lcb-col="' + escapeAttr(String(meta.col)) + '"');
    if (meta.row != null) attrs.push('data-lcb-row="' + escapeAttr(String(meta.row)) + '"');
    var icon = escapeHtml(meta.icon || '·');
    var t1 = escapeHtml(meta.title || '');
    var t2 = escapeHtml(meta.sub || '');
    return (
        '<button ' +
        attrs.join(' ') +
        '>' +
        '<span class="lcb-item-icon">' +
        icon +
        '</span>' +
        '<span class="lcb-item-meta">' +
        '<strong>' +
        t1 +
        '</strong>' +
        '<span>' +
        t2 +
        '</span>' +
        '</span>' +
        '</button>'
    );
}

export function ensureLevelContentBrowserUiWired(refs, env) {
    var filters = refs.levelContentBrowserFilters;
    var list = refs.levelContentBrowserList;
    if (filters && filters.dataset.lcbWired !== '1') {
        filters.dataset.lcbWired = '1';
        var currentFilter = env.getLevelContentBrowserFilter();
        filters.innerHTML = LEVEL_CONTENT_BROWSER_FILTER_ORDER.map(function (fid) {
            var label = fid === 'all' ? '全部' : TOOL_LABELS[fid] || fid;
            var active = fid === currentFilter ? ' active' : '';
            return (
                '<button type="button" role="tab" class="lcb-filter-chip' +
                active +
                '" data-lcb-filter="' +
                escapeAttr(fid) +
                '" aria-selected="' +
                (active ? 'true' : 'false') +
                '">' +
                escapeHtml(label) +
                '</button>'
            );
        }).join('');
        filters.addEventListener('click', function (e) {
            var chip = e.target.closest('[data-lcb-filter]');
            if (!chip) return;
            env.setLevelContentBrowserFilter(chip.getAttribute('data-lcb-filter') || 'all');
            var f = env.getLevelContentBrowserFilter();
            filters.querySelectorAll('[data-lcb-filter]').forEach(function (c) {
                var on = c.getAttribute('data-lcb-filter') === f;
                c.classList.toggle('active', on);
                c.setAttribute('aria-selected', on ? 'true' : 'false');
            });
            renderLevelContentBrowser(refs, env);
        });
    }
    if (list && list.dataset.lcbWired !== '1') {
        list.dataset.lcbWired = '1';
        list.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-lcb-sel-kind]');
            if (!btn) return;
            var kind = btn.getAttribute('data-lcb-sel-kind') || '';
            if (
                kind === 'obstacleCell' ||
                kind === 'pathCell' ||
                kind === 'buildSlotCell' ||
                kind === 'safeZoneCell'
            ) {
                env.selectGridCellObject(kind, Number(btn.getAttribute('data-lcb-col')), Number(btn.getAttribute('data-lcb-row')));
                return;
            }
            var oid = btn.getAttribute('data-lcb-id');
            if (kind && oid != null && oid !== '') env.selectObject(kind, oid);
        });
    }
}

export function renderLevelContentBrowser(refs, env) {
    ensureLevelContentBrowserUiWired(refs, env);
    if (!refs.levelContentBrowserList || !refs.levelContentBrowser) return;

    var show = env.getActiveWorkbench() === 'level' && env.getViewportViewMode() === 'preview';
    refs.levelContentBrowser.classList.toggle('view-hidden', !show);
    refs.levelContentBrowser.setAttribute('aria-hidden', show ? 'false' : 'true');

    var state = env.getState();
    if (!show || !state) {
        refs.levelContentBrowserList.innerHTML = '';
        return;
    }

    if (refs.previewSceneOutlineSection) {
        refs.previewSceneOutlineSection.classList.add('view-hidden');
        refs.previewSceneOutlineSection.setAttribute('aria-hidden', 'true');
    }

    var level = env.getLevel();
    if (!level || !level.map) {
        refs.levelContentBrowserList.innerHTML = '<div class="empty-state">请选择关卡</div>';
        return;
    }

    var f = env.getLevelContentBrowserFilter();
    var want = function (key) {
        return f === 'all' || f === key;
    };
    var map = level.map;
    var layout = ensureExplorationLayout(map);
    var sections = [];
    var activeEditorMode = env.getActiveEditorMode();

    if (want('obstacle')) {
        var obs =
            activeEditorMode === 'explore'
                ? sortCells(layout.obstacles || [])
                : sortCells(map.obstacles || []);
        var obsHtml = obs
            .map(function (c) {
                return lcbItemButton(env, {
                    selKind: 'obstacleCell',
                    col: c.col,
                    row: c.row,
                    probe: { col: c.col, row: c.row },
                    icon: '障',
                    title: '障碍 — (' + c.col + ',' + c.row + ')',
                    sub: activeEditorMode === 'explore' ? '探索布局' : '塔防布局'
                });
            })
            .join('');
        if (obsHtml) sections.push(lcbSection('障碍', obsHtml));
    }

    if (want('spawn')) {
        var spHtml = '';
        if (activeEditorMode === 'explore' && layout.startPoint) {
            var sp0 = layout.startPoint;
            spHtml += lcbItemButton(env, {
                selKind: 'spawn',
                id: sp0.id,
                probe: { id: sp0.id },
                icon: '出',
                title: sp0.name || '探索起点',
                sub: '(' + sp0.col + ',' + sp0.row + ')'
            });
        } else if (activeEditorMode === 'defense') {
            spHtml = (map.spawnPoints || [])
                .map(function (sp) {
                    return lcbItemButton(env, {
                        selKind: 'spawn',
                        id: sp.id,
                        probe: { id: sp.id },
                        icon: '出',
                        title: sp.name || '敌人出口',
                        sub: '(' + sp.col + ',' + sp.row + ')'
                    });
                })
                .join('');
        }
        if (spHtml) sections.push(lcbSection('敌人出口', spHtml));
    }

    if (want('path')) {
        var pathCells = [];
        if (activeEditorMode === 'explore') pathCells = sortCells(layout.path || []);
        else {
            var seen = {};
            (map.enemyPaths || []).forEach(function (p) {
                (p.cells || []).forEach(function (c) {
                    var k = c.col + ',' + c.row;
                    if (seen[k]) return;
                    seen[k] = true;
                    pathCells.push(c);
                });
            });
            pathCells = sortCells(pathCells);
        }
        var pathHtml = pathCells
            .map(function (c) {
                return lcbItemButton(env, {
                    selKind: 'pathCell',
                    col: c.col,
                    row: c.row,
                    probe: { col: c.col, row: c.row },
                    icon: '径',
                    title: '路径格 — (' + c.col + ',' + c.row + ')',
                    sub: '敌人路径'
                });
            })
            .join('');
        if (pathHtml) sections.push(lcbSection('敌人路径', pathHtml));
    }

    if (want('buildSlot') && activeEditorMode === 'defense') {
        var bsHtml = sortCells(map.buildSlots || [])
            .map(function (c) {
                return lcbItemButton(env, {
                    selKind: 'buildSlotCell',
                    col: c.col,
                    row: c.row,
                    probe: { col: c.col, row: c.row },
                    icon: '塔',
                    title: '塔位 — (' + c.col + ',' + c.row + ')',
                    sub: '仅塔防布局'
                });
            })
            .join('');
        if (bsHtml) sections.push(lcbSection('塔位', bsHtml));
    }

    if (want('objective')) {
        var obHtml = '';
        if (activeEditorMode === 'explore' && layout.exitPoint) {
            var op = layout.exitPoint;
            obHtml = lcbItemButton(env, {
                selKind: 'objective',
                id: op.id,
                probe: { id: op.id },
                icon: '标',
                title: op.name || '探索终点',
                sub: '(' + op.col + ',' + op.row + ')'
            });
        } else if (activeEditorMode === 'defense' && map.objectivePoint) {
            var opz = map.objectivePoint;
            obHtml = lcbItemButton(env, {
                selKind: 'objective',
                id: opz.id,
                probe: { id: opz.id },
                icon: '标',
                title: opz.name || '防守目标',
                sub: '(' + opz.col + ',' + opz.row + ')'
            });
        }
        if (obHtml) sections.push(lcbSection('防守目标', obHtml));
    }

    if (want('explorePoint') && Array.isArray(map.explorationPoints) && map.explorationPoints.length) {
        var epHtml = map.explorationPoints
            .map(function (p) {
                return lcbItemButton(env, {
                    selKind: 'explorePoint',
                    id: p.id,
                    probe: { id: p.id },
                    icon: '探',
                    title: p.name || p.id,
                    sub: '(' + p.col + ',' + p.row + ')'
                });
            })
            .join('');
        sections.push(lcbSection('探索点', epHtml));
    }

    if (want('safeZone') && activeEditorMode === 'explore') {
        var szHtml = sortCells(layout.safeZones || [])
            .map(function (c) {
                return lcbItemButton(env, {
                    selKind: 'safeZoneCell',
                    col: c.col,
                    row: c.row,
                    probe: { col: c.col, row: c.row },
                    icon: '安',
                    title: '安全区 — (' + c.col + ',' + c.row + ')',
                    sub: '探索布局'
                });
            })
            .join('');
        if (szHtml) sections.push(lcbSection('安全区', szHtml));
    }

    if (want('actor') && Array.isArray(map.actors) && map.actors.length) {
        var actHtml = map.actors
            .map(function (actor) {
                var cat = actor.category ? String(actor.category) : '';
                return lcbItemButton(env, {
                    selKind: 'actor',
                    id: actor.id,
                    probe: { id: actor.id },
                    icon: actor.icon ? String(actor.icon).slice(0, 2) : 'Ac',
                    title: actor.name || actor.id,
                    sub: cat || '模型 Actor'
                });
            })
            .join('');
        sections.push(lcbSection('模型 Actor', actHtml));
    }

    refs.levelContentBrowserList.innerHTML = sections.length
        ? sections.join('')
        : '<div class="empty-state">当前筛选下暂无条目；可在棋盘布局中添加障碍、路径等内容。</div>';
}
