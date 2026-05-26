/**
 * 关卡列表右键菜单：删除关卡及关联资源。
 */

var menuEl = null;
var openLevelId = '';

function ensureMenu() {
    if (menuEl) return menuEl;
    menuEl = document.createElement('div');
    menuEl.id = 'levelContextMenu';
    menuEl.className = 'level-context-menu view-hidden';
    menuEl.setAttribute('role', 'menu');
    menuEl.innerHTML =
        '<button type="button" class="level-context-menu__item danger" data-level-context-action="delete-with-assets" role="menuitem">删除关卡及关联资源</button>' +
        '<button type="button" class="level-context-menu__item" data-level-context-action="delete-level-only" role="menuitem">仅删除关卡数据</button>';
    document.body.appendChild(menuEl);
    return menuEl;
}

function hideMenu() {
    if (!menuEl) return;
    menuEl.classList.add('view-hidden');
    menuEl.setAttribute('aria-hidden', 'true');
    openLevelId = '';
}

function clampMenuPosition(left, top) {
    var rect = menuEl.getBoundingClientRect();
    var maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
    var maxTop = Math.max(8, window.innerHeight - rect.height - 8);
    menuEl.style.left = Math.min(left, maxLeft) + 'px';
    menuEl.style.top = Math.min(top, maxTop) + 'px';
}

function showMenu(levelId, clientX, clientY) {
    ensureMenu();
    openLevelId = levelId || '';
    menuEl.classList.remove('view-hidden');
    menuEl.setAttribute('aria-hidden', 'false');
    menuEl.style.left = clientX + 'px';
    menuEl.style.top = clientY + 'px';
    requestAnimationFrame(function () {
        clampMenuPosition(clientX, clientY);
    });
}

export function bindLevelContextMenu(refs, env) {
    if (!refs.levelTree || refs.levelTree.dataset.levelContextBound === '1') return;
    refs.levelTree.dataset.levelContextBound = '1';
    ensureMenu();

    refs.levelTree.addEventListener('contextmenu', function (event) {
        var card = event.target.closest('[data-level-id]');
        if (!card) return;
        event.preventDefault();
        event.stopPropagation();
        showMenu(card.getAttribute('data-level-id') || '', event.clientX, event.clientY);
    });

    menuEl.addEventListener('click', function (event) {
        var button = event.target.closest('[data-level-context-action]');
        if (!button || !openLevelId) return;
        event.preventDefault();
        event.stopPropagation();
        var action = button.getAttribute('data-level-context-action') || '';
        var levelId = openLevelId;
        hideMenu();
        if (action === 'delete-with-assets') {
            void env.deleteLevelWithAssets(levelId);
        } else if (action === 'delete-level-only') {
            env.deleteLevelById(levelId);
        }
    });

    document.addEventListener(
        'click',
        function (event) {
            if (!menuEl || menuEl.classList.contains('view-hidden')) return;
            if (event.target.closest('#levelContextMenu')) return;
            hideMenu();
        },
        true
    );

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') hideMenu();
    });

    window.addEventListener(
        'scroll',
        function () {
            hideMenu();
        },
        true
    );

    window.addEventListener('resize', hideMenu);
}
