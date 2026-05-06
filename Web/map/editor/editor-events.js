import { readDragPayload } from './utils.js';

export function bindEditorEvents(refs, env) {
    env.mountExploreGameplayFieldTemplates();
    if (refs.inspectorPanelBody) {
        refs.inspectorPanelBody.addEventListener('input', env.onExploreGameplayFieldInput);
        refs.inspectorPanelBody.addEventListener('change', env.onExploreGameplayFieldInput);
    }
    if (refs.toggleGeoMapping) {
        refs.toggleGeoMapping.addEventListener('change', function () {
            env.setGeoMappingEnabled(!!refs.toggleGeoMapping.checked);
            env.persistGeoMappingEnabled(env.getGeoMappingEnabled());
            env.refreshPreviewPreserveActorSelection();
        });
    }

    function closeProjectMenu() {
        if (refs.projectMenuDropdown) refs.projectMenuDropdown.classList.add('view-hidden');
        if (refs.btnProjectMenu) refs.btnProjectMenu.setAttribute('aria-expanded', 'false');
    }

    function toggleProjectMenu(event) {
        if (event) event.stopPropagation();
        if (!refs.projectMenuDropdown || !refs.btnProjectMenu) return;
        var opening = refs.projectMenuDropdown.classList.contains('view-hidden');
        if (opening) {
            refs.projectMenuDropdown.classList.remove('view-hidden');
            refs.btnProjectMenu.setAttribute('aria-expanded', 'true');
        } else {
            closeProjectMenu();
        }
    }

    if (refs.btnProjectMenu) refs.btnProjectMenu.addEventListener('click', toggleProjectMenu);
    if (refs.projectMenuDropdown) refs.projectMenuDropdown.addEventListener('click', closeProjectMenu);
    document.addEventListener('click', function (event) {
        if (!refs.projectMenuDropdown || !refs.btnProjectMenu) return;
        if (event.target.closest('.topbar-project-menu')) return;
        closeProjectMenu();
    });

    refs.btnReload.addEventListener('click', env.reloadState);
    if (refs.btnSave) refs.btnSave.addEventListener('click', env.saveState);
    refs.btnExport.addEventListener('click', env.exportState);
    refs.btnCreateLevel.addEventListener('click', env.createManualLevel);
    refs.btnGenerateRegions.addEventListener('click', function () {
        env.generateRegionLevelSkeletons(true);
    });
    refs.levelSearch.addEventListener('input', env.renderLevelTree);
    refs.btnResizeMap.addEventListener('click', env.applyMapSize);
    refs.btnDeleteSelection.addEventListener('click', env.deleteSelection);
    refs.btnCreateActorTemplate.addEventListener('click', env.createActorTemplateFromSelection);
    env.bindWaveEditorUi();

    refs.modelUpload.addEventListener('change', function () {
        if (refs.modelUpload.files && refs.modelUpload.files[0]) {
            env.uploadModelAsset(refs.modelUpload.files[0]);
        }
    });

    if (refs.workbenchTabs) {
        refs.workbenchTabs.addEventListener('click', function (event) {
            var button = event.target.closest('[data-workbench]');
            if (!button) return;
            env.setActiveWorkbench(button.getAttribute('data-workbench') || 'level');
            if (env.getActiveWorkbench() === 'theme') env.resetThemeEditorCache();
            refs.workbenchTabs.querySelectorAll('[data-workbench]').forEach(function (item) {
                item.classList.toggle('active', item === button);
            });
            if (env.getActiveWorkbench() !== 'gameplay') env.disposeGameplayAssetPreview();
            if (env.getActiveWorkbench() !== 'model') env.disposeModelAssetPreview();
            env.renderAll();
        });
    }

    if (refs.themeScopeSelect) {
        refs.themeScopeSelect.addEventListener('change', function () {
            env.setActiveThemeScope(refs.themeScopeSelect.value === 'explore' ? 'explore' : 'defense');
            env.resetThemeEditorCache();
            env.renderThemeEditor();
        });
    }
    if (refs.themeWorkbench && refs.themeWorkbench.dataset.themeChromeBound !== '1') {
        refs.themeWorkbench.dataset.themeChromeBound = '1';
        refs.themeWorkbench.addEventListener('click', function (event) {
            var tabButton = event.target.closest('[data-theme-workbench-tab]');
            if (tabButton) {
                env.setThemeWorkbenchTab(tabButton.getAttribute('data-theme-workbench-tab') || 'colors');
                return;
            }
            var swatch = event.target.closest('[data-theme-swatch-for]');
            if (!swatch) return;
            var colorInputId = swatch.getAttribute('data-theme-swatch-for') || '';
            if (!colorInputId) return;
            var input = document.getElementById(colorInputId);
            if (input && input.type === 'color') input.click();
        });
    }
    if (refs.themeEditorForm) {
        refs.themeEditorForm.addEventListener('change', env.readThemeFormToLevel);
        refs.themeEditorForm.addEventListener('input', function (event) {
            var target = event.target;
            if (target && target.type === 'color') env.syncThemeColorSwatches();
        });
    }
    if (refs.themeBoardTextureUrl) {
        refs.themeBoardTextureUrl.addEventListener('input', env.debounceReadThemeFormToLevel);
    }
    if (refs.btnThemeCopyToExplore) refs.btnThemeCopyToExplore.addEventListener('click', env.copyThemeToExplore);
    if (refs.btnThemeCopyToDefense) refs.btnThemeCopyToDefense.addEventListener('click', env.copyThemeToDefense);

    env.bindCutsceneEditorEvents();
    env.bindThemeBoardImageWorkbenchEvents();
    env.bindGameplayUi();

    if (refs.modelCategoryTabs) {
        refs.modelCategoryTabs.addEventListener('click', function (event) {
            var button = event.target.closest('[data-model-category]');
            if (!button) return;
            env.setActiveModelCategory(button.getAttribute('data-model-category') || 'all');
            env.setSelectedModelId('');
            refs.modelCategoryTabs.querySelectorAll('[data-model-category]').forEach(function (item) {
                item.classList.toggle('active', item.getAttribute('data-model-category') === env.getActiveModelCategory());
            });
            env.renderModelEditor();
        });
    }
    if (refs.modelSearch) refs.modelSearch.addEventListener('input', env.renderModelEditor);
    if (refs.modelEntryList) {
        refs.modelEntryList.addEventListener('click', function (event) {
            var item = event.target.closest('[data-model-id]');
            if (!item) return;
            env.setSelectedModelId(item.getAttribute('data-model-id') || '');
            env.renderModelEditor();
        });
    }
    if (refs.modelUploadReplace) {
        refs.modelUploadReplace.addEventListener('change', function () {
            if (refs.modelUploadReplace.files && refs.modelUploadReplace.files[0]) {
                env.replaceSelectedModel(refs.modelUploadReplace.files[0]);
            }
        });
    }
    if (refs.modelInspectorUpload) {
        refs.modelInspectorUpload.addEventListener('change', function () {
            if (refs.modelInspectorUpload.files && refs.modelInspectorUpload.files[0]) {
                env.uploadNewModelFromInspector(refs.modelInspectorUpload.files[0]);
            }
        });
    }

    refs.statusFilters.addEventListener('click', function (event) {
        var button = event.target.closest('[data-status-filter]');
        if (!button) return;
        env.setActiveStatusFilter(button.getAttribute('data-status-filter') || 'all');
        refs.statusFilters.querySelectorAll('[data-status-filter]').forEach(function (item) {
            item.classList.toggle('active', item === button);
        });
        env.renderLevelTree();
    });

    refs.editorModeTabs.addEventListener('click', function (event) {
        var button = event.target.closest('[data-editor-mode]');
        if (!button) return;
        env.setActiveEditorMode(button.getAttribute('data-editor-mode') || 'defense');
        refs.editorModeTabs.querySelectorAll('[data-editor-mode]').forEach(function (item) {
            item.classList.toggle('active', item === button);
        });
        env.setSelectedObject(null);
        env.renderAll();
        env.refreshPreviewNow();
    });

    document.querySelectorAll('[data-tool]').forEach(function (button) {
        button.addEventListener('click', function () {
            env.activateTool(button.getAttribute('data-tool') || 'select');
        });
    });

    refs.levelTree.addEventListener('click', function (event) {
        var button = event.target.closest('[data-level-id]');
        if (!button) return;
        env.selectLevel(button.getAttribute('data-level-id'));
    });

    refs.mapGrid.addEventListener('click', function (event) {
        var marker = event.target.closest('[data-object-kind]');
        if (marker) {
            env.selectObject(marker.getAttribute('data-object-kind'), marker.getAttribute('data-object-id'));
            return;
        }
        var cell = event.target.closest('[data-col][data-row]');
        if (!cell) return;
        env.handleCellAction(Number(cell.dataset.col), Number(cell.dataset.row));
    });

    refs.mapGrid.addEventListener('mousemove', function (event) {
        if (!env.isEraserPreviewActive()) return;
        env.recordEraserPreviewPointer(event.clientX, event.clientY);
        env.updateEraserBrushPreview(refs, event.clientX, event.clientY);
    });
    refs.mapGrid.addEventListener('mouseleave', function () {
        if (!env.isEraserPreviewActive()) return;
        env.clearEraserPreviewPointer();
        env.clearEraserBrushPreview(refs);
    });

    refs.mapGrid.addEventListener('dragover', function (event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
    });

    refs.mapGrid.addEventListener('drop', function (event) {
        event.preventDefault();
        var level = env.getLevel();
        if (!level || !level.map || !level.map.grid) return;
        if (env.tryConsumeBoardImageFileDrop(event, refs)) return;
        var cellEl = event.target.closest('.map-grid-cells--floor .map-cell[data-col][data-row]');
        var resolved =
            cellEl ||
            (function () {
                var nodes = document.elementsFromPoint(event.clientX, event.clientY);
                for (var index = 0; index < nodes.length; index += 1) {
                    var node = nodes[index];
                    if (
                        node.classList &&
                        node.classList.contains('map-cell') &&
                        node.closest('.map-grid-cells--floor') &&
                        node.getAttribute('data-col') != null &&
                        node.getAttribute('data-row') != null
                    ) {
                        return node;
                    }
                }
                return env.mapGridPickCellFromClientPoint(event.clientX, event.clientY, level.map.grid);
            })();
        if (!resolved || resolved.getAttribute('data-col') == null) return;
        var col = Number(resolved.getAttribute('data-col'));
        var row = Number(resolved.getAttribute('data-row'));
        if (!Number.isFinite(col) || !Number.isFinite(row)) return;
        var payload = readDragPayload(event);
        if (!payload) return;
        if (payload.kind === 'template') env.placeActorFromTemplate(payload.id, col, row);
        if (payload.kind === 'actor') env.moveActor(payload.id, col, row);
        if (payload.kind === 'marker') env.moveMarker(payload.markerKind, payload.id, col, row);
    });

    env.bindLevelFields();
    env.bindGameAssetPanel();
    env.bindLevelAudioUi();
    env.bindGlobalAudioUi();
    env.bindGlobalSettingsChrome();
    env.bindGlobalCutscenePanel();
    env.bindGlobalScreenUiPanel();

    if (refs.previewSceneOutlineList) {
        refs.previewSceneOutlineList.addEventListener('click', function (event) {
            var button = event.target.closest('[data-outline-actor]');
            if (!button) return;
            var id = button.getAttribute('data-outline-actor') || '';
            if (!id) return;
            env.selectObject('actor', id);
        });
    }
    if (refs.viewportViewTabs) {
        refs.viewportViewTabs.addEventListener('click', function (event) {
            var button = event.target.closest('[data-view-mode]');
            if (!button) return;
            env.wireViewportViewMode(button.getAttribute('data-view-mode') || 'board');
        });
    }
    if (refs.previewGizmoTranslate && refs.previewGizmoRotate && refs.previewGizmoScale) {
        refs.previewGizmoTranslate.addEventListener('click', function () {
            env.setPreviewToolbarMode('translate');
        });
        refs.previewGizmoRotate.addEventListener('click', function () {
            env.setPreviewToolbarMode('rotate');
        });
        refs.previewGizmoScale.addEventListener('click', function () {
            env.setPreviewToolbarMode('scale');
        });
    }
    if (refs.previewFocusSelection) {
        refs.previewFocusSelection.addEventListener('click', function () {
            env.focusPreviewSelection();
        });
    }
    if (refs.contentBrowserReload) {
        refs.contentBrowserReload.addEventListener('click', function () {
            void env.refreshGameModelsCatalog().then(function () {
                env.renderContentBrowser();
                env.setStatus('已刷新内容浏览器', 'idle');
            });
        });
    }

    env.wireContentBrowserFloating();
    if (refs.collapseRegionPanel) refs.collapseRegionPanel.addEventListener('click', env.collapseRegionPanel);
    if (refs.railExpandRegionPanel) refs.railExpandRegionPanel.addEventListener('click', env.expandRegionPanel);
    if (refs.collapseInspectorPanel) refs.collapseInspectorPanel.addEventListener('click', env.collapseInspectorPanel);
    if (refs.railExpandInspectorPanel) refs.railExpandInspectorPanel.addEventListener('click', env.expandInspectorPanel);

    var shellReflowTimer = null;
    window.addEventListener('resize', function () {
        env.resizePreviewIfOpen();
        clearTimeout(shellReflowTimer);
        shellReflowTimer = window.setTimeout(function () {
            env.applyShellPanelCollapseUi();
            env.clampContentBrowserFloatPanelIntoViewport();
        }, 100);
    });

    document.addEventListener('keydown', function (event) {
        var activeElement = document.activeElement;
        var tag = activeElement && activeElement.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (activeElement && activeElement.isContentEditable) return;

        if ((event.ctrlKey || event.metaKey) && event.code === 'Space') {
            if (env.getActiveWorkbench() !== 'level') return;
            event.preventDefault();
            env.toggleContentBrowserFloat();
            return;
        }

        if (event.key === 'f' || event.key === 'F') {
            if (env.getActiveWorkbench() !== 'level') return;
            if (!env.canFocusPreviewSelection()) return;
            event.preventDefault();
            event.stopPropagation();
            env.focusPreviewSelection();
            return;
        }

        if (event.key === 'Escape' && env.isBoardImageSelectedInLevelWorkbench()) {
            event.preventDefault();
            env.clearBoardImageSelection();
            return;
        }

        if (event.key !== 'Delete') return;
        if (env.getActiveWorkbench() !== 'level' || !env.getSelectedObject()) return;
        event.preventDefault();
        env.deleteSelection();
    });

    env.bindEraserToolControls(refs);
    env.bindBoardImageGlobalHandlers(refs);
    env.ensureBoardImagesPanelDelegated(refs);
}
