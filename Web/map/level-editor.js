import { CITY_GEO_CONFIGS, DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID, JINAN_MAP_TEXTURE_URL } from './editor/city-geo-configs.js';
import { BUILT_IN_CITY_LAYOUTS, matchBuiltInCity } from './editor/built-in-layouts.js';
import { clamp, clone, normalizeChineseCityName, escapeHtml, escapeAttr, uid, slugify, updatePath, cellsRect, toggleCell, removeCell, hasCell, cloneCells, atCell, notAtCell, inBounds, byId, editorVol01, editorPctFromVol01, clampInspectorWidthPx, isNarrowWorkbenchLayout, readDragPayload, fileToBase64 } from './editor/utils.js';
import { splitRegion, buildRegionLabel, inferCountryCode, normalizeCell, normalizeCells, normalizePoint, defaultObjectivePoint, normalizeStatus, normalizeLocation, normalizeEnvironment, normalizeBoardImageLayers, normalizeStats, normalizeActorTemplate, normalizeActors, normalizeEnemyTypes, normalizeWaveRules, normalizeModeProfiles, normalizeSpawnPoints, normalizeExplorePoints, EXPLORE_GAMEPLAY_STORE_KEYS, normalizeExploreGameplayNormalized, normalizeGeoConfig, makeGeoConfig, visitCoordinatePairs, geometryCenter, fetchCountryCapitalCoords, countryGeoFromFeature, geoFromLonLatArray, normalizeEditorThemeColorHex, normalizeTheme, normalizeEnemyPaths, normalizeExplorationLayout, normalizeCatalog, normalizeCatalogItem, normalizeEditorAssetsCatalog, defaultGlobalAudio, normalizeGlobalAudio, normalizeLevelAudioSource, defaultGlobalScreenUi, normalizeGlobalScreenUi, defaultGameAssetConfig, normalizeGameAssetConfig, mergeDistinctStrings, normalizeGameplayPlacement, normalizeGameplayEntries, normalizeCityGameplayConfigs, createDefaultMap, trimMapToBounds, normalizeMap, normalizeLevel, sortLevels, normalizeState } from './editor/normalizers.js';
import { API_URL, LOCAL_BACKUP_KEY, LEGACY_BACKUP_KEY, ENGINE_VERSION, DEFAULT_GRID_COLS, DEFAULT_GRID_ROWS, DEFAULT_TILE_SIZE, GEO_MAPPING_STORAGE_KEY, SHELL_LEFT_COLLAPSE_KEY, SHELL_RIGHT_COLLAPSE_KEY, SHELL_INSPECTOR_WIDTH_KEY, CONTENT_BROWSER_FLOAT_GEOM_KEY, TOOL_LABELS, LEVEL_CONTENT_BROWSER_FILTER_ORDER, LCB_CELL_KIND_LABEL, MODEL_CATEGORY_CONFIG, DEFAULT_ACTOR_TEMPLATES, TOWER_MODEL_SPECS, DEFAULT_TOWER_GAMEPLAY_STATS, GAMEPLAY_RESOURCE_CONFIG } from './editor/content.js';
import { sanitizeStateForSave as _sanitizeStateForSave, persistLocalBackup as _persistLocalBackup, readLocalBackup as _readLocalBackup, exportState as _exportState, readShellCollapsedPrefs as _readShellCollapsedPrefs, persistShellCollapsedPrefs as _persistShellCollapsedPrefs } from './editor/storage.js';
import { expandPathWaypointPolyline, uniqueDefenseCells, manhattanDefense, sameDefenseCell, orderEditorPathCellsDefense, projectGridCellDefense, defensePathSourceCells, buildDefenseFallbackVertexList, getDefenseEditorPathKeys } from './editor/path-utils.js';
import {
    bindEraserToolControls,
    updateEraserToolPanelVisibility,
    clearEraserBrushPreview,
    updateEraserBrushPreview,
    recordEraserPreviewPointer,
    clearEraserPreviewPointer,
    refreshEraserPreviewIfActive,
    applyEraserBrush,
    resetEraserPreviewAfterMapRebuild
} from './editor/eraser-tool.js';
import { statusLabel, actorCategoryLabel, summaryStats, gameplayPlacementLabel, modelBindShortLabel, isImageAssetPath, isModelAssetPath, groupLevels, compareRegionKeys, hasDefenseLayout, hasExploreLayout, isJinanLevel, normalizePlaceSearchResult, uniqueCatalogId, levelVideoCityContext, normalizeCityIdentity, pickPreferredGameplayTab } from './editor/display-utils.js';
import { pickLevelId, uniqueLevelId, uniqueTemplateId, findLevelById, uniqueGameplayEntryId } from './editor/id-utils.js';
import { resolveSpecialGeoForLevel, cloneGeoConfig, applyDefenseLayout, applyExploreLayout, createDraftLevel, ensureExplorationLayout } from './editor/layout-presets.js';
import { mergeExploreGameplayDisplay, readExploreGameplayRawFromDomSection } from './editor/explore-gameplay-defaults.js';
import { fieldHtml, selectHtml, boardLayerFieldHtml, markerHtml, lcbSection, themeColorInput, sortCells, findBoardImageLayerById, clampContentBrowserGeom } from './editor/html-builders.js';
import { projectPathFromVideoPublicUrl, effectiveCutsceneVideoProjectPath, formatIntroVideoStatusLines } from './editor/cutscene-utils.js';
import { parseFetchErrorBody } from './editor/fetch-utils.js';
import { ensureWorldOffset, mergeGameplayEntryList } from './editor/level-mutators.js';
import { renderBoardImagesPanel, ensureBoardImagesPanelDelegated, tryConsumeBoardImageFileDrop, bindBoardImageGlobalHandlers, clearBoardImageInteractionState } from './editor/board-images.js';
import { renderLevelAudioFields, renderGlobalAudioPanel, bindLevelAudioUi, bindGlobalAudioUi } from './editor/audio.js';
import { refreshGlobalSettingsWorkbench as _refreshGlobalSettingsWorkbench, bindGlobalCutscenePanel as _bindGlobalCutscenePanel, bindGlobalSettingsChrome as _bindGlobalSettingsChrome } from './editor/global-settings.js';
import { renderMap as _renderMap } from './editor/map-render.js';

    var state = null;
    var selectedLevelId = new URLSearchParams(window.location.search).get('levelId') || '';
    var selectedObject = null;
    var selectedTemplateId = 'tower-machine';
    var activeTool = 'select';
    var activeStatusFilter = 'all';
    var activeWorkbench = 'level';
    var activeGlobalSettingsTab = 'levels';
    var globalCutsceneEditLevelId = '';
    var activeThemeScope = 'defense';
    /** @type {'colors'|'cutscenes'} */
    var activeThemeWorkbenchTab = 'colors';
    var themeEditorCacheKey = '';
    var themeBoardUrlDebounce = 0;
    var activeEditorMode = 'defense';
    var activeGameplayTab = 'enemies';
    var selectedGameplayEntryId = '';
    var selectedGameplayAssetId = '';
    var activeModelCategory = 'all';
    var selectedModelId = '';
    var modelAssetPreviewApi = null;
    var modelPreviewInitGeneration = 0;
    var viewportViewMode = 'board';
    var previewApi = null;
    var gameplayAssetPreviewApi = null;
    var previewInitGeneration = 0;
    var gameplayPreviewInitGeneration = 0;
    var previewRefreshTimer = null;
    var shellLeftCollapsedPref = false;
    var shellRightCollapsedPref = false;
    var inspectorSplitPointerStartX = 0;
    var inspectorSplitStartWidthPx = 380;
    var geoMappingEnabled = true;
    var isDirty = false;
    /** 程序化回填探索玩法表单时跳过 input 写回，避免递归 */
    var exploreGameplayFieldSilent = 0;
    var regionSources = { countries: [], chinaCities: [] };
    var contentBrowserMiniApi = null;
    var contentBrowserFloatGeomTimer = null;
    var contentBrowserFloatRo = null;
    var selectedContentBrowserAssetId = '';
    var levelContentBrowserFilter = 'all';

    var refs = {
        toggleGeoMapping: document.getElementById('toggleGeoMapping'),
        levelSummary: document.getElementById('levelSummary'),
        btnProjectMenu: document.getElementById('btnProjectMenu'),
        projectMenuDropdown: document.getElementById('projectMenuDropdown'),
        btnGenerateRegions: document.getElementById('btnGenerateRegions'),
        btnCreateLevel: document.getElementById('btnCreateLevel'),
        btnReload: document.getElementById('btnReload'),
        btnExport: document.getElementById('btnExport'),
        btnSave: document.getElementById('btnSave'),
        levelSearch: document.getElementById('levelSearch'),
        statusFilters: document.getElementById('statusFilters'),
        levelTree: document.getElementById('levelTree'),
        currentLevelName: document.getElementById('currentLevelName'),
        currentLevelMeta: document.getElementById('currentLevelMeta'),
        overviewStats: document.getElementById('overviewStats'),
        workbenchTabs: document.getElementById('workbenchTabs'),
        levelWorkbench: document.getElementById('levelWorkbench'),
        gameplayWorkbench: document.getElementById('gameplayWorkbench'),
        levelInspectorWorkspace: document.getElementById('levelInspectorWorkspace'),
        gameplayInspectorWorkspace: document.getElementById('gameplayInspectorWorkspace'),
        editorModeTabs: document.getElementById('editorModeTabs'),
        gameplayResourceTabs: document.getElementById('gameplayResourceTabs'),
        gameplaySearch: document.getElementById('gameplaySearch'),
        gameplayCityTitle: document.getElementById('gameplayCityTitle'),
        gameplayCityMeta: document.getElementById('gameplayCityMeta'),
        gameplayOverviewStats: document.getElementById('gameplayOverviewStats'),
        btnCreateGameplayEntry: document.getElementById('btnCreateGameplayEntry'),
        gameplayEntryList: document.getElementById('gameplayEntryList'),
        gameplayEditorTitle: document.getElementById('gameplayEditorTitle'),
        gameplayEditorHint: document.getElementById('gameplayEditorHint'),
        btnMoveGameplayUp: document.getElementById('btnMoveGameplayUp'),
        btnMoveGameplayDown: document.getElementById('btnMoveGameplayDown'),
        btnDuplicateGameplayEntry: document.getElementById('btnDuplicateGameplayEntry'),
        btnDeleteGameplayEntry: document.getElementById('btnDeleteGameplayEntry'),
        gameplayPreviewTitle: document.getElementById('gameplayPreviewTitle'),
        gameplayPreviewMeta: document.getElementById('gameplayPreviewMeta'),
        gameplayAssetPreviewEmpty: document.getElementById('gameplayAssetPreviewEmpty'),
        gameplayAssetPreviewImage: document.getElementById('gameplayAssetPreviewImage'),
        gameplayAssetPreviewHost: document.getElementById('gameplayAssetPreviewHost'),
        gameplayEditorForm: document.getElementById('gameplayEditorForm'),
        gameplayName: document.getElementById('gameplayName'),
        gameplayId: document.getElementById('gameplayId'),
        gameplayTags: document.getElementById('gameplayTags'),
        gameplayRarity: document.getElementById('gameplayRarity'),
        gameplaySummary: document.getElementById('gameplaySummary'),
        gameplayStatGrid: document.getElementById('gameplayStatGrid'),
        gameplayInspectorMeta: document.getElementById('gameplayInspectorMeta'),
        gameplaySelectionMeta: document.getElementById('gameplaySelectionMeta'),
        gameplayAssetUpload: document.getElementById('gameplayAssetUpload'),
        gameplayAssetName: document.getElementById('gameplayAssetName'),
        gameplayAssetType: document.getElementById('gameplayAssetType'),
        gameplayAssetList: document.getElementById('gameplayAssetList'),
        mapGrid: document.getElementById('mapGrid'),
        eraserToolPanel: document.getElementById('eraserToolPanel'),
        eraserRadiusSlider: document.getElementById('eraserRadiusSlider'),
        eraserRadiusNumber: document.getElementById('eraserRadiusNumber'),
        mapStage: document.getElementById('mapStage'),
        activeToolLabel: document.getElementById('activeToolLabel'),
        fieldLevelName: document.getElementById('fieldLevelName'),
        fieldStatus: document.getElementById('fieldStatus'),
        fieldCountry: document.getElementById('fieldCountry'),
        fieldCity: document.getElementById('fieldCity'),
        fieldDifficulty: document.getElementById('fieldDifficulty'),
        fieldDescription: document.getElementById('fieldDescription'),
        fieldGridCols: document.getElementById('fieldGridCols'),
        fieldGridRows: document.getElementById('fieldGridRows'),
        fieldTileSize: document.getElementById('fieldTileSize'),
        fieldGeoEnabled: document.getElementById('fieldGeoEnabled'),
        fieldGeoLat: document.getElementById('fieldGeoLat'),
        fieldGeoLon: document.getElementById('fieldGeoLon'),
        fieldGeoHeight: document.getElementById('fieldGeoHeight'),
        fieldGeoExtent: document.getElementById('fieldGeoExtent'),
        fieldGeoRotation: document.getElementById('fieldGeoRotation'),
        fieldGeoYOffset: document.getElementById('fieldGeoYOffset'),
        fieldGeoBoardHeight: document.getElementById('fieldGeoBoardHeight'),
        fieldGeoAssetId: document.getElementById('fieldGeoAssetId'),
        btnResizeMap: document.getElementById('btnResizeMap'),
        btnDeleteSelection: document.getElementById('btnDeleteSelection'),
        selectionInspector: document.getElementById('selectionInspector'),
        actorPalette: document.getElementById('actorPalette'),
        btnCreateActorTemplate: document.getElementById('btnCreateActorTemplate'),
        waveList: document.getElementById('waveList'),
        btnAddWave: document.getElementById('btnAddWave'),
        modelUpload: document.getElementById('modelUpload'),
        modelAssetList: document.getElementById('modelAssetList'),
        statusBadge: document.getElementById('statusBadge'),
        statusText: document.getElementById('statusText'),
        towerModelList: document.getElementById('towerModelList'),
        gameAssetSection: document.getElementById('gameAssetSection'),
        boardViewport: document.getElementById('boardViewport'),
        boardImagesPanel: document.getElementById('boardImagesPanel'),
        previewStageWrap: document.getElementById('previewStageWrap'),
        viewportViewTabs: document.getElementById('viewportViewTabs'),
        editorToolRibbon: document.getElementById('editorToolRibbon'),
        previewHost: document.getElementById('previewHost'),
        contentBrowserList: document.getElementById('contentBrowserList'),
        contentBrowserReload: document.getElementById('contentBrowserReload'),
        contentBrowserPreviewHost: document.getElementById('contentBrowserPreviewHost'),
        mapStageWrap: document.getElementById('mapStageWrap'),
        contentBrowserFloatPanel: document.getElementById('contentBrowserFloatPanel'),
        btnOpenContentBrowserFloat: document.getElementById('btnOpenContentBrowserFloat'),
        contentBrowserFloatDragHandle: document.getElementById('contentBrowserFloatDragHandle'),
        contentBrowserFloatClose: document.getElementById('contentBrowserFloatClose'),
        stageHintExtra: document.getElementById('stageHintExtra'),
        previewGizmoTranslate: document.getElementById('previewGizmoTranslate'),
        previewGizmoRotate: document.getElementById('previewGizmoRotate'),
        previewGizmoScale: document.getElementById('previewGizmoScale'),
        previewFocusSelection: document.getElementById('previewFocusSelection'),
        previewSceneOutlineSection: document.getElementById('previewSceneOutlineSection'),
        previewSceneOutlineList: document.getElementById('previewSceneOutlineList'),
        modelWorkbench: document.getElementById('modelWorkbench'),
        modelCategoryTabs: document.getElementById('modelCategoryTabs'),
        modelSearch: document.getElementById('modelSearch'),
        modelEditorTitle: document.getElementById('modelEditorTitle'),
        modelEditorMeta: document.getElementById('modelEditorMeta'),
        modelOverviewStats: document.getElementById('modelOverviewStats'),
        modelEntryList: document.getElementById('modelEntryList'),
        modelListCount: document.getElementById('modelListCount'),
        modelDetailTitle: document.getElementById('modelDetailTitle'),
        modelDetailMeta: document.getElementById('modelDetailMeta'),
        modelDetailName: document.getElementById('modelDetailName'),
        modelDetailCategory: document.getElementById('modelDetailCategory'),
        modelDetailPath: document.getElementById('modelDetailPath'),
        modelPreviewEmpty: document.getElementById('modelPreviewEmpty'),
        modelPreviewHost: document.getElementById('modelPreviewHost'),
        modelPreviewMeta: document.getElementById('modelPreviewMeta'),
        modelUploadReplace: document.getElementById('modelUploadReplace'),
        modelInspectorWorkspace: document.getElementById('modelInspectorWorkspace'),
        modelInspectorStats: document.getElementById('modelInspectorStats'),
        modelInspectorUpload: document.getElementById('modelInspectorUpload'),
        modelInspectorUploadName: document.getElementById('modelInspectorUploadName'),
        modelInspectorUploadCategory: document.getElementById('modelInspectorUploadCategory'),
        themeWorkbench: document.getElementById('themeWorkbench'),
        themeWorkbenchTitle: document.getElementById('themeWorkbenchTitle'),
        themeWorkbenchMeta: document.getElementById('themeWorkbenchMeta'),
        globalSettingsWorkbench: document.getElementById('globalSettingsWorkbench'),
        globalSettingsInspectorWorkspace: document.getElementById('globalSettingsInspectorWorkspace'),
        globalSettingsSubTabs: document.getElementById('globalSettingsSubTabs'),
        globalSettingsHeroTitle: document.getElementById('globalSettingsHeroTitle'),
        globalSettingsHeroDetail: document.getElementById('globalSettingsHeroDetail'),
        globalLevelsManageList: document.getElementById('globalLevelsManageList'),
        btnGlobalOpenCreateLevel: document.getElementById('btnGlobalOpenCreateLevel'),
        globalCutsceneOverview: document.getElementById('globalCutsceneOverview'),
        globalCutsceneLevelSelect: document.getElementById('globalCutsceneLevelSelect'),
        gIntroVideoFile: document.getElementById('gIntroVideoFile'),
        gIntroVideoInfo: document.getElementById('gIntroVideoInfo'),
        gIntroVideoTitle: document.getElementById('gIntroVideoTitle'),
        gBtnClearIntroVideo: document.getElementById('gBtnClearIntroVideo'),
        gBtnOpenIntroVideoLocation: document.getElementById('gBtnOpenIntroVideoLocation'),
        gBtnAddWaveVideo: document.getElementById('gBtnAddWaveVideo'),
        gWaveVideoList: document.getElementById('gWaveVideoList'),
        levelAudioTowerRows: document.getElementById('levelAudioTowerRows'),
        themeInspectorWorkspace: document.getElementById('themeInspectorWorkspace'),
        themeScopeSelect: document.getElementById('themeScopeSelect'),
        themeEditorForm: document.getElementById('themeEditorForm'),
        themeGround: document.getElementById('themeGround'),
        themeGroundAlt: document.getElementById('themeGroundAlt'),
        themePath: document.getElementById('themePath'),
        themeObstacle: document.getElementById('themeObstacle'),
        themeAccent: document.getElementById('themeAccent'),
        themeFog: document.getElementById('themeFog'),
        themeHoverOk: document.getElementById('themeHoverOk'),
        themeHoverBad: document.getElementById('themeHoverBad'),
        themeBoardTextureUrl: document.getElementById('themeBoardTextureUrl'),
        themeGeoTileOpacity: document.getElementById('themeGeoTileOpacity'),
        themeGeoPathOpacity: document.getElementById('themeGeoPathOpacity'),
        themeBoardBaseOpacity: document.getElementById('themeBoardBaseOpacity'),
        themeGridLineOpacity: document.getElementById('themeGridLineOpacity'),
        themeRimOpacity: document.getElementById('themeRimOpacity'),
        themePathGlowOpacity: document.getElementById('themePathGlowOpacity'),
        themePathDetailOpacity: document.getElementById('themePathDetailOpacity'),
        themeHoverCellOpacity: document.getElementById('themeHoverCellOpacity'),
        btnThemeCopyToExplore: document.getElementById('btnThemeCopyToExplore'),
        btnThemeCopyToDefense: document.getElementById('btnThemeCopyToDefense'),
        // 过场视频
        cutsceneEditorPanel: document.getElementById('cutsceneEditorPanel'),
        introVideoFile: document.getElementById('introVideoFile'),
        introVideoInfo: document.getElementById('introVideoInfo'),
        introVideoTitle: document.getElementById('introVideoTitle'),
        btnClearIntroVideo: document.getElementById('btnClearIntroVideo'),
        btnOpenIntroVideoLocation: document.getElementById('btnOpenIntroVideoLocation'),
        btnAddWaveVideo: document.getElementById('btnAddWaveVideo'),
        waveVideoList: document.getElementById('waveVideoList'),
        createLevelModal: document.getElementById('createLevelModal'),
        btnCancelCreateLevel: document.getElementById('btnCancelCreateLevel'),
        newLevelName: document.getElementById('newLevelName'),
        newLevelRegionSearch: document.getElementById('newLevelRegionSearch'),
        newLevelRegionDropdown: document.getElementById('newLevelRegionDropdown'),
        newLevelPlaceSearch: document.getElementById('newLevelPlaceSearch'),
        newLevelPlaceDropdown: document.getElementById('newLevelPlaceDropdown'),
        btnSearchPlace: document.getElementById('btnSearchPlace'),
        btnUseCurrentLocation: document.getElementById('btnUseCurrentLocation'),
        newLevelLat: document.getElementById('newLevelLat'),
        newLevelLon: document.getElementById('newLevelLon'),
        btnConfirmCreateLevel: document.getElementById('btnConfirmCreateLevel'),
        selectedPlacePreview: document.getElementById('selectedPlacePreview'),
        selectedPlaceName: document.getElementById('selectedPlaceName'),
        selectedPlaceCoords: document.getElementById('selectedPlaceCoords'),
        btnCancelCreateLevelAlt: document.getElementById('btnCancelCreateLevelAlt'),
        levelContentBrowser: document.getElementById('levelContentBrowser'),
        levelContentBrowserFilters: document.getElementById('levelContentBrowserFilters'),
        levelContentBrowserList: document.getElementById('levelContentBrowserList'),
        engineShell: document.getElementById('engineShell'),
        regionPanel: document.getElementById('regionPanel'),
        regionPanelBody: document.getElementById('regionPanelBody'),
        collapseRegionPanel: document.getElementById('collapseRegionPanel'),
        railExpandRegionPanel: document.getElementById('railExpandRegionPanel'),
        inspectorPanel: document.getElementById('inspectorPanel'),
        inspectorPanelBody: document.getElementById('inspectorPanelBody'),
        collapseInspectorPanel: document.getElementById('collapseInspectorPanel'),
        railExpandInspectorPanel: document.getElementById('railExpandInspectorPanel'),
        viewportInspectorSplitter: document.getElementById('viewportInspectorSplitter')
    };

    function readShellCollapsedPrefsFromStorage() {
        var prefs = _readShellCollapsedPrefs({ leftKey: SHELL_LEFT_COLLAPSE_KEY, rightKey: SHELL_RIGHT_COLLAPSE_KEY });
        shellLeftCollapsedPref = prefs.left;
        shellRightCollapsedPref = prefs.right;
    }

    function bumpShellLayoutDependentUi() {
        window.requestAnimationFrame(function () {
            if (viewportViewMode === 'preview' && previewApi && typeof previewApi.resize === 'function') previewApi.resize();
        });
    }

    function applyPersistedInspectorWidth() {
        if (!refs.engineShell || isNarrowWorkbenchLayout() || shellRightCollapsedPref) return;
        var w = 380;
        try {
            var s = window.localStorage.getItem(SHELL_INSPECTOR_WIDTH_KEY);
            if (s) {
                var n = parseInt(s, 10);
                if (Number.isFinite(n)) w = n;
            }
        } catch (_e) {}
        w = clampInspectorWidthPx(w);
        refs.engineShell.style.setProperty('--shell-inspector-w', w + 'px');
    }

    function persistInspectorWidthPx(w) {
        try {
            window.localStorage.setItem(SHELL_INSPECTOR_WIDTH_KEY, String(w));
        } catch (_e) {}
    }

    function bindViewportInspectorSplitter() {
        var grip = refs.viewportInspectorSplitter;
        if (!grip || grip.dataset.bound === '1') return;
        grip.dataset.bound = '1';
        function onMove(ev) {
            var dx = ev.clientX - inspectorSplitPointerStartX;
            var next = clampInspectorWidthPx(inspectorSplitStartWidthPx - dx);
            if (refs.engineShell) refs.engineShell.style.setProperty('--shell-inspector-w', next + 'px');
        }
        function onUp() {
            grip.classList.remove('is-dragging');
            document.body.classList.remove('editor-shell--resizing');
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            if (refs.engineShell) {
                var cur = refs.engineShell.style.getPropertyValue('--shell-inspector-w').trim();
                var m = /^(\d+)px$/.exec(cur);
                if (m) persistInspectorWidthPx(Number(m[1]));
            }
            bumpShellLayoutDependentUi();
        }
        grip.addEventListener('pointerdown', function (ev) {
            if (!refs.engineShell || shellRightCollapsedPref || isNarrowWorkbenchLayout()) return;
            ev.preventDefault();
            try {
                grip.setPointerCapture(ev.pointerId);
            } catch (_e) {}
            inspectorSplitPointerStartX = ev.clientX;
            var cur = refs.engineShell.style.getPropertyValue('--shell-inspector-w').trim();
            var m = /^(\d+)px$/.exec(cur);
            inspectorSplitStartWidthPx = m ? Number(m[1]) : clampInspectorWidthPx(380);
            grip.classList.add('is-dragging');
            document.body.classList.add('editor-shell--resizing');
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
        });
    }

    function applyShellPanelCollapseUi() {
        if (!refs.engineShell || !refs.regionPanel || !refs.inspectorPanel) return;
        var narrow = isNarrowWorkbenchLayout();
        if (narrow) {
            refs.engineShell.classList.remove('shell-left-collapsed', 'shell-right-collapsed');
            refs.regionPanel.classList.remove('shell-panel-collapsed');
            refs.inspectorPanel.classList.remove('shell-panel-collapsed');
            if (refs.railExpandRegionPanel) refs.railExpandRegionPanel.hidden = true;
            if (refs.railExpandInspectorPanel) refs.railExpandInspectorPanel.hidden = true;
            if (refs.regionPanelBody) refs.regionPanelBody.removeAttribute('aria-hidden');
            if (refs.inspectorPanelBody) refs.inspectorPanelBody.removeAttribute('aria-hidden');
            if (refs.viewportInspectorSplitter) {
                refs.viewportInspectorSplitter.hidden = true;
            }
            bumpShellLayoutDependentUi();
            return;
        }
        refs.engineShell.classList.toggle('shell-left-collapsed', shellLeftCollapsedPref);
        refs.engineShell.classList.toggle('shell-right-collapsed', shellRightCollapsedPref);
        refs.regionPanel.classList.toggle('shell-panel-collapsed', shellLeftCollapsedPref);
        refs.inspectorPanel.classList.toggle('shell-panel-collapsed', shellRightCollapsedPref);
        if (refs.railExpandRegionPanel) {
            refs.railExpandRegionPanel.hidden = !shellLeftCollapsedPref;
            refs.railExpandRegionPanel.setAttribute('aria-expanded', shellLeftCollapsedPref ? 'false' : 'true');
        }
        if (refs.railExpandInspectorPanel) {
            refs.railExpandInspectorPanel.hidden = !shellRightCollapsedPref;
            refs.railExpandInspectorPanel.setAttribute('aria-expanded', shellRightCollapsedPref ? 'false' : 'true');
        }
        if (refs.regionPanelBody) refs.regionPanelBody.setAttribute('aria-hidden', shellLeftCollapsedPref ? 'true' : 'false');
        if (refs.inspectorPanelBody) refs.inspectorPanelBody.setAttribute('aria-hidden', shellRightCollapsedPref ? 'true' : 'false');
        if (refs.collapseRegionPanel)
            refs.collapseRegionPanel.setAttribute('aria-expanded', shellLeftCollapsedPref ? 'false' : 'true');
        if (refs.collapseInspectorPanel)
            refs.collapseInspectorPanel.setAttribute('aria-expanded', shellRightCollapsedPref ? 'false' : 'true');
        if (refs.viewportInspectorSplitter) {
            refs.viewportInspectorSplitter.hidden = shellRightCollapsedPref;
        }
        if (!shellRightCollapsedPref) {
            applyPersistedInspectorWidth();
        }
        bumpShellLayoutDependentUi();
    }

    function init() {
        initGeoMappingToggle();
        readShellCollapsedPrefsFromStorage();
        bindEvents();
        bindCreateLevelModalEvents();
        loadState();
        applyShellPanelCollapseUi();
        bindViewportInspectorSplitter();
    }

    function readGeoMappingEnabledFromStorage() {
        var v = window.localStorage.getItem(GEO_MAPPING_STORAGE_KEY);
        if (v === null) return true;
        return v !== '0' && v !== 'false';
    }

    function initGeoMappingToggle() {
        geoMappingEnabled = readGeoMappingEnabledFromStorage();
        if (refs.toggleGeoMapping) {
            refs.toggleGeoMapping.checked = geoMappingEnabled;
        }
    }

    function bindEvents() {
        mountExploreGameplayFieldTemplates();
        if (refs.inspectorPanelBody) {
            refs.inspectorPanelBody.addEventListener('input', onExploreGameplayFieldInput);
            refs.inspectorPanelBody.addEventListener('change', onExploreGameplayFieldInput);
        }
        if (refs.toggleGeoMapping) {
            refs.toggleGeoMapping.addEventListener('change', function () {
                geoMappingEnabled = !!refs.toggleGeoMapping.checked;
                window.localStorage.setItem(GEO_MAPPING_STORAGE_KEY, geoMappingEnabled ? '1' : '0');
                if (viewportViewMode === 'preview' && previewApi && typeof previewApi.refresh === 'function') {
                    var sid = selectedObject && selectedObject.kind === 'actor' ? selectedObject.id : null;
                    previewApi.refresh({ preserveView: true, selectActorId: sid });
                }
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
        if (refs.btnProjectMenu) {
            refs.btnProjectMenu.addEventListener('click', toggleProjectMenu);
        }
        if (refs.projectMenuDropdown) {
            refs.projectMenuDropdown.addEventListener('click', closeProjectMenu);
        }
        document.addEventListener('click', function (event) {
            if (!refs.projectMenuDropdown || !refs.btnProjectMenu) return;
            if (event.target.closest('.topbar-project-menu')) return;
            closeProjectMenu();
        });
        refs.btnReload.addEventListener('click', reloadState);
        if (refs.btnSave) refs.btnSave.addEventListener('click', saveState);
        refs.btnExport.addEventListener('click', function() { _exportState(state, setStatus); });
        refs.btnCreateLevel.addEventListener('click', createManualLevel);
        refs.btnGenerateRegions.addEventListener('click', function () { generateRegionLevelSkeletons(true); });
        refs.levelSearch.addEventListener('input', renderLevelTree);
        refs.btnResizeMap.addEventListener('click', applyMapSize);
        refs.btnDeleteSelection.addEventListener('click', deleteSelection);
        refs.btnCreateActorTemplate.addEventListener('click', createActorTemplateFromSelection);
        refs.btnAddWave.addEventListener('click', addWaveRule);
        refs.modelUpload.addEventListener('change', function () {
            if (refs.modelUpload.files && refs.modelUpload.files[0]) {
                uploadModelAsset(refs.modelUpload.files[0]);
            }
        });

        if (refs.workbenchTabs) {
            refs.workbenchTabs.addEventListener('click', function (event) {
                var button = event.target.closest('[data-workbench]');
                if (!button) return;
                activeWorkbench = button.getAttribute('data-workbench') || 'level';
                if (activeWorkbench === 'theme') {
                    themeEditorCacheKey = '';
                }
                refs.workbenchTabs.querySelectorAll('[data-workbench]').forEach(function (item) {
                    item.classList.toggle('active', item === button);
                });
                if (activeWorkbench !== 'gameplay') disposeGameplayAssetPreview();
                if (activeWorkbench !== 'model') disposeModelAssetPreview();
                renderAll();
            });
        }

        if (refs.themeScopeSelect) {
            refs.themeScopeSelect.addEventListener('change', function () {
                activeThemeScope = refs.themeScopeSelect.value === 'explore' ? 'explore' : 'defense';
                themeEditorCacheKey = '';
                renderThemeEditor();
            });
        }
        if (refs.themeWorkbench && refs.themeWorkbench.dataset.themeChromeBound !== '1') {
            refs.themeWorkbench.dataset.themeChromeBound = '1';
            refs.themeWorkbench.addEventListener('click', function (e) {
                var tabBtn = e.target.closest('[data-theme-workbench-tab]');
                if (tabBtn) {
                    setThemeWorkbenchTab(tabBtn.getAttribute('data-theme-workbench-tab') || 'colors');
                    return;
                }
                var sw = e.target.closest('[data-theme-swatch-for]');
                if (!sw) return;
                var cid = sw.getAttribute('data-theme-swatch-for') || '';
                if (!cid) return;
                var inp = document.getElementById(cid);
                if (inp && inp.type === 'color') inp.click();
            });
        }
        if (refs.themeEditorForm) {
            refs.themeEditorForm.addEventListener('change', readThemeFormToLevel);
            refs.themeEditorForm.addEventListener('input', function (ev) {
                var t = ev.target;
                if (t && t.type === 'color') syncThemeColorSwatches();
            });
        }
        if (refs.themeBoardTextureUrl) {
            refs.themeBoardTextureUrl.addEventListener('input', function () {
                clearTimeout(themeBoardUrlDebounce);
                themeBoardUrlDebounce = setTimeout(readThemeFormToLevel, 350);
            });
        }
        if (refs.btnThemeCopyToExplore) {
            refs.btnThemeCopyToExplore.addEventListener('click', function () {
                var level = getLevel();
                if (!level || !level.map) return;
                var lo = ensureExplorationLayout(level.map);
                lo.theme = normalizeTheme(JSON.parse(JSON.stringify(normalizeTheme(level.map.theme))));
                markDirty('已复制防守主题到探索');
                activeThemeScope = 'explore';
                themeEditorCacheKey = '';
                if (refs.themeScopeSelect) refs.themeScopeSelect.value = 'explore';
                fillThemeFormFromLevel();
                renderAll();
            });
        }
        if (refs.btnThemeCopyToDefense) {
            refs.btnThemeCopyToDefense.addEventListener('click', function () {
                var level = getLevel();
                if (!level || !level.map) return;
                var lo = ensureExplorationLayout(level.map);
                level.map.theme = normalizeTheme(JSON.parse(JSON.stringify(normalizeTheme(lo.theme))));
                markDirty('已复制探索主题到防守');
                activeThemeScope = 'defense';
                themeEditorCacheKey = '';
                if (refs.themeScopeSelect) refs.themeScopeSelect.value = 'defense';
                fillThemeFormFromLevel();
                renderAll();
            });
        }

        // 过场视频面板事件
        bindCutsceneEditorEvents();

        if (refs.gameplayResourceTabs) {
            refs.gameplayResourceTabs.addEventListener('click', function (event) {
                var button = event.target.closest('[data-gameplay-tab]');
                if (!button) return;
                activeGameplayTab = button.getAttribute('data-gameplay-tab') || 'enemies';
                selectedGameplayEntryId = '';
                selectedGameplayAssetId = '';
                refs.gameplayResourceTabs.querySelectorAll('[data-gameplay-tab]').forEach(function (item) {
                    item.classList.toggle('active', item === button);
                });
                renderGameplayEditor();
            });
        }

        if (refs.gameplaySearch) refs.gameplaySearch.addEventListener('input', renderGameplayEditor);
        if (refs.btnCreateGameplayEntry) refs.btnCreateGameplayEntry.addEventListener('click', createGameplayEntry);
        if (refs.btnDuplicateGameplayEntry) refs.btnDuplicateGameplayEntry.addEventListener('click', duplicateGameplayEntry);
        if (refs.btnDeleteGameplayEntry) refs.btnDeleteGameplayEntry.addEventListener('click', deleteGameplayEntry);
        if (refs.btnMoveGameplayUp) refs.btnMoveGameplayUp.addEventListener('click', function () { moveGameplayEntry(-1); });
        if (refs.btnMoveGameplayDown) refs.btnMoveGameplayDown.addEventListener('click', function () { moveGameplayEntry(1); });

        if (refs.modelCategoryTabs) {
            refs.modelCategoryTabs.addEventListener('click', function (event) {
                var button = event.target.closest('[data-model-category]');
                if (!button) return;
                activeModelCategory = button.getAttribute('data-model-category') || 'all';
                selectedModelId = '';
                refs.modelCategoryTabs.querySelectorAll('[data-model-category]').forEach(function (item) {
                    item.classList.toggle('active', item.getAttribute('data-model-category') === activeModelCategory);
                });
                renderModelEditor();
            });
        }
        if (refs.modelSearch) refs.modelSearch.addEventListener('input', renderModelEditor);
        if (refs.modelEntryList) {
            refs.modelEntryList.addEventListener('click', function (event) {
                var item = event.target.closest('[data-model-id]');
                if (!item) return;
                selectedModelId = item.getAttribute('data-model-id') || '';
                renderModelEditor();
            });
        }
        if (refs.modelUploadReplace) {
            refs.modelUploadReplace.addEventListener('change', function () {
                if (refs.modelUploadReplace.files && refs.modelUploadReplace.files[0]) {
                    replaceSelectedModel(refs.modelUploadReplace.files[0]);
                }
            });
        }
        if (refs.modelInspectorUpload) {
            refs.modelInspectorUpload.addEventListener('change', function () {
                if (refs.modelInspectorUpload.files && refs.modelInspectorUpload.files[0]) {
                    uploadNewModelFromInspector(refs.modelInspectorUpload.files[0]);
                }
            });
        }
        if (refs.gameplayEntryList) {
            refs.gameplayEntryList.addEventListener('click', function (event) {
                var menuToggle = event.target.closest('[data-gameplay-menu-toggle]');
                if (menuToggle) {
                    event.stopPropagation();
                    var wrap = menuToggle.closest('.gameplay-entry-menu-anchor');
                    var menu = wrap && wrap.querySelector('.gameplay-entry-menu');
                    var expanded = menuToggle.getAttribute('aria-expanded') === 'true';
                    closeAllGameplayEntryMenus();
                    if (!expanded && menu) {
                        menuToggle.setAttribute('aria-expanded', 'true');
                        menu.classList.remove('view-hidden');
                    }
                    return;
                }
                var actionButton = event.target.closest('[data-gameplay-action]');
                if (actionButton) {
                    event.stopPropagation();
                    var action = actionButton.getAttribute('data-gameplay-action');
                    var id = actionButton.getAttribute('data-gameplay-entry-id') || '';
                    selectedGameplayEntryId = id;
                    closeAllGameplayEntryMenus();
                    if (action === 'duplicate') duplicateGameplayEntry();
                    if (action === 'delete') deleteGameplayEntry();
                    if (action === 'move-up') moveGameplayEntry(-1);
                    if (action === 'move-down') moveGameplayEntry(1);
                    return;
                }
                var selectBtn = event.target.closest('[data-gameplay-select-id]');
                if (!selectBtn) return;
                event.stopPropagation();
                selectedGameplayEntryId = selectBtn.getAttribute('data-gameplay-select-id') || '';
                selectedGameplayAssetId = '';
                closeAllGameplayEntryMenus();
                renderGameplayEditor();
            });
        }

        document.addEventListener('click', function (event) {
            if (activeWorkbench !== 'gameplay') return;
            if (!refs.gameplayEntryList) return;
            if (event.target.closest('.gameplay-entry-menu-anchor')) return;
            closeAllGameplayEntryMenus();
        });
        if (refs.gameplayEditorForm) {
            refs.gameplayEditorForm.addEventListener('input', function (event) {
                handleGameplayFormInput(event.target);
            });
            refs.gameplayEditorForm.addEventListener('change', function (event) {
                handleGameplayFormInput(event.target);
            });
        }
        if (refs.gameplayAssetType) refs.gameplayAssetType.addEventListener('change', renderGameplayEditor);
        if (refs.gameplayAssetUpload) {
            refs.gameplayAssetUpload.addEventListener('change', function () {
                if (refs.gameplayAssetUpload.files && refs.gameplayAssetUpload.files[0]) {
                    uploadGameplayAsset(refs.gameplayAssetUpload.files[0]);
                }
            });
        }
        if (refs.gameplayAssetList) {
            refs.gameplayAssetList.addEventListener('click', function (event) {
                var previewCard = event.target.closest('[data-asset-preview-id]');
                if (previewCard && !event.target.closest('[data-asset-bind]')) {
                    selectedGameplayAssetId = previewCard.getAttribute('data-asset-preview-id') || '';
                    renderGameplayEditor();
                    return;
                }
                var button = event.target.closest('[data-asset-bind]');
                if (!button) return;
                bindGameplayAsset(button.getAttribute('data-asset-id') || '', button.getAttribute('data-asset-bind') || 'imagePath');
            });
        }

        refs.statusFilters.addEventListener('click', function (event) {
            var button = event.target.closest('[data-status-filter]');
            if (!button) return;
            activeStatusFilter = button.getAttribute('data-status-filter') || 'all';
            refs.statusFilters.querySelectorAll('[data-status-filter]').forEach(function (item) {
                item.classList.toggle('active', item === button);
            });
            renderLevelTree();
        });

        refs.editorModeTabs.addEventListener('click', function (event) {
            var button = event.target.closest('[data-editor-mode]');
            if (!button) return;
            activeEditorMode = button.getAttribute('data-editor-mode') || 'defense';
            refs.editorModeTabs.querySelectorAll('[data-editor-mode]').forEach(function (item) {
                item.classList.toggle('active', item === button);
            });
            selectedObject = null;
            renderAll();
            refreshPreviewNow();
        });

        document.querySelectorAll('[data-tool]').forEach(function (button) {
            button.addEventListener('click', function () {
                activeTool = button.getAttribute('data-tool') || 'select';
                document.querySelectorAll('[data-tool]').forEach(function (item) {
                    item.classList.toggle('active', item === button);
                });
                refs.activeToolLabel.textContent = '当前工具：' + TOOL_LABELS[activeTool];
                updateEraserToolPanelVisibility(refs, activeWorkbench, activeTool);
                updateStageHintText();
            });
        });

        refs.levelTree.addEventListener('click', function (event) {
            var button = event.target.closest('[data-level-id]');
            if (!button) return;
            selectLevel(button.getAttribute('data-level-id'));
        });

        refs.mapGrid.addEventListener('click', function (event) {
            var marker = event.target.closest('[data-object-kind]');
            if (marker) {
                selectObject(marker.getAttribute('data-object-kind'), marker.getAttribute('data-object-id'));
                return;
            }
            var cell = event.target.closest('[data-col][data-row]');
            if (!cell) return;
            handleCellAction(Number(cell.dataset.col), Number(cell.dataset.row));
        });

        refs.mapGrid.addEventListener('mousemove', function (event) {
            if (activeWorkbench !== 'level' || activeTool !== 'erase') return;
            recordEraserPreviewPointer(event.clientX, event.clientY);
            updateEraserBrushPreview(refs, event.clientX, event.clientY, eraserPreviewEnv());
        });
        refs.mapGrid.addEventListener('mouseleave', function () {
            if (activeWorkbench !== 'level' || activeTool !== 'erase') return;
            clearEraserPreviewPointer();
            clearEraserBrushPreview(refs);
        });

        refs.mapGrid.addEventListener('dragover', function (event) {
            /* gap:1px 与 padding 会导致 target 落到 #mapGrid 自身，不写 preventDefault 则浏览器禁止 drop */
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
        });

        refs.mapGrid.addEventListener('drop', function (event) {
            event.preventDefault();
            var level = getLevel();
            if (!level || !level.map || !level.map.grid) return;
            if (tryConsumeBoardImageFileDrop(event, refs, boardImagesEnv())) return;
            var cellEl = event.target.closest('.map-grid-cells--floor .map-cell[data-col][data-row]');
            var resolved =
                cellEl ||
                (function () {
                    var nodes = document.elementsFromPoint(event.clientX, event.clientY);
                    for (var li = 0; li < nodes.length; li += 1) {
                        var n = nodes[li];
                        if (
                            n.classList &&
                            n.classList.contains('map-cell') &&
                            n.closest('.map-grid-cells--floor') &&
                            n.getAttribute('data-col') != null &&
                            n.getAttribute('data-row') != null
                        ) {
                            return n;
                        }
                    }
                    return mapGridPickCellFromClientPoint(event.clientX, event.clientY, level.map.grid);
                })();
            if (!resolved || resolved.getAttribute('data-col') == null) return;
            var col = Number(resolved.getAttribute('data-col'));
            var row = Number(resolved.getAttribute('data-row'));
            if (!Number.isFinite(col) || !Number.isFinite(row)) return;
            var payload = readDragPayload(event);
            if (!payload) return;
            if (payload.kind === 'template') placeActorFromTemplate(payload.id, col, row);
            if (payload.kind === 'actor') moveActor(payload.id, col, row);
            if (payload.kind === 'marker') moveMarker(payload.markerKind, payload.id, col, row);
        });

        bindLevelFields();
        bindGameAssetPanel();
        bindLevelAudioUi(refs, audioEnv());
        bindGlobalAudioUi(audioEnv());
        bindGlobalSettingsChrome();
        bindGlobalCutscenePanel();
        bindGlobalScreenUiPanel();

        if (refs.previewSceneOutlineList) {
            refs.previewSceneOutlineList.addEventListener('click', function (event) {
                var btn = event.target.closest('[data-outline-actor]');
                if (!btn) return;
                var id = btn.getAttribute('data-outline-actor') || '';
                if (!id) return;
                selectObject('actor', id);
            });
        }

        if (refs.viewportViewTabs) {
            refs.viewportViewTabs.addEventListener('click', function (event) {
                var button = event.target.closest('[data-view-mode]');
                if (!button) return;
                wireViewportViewMode(button.getAttribute('data-view-mode') || 'board');
            });
        }

        if (refs.previewGizmoTranslate && refs.previewGizmoRotate && refs.previewGizmoScale) {
            refs.previewGizmoTranslate.addEventListener('click', function () {
                setPreviewToolbarMode('translate');
            });
            refs.previewGizmoRotate.addEventListener('click', function () {
                setPreviewToolbarMode('rotate');
            });
            refs.previewGizmoScale.addEventListener('click', function () {
                setPreviewToolbarMode('scale');
            });
        }

        if (refs.previewFocusSelection) {
            refs.previewFocusSelection.addEventListener('click', function () {
                if (previewApi && typeof previewApi.focusSelection === 'function') previewApi.focusSelection();
            });
        }

        if (refs.contentBrowserReload) {
            refs.contentBrowserReload.addEventListener('click', function () {
                void refreshGameModelsCatalog().then(function () {
                    renderContentBrowser();
                    setStatus('已刷新内容浏览器', 'idle');
                });
            });
        }

        wireContentBrowserFloating();

        if (refs.collapseRegionPanel) {
            refs.collapseRegionPanel.addEventListener('click', function () {
                shellLeftCollapsedPref = true;
                _persistShellCollapsedPrefs(
            { leftKey: SHELL_LEFT_COLLAPSE_KEY, rightKey: SHELL_RIGHT_COLLAPSE_KEY },
            shellLeftCollapsedPref,
            shellRightCollapsedPref
        );
                applyShellPanelCollapseUi();
            });
        }
        if (refs.railExpandRegionPanel) {
            refs.railExpandRegionPanel.addEventListener('click', function () {
                shellLeftCollapsedPref = false;
                _persistShellCollapsedPrefs(
            { leftKey: SHELL_LEFT_COLLAPSE_KEY, rightKey: SHELL_RIGHT_COLLAPSE_KEY },
            shellLeftCollapsedPref,
            shellRightCollapsedPref
        );
                applyShellPanelCollapseUi();
            });
        }
        if (refs.collapseInspectorPanel) {
            refs.collapseInspectorPanel.addEventListener('click', function () {
                shellRightCollapsedPref = true;
                _persistShellCollapsedPrefs(
            { leftKey: SHELL_LEFT_COLLAPSE_KEY, rightKey: SHELL_RIGHT_COLLAPSE_KEY },
            shellLeftCollapsedPref,
            shellRightCollapsedPref
        );
                applyShellPanelCollapseUi();
            });
        }
        if (refs.railExpandInspectorPanel) {
            refs.railExpandInspectorPanel.addEventListener('click', function () {
                shellRightCollapsedPref = false;
                _persistShellCollapsedPrefs(
            { leftKey: SHELL_LEFT_COLLAPSE_KEY, rightKey: SHELL_RIGHT_COLLAPSE_KEY },
            shellLeftCollapsedPref,
            shellRightCollapsedPref
        );
                applyShellPanelCollapseUi();
            });
        }

        var shellReflowTimer = null;
        window.addEventListener('resize', function () {
            if (viewportViewMode === 'preview' && previewApi && typeof previewApi.resize === 'function') {
                previewApi.resize();
            }
            clearTimeout(shellReflowTimer);
            shellReflowTimer = window.setTimeout(function () {
                applyShellPanelCollapseUi();
                clampContentBrowserFloatPanelIntoViewport();
            }, 100);
        });

        document.addEventListener('keydown', function (e) {
            var ae = document.activeElement;
            var tag = ae && ae.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (ae && ae.isContentEditable) return;

            if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
                if (activeWorkbench !== 'level') return;
                e.preventDefault();
                toggleContentBrowserFloat();
                return;
            }

            if (e.key === 'f' || e.key === 'F') {
                if (activeWorkbench !== 'level') return;
                if (viewportViewMode !== 'preview' || !previewApi || typeof previewApi.focusSelection !== 'function') return;
                if (!selectedObject || selectedObject.kind !== 'actor') return;
                e.preventDefault();
                e.stopPropagation();
                previewApi.focusSelection();
                return;
            }

            if (
                e.key === 'Escape' &&
                activeWorkbench === 'level' &&
                selectedObject &&
                selectedObject.kind === 'boardImage'
            ) {
                e.preventDefault();
                selectedObject = null;
                clearBoardImageInteractionState();
                renderSelectionInspector();
                renderMap();
                renderBoardImagesPanel(refs, boardImagesEnv());
                return;
            }

            if (e.key !== 'Delete') return;
            if (activeWorkbench !== 'level' || !selectedObject) return;
            e.preventDefault();
            deleteSelection();
        });
        bindEraserToolControls(refs, function () {
            refreshEraserPreviewIfActive(refs, eraserPreviewEnv());
        });
        bindBoardImageGlobalHandlers(refs, boardImagesEnv());
        ensureBoardImagesPanelDelegated(refs, boardImagesEnv());
    }

    function normalizeGameModelsForCatalog() {
        return (state && Array.isArray(state.gameModelsCatalog) ? state.gameModelsCatalog : []).map(function (entry) {
            var pub = String(entry.publicUrl || '');
            return {
                id: String(entry.id || ''),
                name: String(entry.name || entry.relativePath || '模型'),
                path: pub,
                publicUrl: pub,
                relativePath: String(entry.relativePath || ''),
                summary: entry.relativePath ? 'GameModels/' + String(entry.relativePath) : 'GameModels',
                source: 'gameModels'
            };
        });
    }

    async function refreshGameModelsCatalog() {
        if (!state) return;
        try {
            var r = await fetch('/api/game-models/catalog', { cache: 'no-store' });
            if (!r.ok) return;
            var data = await r.json();
            state.gameModelsCatalog = Array.isArray(data.entries) ? data.entries : [];
        } catch (e) {
            console.warn('[GameModels catalog]', e);
            state.gameModelsCatalog = [];
        }
    }

    async function uploadFileToProjectUrl(file, options) {
        if (options && options.gameModelsUpload) {
            var contentGm = await fileToBase64(file);
            var resGm = await fetch('/api/game-models/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: file.name,
                    content: contentGm,
                    subdirectory: options.gameModelsSubdir != null ? String(options.gameModelsSubdir) : ''
                })
            });
            var resTextGm = await resGm.text();
            if (!resGm.ok) {
                throw new Error(parseFetchErrorBody(resGm.status, resTextGm));
            }
            await refreshGameModelsCatalog();
            var payloadGm = {};
            try {
                payloadGm = JSON.parse(resTextGm);
            } catch (e2) {
                throw new Error('服务器返回非 JSON');
            }
            return String(payloadGm.publicUrl || '');
        }
        var cityContext = getGameplayCityContext();
        var payload = null;
        var content = await fileToBase64(file);
        if (cityContext) {
            var requestBody = {
                name: file.name,
                content: content,
                cityCode: cityContext.cityCode,
                cityName: cityContext.cityName,
                assetType: options && options.assetType ? options.assetType : 'LevelAssets',
                resourceKind: options && options.resourceKind ? options.resourceKind : 'level-asset',
                assetName: options && options.assetName ? options.assetName : file.name.replace(/\.[^.]+$/, '')
            };
            var projectResponse = await fetch('/api/editor-assets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            var prText = await projectResponse.text();
            if (!projectResponse.ok) throw new Error(parseFetchErrorBody(projectResponse.status, prText));
            try {
                payload = JSON.parse(prText);
            } catch (eJson) {
                throw new Error('服务器返回非 JSON');
            }
            rememberEditorAsset(payload, requestBody.resourceKind);
            return String(payload.publicUrl || '');
        }
        var response = await fetch('/api/upload-model', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: file.name, content: content })
        });
        var upText = await response.text();
        if (!response.ok) throw new Error(parseFetchErrorBody(response.status, upText));
        try {
            payload = JSON.parse(upText);
        } catch (eUp) {
            throw new Error('服务器返回非 JSON');
        }
        return String(payload.url || '');
    }

    function rememberEditorAsset(payload, resourceKind) {
        if (!payload || !payload.projectPath) return;
        state.editorAssetsCatalog = state.editorAssetsCatalog || [];
        var nextAsset = {
            id: String(payload.id || uid('editor-asset')),
            name: String(payload.name || '未命名资源'),
            assetType: String(payload.assetType || 'LevelAssets'),
            resourceKind: String(resourceKind || payload.resourceKind || 'level-asset'),
            cityCode: String(payload.cityCode || ''),
            cityName: String(payload.cityName || ''),
            path: String(payload.projectPath || ''),
            projectPath: String(payload.projectPath || ''),
            publicUrl: String(payload.publicUrl || ''),
            summary: String(payload.cityName || '') + ' · ' + String(payload.name || ''),
            updatedAt: new Date().toISOString()
        };
        state.editorAssetsCatalog = state.editorAssetsCatalog.filter(function (item) { return item.id !== nextAsset.id; });
        state.editorAssetsCatalog.push(nextAsset);
    }

    function renderGameAssetPanel() {
        if (!state || !state.gameAssetConfig || !refs.towerModelList) return;
        var g = state.gameAssetConfig;
        refs.towerModelList.innerHTML = TOWER_MODEL_SPECS.map(function (spec) {
            var url = g.customModelUrls[spec.id] || '';
            var sc = g.modelScales[spec.id] != null ? g.modelScales[spec.id] : 1;
            return [
                '<div class="game-asset-tower-row">',
                '  <div class="game-asset-tower-title">' + escapeHtml(spec.key + ' · ' + spec.name) + '</div>',
                '  <div class="game-asset-tower-upload-col" data-tower-drop="' +
                    escapeAttr(spec.id) +
                    '" title="从底部「项目模型」拖入到此列（整块区域均可接住）">',
                '    <label class="game-asset-upload tight">替换模型',
                '      <input type="file" data-tower-file="' + escapeAttr(spec.id) + '" accept=".glb,.gltf,.obj,model/gltf-binary,model/gltf+json" />',
                '    </label>',
                '    <div class="game-asset-tower-drop">拖入项目模型</div>',
                '  </div>',
                '  <label class="field-block game-asset-scale-tower"><span>缩放</span>',
                '    <input type="number" data-tower-scale="' + escapeAttr(spec.id) + '" min="0.1" max="8" step="0.1" value="' + String(sc) + '" />',
                '  </label>',
                '  <div class="asset-url-hint" title="' + escapeAttr(url || '未绑定塔防模型文件') + '">' + escapeHtml(url ? modelBindShortLabel(url) : '未配置') + '</div>',
                '</div>'
            ].join('');
        }).join('');

        var ps = document.getElementById('gaPropScale');
        var ys = document.getElementById('gaPlayerScale');
        if (ps) ps.value = String(g.modelScales.moneyDrop != null ? g.modelScales.moneyDrop : 1);
        if (ys) ys.value = String(g.modelScales.player != null ? g.modelScales.player : 1);

        var pt = g.playerExploreTransform || defaultGameAssetConfig().playerExploreTransform;
        var om = pt.offsetMeters || { x: 0, y: 0, z: 0 };
        var rd = pt.rotationDeg || { x: 0, y: 0, z: 0 };
        var elOx = document.getElementById('gaOffX');
        var elOy = document.getElementById('gaOffY');
        var elOz = document.getElementById('gaOffZ');
        var elRx = document.getElementById('gaRotX');
        var elRy = document.getElementById('gaRotY');
        var elRz = document.getElementById('gaRotZ');
        if (elOx) elOx.value = String(om.x != null ? om.x : 0);
        if (elOy) elOy.value = String(om.y != null ? om.y : 0);
        if (elOz) elOz.value = String(om.z != null ? om.z : 0);
        if (elRx) elRx.value = String(rd.x != null ? rd.x : 0);
        if (elRy) elRy.value = String(rd.y != null ? rd.y : 0);
        if (elRz) elRz.value = String(rd.z != null ? rd.z : 0);
    }

    function bindGameAssetPanel() {
        if (!refs.gameAssetSection) return;
        refs.gameAssetSection.addEventListener('change', function (e) {
            var t = e.target;
            if (!t || !state) return;
            (async function () {
                if (t.classList && t.classList.contains('ga-pt')) {
                    if (!state.gameAssetConfig.playerExploreTransform) {
                        state.gameAssetConfig.playerExploreTransform = defaultGameAssetConfig().playerExploreTransform;
                    }
                    var pt2 = state.gameAssetConfig.playerExploreTransform;
                    var n = Number(t.value);
                    if (!Number.isFinite(n)) n = 0;
                    var k = t.getAttribute('data-ga-pt');
                    if (k === 'ox') pt2.offsetMeters.x = n;
                    if (k === 'oy') pt2.offsetMeters.y = n;
                    if (k === 'oz') pt2.offsetMeters.z = n;
                    if (k === 'rx') pt2.rotationDeg.x = n;
                    if (k === 'ry') pt2.rotationDeg.y = n;
                    if (k === 'rz') pt2.rotationDeg.z = n;
                    markDirty('已更新探索出生点变换');
                    return;
                }
                if (t.getAttribute('data-tower-file')) {
                    var tid = t.getAttribute('data-tower-file');
                    var file = t.files && t.files[0];
                    t.value = '';
                    if (!file) return;
                    try {
                        setStatus('正在上传「' + file.name + '」…', 'idle');
                        var url = await uploadFileToProjectUrl(file, { gameModelsUpload: true, gameModelsSubdir: 'Tower' });
                        if (url) {
                            state.gameAssetConfig.customModelUrls[tid] = url;
                            markDirty('已更新塔防单位模型');
                            setStatus(
                                '已成功绑定塔防模型「' + file.name + '」 · ' + modelBindShortLabel(url) + '（悬停「当前文件」格可见完整路径）',
                                'success'
                            );
                        } else {
                            setStatus('模型上传后未返回公开 URL（需 dev /api/game-models/upload）', 'error');
                        }
                    } catch (err) {
                        setStatus((err && err.message) || '上传失败', 'error');
                    }
                    renderGameAssetPanel();
                    return;
                }
                if (t.getAttribute('data-tower-scale')) {
                    var sid = t.getAttribute('data-tower-scale');
                    state.gameAssetConfig.modelScales[sid] = clamp(Number(t.value) || 1, 0.1, 8);
                    markDirty('已更新塔防单位缩放');
                    return;
                }
                if (t.classList && t.classList.contains('ga-scale-input') && t.getAttribute('data-ga-scale')) {
                    var gk = t.getAttribute('data-ga-scale');
                    state.gameAssetConfig.modelScales[gk] = clamp(Number(t.value) || 1, 0.1, 8);
                    markDirty('已更新探索缩放');
                    return;
                }
                if (t.getAttribute('data-ga') === 'propModel') {
                    var pf = t.files && t.files[0];
                    t.value = '';
                    if (!pf) return;
                    try {
                        setStatus('正在上传探索掉落模型…', 'idle');
                        var purl = await uploadFileToProjectUrl(pf, { assetType: 'LevelProps', resourceKind: 'drop-model', assetName: 'money-drop' });
                        if (purl) {
                            state.gameAssetConfig.customDropModelUrl = purl;
                            markDirty('已更新探索掉落模型');
                        }
                    } catch (err2) {
                        setStatus((err2 && err2.message) || '上传失败', 'error');
                    }
                    renderGameAssetPanel();
                    return;
                }
                if (t.getAttribute('data-ga') === 'playerModel') {
                    var pfile = t.files && t.files[0];
                    t.value = '';
                    if (!pfile) return;
                    try {
                        setStatus('正在上传角色模型…', 'idle');
                        var plurl = await uploadFileToProjectUrl(pfile, { assetType: 'Characters', resourceKind: 'player-model', assetName: 'explore-player' });
                        if (plurl) {
                            state.gameAssetConfig.customPlayerModelUrl = plurl;
                            markDirty('已更新探索角色模型');
                        }
                    } catch (err3) {
                        setStatus((err3 && err3.message) || '上传失败', 'error');
                    }
                    renderGameAssetPanel();
                    return;
                }
                if (t.getAttribute('data-ga-anim')) {
                    var anim = t.getAttribute('data-ga-anim');
                    var af = t.files && t.files[0];
                    t.value = '';
                    if (!af) return;
                    try {
                        setStatus('正在上传 ' + anim + ' 动画…', 'idle');
                        var aurl = await uploadFileToProjectUrl(af, { assetType: 'Animations', resourceKind: 'mixamo-' + anim, assetName: anim + '-animation' });
                        if (aurl) {
                            state.gameAssetConfig.customAnimationUrls[anim] = aurl;
                            markDirty('已更新 ' + anim + ' 动画');
                        }
                    } catch (err4) {
                        setStatus((err4 && err4.message) || '上传失败', 'error');
                    }
                    renderGameAssetPanel();
                }
            })();
        });

        if (refs.gameAssetSection && !refs.gameAssetSection.__towerCatalogDropBound) {
            refs.gameAssetSection.__towerCatalogDropBound = true;
            function towerDropZoneFromTarget(t) {
                if (!t) return null;
                var el = t.nodeType === 3 && t.parentElement ? t.parentElement : t;
                return el.closest ? el.closest('[data-tower-drop]') : null;
            }
            function readCatalogPayloadFromDrag(dataTransfer) {
                if (!dataTransfer) return null;
                var rawJson = '';
                try {
                    rawJson = String(dataTransfer.getData('application/json') || '').trim();
                } catch (e1) {
                    rawJson = '';
                }
                if (!rawJson) {
                    try {
                        rawJson = String(dataTransfer.getData('text/plain') || '').trim();
                    } catch (e2) {
                        rawJson = '';
                    }
                }
                if (!rawJson || rawJson.charAt(0) !== '{') return null;
                try {
                    var o = JSON.parse(rawJson);
                    return o && typeof o === 'object' ? o : null;
                } catch (e3) {
                    return null;
                }
            }
            refs.gameAssetSection.addEventListener('dragover', function (e) {
                var zone = towerDropZoneFromTarget(e.target);
                if (!zone) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            });
            refs.gameAssetSection.addEventListener('dragenter', function (e) {
                var zone = towerDropZoneFromTarget(e.target);
                if (!zone) return;
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
            });
            refs.gameAssetSection.addEventListener('drop', function (e) {
                var zone = towerDropZoneFromTarget(e.target);
                if (!zone || !state || !state.gameAssetConfig) return;
                e.preventDefault();
                var tid = zone.getAttribute('data-tower-drop');
                if (!tid) return;
                var payload = readCatalogPayloadFromDrag(e.dataTransfer);
                if (!payload || payload.kind !== 'catalogModel') return;
                var aid = payload.assetId || payload.id || '';
                var asset = getBrowsableModelAssets().find(function (item) {
                    return item.id === aid;
                });
                var url = asset ? asset.path || asset.publicUrl || '' : '';
                if (!url) {
                    setStatus('无法解析该模型路径，请先在「项目模型」中刷新列表。', 'error');
                    return;
                }
                state.gameAssetConfig.customModelUrls[tid] = url;
                markDirty('已从项目模型绑定塔防替换模型');
                setStatus('已绑定塔防模型：' + modelBindShortLabel(url) + '（路径见格内 / 悬停）', 'success');
                renderGameAssetPanel();
            });
        }
    }

    function bindLevelFields() {
        refs.fieldLevelName.addEventListener('input', function () { updateLevel('name', refs.fieldLevelName.value); });
        refs.fieldStatus.addEventListener('change', function () { updateLevel('status', refs.fieldStatus.value); renderLevelTree(); });
        refs.fieldCountry.addEventListener('input', function () { updatePath(getLevel(), 'location.countryName', refs.fieldCountry.value); markDirty('已更新国家'); renderLevelTree(); });
        refs.fieldCity.addEventListener('input', function () { updatePath(getLevel(), 'location.cityName', refs.fieldCity.value); markDirty('已更新城市'); renderLevelTree(); });
        refs.fieldDifficulty.addEventListener('change', function () {
            var level = getLevel();
            if (!level) return;
            level.difficulty = clamp(Number(refs.fieldDifficulty.value) || 1, 1, 5);
            refs.fieldDifficulty.value = String(level.difficulty);
            markDirty('已更新难度');
        });
        refs.fieldDescription.addEventListener('input', function () { updateLevel('description', refs.fieldDescription.value); });
        [
            refs.fieldGeoEnabled,
            refs.fieldGeoLat,
            refs.fieldGeoLon,
            refs.fieldGeoHeight,
            refs.fieldGeoExtent,
            refs.fieldGeoRotation,
            refs.fieldGeoYOffset,
            refs.fieldGeoBoardHeight,
            refs.fieldGeoAssetId
        ].filter(Boolean).forEach(function (field) {
            field.addEventListener('input', updateGeoFromFields);
            field.addEventListener('change', updateGeoFromFields);
        });
    }

    async function fetchAppConfig() {
        try {
            var cfgRes = await fetch('/api/app-config', { cache: 'no-store' });
            if (cfgRes.ok) {
                var cfg = await cfgRes.json();
                if (cfg.cesiumIonToken) {
                    window.CESIUM_ION_TOKEN = cfg.cesiumIonToken;
                    try {
                        window.localStorage.setItem('earth-guardian.cesiumIonToken', cfg.cesiumIonToken);
                    } catch (ignore) {}
                }
            }
        } catch (e) {
            // App config is optional; continue without it.
        }
    }

    async function loadState() {
        setStatus('正在读取项目关卡配置…', 'idle');
        try {
            await fetchAppConfig();
            regionSources = await loadRegionSources();
            var response = await fetch(API_URL, { cache: 'no-store' });
            if (!response.ok) throw new Error('读取失败: ' + response.status);
            state = normalizeState(await response.json());
            var runtimeGameplay = await fetchRuntimeCityGameplay();
            var gameplaySynced = mergeRuntimeCityGameplayConfigs(runtimeGameplay);
            var generated = generateRegionLevelSkeletons(false);
            var geoSynced = syncGeoConfigs(false);
            var synced = syncBuiltInCityLayouts(false);
            selectedLevelId = pickLevelId(state.levels, selectedLevelId);
            await refreshGameModelsCatalog();
            renderAll();
            isDirty = generated > 0 || synced > 0 || geoSynced > 0 || gameplaySynced > 0;
            _persistLocalBackup(state);
            setStatus(generated + synced + geoSynced + gameplaySynced > 0 ? '已同步 ' + gameplaySynced + ' 个运行时玩法条目、' + synced + ' 个城市布局、' + geoSynced + ' 个真实地图坐标，生成 ' + generated + ' 个骨架，保存后写入项目' : '配置已加载', generated + synced + geoSynced + gameplaySynced > 0 ? 'dirty' : 'success');
        } catch (error) {
            var backup = _readLocalBackup();
            state = normalizeState(backup || { version: ENGINE_VERSION, catalog: {}, levels: [] });
            selectedLevelId = pickLevelId(state.levels, selectedLevelId);
            await refreshGameModelsCatalog();
            renderAll();
            isDirty = false;
            setStatus('项目读取失败，已载入本地备份: ' + error.message, 'error');
        }
    }

    async function reloadState() {
        if (isDirty && !window.confirm('当前有未保存修改，确定重新载入项目文件吗？')) return;
        await loadState();
    }

    async function saveState() {
        try {
            setStatus('正在保存到项目文件…', 'idle');
            var response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(_sanitizeStateForSave(state))
            });
            if (!response.ok) throw new Error('保存失败: ' + response.status);
            state = normalizeState(await response.json());
            selectedLevelId = pickLevelId(state.levels, selectedLevelId);
            isDirty = false;
            _persistLocalBackup(state);
            await refreshGameModelsCatalog();
            renderAll();
            setStatus('已保存到 Web/data/level-editor-state.json', 'success');
        } catch (error) {
            _persistLocalBackup(state);
            setStatus('保存失败，已保留本地备份: ' + error.message, 'error');
        }
    }

    async function loadRegionSources() {
        var countries = [];
        var chinaCities = [];
        try {
            var world = await fetchGeoJsonScript('../data/world-data.js', '__WORLD_GEOJSON__');
            var countryCapitalCoords = await fetchCountryCapitalCoords();
            countries = (world.features || []).map(function (feature) {
                var code = String(feature.id || slugify(feature.properties && feature.properties.name) || '');
                return {
                    kind: 'country',
                    code: code,
                    name: String(feature.properties && feature.properties.name || 'Unknown Country'),
                    geo: countryGeoFromFeature(feature, code, countryCapitalCoords)
                };
            }).filter(function (item) { return item.name && item.name !== 'Antarctica'; });
        } catch (error) {
            setStatus('世界国家数据读取失败，仅保留现有关卡: ' + error.message, 'error');
        }

        try {
            var china = await fetchGeoJsonScript('../data/china-data.js', '__CHINA_GEOJSON__');
            var provinces = (china.features || []).map(function (feature) {
                return feature.properties && feature.properties.adcode;
            }).filter(Boolean);
            var cityGroups = await Promise.all(provinces.map(loadProvinceCities));
            chinaCities = cityGroups.flat().filter(function (city) { return city.code && city.name; });
        } catch (error) {
            setStatus('中国城市数据读取失败，仅生成国家骨架: ' + error.message, 'error');
        }

        return { countries: countries, chinaCities: chinaCities };
    }

    async function fetchRuntimeCityGameplay() {
        try {
            var response = await fetch('/api/runtime-city-gameplay', { cache: 'no-store' });
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            return null;
        }
    }

    async function loadProvinceCities(adcode) {
        try {
            var variableName = '__PROVINCE_' + adcode + '_GEOJSON__';
            var data = await fetchGeoJsonScript('../data/provinces/' + adcode + '-data.js', variableName);
            return (data.features || []).map(function (feature) {
                var props = feature.properties || {};
                return {
                    kind: 'china-city',
                    code: String(props.adcode || ''),
                    name: String(props.name || ''),
                    countryCode: 'CN',
                    countryName: '中国',
                    provinceCode: String(adcode),
                    center: props.center || props.centroid || null,
                    geo: geoFromLonLatArray(props.center || props.centroid, 1600)
                };
            });
        } catch (error) {
            return [];
        }
    }

    async function fetchGeoJsonScript(url, variableName) {
        var response = await fetch(url, { cache: 'force-cache' });
        if (!response.ok) throw new Error(url + ' ' + response.status);
        var text = await response.text();
        var prefix = 'window.' + variableName + ' = ';
        var start = text.indexOf(prefix);
        if (start === -1) throw new Error('找不到 ' + variableName);
        start += prefix.length;
        var end = text.lastIndexOf(';');
        var json = text.slice(start, end > start ? end : undefined).trim();
        return JSON.parse(json);
    }

    function generateRegionLevelSkeletons(markAsDirty) {
        if (!state) return 0;
        var created = 0;
        var existing = new Set(state.levels.map(function (level) { return level.id; }));
        regionSources.countries.forEach(function (country) {
            var id = 'country-' + slugify(country.code || country.name);
            if (existing.has(id)) return;
            state.levels.push(createDraftLevel({
                id: id,
                name: country.name + ' · 未设计关卡',
                countryCode: country.code,
                countryName: country.name,
                cityCode: '',
                cityName: '',
                regionLabel: country.name,
                source: 'world-country',
                geo: country.geo
            }));
            existing.add(id);
            created += 1;
        });
        regionSources.chinaCities.forEach(function (city) {
            var id = 'city-cn-' + city.code;
            if (existing.has(id)) return;
            state.levels.push(createDraftLevel({
                id: id,
                name: city.name + ' · 未设计关卡',
                countryCode: 'CN',
                countryName: '中国',
                cityCode: city.code,
                cityName: city.name,
                regionLabel: '中国 · ' + city.name,
                source: 'china-city',
                geo: city.geo
            }));
            existing.add(id);
            created += 1;
        });
        if (created > 0) {
            sortLevels(state);
            if (markAsDirty) {
                selectedLevelId = pickLevelId(state.levels, selectedLevelId);
                markDirty('已生成 ' + created + ' 个国家/城市关卡骨架');
                renderAll();
            }
        } else if (markAsDirty) {
            setStatus('所有国家和中国城市都已有关卡骨架', 'success');
        }
        if (markAsDirty) {
            syncBuiltInCityLayouts(true);
            syncGeoConfigs(true);
        }
        return created;
    }

    function syncGeoConfigs(markAsDirty) {
        if (!state) return 0;
        var synced = 0;
        state.levels.forEach(function (level) {
            var geo = resolveGeoForLevel(level);
            if (!geo) return;
            var isWorldCountry = level.location && level.location.source === 'world-country';

            var pinManual = level.extensions && level.extensions.manualWorldGeoPin === true;

            if (level.map && level.map.geo && level.map.geo.enabled) {
                if (!isWorldCountry || pinManual) return;
            }
            level.map.geo = cloneGeoConfig(geo);
            synced += 1;
        });
        if (synced > 0 && markAsDirty) {
            markDirty('已同步 ' + synced + ' 个真实地图坐标');
            renderAll();
        }
        return synced;
    }

    function syncBuiltInCityLayouts(markAsDirty) {
        if (!state) return 0;
        var synced = 0;
        state.levels.forEach(function (level) {
            var cityKey = matchBuiltInCity(level);
            if (!cityKey) return;
            var layout = BUILT_IN_CITY_LAYOUTS[cityKey];
            var needsDefense = !hasDefenseLayout(level.map);
            var needsExplore = !hasExploreLayout(level.map);
            var needsGeo = !!(layout.geo && (!level.map.geo || !level.map.geo.enabled));
            if (!needsDefense && !needsExplore && !needsGeo) return;
            if (needsDefense) applyDefenseLayout(level, layout);
            if (needsExplore) applyExploreLayout(level, layout);
            if (needsGeo) level.map.geo = cloneGeoConfig(layout.geo);
            level.status = 'designed';
            level.extensions = level.extensions || {};
            level.extensions.syncedBuiltInLayout = {
                city: cityKey,
                defense: layout.defenseName,
                exploration: layout.exploreName
            };
            synced += 1;
        });
        if (synced > 0) {
            sortLevels(state);
            if (markAsDirty) {
                markDirty('已同步 ' + synced + ' 个城市的塔防/探索布局');
                renderAll();
            }
        }
        return synced;
    }

    function resolveGeoForLevel(level) {
        var specialGeo = resolveSpecialGeoForLevel(level);
        if (specialGeo) return specialGeo;
        var builtIn = BUILT_IN_CITY_LAYOUTS[matchBuiltInCity(level)];
        if (builtIn && builtIn.geo) return builtIn.geo;
        var cityCode = String(level.location && level.location.cityCode || '');
        var cityName = normalizeChineseCityName(level.location && (level.location.cityName || level.location.regionLabel) || level.name || '');
        if (cityCode) {
            var city = regionSources.chinaCities.find(function (item) { return String(item.code) === cityCode; });
            if (city && city.geo) return city.geo;
        }
        if (cityName) {
            var cityByName = regionSources.chinaCities.find(function (item) { return normalizeChineseCityName(item.name) === cityName; });
            if (cityByName && cityByName.geo) return cityByName.geo;
        }
        var countryCode = String(level.location && level.location.countryCode || '').replace(/^country-/i, '').toUpperCase();
        var countryName = String(level.location && (level.location.countryName || level.location.regionLabel) || level.name || '').replace(/ · .+$/, '');
        var country = regionSources.countries.find(function (item) {
            return String(item.code || '').toUpperCase() === countryCode || String(item.name || '').toLowerCase() === countryName.toLowerCase();
        });
        return country && country.geo ? country.geo : null;
    }

    function renderAll() {
        renderWorkbenchShell();
        renderLevelTree();
        renderLevelDetails();
        renderMap();
        renderActorPalette();
        renderWaveList();
        renderModelAssets();
        renderGameAssetPanel();
        renderOverview();
        renderGameplayEditor();
        renderModelEditor();
        renderThemeEditor();
        syncViewportPanels();
        renderContentBrowser();
        renderBoardImagesPanel(refs, boardImagesEnv());
        updateEraserToolPanelVisibility(refs, activeWorkbench, activeTool);
    }

    function ensureLevelContentBrowserUiWired() {
        var filters = refs.levelContentBrowserFilters;
        var list = refs.levelContentBrowserList;
        if (filters && filters.dataset.lcbWired !== '1') {
            filters.dataset.lcbWired = '1';
            filters.innerHTML = LEVEL_CONTENT_BROWSER_FILTER_ORDER.map(function (fid) {
                var label = fid === 'all' ? '全部' : TOOL_LABELS[fid] || fid;
                var active = fid === levelContentBrowserFilter ? ' active' : '';
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
                levelContentBrowserFilter = chip.getAttribute('data-lcb-filter') || 'all';
                filters.querySelectorAll('[data-lcb-filter]').forEach(function (c) {
                    var on = c.getAttribute('data-lcb-filter') === levelContentBrowserFilter;
                    c.classList.toggle('active', on);
                    c.setAttribute('aria-selected', on ? 'true' : 'false');
                });
                renderLevelContentBrowser();
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
                    selectGridCellObject(kind, Number(btn.getAttribute('data-lcb-col')), Number(btn.getAttribute('data-lcb-row')));
                    return;
                }
                var oid = btn.getAttribute('data-lcb-id');
                if (kind && oid != null && oid !== '') selectObject(kind, oid);
            });
        }
    }

    function lcbBtnActive(selKind, probe) {
        if (!selectedObject || selectedObject.kind !== selKind) return false;
        if (probe.id != null && selectedObject.id !== probe.id) return false;
        if (probe.col != null && (selectedObject.col !== probe.col || selectedObject.row !== probe.row)) return false;
        return true;
    }

    function lcbItemButton(meta) {
        var sk = meta.selKind;
        var active = lcbBtnActive(sk, meta.probe || {}) ? ' lcb-item--active' : '';
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

    function renderLevelContentBrowser() {
        ensureLevelContentBrowserUiWired();
        if (!refs.levelContentBrowserList || !refs.levelContentBrowser) return;

        var show = activeWorkbench === 'level' && viewportViewMode === 'preview';
        refs.levelContentBrowser.classList.toggle('view-hidden', !show);
        refs.levelContentBrowser.setAttribute('aria-hidden', show ? 'false' : 'true');

        if (!show || !state) {
            refs.levelContentBrowserList.innerHTML = '';
            return;
        }

        if (refs.previewSceneOutlineSection) {
            refs.previewSceneOutlineSection.classList.add('view-hidden');
            refs.previewSceneOutlineSection.setAttribute('aria-hidden', 'true');
        }

        var level = getLevel();
        if (!level || !level.map) {
            refs.levelContentBrowserList.innerHTML = '<div class="empty-state">请选择关卡</div>';
            return;
        }

        var f = levelContentBrowserFilter;
        var want = function (key) {
            return f === 'all' || f === key;
        };
        var map = level.map;
        var layout = ensureExplorationLayout(map);
        var sections = [];

        /* 障碍 */
        if (want('obstacle')) {
            var obs =
                activeEditorMode === 'explore'
                    ? sortCells(layout.obstacles || [])
                    : sortCells(map.obstacles || []);
            var obsHtml = obs
                .map(function (c) {
                    return lcbItemButton({
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

        /* 敌人出口 */
        if (want('spawn')) {
            var spHtml = '';
            if (activeEditorMode === 'explore' && layout.startPoint) {
                var sp = layout.startPoint;
                spHtml += lcbItemButton({
                    selKind: 'spawn',
                    id: sp.id,
                    probe: { id: sp.id },
                    icon: '出',
                    title: sp.name || '探索起点',
                    sub: '(' + sp.col + ',' + sp.row + ')'
                });
            } else if (activeEditorMode === 'defense') {
                spHtml = (map.spawnPoints || [])
                    .map(function (sp) {
                        return lcbItemButton({
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

        /* 敌人路径 */
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
                    return lcbItemButton({
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

        /* 塔位 */
        if (want('buildSlot') && activeEditorMode === 'defense') {
            var bsHtml = sortCells(map.buildSlots || [])
                .map(function (c) {
                    return lcbItemButton({
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

        /* 防守目标 */
        if (want('objective')) {
            var obHtml = '';
            if (activeEditorMode === 'explore' && layout.exitPoint) {
                var op = layout.exitPoint;
                obHtml = lcbItemButton({
                    selKind: 'objective',
                    id: op.id,
                    probe: { id: op.id },
                    icon: '标',
                    title: op.name || '探索终点',
                    sub: '(' + op.col + ',' + op.row + ')'
                });
            } else if (activeEditorMode === 'defense' && map.objectivePoint) {
                var opz = map.objectivePoint;
                obHtml = lcbItemButton({
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

        /* 探索点 */
        if (want('explorePoint') && Array.isArray(map.explorationPoints) && map.explorationPoints.length) {
            var epHtml = map.explorationPoints
                .map(function (p) {
                    return lcbItemButton({
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

        /* 安全区 */
        if (want('safeZone') && activeEditorMode === 'explore') {
            var szHtml = sortCells(layout.safeZones || [])
                .map(function (c) {
                    return lcbItemButton({
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

        /* 模型 Actor */
        if (want('actor') && Array.isArray(map.actors) && map.actors.length) {
            var actHtml = map.actors
                .map(function (actor) {
                    var cat = actor.category ? String(actor.category) : '';
                    return lcbItemButton({
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

    function renderPreviewSceneOutline() {
        renderLevelContentBrowser();
        /* 侧栏大纲已迁移至预览区右侧；保留空列表避免遗留脚本报错 */
        if (refs.previewSceneOutlineList) refs.previewSceneOutlineList.innerHTML = '';
    }

    function refreshGlobalSettingsWorkbench() {
        _refreshGlobalSettingsWorkbench(refs, globalSettingsEnv());
    }

    function deleteLevelById(levelId) {
        if (!state || !levelId) return;
        var idx = state.levels.findIndex(function (l) {
            return l.id === levelId;
        });
        if (idx < 0) return;
        var name = state.levels[idx].name || levelId;
        if (!window.confirm('确定删除关卡「' + name + '」？此操作不可撤销。')) return;
        state.levels.splice(idx, 1);
        if (selectedLevelId === levelId) {
            selectedLevelId = state.levels[0] ? state.levels[0].id : '';
        }
        if (globalCutsceneEditLevelId === levelId) {
            globalCutsceneEditLevelId = '';
        }
        markDirty('已删除关卡');
        renderAll();
    }

    function focusLevelInEditor(levelId) {
        if (!levelId || !findLevelById(state.levels, levelId)) return;
        selectedLevelId = levelId;
        activeWorkbench = 'level';
        if (refs.workbenchTabs) {
            refs.workbenchTabs.querySelectorAll('[data-workbench]').forEach(function (item) {
                item.classList.toggle('active', item.getAttribute('data-workbench') === 'level');
            });
        }
        renderAll();
        var treeBtn = Array.prototype.find.call(document.querySelectorAll('[data-level-id]'), function (el) {
            return el.getAttribute('data-level-id') === levelId;
        });
        if (treeBtn && typeof treeBtn.scrollIntoView === 'function') treeBtn.scrollIntoView({ block: 'nearest' });
    }

    function renderGlobalScreenUiForm() {
        if (!state || !state.gameAssetConfig) return;
        state.gameAssetConfig.globalScreenUi = normalizeGlobalScreenUi(state.gameAssetConfig.globalScreenUi);
        var u = state.gameAssetConfig.globalScreenUi;
        var u1 = document.getElementById('gsStartScreenBgUrl');
        var u2 = document.getElementById('gsLevelSelectBgUrl');
        var c1 = document.getElementById('gsLevelSelectBgColor');
        var c2 = document.getElementById('gsLevelSelectAccentColor');
        if (u1) u1.value = u.startScreenBackgroundUrl || '';
        if (u2) u2.value = u.levelSelectBackgroundUrl || '';
        if (c1) c1.value = u.levelSelectBackgroundColor || '#0d1418';
        if (c2) c2.value = u.levelSelectAccentColor || '#8fb8ae';
    }

    function bindGlobalScreenUiPanel() {
        var root = document.getElementById('globalScreenUiBindRoot');
        if (!root || root.dataset.bound === '1') return;
        root.dataset.bound = '1';
        function su() {
            if (!state || !state.gameAssetConfig) return null;
            state.gameAssetConfig.globalScreenUi = normalizeGlobalScreenUi(state.gameAssetConfig.globalScreenUi);
            return state.gameAssetConfig.globalScreenUi;
        }
        var u1 = document.getElementById('gsStartScreenBgUrl');
        var u2 = document.getElementById('gsLevelSelectBgUrl');
        var c1 = document.getElementById('gsLevelSelectBgColor');
        var c2 = document.getElementById('gsLevelSelectAccentColor');
        if (u1) {
            u1.addEventListener('input', function () {
                var s = su();
                if (!s) return;
                s.startScreenBackgroundUrl = u1.value.trim();
                markDirty('已更新全局开始页背景');
            });
        }
        if (u2) {
            u2.addEventListener('input', function () {
                var s = su();
                if (!s) return;
                s.levelSelectBackgroundUrl = u2.value.trim();
                markDirty('已更新选关页背景图');
            });
        }
        if (c1) {
            c1.addEventListener('input', function () {
                var s = su();
                if (!s) return;
                s.levelSelectBackgroundColor = c1.value;
                markDirty('已更新选关页底色');
            });
        }
        if (c2) {
            c2.addEventListener('input', function () {
                var s = su();
                if (!s) return;
                s.levelSelectAccentColor = c2.value;
                markDirty('已更新选关页强调色');
            });
        }
        var f1 = document.getElementById('gsStartScreenBgFile');
        var f2 = document.getElementById('gsLevelSelectBgFile');
        if (f1) {
            f1.addEventListener('change', function () {
                var f = f1.files && f1.files[0];
                f1.value = '';
                if (!f) return;
                void (async function () {
                    try {
                        setStatus('正在上传开始页背景…', 'idle');
                        var url = await uploadFileToProjectUrl(f, { gameModelsUpload: true, gameModelsSubdir: 'UI' });
                        var s = su();
                        if (!s) return;
                        s.startScreenBackgroundUrl = url;
                        if (u1) u1.value = url;
                        markDirty('已上传开始页背景');
                        setStatus('已上传开始页背景', 'success');
                    } catch (err) {
                        setStatus((err && err.message) || '上传失败', 'error');
                    }
                })();
            });
        }
        if (f2) {
            f2.addEventListener('change', function () {
                var f = f2.files && f2.files[0];
                f2.value = '';
                if (!f) return;
                void (async function () {
                    try {
                        setStatus('正在上传选关页背景…', 'idle');
                        var url = await uploadFileToProjectUrl(f, { gameModelsUpload: true, gameModelsSubdir: 'UI' });
                        var s = su();
                        if (!s) return;
                        s.levelSelectBackgroundUrl = url;
                        if (u2) u2.value = url;
                        markDirty('已上传选关页背景');
                        setStatus('已上传选关页背景', 'success');
                    } catch (err) {
                        setStatus((err && err.message) || '上传失败', 'error');
                    }
                })();
            });
        }
    }

    function bindGlobalCutscenePanel() {
        _bindGlobalCutscenePanel(refs, globalSettingsEnv());
    }

    function bindGlobalSettingsChrome() {
        _bindGlobalSettingsChrome(refs, globalSettingsEnv());
    }

    function renderWorkbenchShell() {
        var gameplay = activeWorkbench === 'gameplay';
        var model = activeWorkbench === 'model';
        var level = activeWorkbench === 'level';
        var theme = activeWorkbench === 'theme';
        var globalSettings = activeWorkbench === 'globalSettings';
        if (refs.levelWorkbench) refs.levelWorkbench.classList.toggle('view-hidden', !level);
        if (refs.levelWorkbench) refs.levelWorkbench.setAttribute('aria-hidden', level ? 'false' : 'true');
        if (refs.gameplayWorkbench) {
            refs.gameplayWorkbench.classList.toggle('view-hidden', !gameplay);
            refs.gameplayWorkbench.setAttribute('aria-hidden', gameplay ? 'false' : 'true');
        }
        if (refs.modelWorkbench) {
            refs.modelWorkbench.classList.toggle('view-hidden', !model);
            refs.modelWorkbench.setAttribute('aria-hidden', model ? 'false' : 'true');
        }
        if (refs.themeWorkbench) {
            refs.themeWorkbench.classList.toggle('view-hidden', !theme);
            refs.themeWorkbench.setAttribute('aria-hidden', theme ? 'false' : 'true');
        }
        if (refs.globalSettingsWorkbench) {
            refs.globalSettingsWorkbench.classList.toggle('view-hidden', !globalSettings);
            refs.globalSettingsWorkbench.setAttribute('aria-hidden', globalSettings ? 'false' : 'true');
        }
        if (refs.btnOpenContentBrowserFloat) {
            refs.btnOpenContentBrowserFloat.classList.toggle('view-hidden', !level);
            refs.btnOpenContentBrowserFloat.setAttribute('aria-hidden', level ? 'false' : 'true');
            if (!level && isContentBrowserFloatOpen()) toggleContentBrowserFloat(false);
        }
        if (refs.levelInspectorWorkspace) refs.levelInspectorWorkspace.classList.toggle('view-hidden', !level);
        if (refs.gameplayInspectorWorkspace) {
            refs.gameplayInspectorWorkspace.classList.toggle('view-hidden', !gameplay);
            refs.gameplayInspectorWorkspace.setAttribute('aria-hidden', gameplay ? 'false' : 'true');
        }
        if (refs.modelInspectorWorkspace) {
            refs.modelInspectorWorkspace.classList.toggle('view-hidden', !model);
            refs.modelInspectorWorkspace.setAttribute('aria-hidden', model ? 'false' : 'true');
        }
        if (refs.themeInspectorWorkspace) {
            refs.themeInspectorWorkspace.classList.toggle('view-hidden', !theme);
            refs.themeInspectorWorkspace.setAttribute('aria-hidden', theme ? 'false' : 'true');
        }
        if (refs.globalSettingsInspectorWorkspace) {
            refs.globalSettingsInspectorWorkspace.classList.toggle('view-hidden', !globalSettings);
            refs.globalSettingsInspectorWorkspace.setAttribute('aria-hidden', globalSettings ? 'false' : 'true');
        }
        if (refs.workbenchTabs) {
            refs.workbenchTabs.querySelectorAll('[data-workbench]').forEach(function (item) {
                item.classList.toggle('active', item.getAttribute('data-workbench') === activeWorkbench);
            });
        }
        if (refs.levelSummary) {
            if (gameplay) {
                refs.levelSummary.textContent = '按当前关卡/城市维护敌人、防御塔、卡片、角色、技能与项目资源目录。';
            } else if (model) {
                refs.levelSummary.textContent = '统一管理项目模型资产，按分类浏览、预览和上传替换。';
            } else if (theme) {
                refs.levelSummary.textContent = '编辑当前关卡的棋盘颜色、贴图与半透明参数，与主游戏运行时地图一致。';
            } else if (globalSettings) {
                refs.levelSummary.textContent =
                    '全局设置：在中间主区域切换子标签，编辑关卡、过场、音效与 UI 背景；保存写入项目 JSON。';
            } else {
                refs.levelSummary.textContent = '自动生成关卡骨架，自由布置塔防与第三人称探索地图。';
            }
        }
        if (!gameplay) disposeGameplayAssetPreview();
        if (!model) disposeModelAssetPreview();
        if (globalSettings) refreshGlobalSettingsWorkbench();
    }

    function swatchIdToInputRef(swatchForId) {
        if (!swatchForId || !refs.themeEditorForm) return null;
        var map = {
            themeGround: refs.themeGround,
            themeGroundAlt: refs.themeGroundAlt,
            themePath: refs.themePath,
            themeObstacle: refs.themeObstacle,
            themeAccent: refs.themeAccent,
            themeFog: refs.themeFog,
            themeHoverOk: refs.themeHoverOk,
            themeHoverBad: refs.themeHoverBad
        };
        return map[swatchForId] || document.getElementById(swatchForId);
    }

    function syncThemeColorSwatches() {
        if (!refs.themeEditorForm) return;
        refs.themeEditorForm.querySelectorAll('[data-theme-swatch-for]').forEach(function (btn) {
            var sid = btn.getAttribute('data-theme-swatch-for');
            var inp = swatchIdToInputRef(sid);
            if (!inp || inp.type !== 'color') return;
            var hex = inp.value || '#000000';
            btn.style.backgroundColor = hex;
        });
    }

    function applyThemeWorkbenchTabUi() {
        if (activeWorkbench !== 'theme') return;
        var tab = activeThemeWorkbenchTab === 'cutscenes' ? 'cutscenes' : 'colors';
        activeThemeWorkbenchTab = tab;
        var tabsRoot = document.getElementById('themeWorkbenchSubTabs');
        if (tabsRoot) {
            tabsRoot.querySelectorAll('[data-theme-workbench-tab]').forEach(function (btn) {
                var on = btn.getAttribute('data-theme-workbench-tab') === tab;
                btn.classList.toggle('active', on);
                btn.setAttribute('aria-selected', on ? 'true' : 'false');
            });
        }
        var colorsPanel = document.getElementById('themeTabPanelColors');
        var cutPanel = document.getElementById('themeTabPanelCutscenes');
        if (colorsPanel) {
            var showColors = tab === 'colors';
            colorsPanel.classList.toggle('view-hidden', !showColors);
            colorsPanel.setAttribute('aria-hidden', showColors ? 'false' : 'true');
        }
        if (cutPanel) {
            var showCut = tab === 'cutscenes';
            cutPanel.classList.toggle('view-hidden', !showCut);
            cutPanel.setAttribute('aria-hidden', showCut ? 'false' : 'true');
        }
        if (tab === 'cutscenes') renderCutsceneEditor();
        else syncThemeColorSwatches();
    }

    function setThemeWorkbenchTab(tabId) {
        activeThemeWorkbenchTab = tabId === 'cutscenes' ? 'cutscenes' : 'colors';
        applyThemeWorkbenchTabUi();
    }

    function fillThemeFormFromLevel() {
        if (!refs.themeGround) return;
        var level = getLevel();
        if (!level || !level.map) {
            if (refs.themeWorkbenchTitle) refs.themeWorkbenchTitle.textContent = '请选择关卡';
            return;
        }
        if (refs.themeWorkbenchTitle) refs.themeWorkbenchTitle.textContent = level.name || '棋盘主题';
        var t =
            activeThemeScope === 'explore'
                ? normalizeTheme(ensureExplorationLayout(level.map).theme)
                : normalizeTheme(level.map.theme);
        refs.themeGround.value = themeColorInput(t.ground);
        refs.themeGroundAlt.value = themeColorInput(t.groundAlt);
        refs.themePath.value = themeColorInput(t.path);
        refs.themeObstacle.value = themeColorInput(t.obstacle);
        refs.themeAccent.value = themeColorInput(t.accent);
        refs.themeFog.value = themeColorInput(t.fog);
        refs.themeHoverOk.value = themeColorInput(t.hoverColorOk);
        refs.themeHoverBad.value = themeColorInput(t.hoverColorBad);
        refs.themeBoardTextureUrl.value = t.boardTextureUrl || '';
        refs.themeGeoTileOpacity.value = String(t.geoTileOpacity);
        refs.themeGeoPathOpacity.value = String(t.geoPathOpacity);
        refs.themeBoardBaseOpacity.value = String(t.boardBaseOpacity);
        refs.themeGridLineOpacity.value = String(t.gridLineOpacity);
        refs.themeRimOpacity.value = String(t.rimOpacity);
        refs.themePathGlowOpacity.value = String(t.pathGlowOpacity);
        refs.themePathDetailOpacity.value = String(t.pathDetailOpacity);
        refs.themeHoverCellOpacity.value = String(t.hoverCellOpacity);
        syncThemeColorSwatches();
    }

    function readThemeFormToLevel() {
        if (!refs.themeGround) return;
        var level = getLevel();
        if (!level || !level.map) return;
        var raw = {
            ground: refs.themeGround.value,
            groundAlt: refs.themeGroundAlt.value,
            road: refs.themePath.value,
            path: refs.themePath.value,
            obstacle: refs.themeObstacle.value,
            accent: refs.themeAccent.value,
            fog: refs.themeFog.value,
            boardTextureUrl: refs.themeBoardTextureUrl.value,
            geoTileOpacity: refs.themeGeoTileOpacity.value,
            geoPathOpacity: refs.themeGeoPathOpacity.value,
            boardBaseOpacity: refs.themeBoardBaseOpacity.value,
            gridLineOpacity: refs.themeGridLineOpacity.value,
            rimOpacity: refs.themeRimOpacity.value,
            pathGlowOpacity: refs.themePathGlowOpacity.value,
            pathDetailOpacity: refs.themePathDetailOpacity.value,
            hoverCellOpacity: refs.themeHoverCellOpacity.value,
            hoverColorOk: refs.themeHoverOk.value,
            hoverColorBad: refs.themeHoverBad.value
        };
        var next = normalizeTheme(raw);
        if (activeThemeScope === 'explore') {
            ensureExplorationLayout(level.map).theme = next;
        } else {
            level.map.theme = next;
        }
        markDirty('已更新棋盘主题');
        syncThemeColorSwatches();
        if (activeWorkbench === 'level') renderMap();
        if (previewApi && typeof previewApi.refresh === 'function') previewApi.refresh({ preserveView: true });
    }

    async function revealProjectPathInExplorer(projectPath) {
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
        setStatus('已在资源管理器中定位视频文件', 'success');
    }

    /** 获取或初始化当前关卡的 cutscenes 对象 */
    function ensureLevelCutscenes() {
        var level = getLevel();
        if (!level || !level.map) return null;
        if (!level.map.cutscenes) level.map.cutscenes = {};
        return level.map.cutscenes;
    }

    /** 渲染过场视频面板（在 theme 工作台下） */
    function renderCutsceneEditor() {
        if (!refs.introVideoInfo) return;
        var level = getLevel();
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

        // 开场视频标题
        if (refs.introVideoTitle) refs.introVideoTitle.value = intro.title || '';

        // 波次视频列表
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

    /** 绑定过场视频面板的事件（只绑一次，通过委托处理动态行） */
    function bindCutsceneEditorEvents() {
        // 开场视频上传
        if (refs.introVideoFile) {
            refs.introVideoFile.addEventListener('change', async function () {
                var file = refs.introVideoFile.files && refs.introVideoFile.files[0];
                if (!file) return;
                try {
                    setStatus('正在上传开场视频 ' + file.name + '…', 'idle');
                    var up = await uploadVideoFile(file, getLevel());
                    var cutscenes = ensureLevelCutscenes();
                    if (!cutscenes) return;
                    cutscenes.introVideo = { url: up.url };
                    if (up.projectPath) cutscenes.introVideo.projectPath = up.projectPath;
                    var titleTrim = (refs.introVideoTitle && refs.introVideoTitle.value.trim()) || '';
                    if (titleTrim) cutscenes.introVideo.title = titleTrim;
                    else delete cutscenes.introVideo.title;
                    refs.introVideoFile.value = '';
                    markDirty('已上传开场视频');
                    renderCutsceneEditor();
                    renderGlobalCutsceneOverview();
                    setStatus('开场视频已上传', 'idle');
                } catch (err) {
                    refs.introVideoFile.value = '';
                    setStatus('视频上传失败: ' + err.message, 'error');
                }
            });
        }

        // 开场视频标题实时保存
        if (refs.introVideoTitle) {
            refs.introVideoTitle.addEventListener('change', function () {
                var cutscenes = ensureLevelCutscenes();
                if (!cutscenes || !cutscenes.introVideo) return;
                var t = refs.introVideoTitle.value.trim();
                if (t) {
                    cutscenes.introVideo.title = t;
                } else {
                    delete cutscenes.introVideo.title;
                }
                markDirty('已更新开场视频标题');
            });
        }

        // 清除开场视频
        if (refs.btnClearIntroVideo) {
            refs.btnClearIntroVideo.addEventListener('click', function () {
                var cutscenes = ensureLevelCutscenes();
                if (!cutscenes) return;
                delete cutscenes.introVideo;
                markDirty('已清除开场视频');
                renderCutsceneEditor();
                renderGlobalCutsceneOverview();
            });
        }
        if (refs.btnOpenIntroVideoLocation && refs.btnOpenIntroVideoLocation.dataset.bound !== '1') {
            refs.btnOpenIntroVideoLocation.dataset.bound = '1';
            refs.btnOpenIntroVideoLocation.addEventListener('click', function () {
                var level = getLevel();
                var intro = level && level.map && level.map.cutscenes && level.map.cutscenes.introVideo;
                var p = effectiveCutsceneVideoProjectPath(intro);
                if (!p) {
                    setStatus('无法定位项目内文件：请使用「上传开场视频」写入 public 目录', 'error');
                    return;
                }
                void revealProjectPathInExplorer(p).catch(function (err) {
                    setStatus((err && err.message) || '打开资源管理器失败', 'error');
                });
            });
        }

        // 添加波次视频条目
        if (refs.btnAddWaveVideo) {
            refs.btnAddWaveVideo.addEventListener('click', function () {
                var cutscenes = ensureLevelCutscenes();
                if (!cutscenes) return;
                if (!Array.isArray(cutscenes.waveVideos)) cutscenes.waveVideos = [];
                // 找下一个未使用的波次序号
                var usedWaves = cutscenes.waveVideos.map(function (w) { return w.afterWave; });
                var nextWave = 1;
                while (usedWaves.indexOf(nextWave) !== -1) nextWave++;
                cutscenes.waveVideos.push({ afterWave: nextWave, url: '' });
                markDirty('已新增波次视频槽');
                renderCutsceneEditor();
            });
        }

        // 波次视频列表：委托处理所有子元素事件
        if (refs.waveVideoList) {
            // 波次输入变更
            refs.waveVideoList.addEventListener('change', function (e) {
                var target = e.target;
                var idx = parseInt(target.getAttribute('data-wv-idx') || '', 10);
                if (isNaN(idx)) return;
                var cutscenes = ensureLevelCutscenes();
                if (!cutscenes || !Array.isArray(cutscenes.waveVideos) || !cutscenes.waveVideos[idx]) return;
                if (target.classList.contains('wv-wave-input')) {
                    cutscenes.waveVideos[idx].afterWave = Math.max(1, parseInt(target.value, 10) || 1);
                    markDirty('已更新波次');
                } else if (target.classList.contains('wv-title-input')) {
                    var t = target.value.trim();
                    if (t) { cutscenes.waveVideos[idx].title = t; } else { delete cutscenes.waveVideos[idx].title; }
                    markDirty('已更新波次视频标题');
                } else if (target.classList.contains('wv-file-input') && target.files && target.files[0]) {
                    var fileInner = target.files[0];
                    var idxInner = parseInt(target.getAttribute('data-wv-idx') || '', 10);
                    void (async function () {
                        try {
                            setStatus('正在上传波次视频 ' + fileInner.name + '…', 'idle');
                            var up = await uploadVideoFile(fileInner, getLevel());
                            var cs = ensureLevelCutscenes();
                            if (cs && Array.isArray(cs.waveVideos) && cs.waveVideos[idxInner]) {
                                cs.waveVideos[idxInner].url = up.url;
                                if (up.projectPath) cs.waveVideos[idxInner].projectPath = up.projectPath;
                                else delete cs.waveVideos[idxInner].projectPath;
                                markDirty('已上传波次视频');
                                renderCutsceneEditor();
                                renderGlobalCutsceneOverview();
                                setStatus('波次视频已上传', 'idle');
                            }
                            target.value = '';
                        } catch (err) {
                            target.value = '';
                            setStatus('波次视频上传失败: ' + err.message, 'error');
                        }
                    })();
                }
            });

            // 删除波次视频条目
            refs.waveVideoList.addEventListener('click', function (e) {
                var btn = e.target.closest('.wv-remove-btn');
                if (!btn) return;
                var idx = parseInt(btn.getAttribute('data-wv-idx') || '', 10);
                if (isNaN(idx)) return;
                var cutscenes = ensureLevelCutscenes();
                if (!cutscenes || !Array.isArray(cutscenes.waveVideos)) return;
                cutscenes.waveVideos.splice(idx, 1);
                if (cutscenes.waveVideos.length === 0) delete cutscenes.waveVideos;
                markDirty('已删除波次视频');
                renderCutsceneEditor();
            });
        }
    }

    /**
     * 上传视频文件到项目视频目录，返回 publicUrl。
     * 优先使用城市上下文（/api/editor-assets），否则回退到 /api/upload-video。
     */
    async function uploadVideoFile(file, levelForCityContext) {
        var content = await fileToBase64(file);
        var levelCtx = levelForCityContext || getLevel();
        var cityContext = levelVideoCityContext(levelCtx) || getGameplayCityContext();
        if (cityContext) {
            var requestBody = {
                name: file.name,
                content: content,
                cityCode: cityContext.cityCode,
                cityName: cityContext.cityName,
                assetType: 'LevelVideos',
                resourceKind: 'cutscene-video',
                assetName: file.name.replace(/\.[^.]+$/, '')
            };
            var res = await fetch('/api/editor-assets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            var resText = await res.text();
            if (!res.ok) throw new Error(parseFetchErrorBody(res.status, resText));
            var payload = {};
            try {
                payload = JSON.parse(resText);
            } catch (e) {
                throw new Error('服务器返回非 JSON');
            }
            rememberEditorAsset(payload, requestBody.resourceKind);
            var outA = {
                url: String(payload.publicUrl || '').trim(),
                projectPath: String(payload.projectPath || '').trim()
            };
            if (!outA.url) throw new Error('上传接口未返回有效的 publicUrl');
            return outA;
        }
        var res2 = await fetch('/api/upload-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: file.name, content: content })
        });
        var resText2 = await res2.text();
        if (!res2.ok) throw new Error(parseFetchErrorBody(res2.status, resText2));
        var payload2 = {};
        try {
            payload2 = JSON.parse(resText2);
        } catch (e) {
            throw new Error('服务器返回非 JSON');
        }
        var outB = {
            url: String(payload2.url || '').trim(),
            projectPath: String(payload2.projectPath || '').trim()
        };
        if (!outB.url) throw new Error('上传接口未返回有效的 url');
        return outB;
    }

    function renderThemeEditor() {
        if (activeWorkbench !== 'theme') return;
        var key = selectedLevelId + '|' + activeThemeScope;
        if (!refs.themeGround) return;
        if (themeEditorCacheKey !== key) {
            themeEditorCacheKey = key;
            fillThemeFormFromLevel();
        }
        if (refs.themeScopeSelect) refs.themeScopeSelect.value = activeThemeScope;
        applyThemeWorkbenchTabUi();
    }

    function renderGameplayEditor() {
        var cityContext = getGameplayCityContext();
        var config = cityContext ? ensureCityGameplayConfig(cityContext) : null;
        if (config) {
            var preferredTab = pickPreferredGameplayTab(config, activeGameplayTab);
            if (preferredTab !== activeGameplayTab) {
                activeGameplayTab = preferredTab;
                if (refs.gameplayResourceTabs) {
                    refs.gameplayResourceTabs.querySelectorAll('[data-gameplay-tab]').forEach(function (item) {
                        item.classList.toggle('active', item.getAttribute('data-gameplay-tab') === activeGameplayTab);
                    });
                }
            }
        }
        var collection = config ? config[activeGameplayTab] : [];
        var keyword = refs.gameplaySearch ? String(refs.gameplaySearch.value || '').trim().toLowerCase() : '';
        var filtered = collection.filter(function (entry) {
            if (!keyword) return true;
            var haystack = [entry.name, entry.id, entry.summary].concat(entry.tags || []).join(' ').toLowerCase();
            return haystack.indexOf(keyword) !== -1;
        });
        if (refs.gameplayCityTitle) refs.gameplayCityTitle.textContent = cityContext ? cityContext.cityName + ' · 卡片/玩法编辑器' : '请选择带城市信息的关卡';
        if (refs.gameplayCityMeta) refs.gameplayCityMeta.textContent = cityContext ? '当前城市代码：' + cityContext.cityCode + '，保存后会写入该关卡可用卡片、防御塔与城市资源。' : '先在左侧选择一个城市关卡，然后维护该关卡的敌人、防御塔、卡片、角色和技能。';
        if (refs.gameplayOverviewStats) {
            refs.gameplayOverviewStats.innerHTML = cityContext
                ? [
                    { label: '敌人', value: config.enemies.length },
                    { label: '防御塔', value: config.towers.length },
                    { label: '卡片', value: config.cards.length },
                    { label: '角色', value: config.characters.length },
                    { label: '技能', value: config.skills.length }
                ].map(function (card) {
                    return '<div class="stat-card"><strong>' + escapeHtml(String(card.value)) + '</strong><span>' + escapeHtml(card.label) + '</span></div>';
                }).join('')
                : '';
        }
        renderGameplayEntryList(filtered, cityContext);
        renderGameplayForm(filtered, cityContext, config);
        renderGameplayInspector(cityContext, config, filtered);
    }

    function getModelsByCategory(category) {
        var assets = getBrowsableModelAssets();
        if (category === 'all') return assets;
        var folder = MODEL_CATEGORY_CONFIG[category] ? MODEL_CATEGORY_CONFIG[category].folder : '';
        if (!folder) return [];
        return assets.filter(function (asset) {
            return getModelAssetCategoryFolder(asset).toLowerCase() === folder.toLowerCase();
        });
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

    function renderModelEditor() {
        if (activeWorkbench !== 'model') return;
        var allAssets = getBrowsableModelAssets();
        var categoryAssets = getModelsByCategory(activeModelCategory);
        var keyword = refs.modelSearch ? String(refs.modelSearch.value || '').trim().toLowerCase() : '';
        var filtered = categoryAssets.filter(function (asset) {
            if (!keyword) return true;
            var haystack = [asset.name, asset.id, asset.summary, asset.path].join(' ').toLowerCase();
            return haystack.indexOf(keyword) !== -1;
        });

        var counts = {};
        Object.keys(MODEL_CATEGORY_CONFIG).forEach(function (key) {
            if (key === 'all') {
                counts[key] = allAssets.length;
            } else {
                counts[key] = getModelsByCategory(key).length;
            }
        });

        if (refs.modelOverviewStats) {
            refs.modelOverviewStats.innerHTML = Object.keys(MODEL_CATEGORY_CONFIG).map(function (key) {
                var cfg = MODEL_CATEGORY_CONFIG[key];
                return '<div class="stat-card"><strong>' + escapeHtml(String(counts[key] || 0)) + '</strong><span>' + escapeHtml(cfg.label) + '</span></div>';
            }).join('');
        }

        if (refs.modelListCount) {
            refs.modelListCount.textContent = '共 ' + filtered.length + ' 项';
        }

        if (refs.modelEntryList) {
            if (!filtered.length) {
                refs.modelEntryList.innerHTML = '<div class="empty-state">当前分类暂无模型。点击右侧「上传新模型」或扫描 public/GameModels。</div>';
            } else {
                if (!selectedModelId || !filtered.some(function (a) { return a.id === selectedModelId; })) {
                    selectedModelId = filtered[0].id;
                }
                refs.modelEntryList.innerHTML = filtered.map(function (asset) {
                    var active = asset.id === selectedModelId ? ' active' : '';
                    var cat = String(asset.summary || asset.relativePath || '');
                    var folder = getModelAssetCategoryFolder(asset);
                    var matchedKey = Object.keys(MODEL_CATEGORY_CONFIG).find(function (k) {
                        return k !== 'all' && MODEL_CATEGORY_CONFIG[k].folder.toLowerCase() === folder.toLowerCase();
                    });
                    var catLabel = matchedKey ? MODEL_CATEGORY_CONFIG[matchedKey].label : (folder || '未分类');
                    return [
                        '<button type="button" class="list-item gameplay-entry-card' + active + '" data-model-id="' + escapeAttr(asset.id) + '">',
                        '  <strong>' + escapeHtml(asset.name) + '</strong>',
                        '  <span>' + escapeHtml(cat) + '</span>',
                        '  <div class="gameplay-entry-meta">',
                        '    <span class="gameplay-chip">' + escapeHtml(catLabel) + '</span>',
                        '  </div>',
                        '</button>'
                    ].join('');
                }).join('');
            }
        }

        var selected = filtered.find(function (a) { return a.id === selectedModelId; }) || null;
        renderModelDetail(selected);
        renderModelInspector(counts);
    }

    function renderModelDetail(asset) {
        if (refs.modelDetailTitle) refs.modelDetailTitle.textContent = asset ? asset.name : '模型详情';
        if (refs.modelDetailMeta) refs.modelDetailMeta.textContent = asset ? '已选择' : '未选择';
        if (refs.modelDetailName) refs.modelDetailName.value = asset ? asset.name : '';
        var catLabel = '';
        if (asset) {
            var firstDir = getModelAssetCategoryFolder(asset);
            var matchedKey = Object.keys(MODEL_CATEGORY_CONFIG).find(function (k) {
                return k !== 'all' && MODEL_CATEGORY_CONFIG[k].folder.toLowerCase() === firstDir.toLowerCase();
            });
            catLabel = matchedKey ? MODEL_CATEGORY_CONFIG[matchedKey].label : (firstDir || '未分类');
        }
        if (refs.modelDetailCategory) refs.modelDetailCategory.value = catLabel;
        if (refs.modelDetailPath) refs.modelDetailPath.value = asset ? (asset.path || asset.publicUrl || '') : '';

        if (refs.modelPreviewEmpty) refs.modelPreviewEmpty.classList.toggle('view-hidden', !!asset);
        if (refs.modelPreviewHost) refs.modelPreviewHost.classList.toggle('view-hidden', !asset);
        if (refs.modelPreviewMeta) refs.modelPreviewMeta.textContent = asset ? (asset.name + ' · 模型预览') : '未绑定模型';

        if (!asset) {
            disposeModelAssetPreview();
            return;
        }
        ensureModelAssetPreview(asset.publicUrl || asset.path || '');
    }

    function ensureModelAssetPreview(modelUrl) {
        if (!refs.modelPreviewHost) return;
        if (!modelUrl) return;
        if (!modelAssetPreviewApi) {
            var generation = (modelPreviewInitGeneration += 1);
            import('./gameplay-asset-preview.js').then(function (mod) {
                if (generation !== modelPreviewInitGeneration || !refs.modelPreviewHost) return;
                modelAssetPreviewApi = mod.createGameplayAssetPreview({ host: refs.modelPreviewHost });
                modelAssetPreviewApi.setAsset(modelUrl);
            }).catch(function (error) {
                setStatus('模型预览初始化失败: ' + error.message, 'error');
            });
            return;
        }
        modelAssetPreviewApi.setAsset(modelUrl);
    }

    function renderModelInspector(counts) {
        if (!refs.modelInspectorStats) return;
        refs.modelInspectorStats.innerHTML = Object.keys(MODEL_CATEGORY_CONFIG).map(function (key) {
            var cfg = MODEL_CATEGORY_CONFIG[key];
            return [
                '<button type="button" class="list-item" data-inspector-category="' + escapeAttr(key) + '" style="cursor:pointer">',
                '  <strong>' + escapeHtml(cfg.label) + '</strong>',
                '  <span>' + escapeHtml(String(counts[key] || 0)) + ' 个模型</span>',
                '</button>'
            ].join('');
        }).join('');

        refs.modelInspectorStats.querySelectorAll('[data-inspector-category]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                activeModelCategory = btn.getAttribute('data-inspector-category') || 'all';
                selectedModelId = '';
                if (refs.modelCategoryTabs) {
                    refs.modelCategoryTabs.querySelectorAll('[data-model-category]').forEach(function (item) {
                        item.classList.toggle('active', item.getAttribute('data-model-category') === activeModelCategory);
                    });
                }
                renderModelEditor();
            });
        });
    }

    async function replaceSelectedModel(file) {
        var selected = getModelsByCategory(activeModelCategory).find(function (a) { return a.id === selectedModelId; });
        if (!selected) {
            setStatus('请先选择一个要替换的模型。', 'error');
            refs.modelUploadReplace.value = '';
            return;
        }
        var subdir = getModelAssetCategoryFolder(selected);
        try {
            setStatus('正在替换模型 ' + file.name + '…', 'idle');
            var content = await fileToBase64(file);
            var res = await fetch('/api/game-models/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: file.name,
                    content: content,
                    subdirectory: subdir
                })
            });
            var resText = await res.text();
            if (!res.ok) throw new Error(parseFetchErrorBody(res.status, resText));
            var payload = JSON.parse(resText);
            await refreshGameModelsCatalog();
            selectedModelId = '';
            refs.modelUploadReplace.value = '';
            markDirty('已替换模型');
            renderModelEditor();
            setStatus('模型已替换: ' + String(payload.projectPath || ''), 'success');
        } catch (error) {
            refs.modelUploadReplace.value = '';
            setStatus('模型替换失败: ' + error.message, 'error');
        }
    }

    async function uploadNewModelFromInspector(file) {
        var category = refs.modelInspectorUploadCategory ? refs.modelInspectorUploadCategory.value : 'Enemy';
        var nameHint = refs.modelInspectorUploadName ? String(refs.modelInspectorUploadName.value || '').trim() : '';
        var subdir = String(category || '');
        var uploadName = nameHint || file.name;
        try {
            setStatus('正在上传新模型 ' + uploadName + '…', 'idle');
            var content = await fileToBase64(file);
            var res = await fetch('/api/game-models/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: uploadName + (file.name.match(/\.[^.]+$/) ? '' : '.glb'),
                    content: content,
                    subdirectory: subdir
                })
            });
            var resText = await res.text();
            if (!res.ok) throw new Error(parseFetchErrorBody(res.status, resText));
            var payload = JSON.parse(resText);
            await refreshGameModelsCatalog();
            if (refs.modelInspectorUploadName) refs.modelInspectorUploadName.value = '';
            if (refs.modelInspectorUpload) refs.modelInspectorUpload.value = '';
            activeModelCategory = category;
            selectedModelId = '';
            if (refs.modelCategoryTabs) {
                refs.modelCategoryTabs.querySelectorAll('[data-model-category]').forEach(function (item) {
                    item.classList.toggle('active', item.getAttribute('data-model-category') === activeModelCategory);
                });
            }
            markDirty('已上传新模型');
            renderModelEditor();
            setStatus('新模型已保存: ' + String(payload.projectPath || ''), 'success');
        } catch (error) {
            if (refs.modelInspectorUpload) refs.modelInspectorUpload.value = '';
            setStatus('模型上传失败: ' + error.message, 'error');
        }
    }

    function closeAllGameplayEntryMenus() {
        if (!refs.gameplayEntryList) return;
        refs.gameplayEntryList.querySelectorAll('[data-gameplay-menu-toggle]').forEach(function (btn) {
            btn.setAttribute('aria-expanded', 'false');
        });
        refs.gameplayEntryList.querySelectorAll('.gameplay-entry-menu').forEach(function (menu) {
            menu.classList.add('view-hidden');
        });
    }

    function renderGameplayEntryList(entries, cityContext) {
        if (!refs.gameplayEntryList) return;
        if (!cityContext) {
            refs.gameplayEntryList.innerHTML = '<div class="empty-state">先从左侧选中一个城市关卡，玩法编辑器会自动切到该城市的资源库。</div>';
            return;
        }
        if (!entries.length) {
            refs.gameplayEntryList.innerHTML = '<div class="empty-state">' + GAMEPLAY_RESOURCE_CONFIG[activeGameplayTab].empty + '</div>';
            return;
        }
        if (!selectedGameplayEntryId || !entries.some(function (entry) { return entry.id === selectedGameplayEntryId; })) {
            selectedGameplayEntryId = entries[0].id;
        }
        refs.gameplayEntryList.innerHTML = entries.map(function (entry) {
            var thumb = resolveGameplayEntryThumbnail(entry);
            return [
                '<div class="list-item gameplay-entry-card' + (entry.id === selectedGameplayEntryId ? ' active' : '') + '">',
                thumb
                    ? '  <button type="button" class="gameplay-entry-thumb-btn" data-gameplay-select-id="' + escapeAttr(entry.id) + '" title="选择此条目">'
                        + '<img class="gameplay-asset-thumb" src="' + escapeAttr(thumb) + '" alt="' + escapeAttr(entry.name) + '">'
                        + '</button>'
                    : '',
                '  <div class="gameplay-entry-main">',
                '    <div class="gameplay-entry-title-row">',
                '      <button type="button" class="gameplay-entry-select" data-gameplay-select-id="' + escapeAttr(entry.id) + '">' + escapeHtml(entry.name) + '</button>',
                '      <div class="gameplay-entry-menu-anchor">',
                '        <button type="button" class="mini-button gameplay-entry-ops-btn" data-gameplay-menu-toggle aria-expanded="false">操作</button>',
                '        <div class="gameplay-entry-menu view-hidden" role="menu">',
                '          <button type="button" role="menuitem" class="gameplay-entry-menu-item" data-gameplay-action="move-up" data-gameplay-entry-id="' + escapeAttr(entry.id) + '">上移</button>',
                '          <button type="button" role="menuitem" class="gameplay-entry-menu-item" data-gameplay-action="move-down" data-gameplay-entry-id="' + escapeAttr(entry.id) + '">下移</button>',
                '          <button type="button" role="menuitem" class="gameplay-entry-menu-item" data-gameplay-action="duplicate" data-gameplay-entry-id="' + escapeAttr(entry.id) + '">复制</button>',
                '          <button type="button" role="menuitem" class="gameplay-entry-menu-item danger" data-gameplay-action="delete" data-gameplay-entry-id="' + escapeAttr(entry.id) + '">删除</button>',
                '        </div>',
                '      </div>',
                '    </div>',
                '    <span class="gameplay-entry-summary">' + escapeHtml(entry.summary || '未填写简介') + '</span>',
                '    <div class="gameplay-entry-meta">',
                '      <span class="gameplay-chip">' + escapeHtml(entry.rarity || 'common') + '</span>',
                '      <span class="gameplay-chip">' + escapeHtml((entry.tags || []).join(' / ') || cityContext.cityName) + '</span>',
                entry.placement ? '      <span class="gameplay-chip">' + escapeHtml(gameplayPlacementLabel(entry.placement)) + '</span>' : '',
                '    </div>',
                '  </div>',
                '</div>'
            ].join('');
        }).join('');
    }

    function renderGameplayForm(entries, cityContext) {
        var entry = getSelectedGameplayEntry(entries);
        var disabled = !entry;
        if (refs.gameplayEditorTitle) refs.gameplayEditorTitle.textContent = entry ? entry.name : (GAMEPLAY_RESOURCE_CONFIG[activeGameplayTab].label + '详情');
        if (refs.gameplayEditorHint) refs.gameplayEditorHint.textContent = cityContext ? cityContext.cityName + ' · ' + GAMEPLAY_RESOURCE_CONFIG[activeGameplayTab].label : '城市玩法配置';
        if (refs.gameplayName) refs.gameplayName.value = entry ? entry.name : '';
        if (refs.gameplayId) refs.gameplayId.value = entry ? entry.id : '';
        if (refs.gameplayTags) refs.gameplayTags.value = entry ? (entry.tags || []).join(', ') : '';
        if (refs.gameplayRarity) refs.gameplayRarity.value = entry ? entry.rarity : '';
        if (refs.gameplaySummary) refs.gameplaySummary.value = entry ? entry.summary : '';
        [refs.gameplayName, refs.gameplayId, refs.gameplayTags, refs.gameplayRarity, refs.gameplaySummary].forEach(function (field) {
            if (field) field.disabled = disabled;
        });
        setGameplayEntryActionButtons(disabled, entries, entry);
        if (refs.gameplayStatGrid) {
            var statsHtml = GAMEPLAY_RESOURCE_CONFIG[activeGameplayTab].stats.map(function (field) {
                var value = entry && entry.stats ? entry.stats[field.key] : '';
                return [
                    '<label class="field-block">',
                    '  <span>' + escapeHtml(field.label) + '</span>',
                    '  <input type="number" data-gameplay-stat="' + escapeAttr(field.key) + '" step="' + escapeAttr(field.step) + '" value="' + escapeAttr(value === '' || value == null ? '' : String(value)) + '"' + (disabled ? ' disabled' : '') + '>',
                    '</label>'
                ].join('');
            }).join('');
            var placementHtml = activeGameplayTab === 'characters' || activeGameplayTab === 'towers'
                ? [
                    '<label class="field-block">',
                    '  <span>部署位置</span>',
                    '  <select data-gameplay-placement' + (disabled ? ' disabled' : '') + '>',
                    '    <option value="roadside"' + (!entry || entry.placement !== 'road' ? ' selected' : '') + '>道路两侧</option>',
                    '    <option value="road"' + (entry && entry.placement === 'road' ? ' selected' : '') + '>道路上</option>',
                    '  </select>',
                    '</label>'
                ].join('')
                : '';
            refs.gameplayStatGrid.innerHTML = statsHtml + placementHtml;
        }
    }

    function renderGameplayInspector(cityContext, config, entries) {
        var entry = getSelectedGameplayEntry(entries);
        var assetType = refs.gameplayAssetType ? refs.gameplayAssetType.value : GAMEPLAY_RESOURCE_CONFIG[activeGameplayTab].assetType;
        var assets = cityContext ? getGameplayAssets(cityContext, assetType) : [];
        if (refs.gameplayAssetType && (!refs.gameplayAssetType.value || refs.gameplayAssetType.value === '')) {
            refs.gameplayAssetType.value = GAMEPLAY_RESOURCE_CONFIG[activeGameplayTab].assetType;
        }
        if (refs.gameplayAssetName && !refs.gameplayAssetName.value && entry) refs.gameplayAssetName.value = entry.name;
        if (refs.gameplayInspectorMeta) refs.gameplayInspectorMeta.textContent = cityContext ? '当前城市：' + cityContext.cityName + '（' + cityContext.cityCode + '）' : '先从左侧关卡树选择一个城市关卡，再在这里维护该关卡的敌人、防御塔、卡片、角色和技能。';
        if (refs.gameplaySelectionMeta) {
            refs.gameplaySelectionMeta.innerHTML = cityContext ? [
                '<div class="list-item"><strong>城市代码</strong><span>' + escapeHtml(cityContext.cityCode) + '</span></div>',
                '<div class="gameplay-inspector-counts" role="group" aria-label="敌人、防御塔、卡片、角色、技能数量">',
                [['敌人', config.enemies.length], ['防御塔', config.towers.length], ['卡片', config.cards.length], ['角色', config.characters.length], ['技能', config.skills.length]].map(function (pair) {
                    return '<span class="gic-chip"><strong>' + String(pair[1]) + '</strong><span>' + escapeHtml(pair[0]) + '</span></span>';
                }).join(''),
                '</div>',
                '<div class="list-item"><strong>当前选择</strong><span>' + escapeHtml(entry ? entry.name : '未选择条目') + '</span></div>',
                '<div class="list-item"><strong>模型 / 图片</strong><span>' + escapeHtml(entry ? String(entry.assetRefs.modelPath || '未绑定') + ' / ' + String(entry.assetRefs.imagePath || '未绑定') : '未绑定') + '</span></div>'
            ].join('') : '<div class="empty-state">没有可编辑的城市。</div>';
        }
        if (!refs.gameplayAssetList) return;
        if (!cityContext) {
            refs.gameplayAssetList.innerHTML = '<div class="empty-state">请选择城市后再上传资源。</div>';
            renderGameplayAssetPreview(null, entry);
            return;
        }
        if (!assets.length) {
            refs.gameplayAssetList.innerHTML = '<div class="empty-state">当前分类下还没有项目资源。上传后会写入 public/Arts/' + escapeHtml(assetType) + '/' + escapeHtml(cityContext.cityName) + '/</div>';
            renderGameplayAssetPreview(null, entry);
            return;
        }
        refs.gameplayAssetList.innerHTML = assets.map(function (asset) {
            var isImage = isImageAssetPath(asset.publicUrl || asset.path);
            return [
                '<div class="list-item gameplay-asset-card' + (asset.id === selectedGameplayAssetId ? ' active' : '') + '" data-asset-preview-id="' + escapeAttr(asset.id) + '">',
                isImage ? '  <img class="gameplay-asset-thumb" src="' + escapeAttr(asset.publicUrl || asset.path) + '" alt="' + escapeAttr(asset.name) + '">' : '',
                '  <div class="gameplay-asset-kind">' + escapeHtml(asset.resourceKind || asset.assetType) + '</div>',
                '  <strong>' + escapeHtml(asset.name) + '</strong>',
                '  <span>' + escapeHtml(asset.summary || asset.publicUrl || asset.path) + '</span>',
                '  <code>' + escapeHtml(asset.path || asset.projectPath || '') + '</code>',
                '  <div class="inline-controls">',
                '    <button type="button" class="mini-button" data-asset-id="' + escapeAttr(asset.id) + '" data-asset-bind="modelPath">绑定模型</button>',
                '    <button type="button" class="mini-button" data-asset-id="' + escapeAttr(asset.id) + '" data-asset-bind="imagePath">绑定图片</button>',
                '  </div>',
                '</div>'
            ].join('');
        }).join('');
        renderGameplayAssetPreview(getSelectedGameplayAsset(entry, assets), entry);
        renderExploreGameplayPanels();
    }

    function schedulePreviewRefresh() {
        if (viewportViewMode !== 'preview') return;
        clearTimeout(previewRefreshTimer);
        previewRefreshTimer = setTimeout(function () {
            refreshPreviewNow();
        }, 80);
    }

    function refreshPreviewNow() {
        if (viewportViewMode !== 'preview' || !previewApi || typeof previewApi.refresh !== 'function') return;
        if (typeof previewApi.resize === 'function') previewApi.resize();
        var sid = selectedObject && selectedObject.kind === 'actor' ? selectedObject.id : null;
        previewApi.refresh({ preserveView: true, selectActorId: sid });
    }

    function syncViewportPanels() {
        var board = viewportViewMode === 'board';
        var levelPreviewShown = !board && (activeWorkbench === 'level' || activeWorkbench === 'theme');
        if (refs.boardViewport) refs.boardViewport.classList.toggle('view-hidden', !board);
        if (refs.previewStageWrap) {
            refs.previewStageWrap.classList.toggle('view-hidden', board);
            refs.previewStageWrap.setAttribute('aria-hidden', board ? 'true' : 'false');
        }
        if (refs.editorToolRibbon) refs.editorToolRibbon.classList.toggle('view-hidden', !board);
        if (refs.mapStageWrap) refs.mapStageWrap.classList.toggle('map-stage-wrap--level-preview', levelPreviewShown);
        updateStageHintText();
        if (!board && previewApi && typeof previewApi.resize === 'function') {
            previewApi.resize();
        }
        renderPreviewSceneOutline();
    }

    function updateStageHintText() {
        if (!refs.stageHintExtra) return;
        if (viewportViewMode === 'preview') {
            refs.stageHintExtra.textContent =
                '鼠标左键拖拽旋转场景，滚轮缩放，右键平移；左键点中 Actor（或拖拽 Gizmo：移动·旋转·缩放）会优先编辑对象。Esc 取消选择；F 聚焦所选 Actor；顶部「内容浏览器」或 Ctrl+空格 弹出项目模型（可拖拽缩放窗口），卡片拖入三维场景；右侧「关卡内容浏览器」可点选并按 Delete；Inspector 可精确数值。';
            return;
        }
        if (activeTool === 'boardImage') {
            refs.stageHintExtra.textContent =
                '拖入配图到棋盘；图层叠在格子上方、路径与标记手柄之下。棋盘配图工具下拖拽移动，四角/四边手柄或滚轮调宽度；右侧「棋盘配图」可排序与删除；Esc 取消选中。亦可切到「选择/拖拽」后点选配图编辑。';
            return;
        }
        refs.stageHintExtra.textContent =
            '点击格子放置道路/障碍等；拖拽移动 Actor。「选择/拖拽」下仍可点选棋盘配图并用边角手柄调整大小；配图列表在画布右侧；Esc 取消配图选中后再点格子以避免误拖图层。';
    }

    function initPreviewLayer() {
        if (previewApi || !refs.previewHost) return;
        var gen = (previewInitGeneration += 1);
        import('./level-editor-preview.js')
            .then(function (mod) {
                if (gen !== previewInitGeneration || viewportViewMode !== 'preview') return;
                previewApi = mod.createPreview({
                    host: refs.previewHost,
                    getLevel: getLevel,
                    getGeoMappingEnabled: function () {
                        return geoMappingEnabled;
                    },
                    getActiveEditorMode: function () {
                        return activeEditorMode;
                    },
                    getCatalog: function () {
                        return state
                            ? {
                                  modelAssets: (state.catalog && state.catalog.modelAssets) || [],
                                  editorAssetsCatalog: state.editorAssetsCatalog || [],
                                  gameModels: normalizeGameModelsForCatalog()
                              }
                            : { modelAssets: [], editorAssetsCatalog: [], gameModels: [] };
                    },
                    onSelectActor: onPreviewSelectActor,
                    onActorModified: onPreviewActorCommitted,
                    onDropCatalogModel: onDropCatalogModelInPreview,
                    onDropActorTemplate: onDropActorTemplateInPreview,
                    onTransformModeChange: setPreviewToolbarMode
                });
                setPreviewToolbarMode('translate');
                var initSel = selectedObject && selectedObject.kind === 'actor' ? selectedObject.id : null;
                previewApi.refresh({ preserveView: false, selectActorId: initSel });
                renderContentBrowser();
                renderPreviewSceneOutline();
            })
            .catch(function (err) {
                console.error(err);
                setStatus('预览模块加载失败：请确认通过 http(s) 打开本页并能访问 CDN。', 'error');
            });
    }

    function disposePreviewLayer() {
        previewInitGeneration += 1;
        clearTimeout(previewRefreshTimer);
        if (!previewApi) return;
        try {
            previewApi.dispose();
        } catch (e) {
            console.warn('[Preview]', e);
        }
        previewApi = null;
    }

    function onPreviewSelectActor(actorId) {
        if (actorId) selectedObject = { kind: 'actor', id: actorId };
        else selectedObject = null;
        renderSelectionInspector();
        renderMap();
        renderPreviewSceneOutline();
    }

    function onPreviewActorCommitted() {
        markDirty('已更新 Actor 变换');
        renderSelectionInspector();
        renderMap();
        renderPreviewSceneOutline();
        renderOverview();
    }

    function onDropCatalogModelInPreview(payload) {
        var level = getLevel();
        if (!level || !payload || !payload.assetId) return;
        var template = findActorTemplate('explore-item');
        if (!template || !template.id) {
            setStatus('无法放置模型：缺少可用 Actor 模板（explore-item）。', 'error');
            return;
        }
        var asset = getBrowsableModelAssets().find(function (item) { return item.id === payload.assetId; });
        var col = Math.floor(level.map.grid.cols / 2);
        var row = Math.floor(level.map.grid.rows / 2);
        placeActorFromTemplate(template.id, col, row);
        var actor = level.map.actors[level.map.actors.length - 1];
        actor.modelId = payload.assetId;
        actor.modelPath = asset ? asset.path || asset.publicUrl || '' : '';
        applyWorldHitToActor(actor, payload.worldX, payload.worldY, payload.worldZ);
        selectedObject = { kind: 'actor', id: actor.id };
        markDirty('已在预览中放置模型');
        renderAll();
        refreshPreviewNow();
    }

    function onDropActorTemplateInPreview(payload) {
        var level = getLevel();
        if (!level || !payload || !payload.templateId) return;
        var col = Math.floor(level.map.grid.cols / 2);
        var row = Math.floor(level.map.grid.rows / 2);
        placeActorFromTemplate(payload.templateId, col, row);
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
        applyWorldHitToActor(actor, wx, wy, wz);
        selectedObject = { kind: 'actor', id: actor.id };
        markDirty('已在预览中放置 Actor');
        renderAll();
        refreshPreviewNow();
    }

    function setPreviewToolbarMode(mode) {
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
        if (previewApi && typeof previewApi.setTransformMode === 'function') previewApi.setTransformMode(mode);
    }

    function isContentBrowserFloatOpen() {
        return refs.contentBrowserFloatPanel && !refs.contentBrowserFloatPanel.classList.contains('view-hidden');
    }

    function persistContentBrowserFloatGeometry() {
        if (!refs.contentBrowserFloatPanel || !isContentBrowserFloatOpen()) return;
        var el = refs.contentBrowserFloatPanel;
        var r = el.getBoundingClientRect();
        try {
            window.localStorage.setItem(
                CONTENT_BROWSER_FLOAT_GEOM_KEY,
                JSON.stringify({
                    left: Math.round(r.left),
                    top: Math.round(r.top),
                    width: Math.round(el.offsetWidth),
                    height: Math.round(el.offsetHeight)
                })
            );
        } catch (_e) {}
    }

    function schedulePersistContentBrowserFloatGeometry() {
        clearTimeout(contentBrowserFloatGeomTimer);
        contentBrowserFloatGeomTimer = setTimeout(persistContentBrowserFloatGeometry, 220);
    }

    function clampContentBrowserFloatPanelIntoViewport() {
        var p = refs.contentBrowserFloatPanel;
        if (!p || !isContentBrowserFloatOpen()) return;
        var w = clampContentBrowserGeom(p.offsetWidth, 380, Math.max(400, window.innerWidth - 16));
        var h = clampContentBrowserGeom(p.offsetHeight, 280, Math.max(300, window.innerHeight - 80));
        p.style.width = w + 'px';
        p.style.height = h + 'px';
        var r = p.getBoundingClientRect();
        var maxL = Math.max(8, window.innerWidth - w - 8);
        var maxT = Math.max(8, window.innerHeight - h - 72);
        p.style.left = clampContentBrowserGeom(r.left, 8, maxL) + 'px';
        p.style.top = clampContentBrowserGeom(r.top, 8, maxT) + 'px';
        schedulePersistContentBrowserFloatGeometry();
    }

    function applyContentBrowserFloatGeometryFromStorage() {
        var raw = '';
        try {
            raw = window.localStorage.getItem(CONTENT_BROWSER_FLOAT_GEOM_KEY) || '';
        } catch (_e) {
            raw = '';
        }
        var p = refs.contentBrowserFloatPanel;
        if (!p || !raw) return false;
        var o;
        try {
            o = JSON.parse(raw);
        } catch (_e) {
            return false;
        }
        if (
            typeof o.left !== 'number' ||
            typeof o.top !== 'number' ||
            typeof o.width !== 'number' ||
            typeof o.height !== 'number' ||
            !Number.isFinite(o.width) ||
            !Number.isFinite(o.height)
        )
            return false;
        var w = clampContentBrowserGeom(o.width, 380, Math.max(400, window.innerWidth - 16));
        var h = clampContentBrowserGeom(o.height, 280, Math.max(300, window.innerHeight - 80));
        var maxL = Math.max(8, window.innerWidth - w - 8);
        var maxT = Math.max(8, window.innerHeight - h - 72);
        p.style.right = 'auto';
        p.style.bottom = 'auto';
        p.style.left = clampContentBrowserGeom(o.left, 8, maxL) + 'px';
        p.style.top = clampContentBrowserGeom(o.top, 8, maxT) + 'px';
        p.style.width = w + 'px';
        p.style.height = h + 'px';
        return true;
    }

    function observeContentBrowserFloatResize() {
        if (!refs.contentBrowserFloatPanel || typeof ResizeObserver === 'undefined') return;
        if (contentBrowserFloatRo) contentBrowserFloatRo.disconnect();
        contentBrowserFloatRo = new ResizeObserver(function () {
            schedulePersistContentBrowserFloatGeometry();
            if (contentBrowserMiniApi && typeof contentBrowserMiniApi.resize === 'function') {
                window.requestAnimationFrame(function () {
                    contentBrowserMiniApi.resize();
                });
            }
        });
        contentBrowserFloatRo.observe(refs.contentBrowserFloatPanel);
    }

    function toggleContentBrowserFloat(optOpen) {
        var p = refs.contentBrowserFloatPanel;
        if (!p || activeWorkbench !== 'level') return;
        var open = typeof optOpen === 'boolean' ? optOpen : !isContentBrowserFloatOpen();
        p.classList.toggle('view-hidden', !open);
        p.setAttribute('aria-hidden', open ? 'false' : 'true');
        if (refs.btnOpenContentBrowserFloat)
            refs.btnOpenContentBrowserFloat.setAttribute('aria-pressed', open ? 'true' : 'false');
        if (!open) {
            schedulePersistContentBrowserFloatGeometry();
            return;
        }
        applyContentBrowserFloatGeometryFromStorage();
        observeContentBrowserFloatResize();
        window.requestAnimationFrame(function () {
            renderContentBrowser();
            if (contentBrowserMiniApi && typeof contentBrowserMiniApi.resize === 'function') contentBrowserMiniApi.resize();
        });
    }

    function wireContentBrowserFloating() {
        if (refs.btnOpenContentBrowserFloat) {
            refs.btnOpenContentBrowserFloat.addEventListener('click', function () {
                toggleContentBrowserFloat();
            });
        }
        if (refs.contentBrowserFloatClose) {
            refs.contentBrowserFloatClose.addEventListener('click', function () {
                toggleContentBrowserFloat(false);
            });
        }
        var panel = refs.contentBrowserFloatPanel;
        var handle = refs.contentBrowserFloatDragHandle;
        if (!panel || !handle) return;
        var drag = false;
        var sx = 0;
        var sy = 0;
        var sl = 0;
        var st = 0;
        handle.addEventListener(
            'pointerdown',
            function (ev) {
                if (ev.button !== 0) return;
                if (ev.target.closest && ev.target.closest('button')) return;
                drag = true;
                handle.setPointerCapture(ev.pointerId);
                var r = panel.getBoundingClientRect();
                sx = ev.clientX;
                sy = ev.clientY;
                sl = r.left;
                st = r.top;
                panel.style.left = sl + 'px';
                panel.style.top = st + 'px';
                panel.style.right = 'auto';
            },
            { passive: true }
        );
        handle.addEventListener(
            'pointermove',
            function (ev) {
                if (!drag) return;
                var nx = sl + (ev.clientX - sx);
                var ny = st + (ev.clientY - sy);
                var maxL = Math.max(8, window.innerWidth - panel.offsetWidth - 8);
                var maxT = Math.max(8, window.innerHeight - panel.offsetHeight - 72);
                panel.style.left = Math.min(Math.max(8, nx), maxL) + 'px';
                panel.style.top = Math.min(Math.max(8, ny), maxT) + 'px';
            },
            { passive: true }
        );
        function endDrag(ev) {
            if (!drag) return;
            drag = false;
            try {
                handle.releasePointerCapture(ev.pointerId);
            } catch (_e) {}
            schedulePersistContentBrowserFloatGeometry();
        }
        handle.addEventListener('pointerup', endDrag);
        handle.addEventListener('pointercancel', endDrag);
    }

    function renderContentBrowser() {
        var list = refs.contentBrowserList;
        if (!list || !state) return;
        var assets = getBrowsableModelAssets();
        if (!assets.length) {
            selectedContentBrowserAssetId = '';
            list.innerHTML =
                '<div class="empty-state">暂无模型。将 .glb/.gltf 放进项目 <code>public/GameModels/</code> 或使用右侧「上传模型」，在「内容浏览器」窗口中点「刷新」。</div>';
            showContentBrowserMiniPreview('');
            return;
        }

        if (selectedContentBrowserAssetId && !assets.some(function (a) { return a.id === selectedContentBrowserAssetId; })) {
            selectedContentBrowserAssetId = '';
        }

        list.innerHTML = assets
            .map(function (asset) {
                var active = asset.id === selectedContentBrowserAssetId ? ' content-browser-chip--active' : '';
                return [
                    '<div class="content-browser-chip' +
                        active +
                        '" draggable="true" data-asset-chip="' +
                        escapeAttr(asset.id) +
                        '" data-preview-url="' +
                        escapeAttr(asset.path || asset.publicUrl || '') +
                        '">',
                    '  <div class="content-browser-chip-icon">' + escapeHtml(asset.name.slice(0, 2).toUpperCase()) + '</div>',
                    '  <div class="content-browser-chip-meta">',
                    '    <strong>' + escapeHtml(asset.name || asset.id) + '</strong>',
                    '    <span>' + escapeHtml(asset.summary || asset.path || asset.publicUrl || 'GameModels') + '</span>',
                    '  </div>',
                    '</div>'
                ].join('');
            })
            .join('');

        list.querySelectorAll('[data-asset-chip]').forEach(function (chip) {
            chip.addEventListener('dragstart', function (event) {
                var id = chip.getAttribute('data-asset-chip');
                var asset = assets.find(function (a) {
                    return a.id === id;
                });
                var name = asset ? asset.name || id : id || '';
                var modelPath = asset ? asset.path || asset.publicUrl || '' : '';
                var payloadJson = JSON.stringify({
                    kind: 'catalogModel',
                    assetId: id,
                    id: id,
                    name: name,
                    modelPath: modelPath
                });
                if (typeof window !== 'undefined') {
                    window.__egCatalogDragMeta = { assetId: id, name: name, modelPath: modelPath };
                }
                if (event.dataTransfer) {
                    event.dataTransfer.setData('application/json', payloadJson);
                    /* 部分环境与浏览器对自定义 MIME 的 getData 不稳定，mirror 一份到 text/plain 供 Inspector 接住 */
                    event.dataTransfer.setData('text/plain', payloadJson);
                    event.dataTransfer.effectAllowed = 'copy';
                }
            });
            chip.addEventListener('dragend', function () {
                if (typeof window !== 'undefined') window.__egCatalogDragMeta = null;
            });
            chip.addEventListener('click', function (event) {
                if (event.target && event.target.closest && event.target.closest('a')) return;
                selectedContentBrowserAssetId = chip.getAttribute('data-asset-chip') || '';
                list.querySelectorAll('[data-asset-chip]').forEach(function (c) {
                    c.classList.toggle('content-browser-chip--active', c.getAttribute('data-asset-chip') === selectedContentBrowserAssetId);
                });
                showContentBrowserMiniPreview(chip.getAttribute('data-preview-url') || '');
            });
        });

        if (!selectedContentBrowserAssetId && assets[0]) {
            selectedContentBrowserAssetId = assets[0].id;
            list.querySelectorAll('[data-asset-chip]').forEach(function (c) {
                c.classList.toggle('content-browser-chip--active', c.getAttribute('data-asset-chip') === selectedContentBrowserAssetId);
            });
            showContentBrowserMiniPreview(assets[0].path || assets[0].publicUrl || '');
        } else if (selectedContentBrowserAssetId) {
            var cur = assets.find(function (a) {
                return a.id === selectedContentBrowserAssetId;
            });
            showContentBrowserMiniPreview(cur ? cur.path || cur.publicUrl || '' : '');
        }
    }

    function showContentBrowserMiniPreview(url) {
        var host = refs.contentBrowserPreviewHost;
        if (!host) return;
        if (!url) {
            if (contentBrowserMiniApi && typeof contentBrowserMiniApi.dispose === 'function') {
                contentBrowserMiniApi.dispose();
            }
            contentBrowserMiniApi = null;
            host.innerHTML =
                '<div class="empty-state content-browser-mini-empty">在「内容浏览器」窗口中选择模型卡片，或拖拽到关卡预览场景。</div>';
            return;
        }
        if (!isContentBrowserFloatOpen()) {
            if (contentBrowserMiniApi && typeof contentBrowserMiniApi.dispose === 'function') {
                contentBrowserMiniApi.dispose();
            }
            contentBrowserMiniApi = null;
            host.innerHTML =
                '<div class="empty-state content-browser-mini-empty">按工具条「内容浏览器」或 Ctrl+空格 打开窗口后查看三维预览。</div>';
            return;
        }
        import('./content-browser-model-preview.js')
            .then(function (mod) {
                if (!refs.contentBrowserPreviewHost) return;
                if (contentBrowserMiniApi && typeof contentBrowserMiniApi.dispose === 'function') {
                    contentBrowserMiniApi.dispose();
                }
                contentBrowserMiniApi = mod.createContentBrowserMiniPreview({ host: refs.contentBrowserPreviewHost });
                return contentBrowserMiniApi.setUrl(url);
            })
            .catch(function (e) {
                console.warn('[ContentBrowser preview]', e);
            });
    }

    function wireViewportViewMode(next) {
        viewportViewMode = next;
        if (refs.viewportViewTabs) {
            refs.viewportViewTabs.querySelectorAll('[data-view-mode]').forEach(function (b) {
                var on = b.getAttribute('data-view-mode') === next;
                b.classList.toggle('active', on);
                b.setAttribute('aria-selected', on ? 'true' : 'false');
            });
        }
        disposePreviewLayer();
        if (next === 'preview') initPreviewLayer();
        syncViewportPanels();
    }

    function getBrowsableModelAssets() {
        if (!state) return [];
        var merged = [];
        normalizeGameModelsForCatalog()
            .concat(state.catalog.modelAssets || [])
            .concat(
                (state.editorAssetsCatalog || []).filter(function (asset) {
                    return isModelAssetPath(asset.publicUrl || asset.path || asset.projectPath);
                }).map(function (asset) {
                    return {
                        id: asset.id,
                        name: asset.name,
                        summary: asset.summary,
                        path: asset.publicUrl || asset.path || asset.projectPath,
                        source: 'editorAssets'
                    };
                })
            )
            .forEach(function (asset) {
                if (!asset || !asset.id || merged.some(function (item) { return item.id === asset.id; })) return;
                merged.push(asset);
            });
        return merged;
    }

    function getEnemyTypeLookup(level) {
        return getAvailableEnemyTypes(level).reduce(function (lookup, enemy) {
            lookup[enemy.id] = enemy;
            return lookup;
        }, {});
    }

    function renderLevelTree() {
        var query = refs.levelSearch.value.trim().toLowerCase();
        var levels = state.levels.filter(function (level) {
            if (activeStatusFilter !== 'all' && level.status !== activeStatusFilter) return false;
            if (!query) return true;
            return [
                level.name,
                level.location.countryName,
                level.location.cityName,
                level.location.regionLabel
            ].join(' ').toLowerCase().indexOf(query) !== -1;
        });

        if (!levels.length) {
            refs.levelTree.innerHTML = '<div class="empty-state">当前筛选下没有关卡。</div>';
            return;
        }

        var groups = groupLevels(levels);
        refs.levelTree.innerHTML = Object.keys(groups).sort(compareRegionKeys).map(function (key) {
            var items = groups[key];
            return [
                '<section class="tree-group">',
                '  <div class="tree-heading"><span>' + escapeHtml(key) + '</span><span>' + items.length + '</span></div>',
                items.map(renderLevelCard).join(''),
                '</section>'
            ].join('');
        }).join('');
    }

    function renderLevelCard(level) {
        return [
            '<button class="level-card' + (level.id === selectedLevelId ? ' active' : '') + '" data-level-id="' + escapeAttr(level.id) + '">',
            '  <strong>' + escapeHtml(level.name) + '</strong>',
            '  <span>' + escapeHtml(level.location.regionLabel || level.location.countryName || '未设置地区') + '</span>',
            '  <div class="badge-row">',
            '    <span class="mini-badge ' + escapeAttr(level.status) + '">' + escapeHtml(statusLabel(level.status)) + '</span>',
            '    <span class="mini-badge">Actor ' + level.map.actors.length + '</span>',
            '    <span class="mini-badge">道路 ' + level.map.roads.length + '</span>',
            '    <span class="mini-badge">难度 ' + level.difficulty + '</span>',
            '  </div>',
            '</button>'
        ].join('');
    }

    function renderLevelDetails() {
        var level = getLevel();
        var cityConfig = getCurrentCityGameplayConfig();
        if (!level) {
            refs.currentLevelName.textContent = '请选择关卡';
            refs.currentLevelMeta.textContent = '无可编辑关卡。';
            return;
        }
        refs.currentLevelName.textContent = level.name;
        refs.currentLevelMeta.textContent = [
            level.location.regionLabel || level.location.countryName || '未设置地区',
            level.map.grid.cols + 'x' + level.map.grid.rows,
            activeEditorMode === 'explore' ? '探索布局' : '塔防布局',
            statusLabel(level.status)
        ].concat(cityConfig && (cityConfig.characters.length || cityConfig.skills.length || cityConfig.enemies.length)
            ? ['角色 ' + cityConfig.characters.length, '技能 ' + cityConfig.skills.length, '敌人 ' + cityConfig.enemies.length]
            : []).join(' · ');
        refs.levelSummary.textContent = '当前关卡：' + level.name + '。使用工具栏绘制地图，拖拽 Actor 模板到画布。';
        refs.fieldLevelName.value = level.name;
        refs.fieldStatus.value = level.status;
        refs.fieldCountry.value = level.location.countryName || '';
        refs.fieldCity.value = level.location.cityName || '';
        refs.fieldDifficulty.value = String(level.difficulty);
        refs.fieldDescription.value = level.description || '';
        refs.fieldGridCols.value = String(level.map.grid.cols);
        refs.fieldGridRows.value = String(level.map.grid.rows);
        refs.fieldTileSize.value = String(level.map.grid.tileSize);
        renderGeoFields(level);
        renderExploreGameplayPanels();
        renderLevelAudioFields(refs, level);
        renderSelectionInspector();
    }

    function renderGeoFields(level) {
        if (!refs.fieldGeoEnabled) return;
        var mapGeo = normalizeGeoConfig(level.map.geo);
        var locGeo = level.location && level.location.geo ? normalizeGeoConfig(level.location.geo) : null;
        var mapUsable =
            mapGeo.enabled &&
            Number.isFinite(mapGeo.center.lat) &&
            Number.isFinite(mapGeo.center.lon) &&
            !(mapGeo.center.lat === 0 && mapGeo.center.lon === 0);
        var geo = mapUsable ? mapGeo : locGeo || mapGeo;
        refs.fieldGeoEnabled.value = geo.enabled ? 'true' : 'false';
        refs.fieldGeoLat.value = String(geo.center.lat || '');
        refs.fieldGeoLon.value = String(geo.center.lon || '');
        refs.fieldGeoHeight.value = String(geo.center.heightMeters || 0);
        refs.fieldGeoExtent.value = String(geo.extentMeters || 1000);
        refs.fieldGeoRotation.value = String(geo.rotationDeg || 0);
        refs.fieldGeoYOffset.value = String(geo.yOffsetMeters || 0);
        if (refs.fieldGeoBoardHeight) refs.fieldGeoBoardHeight.value = String(geo.boardHeightMeters || 32);
        refs.fieldGeoAssetId.value = geo.assetId || DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID;
    }

    function renderOverview() {
        var level = getLevel();
        if (!level) {
            refs.overviewStats.innerHTML = '';
            return;
        }
        var exploreLayout = ensureExplorationLayout(level.map);
        var cards = activeEditorMode === 'explore' ? [
            { label: '探索尺寸', value: level.map.grid.cols + 'x' + level.map.grid.rows },
            { label: '探索路线', value: exploreLayout.path.length },
            { label: '探索点', value: level.map.explorationPoints.length },
            { label: 'Actor', value: level.map.actors.length }
        ] : [
            { label: '地图尺寸', value: level.map.grid.cols + 'x' + level.map.grid.rows },
            { label: 'Actor', value: level.map.actors.length },
            { label: '敌人出口', value: level.map.spawnPoints.length },
            { label: '波次', value: level.waveRules.length }
        ];
        refs.overviewStats.innerHTML = cards.map(function (card) {
            return '<div class="stat-card"><strong>' + escapeHtml(String(card.value)) + '</strong><span>' + escapeHtml(card.label) + '</span></div>';
        }).join('');
    }

    function renderMap() {
        _renderMap(refs, mapRenderEnv());
    }

    function handleCellAction(col, row) {
        var level = getLevel();
        if (!level) return;
        if (activeTool === 'boardImage') {
            return;
        }
        if (activeTool === 'select') {
            selectedObject = null;
            renderSelectionInspector();
            renderMap();
            return;
        }
        if (activeEditorMode === 'explore') {
            var exploreLayout = ensureExplorationLayout(level.map);
            if (activeTool === 'road' || activeTool === 'path') toggleCell(exploreLayout.path, col, row);
            if (activeTool === 'obstacle') toggleCell(exploreLayout.obstacles, col, row);
            if (activeTool === 'spawn') setExploreStartPoint(col, row);
            if (activeTool === 'objective') setExploreExitPoint(col, row);
            if (activeTool === 'buildSlot') addExplorePoint(col, row);
            if (activeTool === 'safeZone') {
                if (!Array.isArray(exploreLayout.safeZones)) exploreLayout.safeZones = [];
                toggleCell(exploreLayout.safeZones, col, row);
            }
        } else {
            if (activeTool === 'road') toggleCell(level.map.roads, col, row);
            if (activeTool === 'obstacle') toggleCell(level.map.obstacles, col, row);
            if (activeTool === 'path') togglePathCell(level, col, row);
            if (activeTool === 'buildSlot') toggleCell(level.map.buildSlots, col, row);
            if (activeTool === 'spawn') addSpawnPoint(col, row);
            if (activeTool === 'objective') setObjectivePoint(col, row);
        }
        if (activeTool === 'explorePoint') addExplorePoint(col, row);
        if (activeTool === 'actor') placeActorFromTemplate(selectedTemplateId, col, row);
        if (activeTool === 'erase') applyEraserBrush(col, row, getLevel, eraseCellAt);
        level.status = level.status === 'draft' ? 'needs-work' : level.status;
        markDirty('已更新地图');
        renderAll();
        schedulePreviewRefresh();
    }

    function togglePathCell(level, col, row) {
        if (!level.map.enemyPaths.length) {
            level.map.enemyPaths.push({ id: 'path-main', name: '主敌人路径', cells: [] });
        }
        toggleCell(level.map.enemyPaths[0].cells, col, row);
    }

    function addSpawnPoint(col, row) {
        var level = getLevel();
        var existing = level.map.spawnPoints.find(function (point) { return point.col === col && point.row === row; });
        if (existing) {
            selectObject('spawn', existing.id);
            return;
        }
        var id = uid('spawn');
        level.map.spawnPoints.push({ id: id, name: '敌人出口 ' + (level.map.spawnPoints.length + 1), col: col, row: row, pathId: 'path-main' });
        selectedObject = { kind: 'spawn', id: id };
    }

    function setObjectivePoint(col, row) {
        var level = getLevel();
        level.map.objectivePoint = { id: level.map.objectivePoint && level.map.objectivePoint.id || 'objective-main', name: '防守核心', col: col, row: row };
        selectedObject = { kind: 'objective', id: level.map.objectivePoint.id };
    }

    function setExploreStartPoint(col, row) {
        var level = getLevel();
        var layout = ensureExplorationLayout(level.map);
        layout.startPoint = { id: layout.startPoint && layout.startPoint.id || 'explore-start', name: '探索起点', col: col, row: row };
        selectedObject = { kind: 'spawn', id: layout.startPoint.id };
    }

    function setExploreExitPoint(col, row) {
        var level = getLevel();
        var layout = ensureExplorationLayout(level.map);
        layout.exitPoint = { id: layout.exitPoint && layout.exitPoint.id || 'explore-exit', name: '探索终点', col: col, row: row };
        selectedObject = { kind: 'objective', id: layout.exitPoint.id };
    }

    function addExplorePoint(col, row) {
        var level = getLevel();
        var id = uid('poi');
        level.map.explorationPoints.push({ id: id, name: '探索点 ' + (level.map.explorationPoints.length + 1), col: col, row: row, modelId: '', interaction: 'inspect', radius: 2 });
        selectedObject = { kind: 'explorePoint', id: id };
    }

    function applyWorldHitToActor(actor, wx, wy, wz) {
        var level = getLevel();
        if (!level) return;
        var cols = level.map.grid.cols;
        var rows = level.map.grid.rows;
        var ts = level.map.grid.tileSize;
        var col = clamp(Math.floor(wx / ts + cols / 2), 0, cols - 1);
        var row = clamp(Math.floor(wz / ts + rows / 2), 0, rows - 1);
        actor.col = col;
        actor.row = row;
        ensureWorldOffset(actor);
        var cx = (col - cols / 2 + 0.5) * ts;
        var cz = (row - rows / 2 + 0.5) * ts;
        actor.worldOffsetMeters.x = wx - cx;
        actor.worldOffsetMeters.y = wy;
        actor.worldOffsetMeters.z = wz - cz;
    }

    function placeActorFromTemplate(templateId, col, row) {
        var level = getLevel();
        var template = findActorTemplate(templateId);
        if (!level || !template) return;
        var actor = {
            id: uid('actor'),
            templateId: template.id,
            name: template.name,
            category: template.category,
            icon: template.icon || template.name.charAt(0),
            modelId: template.modelId || '',
            modelPath: template.modelPath || '',
            col: col,
            row: row,
            rotation: 0,
            scale:
                template.templateModelScale != null && template.templateModelScale > 0
                    ? template.templateModelScale
                    : 1,
            worldOffsetMeters: { x: 0, y: 0, z: 0 },
            team: template.category === 'enemy' ? 'enemy' : 'player',
            stats: clone(template.stats || {})
        };
        level.map.actors.push(actor);
        selectedObject = { kind: 'actor', id: actor.id };
        level.status = level.status === 'draft' ? 'needs-work' : level.status;
        markDirty('已放置 Actor');
        renderAll();
    }

    function moveActor(actorId, col, row) {
        var level = getLevel();
        var actor = level.map.actors.find(function (item) { return item.id === actorId; });
        if (!actor) return;
        actor.col = col;
        actor.row = row;
        selectedObject = { kind: 'actor', id: actor.id };
        markDirty('已移动 Actor');
        renderAll();
    }

    function moveMarker(kind, id, col, row) {
        var level = getLevel();
        var item = null;
        var layout = ensureExplorationLayout(level.map);
        if (kind === 'spawn') item = activeEditorMode === 'explore' ? layout.startPoint : level.map.spawnPoints.find(byId(id));
        if (kind === 'explorePoint') item = level.map.explorationPoints.find(byId(id));
        if (kind === 'objective') item = activeEditorMode === 'explore' ? layout.exitPoint : level.map.objectivePoint && level.map.objectivePoint.id === id ? level.map.objectivePoint : null;
        if (!item) return;
        item.col = col;
        item.row = row;
        selectedObject = { kind: kind, id: id };
        markDirty('已移动地图标记');
        renderAll();
    }

    function eraseCellAt(col, row) {
        var level = getLevel();
        if (!level) return;
        var layout = ensureExplorationLayout(level.map);
        var c = Number(col);
        var r = Number(row);
        removeCell(layout.path, c, r);
        removeCell(layout.obstacles, c, r);
        if (Array.isArray(layout.safeZones)) removeCell(layout.safeZones, c, r);
        if (layout.startPoint && Number(layout.startPoint.col) === c && Number(layout.startPoint.row) === r) layout.startPoint = null;
        if (layout.exitPoint && Number(layout.exitPoint.col) === c && Number(layout.exitPoint.row) === r) layout.exitPoint = null;

        removeCell(level.map.roads, c, r);
        removeCell(level.map.obstacles, c, r);
        removeCell(level.map.buildSlots, c, r);
        level.map.enemyPaths.forEach(function (path) {
            removeCell(path.cells, c, r);
        });
        level.map.spawnPoints = level.map.spawnPoints.filter(notAtCell(c, r));
        if (
            level.map.objectivePoint &&
            Number(level.map.objectivePoint.col) === c &&
            Number(level.map.objectivePoint.row) === r
        ) {
            level.map.objectivePoint = null;
        }

        level.map.explorationPoints = level.map.explorationPoints.filter(notAtCell(c, r));
        level.map.actors = level.map.actors.filter(notAtCell(c, r));
        if (Array.isArray(level.map.terrain)) removeCell(level.map.terrain, c, r);
        selectedObject = null;
    }

    function renderActorPalette() {
        var templates = getAvailableActorTemplates();
        if (!templates.length) {
            refs.actorPalette.innerHTML = '<div class="empty-state">暂无可用 Actor 模板。</div>';
            return;
        }
        if (!templates.some(function (template) { return template.id === selectedTemplateId; })) {
            selectedTemplateId = templates[0].id;
        }
        refs.actorPalette.innerHTML =
            '<p class="section-hint actor-palette-hint">从下方模板拖到「棋盘布局」或「关卡预览」；松手落在格缝时也会按坐标吸附到最近格。每行可绑定项目模型与缩放（与塔防单位替换一致）。</p>' +
            templates
                .map(function (template) {
                    var t = findActorTemplate(template.id) || template;
                    var url = String(t.modelPath || '');
                    var sc =
                        t.templateModelScale != null && t.templateModelScale > 0 ? t.templateModelScale : 1;
                    var cityOnly = template.source === 'cityGameplay';
                    var modelUi = cityOnly
                        ? '<p class="section-hint" style="margin:8px 10px;font-size:10px;">城市玩法条目：请到「Gameplay」工作台为敌人/模型换绑；此处占位只读。</p>'
                        : '  <div class="actor-template-model game-asset-tower-row">' +
                          '    <div class="game-asset-tower-title">模型</div>' +
                          '    <div class="game-asset-tower-upload-col" data-actor-template-drop="' +
                          escapeAttr(template.id) +
                          '" title="从底部「项目模型」拖入">' +
                          '      <label class="game-asset-upload tight">替换模型' +
                          '        <input type="file" data-actor-template-file="' +
                          escapeAttr(template.id) +
                          '" accept=".glb,.gltf,.obj,model/gltf-binary,model/gltf+json" />' +
                          '      </label>' +
                          '      <div class="game-asset-tower-drop">拖入项目模型</div>' +
                          '    </div>' +
                          '    <label class="field-block game-asset-scale-tower"><span>缩放</span>' +
                          '      <input type="number" data-actor-template-scale="' +
                          escapeAttr(template.id) +
                          '" min="0.1" max="8" step="0.1" value="' +
                          String(sc) +
                          '" />' +
                          '    </label>' +
                          '    <div class="asset-url-hint" title="' +
                          escapeAttr(url || '未绑定 Actor 模板模型') +
                          '">' +
                          escapeHtml(url ? modelBindShortLabel(url) : '未配置') +
                          '</div>' +
                          '  </div>';
                    return (
                        '<div class="actor-template-wrap' +
                        (template.id === selectedTemplateId ? ' actor-template-wrap--selected' : '') +
                        '">' +
                        '  <div class="actor-template' +
                        (template.id === selectedTemplateId ? ' selected' : '') +
                        '" draggable="true" data-template-id="' +
                        escapeAttr(template.id) +
                        '">' +
                        '    <strong>' +
                        escapeHtml(template.name) +
                        '</strong>' +
                        '    <span>' +
                        escapeHtml(actorCategoryLabel(template.category)) +
                        ' · ' +
                        escapeHtml(summaryStats(template.stats)) +
                        (template.source === 'cityGameplay' ? ' · 城市玩法库' : '') +
                        '</span>' +
                        '  </div>' +
                        modelUi +
                        '</div>'
                    );
                })
                .join('');

        refs.actorPalette.querySelectorAll('[data-template-id]').forEach(function (item) {
            item.addEventListener('click', function () {
                selectedTemplateId = item.getAttribute('data-template-id');
                activeTool = 'actor';
                document.querySelectorAll('[data-tool]').forEach(function (tool) {
                    tool.classList.toggle('active', tool.getAttribute('data-tool') === 'actor');
                });
                refs.activeToolLabel.textContent = '当前工具：模型 Actor';
                renderActorPalette();
            });
            item.addEventListener('dragstart', function (event) {
                selectedTemplateId = item.getAttribute('data-template-id');
                var payloadJson = JSON.stringify({ kind: 'template', id: selectedTemplateId });
                if (event.dataTransfer) {
                    event.dataTransfer.setData('application/json', payloadJson);
                    event.dataTransfer.setData('text/plain', payloadJson);
                    event.dataTransfer.effectAllowed = 'copy';
                }
            });
        });
        bindActorTemplateModelControls();
    }

    function bindActorTemplateModelControls() {
        if (!refs.actorPalette) return;
        refs.actorPalette.querySelectorAll('[data-actor-template-scale]').forEach(function (input) {
            input.addEventListener('change', function () {
                var id = input.getAttribute('data-actor-template-scale');
                var t = state.actorTemplates.find(function (x) { return x.id === id; });
                if (!t) return;
                t.templateModelScale = clamp(Number(input.value) || 1, 0.1, 8);
                markDirty('已更新模板缩放');
                schedulePreviewRefresh();
            });
        });
        refs.actorPalette.querySelectorAll('[data-actor-template-file]').forEach(function (inp) {
            inp.addEventListener('change', function () {
                var id = inp.getAttribute('data-actor-template-file');
                if (!inp.files || !inp.files[0]) return;
                applyActorTemplateUploadedModel(id, inp.files[0]);
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
                var f =
                    e.dataTransfer.files && e.dataTransfer.files[0] ? e.dataTransfer.files[0] : null;
                if (f) applyActorTemplateUploadedModel(id, f);
            });
        });
    }

    async function applyActorTemplateUploadedModel(templateId, file) {
        try {
            setStatus('正在上传「' + file.name + '」…', 'idle');
            var url = await uploadFileToProjectUrl(file, { gameModelsUpload: true, gameModelsSubdir: 'ActorTemplates' });
            var tpl = state.actorTemplates.find(function (x) { return x.id === templateId; });
            if (!tpl) {
                setStatus('仅能修改「项目 Actor 模板」。城市玩法库条目请在 Gameplay 工作台绑定模型。', 'error');
                return;
            }
            if (!url) {
                setStatus('上传成功但未返回 publicUrl（请查看终端 /api 报错）', 'error');
                return;
            }
            tpl.modelPath = url;
            markDirty('已绑定模板模型');
            renderActorPalette();
            schedulePreviewRefresh();
            setStatus(
                'Actor 模板已绑定「' + file.name + '」 · 当前：' + modelBindShortLabel(url) + '（悬停右侧格可看完整路径）',
                'success'
            );
        } catch (error) {
            setStatus('上传失败：' + ((error && error.message) || String(error)), 'error');
        }
    }

    function renderSelectionInspector() {
        var level = getLevel();
        if (selectedObject && LCB_CELL_KIND_LABEL[selectedObject.kind]) {
            refs.selectionInspector.className = 'selection-inspector';
            var label = LCB_CELL_KIND_LABEL[selectedObject.kind] || selectedObject.kind;
            refs.selectionInspector.innerHTML =
                '<p class="section-hint">已选「' +
                escapeHtml(label) +
                '」棋盘格 (' +
                selectedObject.col +
                ',' +
                selectedObject.row +
                '）。按 Delete 键从关卡移除。</p>';
            return;
        }
        if (selectedObject && selectedObject.kind === 'boardImage') {
            var bl = level && findBoardImageLayerById(level, selectedObject.id);
            if (!bl) {
                selectedObject = null;
                refs.selectionInspector.className = 'selection-inspector empty-state';
                refs.selectionInspector.innerHTML = '未选择对象。';
                return;
            }
            refs.selectionInspector.className = 'selection-inspector';
            refs.selectionInspector.innerHTML =
                '<p class="section-hint">数据写入 <code>map.boardImageLayers</code>。Delete 移除该配图层。</p>' +
                '<div class="form-grid two">' +
                boardLayerFieldHtml('左上角 X%', 'centerX', bl.centerX, 0.5) +
                boardLayerFieldHtml('左上角 Y%', 'centerY', bl.centerY, 0.5) +
                boardLayerFieldHtml('宽度 %（相对棋盘格宽）', 'widthPct', bl.widthPct, 1) +
                boardLayerFieldHtml('不透明度 0–1', 'opacity', bl.opacity == null ? 1 : bl.opacity, 0.02) +
                boardLayerFieldHtml('层级顺序 order', 'order', bl.order, 1) +
                '</div>';
            refs.selectionInspector.querySelectorAll('[data-board-layer-field]').forEach(function (inp) {
                inp.addEventListener('input', function () {
                    syncBoardLayerFieldFromInspector(inp);
                });
                inp.addEventListener('change', function () {
                    syncBoardLayerFieldFromInspector(inp);
                });
            });
            return;
        }
        var target = findSelectedObject(level);
        if (!target) {
            refs.selectionInspector.className = 'selection-inspector empty-state';
            refs.selectionInspector.innerHTML = '未选择对象。';
            return;
        }
        refs.selectionInspector.className = 'selection-inspector';
        refs.selectionInspector.innerHTML = buildInspectorForm(target.kind, target.item);
        refs.selectionInspector.querySelectorAll('[data-inspect-field]').forEach(function (input) {
            input.addEventListener('input', function () { updateSelectedField(input); });
            input.addEventListener('change', function () { updateSelectedField(input); });
        });
    }

    function buildInspectorForm(kind, item) {
        var modelOptions = ['<option value="">未绑定模型</option>'].concat(getBrowsableModelAssets().map(function (asset) {
            return '<option value="' + escapeAttr(asset.id) + '"' + (asset.id === item.modelId ? ' selected' : '') + '>' + escapeHtml(asset.name) + '</option>';
        })).join('');
        var base = [
            '<div class="form-grid two">',
            fieldHtml('名称', 'name', item.name || ''),
            fieldHtml('列', 'col', item.col, 'number'),
            fieldHtml('行', 'row', item.row, 'number')
        ];
        if (kind === 'actor') {
            ensureWorldOffset(item);
            base.push(fieldHtml('旋转', 'rotation', item.rotation, 'number'));
            base.push(fieldHtml('缩放', 'scale', item.scale, 'number', '0.1'));
            base.push(fieldHtml('偏移 X(米)', 'worldOffsetMeters.x', item.worldOffsetMeters.x, 'number', '0.05'));
            base.push(fieldHtml('偏移 Y(米)', 'worldOffsetMeters.y', item.worldOffsetMeters.y, 'number', '0.05'));
            base.push(fieldHtml('偏移 Z(米)', 'worldOffsetMeters.z', item.worldOffsetMeters.z, 'number', '0.05'));
            base.push(fieldHtml('阵营', 'team', item.team || 'player'));
            base.push(selectHtml('模型', 'modelId', modelOptions));
            base.push(fieldHtml('生命', 'stats.hp', item.stats.hp, 'number'));
            base.push(fieldHtml('攻击', 'stats.attack', item.stats.attack, 'number'));
            base.push(fieldHtml('射程', 'stats.range', item.stats.range, 'number', '0.1'));
            base.push(fieldHtml('射速', 'stats.fireRate', item.stats.fireRate, 'number', '0.1'));
            base.push(fieldHtml('费用', 'stats.cost', item.stats.cost, 'number'));
            base.push(fieldHtml('冷却', 'stats.cooldown', item.stats.cooldown || 0, 'number', '0.1'));
        }
        if (kind === 'spawn') {
            base.push(fieldHtml('路径 ID', 'pathId', item.pathId || 'path-main'));
        }
        if (kind === 'explorePoint') {
            base.push(selectHtml('模型', 'modelId', modelOptions));
            base.push(fieldHtml('交互类型', 'interaction', item.interaction || 'inspect'));
            base.push(fieldHtml('半径', 'radius', item.radius || 2, 'number', '0.1'));
        }
        base.push('</div>');
        return base.join('');
    }

    function syncBoardLayerFieldFromInspector(input) {
        var level = getLevel();
        if (!level || !selectedObject || selectedObject.kind !== 'boardImage') return;
        var lyr = findBoardImageLayerById(level, selectedObject.id);
        if (!lyr) return;
        var key = input.getAttribute('data-board-layer-field');
        if (!key) return;
        var raw =
            input.value === '' || input.value === '-' || input.value === '.' ? NaN : Number(input.value);
        if (!Number.isFinite(raw)) return;
        if (key === 'centerX' || key === 'centerY') lyr[key] = clamp(raw, 0, 100);
        else if (key === 'widthPct') lyr.widthPct = clamp(raw, 5, 500);
        else if (key === 'opacity') lyr.opacity = clamp(raw, 0, 1);
        else if (key === 'order') lyr.order = Math.round(raw);
        markDirty('已更新棋盘配图');
        renderMap();
        renderBoardImagesPanel(refs, boardImagesEnv());
        schedulePreviewRefresh();
    }

    function updateSelectedField(input) {
        var target = findSelectedObject(getLevel());
        if (!target) return;
        var path = input.getAttribute('data-inspect-field');
        var next =
            input.type === 'number'
                ? input.value === '' || input.value === '-' || input.value === '.' || input.value === '-.'
                    ? NaN
                    : Number(input.value)
                : input.value;
        if (input.type === 'number' && !Number.isFinite(next)) return;
        updatePath(target.item, path, next);
        if (path === 'col' || path === 'row') {
            target.item[path] = Math.max(0, Math.floor(Number(next) || 0));
            renderMap();
        }
        markDirty('已更新对象属性');
        renderOverview();
        schedulePreviewRefresh();
    }

    function renderWaveList() {
        var level = getLevel();
        var enemyLookup = getEnemyTypeLookup(level);
        if (!level) {
            refs.waveList.innerHTML = '';
            return;
        }
        if (!level.waveRules.length) {
            refs.waveList.innerHTML = '<div class="empty-state">暂无波次。点击新增波次开始配置。</div>';
            return;
        }
        refs.waveList.innerHTML = level.waveRules.map(function (wave, index) {
            var enemyName = enemyLookup[wave.enemyTypeId] ? enemyLookup[wave.enemyTypeId].name : (wave.enemyTypeId || '未指定敌人');
            var op = String(wave.overrideModelPath || '');
            var oscale = wave.overrideModelScale != null && wave.overrideModelScale > 0 ? wave.overrideModelScale : 1;
            return [
                '<div class="wave-card">',
                '  <div class="wave-card-head">',
                '    <strong>第 ' + wave.waveNumber + ' 波 · ' + escapeHtml(enemyName) + '</strong>',
                '    <span>数量 ' + wave.count + ' · 间隔 ' + wave.interval + 's · 出口 ' + escapeHtml(wave.spawnPointId || '自动') + '</span>',
                '    <div class="inline-controls">',
                '      <button class="mini-button" data-wave-action="edit" data-wave-index="' + index + '">快速编辑</button>',
                '      <button class="mini-button danger" data-wave-action="remove" data-wave-index="' + index + '">删除</button>',
                '    </div>',
                '  </div>',
                '  <div class="wave-card-model game-asset-tower-row">',
                '    <div class="game-asset-tower-title">敌人外观 · 可选覆盖</div>',
                '    <div class="game-asset-tower-upload-col" data-wave-model-drop="' + index + '">',
                '      <label class="game-asset-upload tight">替换模型',
                '        <input type="file" data-wave-model-file="' + index + '" accept=".glb,.gltf,.obj,model/gltf-binary,model/gltf+json" />',
                '      </label>',
                '      <div class="game-asset-tower-drop">拖入项目模型</div>',
                '    </div>',
                '    <label class="field-block game-asset-scale-tower"><span>缩放</span>',
                '      <input type="number" data-wave-override-scale="' +
                    index +
                    '" min="0.1" max="8" step="0.1" value="' +
                    String(oscale) +
                    '" />',
                '    </label>',
                '    <div class="asset-url-hint" title="' + escapeAttr(op || '若留空则沿用敌人条目的模型路径') + '">' +
                escapeHtml(op ? modelBindShortLabel(op) : '沿用敌人') +
                '</div>',
                '  </div>',
                '</div>'
            ].join('');
        }).join('');
        refs.waveList.querySelectorAll('[data-wave-action]').forEach(function (button) {
            button.addEventListener('click', function () {
                var index = Number(button.getAttribute('data-wave-index'));
                if (button.getAttribute('data-wave-action') === 'remove') removeWaveRule(index);
                else editWaveRule(index);
            });
        });
        bindWaveAppearanceControls(level);
    }

    function bindWaveAppearanceControls(level) {
        if (!refs.waveList || !level || !level.waveRules) return;
        refs.waveList.querySelectorAll('[data-wave-override-scale]').forEach(function (input) {
            input.addEventListener('input', function () {
                var wi = Number(input.getAttribute('data-wave-override-scale'));
                var wave = level.waveRules[wi];
                if (!wave) return;
                wave.overrideModelScale = clamp(Number(input.value) || 1, 0.1, 8);
                markDirty('已更新波次模型缩放');
            });
        });
        refs.waveList.querySelectorAll('[data-wave-model-file]').forEach(function (inp) {
            inp.addEventListener('change', function () {
                var wi = Number(inp.getAttribute('data-wave-model-file'));
                var wave = level.waveRules[wi];
                if (!wave || !inp.files || !inp.files[0]) return;
                applyWaveOverrideModel(level, wi, inp.files[0]);
                inp.value = '';
            });
        });
        refs.waveList.querySelectorAll('[data-wave-model-drop]').forEach(function (zone) {
            zone.addEventListener('dragover', function (e) {
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
            });
            zone.addEventListener('drop', function (e) {
                e.preventDefault();
                var wi = Number(zone.getAttribute('data-wave-model-drop'));
                var wave = level.waveRules[wi];
                if (!wave || !e.dataTransfer.files || !e.dataTransfer.files[0]) return;
                applyWaveOverrideModel(level, wi, e.dataTransfer.files[0]);
            });
        });
    }

    async function applyWaveOverrideModel(level, waveIndex, file) {
        try {
            setStatus('正在上传「' + file.name + '」…', 'idle');
            var url = await uploadFileToProjectUrl(file, { gameModelsUpload: true, gameModelsSubdir: 'Waves' });
            var wave = level.waveRules[waveIndex];
            if (!wave) {
                setStatus('找不到对应波次', 'error');
                return;
            }
            if (!url) {
                setStatus('上传成功但未返回 publicUrl', 'error');
                return;
            }
            wave.overrideModelPath = url;
            markDirty('已绑定波次模型');
            renderWaveList();
            setStatus(
                '波次 #' + String(wave.waveNumber || waveIndex + 1) + ' 已绑定「' + file.name + '」 · ' + modelBindShortLabel(url),
                'success'
            );
        } catch (error) {
            setStatus('上传失败：' + ((error && error.message) || String(error)), 'error');
        }
    }

    function addWaveRule() {
        var level = getLevel();
        if (!level) return;
        var enemies = getAvailableEnemyTypes(level);
        var enemy = enemies[0] || createEnemyTypeFromTemplates(level);
        var spawn = level.map.spawnPoints[0];
        level.waveRules.push({
            id: uid('wave'),
            waveNumber: level.waveRules.length + 1,
            enemyTypeId: enemy.id,
            count: 12,
            interval: 1.2,
            spawnPointId: spawn ? spawn.id : '',
            pathId: 'path-main',
            reward: 50,
            overrideModelPath: '',
            overrideModelScale: 1
        });
        markDirty('已新增波次');
        renderWaveList();
        renderOverview();
    }

    function editWaveRule(index) {
        var level = getLevel();
        var wave = level.waveRules[index];
        if (!wave) return;
        var enemies = getAvailableEnemyTypes(level);
        var enemyPrompt = enemies.map(function (enemy) { return enemy.id + ':' + enemy.name; }).join('\n');
        if (enemyPrompt) {
            var enemyTypeId = window.prompt('敌人 ID（可用候选）\n' + enemyPrompt, String(wave.enemyTypeId || enemies[0].id));
            if (enemyTypeId !== null) wave.enemyTypeId = String(enemyTypeId || wave.enemyTypeId || enemies[0].id);
        }
        var count = window.prompt('敌人数量', String(wave.count));
        if (count !== null) wave.count = Math.max(1, Number(count) || wave.count);
        var interval = window.prompt('刷新间隔（秒）', String(wave.interval));
        if (interval !== null) wave.interval = Math.max(0.1, Number(interval) || wave.interval);
        markDirty('已更新波次');
        renderWaveList();
    }

    function removeWaveRule(index) {
        var level = getLevel();
        level.waveRules.splice(index, 1);
        level.waveRules.forEach(function (wave, waveIndex) { wave.waveNumber = waveIndex + 1; });
        markDirty('已删除波次');
        renderWaveList();
        renderOverview();
    }

    function renderModelAssets() {
        var assets = getBrowsableModelAssets();
        if (!assets.length) {
            refs.modelAssetList.innerHTML = '<div class="empty-state">暂无模型资产。上传模型后可作为 Actor 使用。</div>';
            return;
        }
        refs.modelAssetList.innerHTML = assets.map(function (asset) {
            return [
                '<div class="list-item">',
                '  <strong>' + escapeHtml(asset.name) + '</strong>',
                '  <span>' + escapeHtml(asset.path || asset.url || '未设置路径') + '</span>',
                '  <div class="inline-controls">',
                '    <button class="mini-button" data-model-template="' + escapeAttr(asset.id) + '">变成 Actor 模板</button>',
                '  </div>',
                '</div>'
            ].join('');
        }).join('');
        refs.modelAssetList.querySelectorAll('[data-model-template]').forEach(function (button) {
            button.addEventListener('click', function () {
                createActorTemplateFromModel(button.getAttribute('data-model-template'));
            });
        });
    }

    async function uploadModelAsset(file) {
        try {
            setStatus('正在上传模型 ' + file.name + '…', 'idle');
            var url = await uploadFileToProjectUrl(file, { gameModelsUpload: true, gameModelsSubdir: '' });
            var id = uniqueCatalogId(state.catalog.modelAssets, slugify(file.name.replace(/\.[^.]+$/, '')) || 'uploaded-model');
            state.catalog.modelAssets.push({
                id: id,
                name: file.name.replace(/\.[^.]+$/, ''),
                summary: '上传的自定义模型',
                path: url || ''
            });
            createActorTemplateFromModel(id);
            refs.modelUpload.value = '';
            markDirty('已上传模型');
            renderAll();
        } catch (error) {
            refs.modelUpload.value = '';
            setStatus('模型上传失败: ' + error.message, 'error');
        }
    }

    function createActorTemplateFromSelection() {
        var name = window.prompt('Actor 模板名称', '新 Actor 模板');
        if (!name) return;
        var id = uniqueTemplateId(state.actorTemplates, slugify(name) || 'custom-actor');
        state.actorTemplates.push({
            id: id,
            name: name,
            category: 'model',
            modelId: '',
            modelPath: '',
            templateModelScale: 1,
            icon: name.charAt(0).toUpperCase(),
            stats: { hp: 100, attack: 0, range: 1, fireRate: 0, cost: 0, cooldown: 0 }
        });
        selectedTemplateId = id;
        markDirty('已新增 Actor 模板');
        renderActorPalette();
    }

    function createActorTemplateFromModel(modelId) {
        var asset = getBrowsableModelAssets().find(function (item) { return item.id === modelId; });
        if (!asset) return;
        var id = uniqueTemplateId(state.actorTemplates, 'model-' + modelId);
        state.actorTemplates.push({
            id: id,
            name: asset.name + ' Actor',
            category: 'model',
            modelId: modelId,
            modelPath: asset.path || asset.publicUrl || '',
            templateModelScale: 1,
            icon: 'M',
            stats: { hp: 1, attack: 0, range: 1, fireRate: 0, cost: 0, cooldown: 0 }
        });
        selectedTemplateId = id;
        markDirty('已从模型创建 Actor 模板');
        renderActorPalette();
    }

    function applyMapSize() {
        var level = getLevel();
        if (!level) return;
        var cols = clamp(Number(refs.fieldGridCols.value) || DEFAULT_GRID_COLS, 8, 80);
        var rows = clamp(Number(refs.fieldGridRows.value) || DEFAULT_GRID_ROWS, 8, 80);
        var tileSize = clamp(Number(refs.fieldTileSize.value) || DEFAULT_TILE_SIZE, 1, 10);
        level.map.grid.cols = cols;
        level.map.grid.rows = rows;
        level.map.grid.tileSize = tileSize;
        ensureExplorationLayout(level.map).grid = { cols: cols, rows: rows, tileSize: tileSize };
        trimMapToBounds(level.map);
        markDirty('已更新地图尺寸');
        renderAll();
        syncPreviewIfOpen();
    }

    function updateGeoFromFields() {
        var level = getLevel();
        if (!level || !refs.fieldGeoEnabled) return;
        var builtInDefault = BUILT_IN_CITY_LAYOUTS[matchBuiltInCity(level)] && BUILT_IN_CITY_LAYOUTS[matchBuiltInCity(level)].geo;
        var fallback = builtInDefault || normalizeGeoConfig(level.map.geo);
        var enabled = refs.fieldGeoEnabled.value === 'true';
        var lat = Number(refs.fieldGeoLat.value);
        var lon = Number(refs.fieldGeoLon.value);
        if (!Number.isFinite(lat)) lat = fallback.center.lat;
        if (!Number.isFinite(lon)) lon = fallback.center.lon;
        level.map.geo = normalizeGeoConfig({
            enabled: enabled,
            provider: 'cesium-ion',
            assetId: refs.fieldGeoAssetId.value || fallback.assetId || DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID,
            center: {
                lat: lat,
                lon: lon,
                heightMeters: Number(refs.fieldGeoHeight.value) || fallback.center.heightMeters || 0
            },
            extentMeters: Number(refs.fieldGeoExtent.value) || fallback.extentMeters || 1000,
            rotationDeg: Number(refs.fieldGeoRotation.value) || 0,
            yOffsetMeters: Number(refs.fieldGeoYOffset.value) || 0,
            boardHeightMeters: Number(refs.fieldGeoBoardHeight && refs.fieldGeoBoardHeight.value) || fallback.boardHeightMeters || 32,
            scale: fallback.scale || 1
        });
        level.status = level.status === 'draft' ? 'needs-work' : level.status;
        markDirty('已更新真实地图配置');
        syncPreviewIfOpen();
    }

    function closeCreateLevelModal() {
        if (!refs.createLevelModal) return;
        refs.createLevelModal.classList.add('view-hidden');
        refs.createLevelModal.setAttribute('aria-hidden', 'true');
    }

    function resetCreateLevelModal() {
        refs.newLevelName.value = '';
        refs.newLevelRegionSearch.value = '';
        delete refs.newLevelRegionSearch.dataset.code;
        delete refs.newLevelRegionSearch.dataset.kind;
        refs.newLevelPlaceSearch.value = '';
        delete refs.newLevelPlaceSearch.dataset.name;
        refs.newLevelPlaceDropdown.classList.add('view-hidden');
        refs.newLevelPlaceDropdown.innerHTML = '';
        refs.selectedPlacePreview.classList.add('view-hidden');
        refs.selectedPlaceName.textContent = '';
        refs.selectedPlaceCoords.textContent = '';
        refs.newLevelLat.value = '';
        refs.newLevelLon.value = '';
        refs.newLevelRegionDropdown.classList.add('view-hidden');
        refs.newLevelRegionDropdown.innerHTML = '';
    }

    function createManualLevel() {
        if (!refs.createLevelModal) return;
        resetCreateLevelModal();
        refs.createLevelModal.classList.remove('view-hidden');
        refs.createLevelModal.setAttribute('aria-hidden', 'false');
        setTimeout(function () { refs.newLevelName.focus(); }, 0);
    }

    function setSelectedCreateLevelPlace(place, options) {
        if (!place) return;
        var lat = String(place.latitude || '').trim();
        var lon = String(place.longitude || '').trim();
        var name = String(place.name || '').trim() || '未命名位置';
        refs.newLevelPlaceSearch.value = name;
        refs.newLevelPlaceSearch.dataset.name = name;
        refs.newLevelLat.value = lat;
        refs.newLevelLon.value = lon;
        refs.selectedPlaceName.textContent = name;
        refs.selectedPlaceCoords.textContent = '经度: ' + lon + ', 纬度: ' + lat;
        refs.selectedPlacePreview.classList.remove('view-hidden');
        if (!options || !options.keepDropdown) {
            refs.newLevelPlaceDropdown.classList.add('view-hidden');
        }
    }

    function renderPlaceSearchResults(results) {
        var selectedLat = refs.newLevelLat.value;
        var selectedLon = refs.newLevelLon.value;
        refs.newLevelPlaceDropdown.innerHTML = results.map(function (place, index) {
            var selected = place.latitude === selectedLat && place.longitude === selectedLon;
            var typeLabel = place.type ? ' · ' + escapeHtml(place.type) : '';
            return [
                '<button type="button" class="dropdown-item place-result-item' + (selected ? ' selected' : '') + '"',
                ' data-lat="' + escapeAttr(place.latitude) + '"',
                ' data-lon="' + escapeAttr(place.longitude) + '"',
                ' data-name="' + escapeAttr(place.name) + '"',
                '>',
                '<strong>' + escapeHtml(index === 0 ? place.name + '（最佳匹配）' : place.name) + '</strong>',
                '<span>经度 ' + escapeHtml(place.longitude) + ' · 纬度 ' + escapeHtml(place.latitude) + typeLabel + '</span>',
                '</button>'
            ].join('');
        }).join('');
        refs.newLevelPlaceDropdown.classList.toggle('view-hidden', results.length === 0);
    }

    async function searchCreateLevelPlace() {
        var q = refs.newLevelPlaceSearch.value.trim();
        if (!q) {
            setStatus('请输入要搜索的地点', 'error');
            refs.newLevelPlaceSearch.focus();
            return;
        }
        setStatus('正在搜索地点：' + q + '...', 'idle');
        refs.btnSearchPlace.disabled = true;
        refs.newLevelPlaceDropdown.innerHTML = '<div class="dropdown-item dropdown-item-muted">搜索中...</div>';
        refs.newLevelPlaceDropdown.classList.remove('view-hidden');
        try {
            var url = 'https://nominatim.openstreetmap.org/search?format=json&q=' +
                encodeURIComponent(q) +
                '&limit=8&accept-language=zh-CN&addressdetails=1';
            var res = await fetch(url);
            if (!res.ok) throw new Error('网络请求失败');
            var data = await res.json();
            var results = (Array.isArray(data) ? data : [])
                .map(normalizePlaceSearchResult)
                .filter(Boolean)
                .sort(function (a, b) { return b.importance - a.importance; });
            if (!results.length) {
                refs.newLevelPlaceDropdown.innerHTML = '<div class="dropdown-item dropdown-item-muted">未找到相关地点</div>';
                refs.selectedPlacePreview.classList.add('view-hidden');
                setStatus('未找到相关地点', 'error');
                return;
            }
            setSelectedCreateLevelPlace(results[0], { keepDropdown: true });
            renderPlaceSearchResults(results);
            setStatus('已自动填入最匹配地点的经纬度，可在列表中切换', 'success');
        } catch (err) {
            refs.newLevelPlaceDropdown.innerHTML = '<div class="dropdown-item dropdown-item-muted">搜索失败，请稍后重试</div>';
            setStatus('地点搜索失败: ' + err.message, 'error');
        } finally {
            refs.btnSearchPlace.disabled = false;
        }
    }

    function useCurrentLocationForCreateLevel() {
        if (!navigator.geolocation) {
            setStatus('当前浏览器不支持地理定位', 'error');
            return;
        }
        refs.btnUseCurrentLocation.disabled = true;
        setStatus('正在获取当前位置...', 'idle');
        navigator.geolocation.getCurrentPosition(async function (position) {
            var lon = Number(position.coords.longitude).toFixed(6);
            var lat = Number(position.coords.latitude).toFixed(6);
            var name = '当前位置';
            try {
                var response = await fetch('https://nominatim.openstreetmap.org/reverse?format=json&lon=' + encodeURIComponent(lon) + '&lat=' + encodeURIComponent(lat) + '&accept-language=zh-CN');
                if (response.ok) {
                    var data = await response.json();
                    name = data.display_name || name;
                }
            } catch (error) {}
            setSelectedCreateLevelPlace({ name: name, longitude: lon, latitude: lat });
            refs.newLevelPlaceDropdown.classList.add('view-hidden');
            refs.btnUseCurrentLocation.disabled = false;
            setStatus('已填入当前位置', 'success');
        }, function (error) {
            refs.btnUseCurrentLocation.disabled = false;
            setStatus('获取当前位置失败: ' + error.message, 'error');
        }, { enableHighAccuracy: true, timeout: 10000 });
    }

    function confirmCreateLevel() {
        var name = refs.newLevelName.value.trim();
        if (!name) {
            setStatus('请输入关卡名称', 'error');
            return;
        }
        var regionName = refs.newLevelRegionSearch.value.trim() || '自定义国家';
        var regionKind = refs.newLevelRegionSearch.dataset.kind || 'country';
        var regionCode = refs.newLevelRegionSearch.dataset.code || 'CUSTOM';
        
        var lat = Number(refs.newLevelLat.value);
        var lon = Number(refs.newLevelLon.value);
        var hasGeo = Number.isFinite(lat) && Number.isFinite(lon) && refs.newLevelLat.value !== '' && refs.newLevelLon.value !== '';
        
        var id = uniqueLevelId(state.levels, 'custom-level');
        var level = createDraftLevel({
            id: id,
            name: name,
            countryCode: regionKind === 'country' ? regionCode : 'CN',
            countryName: regionKind === 'country' ? regionName : '中国',
            cityCode: regionKind === 'city' ? regionCode : '',
            cityName: regionKind === 'city' ? regionName : (regionKind === 'country' ? '' : '自定义城市'),
            regionLabel: regionName,
            source: 'manual'
        });
        
        if (hasGeo) {
            level.map.geo = {
                enabled: true,
                provider: 'cesium-ion',
                assetId: DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID,
                center: { lat: lat, lon: lon, heightMeters: 45 },
                extentMeters: 1400,
                rotationDeg: 0,
                boardHeightMeters: 32,
                scale: 1
            };
            level.extensions = level.extensions || {};
            level.extensions.manualWorldGeoPin = true;
            level.extensions.placeSearchName = refs.newLevelPlaceSearch.dataset.name || refs.newLevelPlaceSearch.value.trim() || '';
        }
        
        state.levels.unshift(level);
        selectedLevelId = level.id;
        markDirty('已创建新关卡：' + name);
        renderAll();
        
        closeCreateLevelModal();
        setStatus('已创建新关卡，已自动选中', 'success');
    }

    function bindCreateLevelModalEvents() {
        if (!refs.btnCancelCreateLevel) return;
        refs.btnCancelCreateLevel.addEventListener('click', closeCreateLevelModal);
        refs.newLevelRegionSearch.addEventListener('input', function() {
            var q = refs.newLevelRegionSearch.value.trim().toLowerCase();
            if (!q) {
                refs.newLevelRegionDropdown.classList.add('view-hidden');
                return;
            }
            var results = [];
            regionSources.countries.forEach(function(c) {
                if (c.name.toLowerCase().indexOf(q) !== -1 || (c.code && c.code.toLowerCase().indexOf(q) !== -1)) {
                    results.push({ name: c.name, code: c.code, kind: 'country' });
                }
            });
            regionSources.chinaCities.forEach(function(c) {
                if (c.name.toLowerCase().indexOf(q) !== -1 || (c.code && c.code.toLowerCase().indexOf(q) !== -1)) {
                    results.push({ name: c.name, code: c.code, kind: 'city', parent: '中国' });
                }
            });
            if (results.length > 0) {
                refs.newLevelRegionDropdown.innerHTML = results.slice(0, 10).map(function(r) {
                    var label = r.kind === 'country' ? r.name : (r.parent + ' ' + r.name);
                    return '<div class="dropdown-item" data-name="' + escapeAttr(r.name) + '" data-code="' + escapeAttr(r.code) + '" data-kind="' + escapeAttr(r.kind) + '">' + escapeHtml(label) + '</div>';
                }).join('');
                refs.newLevelRegionDropdown.classList.remove('view-hidden');
            } else {
                refs.newLevelRegionDropdown.classList.add('view-hidden');
            }
        });
        refs.newLevelRegionDropdown.addEventListener('click', function(e) {
            var item = e.target.closest('.dropdown-item');
            if (item) {
                refs.newLevelRegionSearch.value = item.getAttribute('data-name');
                refs.newLevelRegionDropdown.classList.add('view-hidden');
                refs.newLevelRegionSearch.dataset.code = item.getAttribute('data-code');
                refs.newLevelRegionSearch.dataset.kind = item.getAttribute('data-kind');
            }
        });
        document.addEventListener('click', function(e) {
            if (refs.newLevelRegionSearch && !refs.newLevelRegionSearch.contains(e.target) && !refs.newLevelRegionDropdown.contains(e.target)) {
                refs.newLevelRegionDropdown.classList.add('view-hidden');
            }
            if (refs.newLevelPlaceSearch && !refs.newLevelPlaceSearch.contains(e.target) && !refs.newLevelPlaceDropdown.contains(e.target)) {
                refs.newLevelPlaceDropdown.classList.add('view-hidden');
            }
        });
        
        refs.newLevelPlaceSearch.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchCreateLevelPlace();
            }
        });
        
        refs.btnSearchPlace.addEventListener('click', searchCreateLevelPlace);
        if (refs.btnUseCurrentLocation) refs.btnUseCurrentLocation.addEventListener('click', useCurrentLocationForCreateLevel);
        
        refs.newLevelPlaceDropdown.addEventListener('click', function(e) {
            var item = e.target.closest('.dropdown-item');
            if (item && item.getAttribute('data-lat')) {
                setSelectedCreateLevelPlace({
                    latitude: item.getAttribute('data-lat'),
                    longitude: item.getAttribute('data-lon'),
                    name: item.getAttribute('data-name')
                });
                setStatus('已选择位置: ' + item.getAttribute('data-name'), 'success');
            }
        });
        if (refs.btnCancelCreateLevelAlt) {
            refs.btnCancelCreateLevelAlt.addEventListener('click', closeCreateLevelModal);
        }
        refs.btnConfirmCreateLevel.addEventListener('click', confirmCreateLevel);
    }

    function syncPreviewIfOpen(viewOpts) {
        viewOpts = viewOpts || {};
        var preserve = viewOpts.preserveView !== false;
        if (viewportViewMode !== 'preview' || !previewApi || typeof previewApi.refresh !== 'function') return;
        var sid = selectedObject && selectedObject.kind === 'actor' ? selectedObject.id : null;
        previewApi.refresh({ preserveView: preserve, selectActorId: sid });
    }

    function selectLevel(levelId) {
        selectedLevelId = levelId;
        selectedObject = null;
        selectedGameplayEntryId = '';
        selectedGameplayAssetId = '';
        themeEditorCacheKey = '';
        renderAll();
        syncPreviewIfOpen({ preserveView: false });
    }

    function selectObject(kind, id) {
        selectedObject = { kind: kind, id: id };
        renderSelectionInspector();
        renderMap();
        if (viewportViewMode === 'preview' && previewApi && typeof previewApi.setSelectedActor === 'function') {
            if (kind === 'actor') previewApi.setSelectedActor(id);
            else previewApi.setSelectedActor(null);
        }
        renderPreviewSceneOutline();
    }

    function selectGridCellObject(kind, col, row) {
        selectedObject = { kind: kind, col: col, row: row };
        renderSelectionInspector();
        renderMap();
        if (viewportViewMode === 'preview' && previewApi && typeof previewApi.setSelectedActor === 'function') {
            previewApi.setSelectedActor(null);
        }
        renderPreviewSceneOutline();
    }

    function deleteSelection() {
        var level = getLevel();
        if (!level || !selectedObject) return;
        var layout = ensureExplorationLayout(level.map);
        if (selectedObject.kind === 'actor') level.map.actors = level.map.actors.filter(function (item) { return item.id !== selectedObject.id; });
        if (selectedObject.kind === 'spawn') {
            if (activeEditorMode === 'explore' && layout.startPoint && layout.startPoint.id === selectedObject.id) layout.startPoint = null;
            else level.map.spawnPoints = level.map.spawnPoints.filter(function (item) { return item.id !== selectedObject.id; });
        }
        if (selectedObject.kind === 'explorePoint') level.map.explorationPoints = level.map.explorationPoints.filter(function (item) { return item.id !== selectedObject.id; });
        if (selectedObject.kind === 'objective') {
            if (activeEditorMode === 'explore' && layout.exitPoint && layout.exitPoint.id === selectedObject.id) layout.exitPoint = null;
            else level.map.objectivePoint = null;
        }
        if (selectedObject.kind === 'obstacleCell') {
            if (activeEditorMode === 'explore') removeCell(layout.obstacles, selectedObject.col, selectedObject.row);
            else removeCell(level.map.obstacles, selectedObject.col, selectedObject.row);
        }
        if (selectedObject.kind === 'pathCell') {
            if (activeEditorMode === 'explore') removeCell(layout.path, selectedObject.col, selectedObject.row);
            else
                level.map.enemyPaths.forEach(function (p) {
                    removeCell(p.cells, selectedObject.col, selectedObject.row);
                });
        }
        if (selectedObject.kind === 'buildSlotCell') removeCell(level.map.buildSlots, selectedObject.col, selectedObject.row);
        if (selectedObject.kind === 'safeZoneCell') {
            if (!Array.isArray(layout.safeZones)) layout.safeZones = [];
            removeCell(layout.safeZones, selectedObject.col, selectedObject.row);
        }
        if (selectedObject.kind === 'boardImage') {
            if (Array.isArray(level.map.boardImageLayers)) {
                level.map.boardImageLayers = level.map.boardImageLayers.filter(function (layer) {
                    return layer.id !== selectedObject.id;
                });
            }
            clearBoardImageInteractionState();
        }
        selectedObject = null;
        markDirty('已删除选中对象');
        renderAll();
        syncPreviewIfOpen();
    }

    function mergeRuntimeCityGameplayConfigs(raw) {
        if (!raw || typeof raw !== 'object' || !state) return 0;
        var normalized = normalizeCityGameplayConfigs(raw);
        var imported = 0;
        Object.keys(normalized).forEach(function (key) {
            var runtimeConfig = normalized[key];
            var resolvedKey = resolveCityGameplayConfigKey({
                key: key,
                cityCode: runtimeConfig.cityCode,
                cityName: runtimeConfig.cityName
            }, key);
            if (!state.cityGameplayConfigs[resolvedKey]) {
                state.cityGameplayConfigs[resolvedKey] = {
                    cityCode: runtimeConfig.cityCode,
                    cityName: runtimeConfig.cityName,
                    aliases: runtimeConfig.aliases || [],
                    enemies: [],
                    characters: [],
                    skills: [],
                    towers: [],
                    cards: [],
                    updatedAt: runtimeConfig.updatedAt || ''
                };
            }
            var target = state.cityGameplayConfigs[resolvedKey];
            target.cityCode = target.cityCode || runtimeConfig.cityCode;
            target.cityName = target.cityName || runtimeConfig.cityName;
            target.aliases = mergeDistinctStrings(target.aliases || [], runtimeConfig.aliases || [], [target.cityCode, target.cityName, runtimeConfig.cityCode, runtimeConfig.cityName]);
            ['enemies', 'characters', 'skills', 'towers', 'cards'].forEach(function (kind) {
                imported += mergeGameplayEntryList(target[kind], runtimeConfig[kind]);
            });
        });
        return imported;
    }

    /**
     * 与 src/game/defense/defense-runtime.ts 中 createEnemyForWave 的兵种分支一致（EnemyType）。
     * 表中数值为波次 1 的近似基准；游戏中仍随波次动态增强。
     */

    function getGameplayCityContext() {
        var level = getLevel();
        if (!level || !level.location) return null;
        var cityName = String(level.location.cityName || '').trim();
        var cityCode = String(level.location.cityCode || slugify(cityName || level.id || 'city')).trim();
        if (!cityName && !cityCode) return null;
        return {
            cityCode: cityCode || slugify(cityName || 'city'),
            cityName: cityName || level.name || '未命名城市',
            key: cityCode || slugify(cityName || level.name || 'city')
        };
    }

    function resolveCityGameplayConfigKey(cityContext, preferredKey) {
        if (!state || !state.cityGameplayConfigs) return preferredKey || cityContext.key || cityContext.cityCode || slugify(cityContext.cityName || 'city');
        var desired = mergeDistinctStrings(
            preferredKey,
            cityContext.key,
            cityContext.cityCode,
            cityContext.cityName,
            slugify(cityContext.cityName || '')
        ).map(normalizeCityIdentity).filter(Boolean);
        var keys = Object.keys(state.cityGameplayConfigs);
        for (var i = 0; i < keys.length; i += 1) {
            var key = keys[i];
            var config = state.cityGameplayConfigs[key];
            var candidates = mergeDistinctStrings(key, config.cityCode, config.cityName, config.aliases || []).map(normalizeCityIdentity).filter(Boolean);
            if (candidates.some(function (candidate) { return desired.indexOf(candidate) !== -1; })) {
                return key;
            }
        }
        return preferredKey || cityContext.key || cityContext.cityCode || slugify(cityContext.cityName || 'city');
    }

    function ensureCityGameplayConfig(cityContext) {
        var resolvedKey = resolveCityGameplayConfigKey(cityContext);
        if (!state.cityGameplayConfigs[resolvedKey]) {
            state.cityGameplayConfigs[resolvedKey] = {
                cityCode: cityContext.cityCode,
                cityName: cityContext.cityName,
                aliases: mergeDistinctStrings(cityContext.cityName, cityContext.cityCode),
                enemies: [],
                characters: [],
                skills: [],
                towers: [],
                cards: [],
                updatedAt: ''
            };
        }
        if (!Array.isArray(state.cityGameplayConfigs[resolvedKey].towers)) {
            state.cityGameplayConfigs[resolvedKey].towers = buildDefaultTowerEntries(state.cityGameplayConfigs[resolvedKey]);
        }
        if (!Array.isArray(state.cityGameplayConfigs[resolvedKey].cards)) {
            state.cityGameplayConfigs[resolvedKey].cards = buildDefaultCardEntries(state.cityGameplayConfigs[resolvedKey]);
        }
        if (!Array.isArray(state.cityGameplayConfigs[resolvedKey].enemies)) {
            state.cityGameplayConfigs[resolvedKey].enemies = [];
        }
        if (!state.cityGameplayConfigs[resolvedKey].enemies.length) {
            state.cityGameplayConfigs[resolvedKey].enemies = buildDefaultEnemyEntries(state.cityGameplayConfigs[resolvedKey]);
        }
        return state.cityGameplayConfigs[resolvedKey];
    }

    function createGameplayEntry() {
        var cityContext = getGameplayCityContext();
        if (!cityContext) {
            setStatus('请先在左侧选择一个带城市信息的关卡', 'error');
            return;
        }
        var config = ensureCityGameplayConfig(cityContext);
        var kindLabel = GAMEPLAY_RESOURCE_CONFIG[activeGameplayTab].label;
        var id = uniqueGameplayEntryId(config[activeGameplayTab], slugify(cityContext.cityName + '-' + kindLabel) || activeGameplayTab);
        config[activeGameplayTab].push({
            id: id,
            name: cityContext.cityName + '·新' + kindLabel,
            summary: '',
            tags: [cityContext.cityName],
            rarity: 'common',
            placement: activeGameplayTab === 'characters' || activeGameplayTab === 'towers' ? 'roadside' : '',
            stats: {},
            assetRefs: {},
            cityCode: cityContext.cityCode,
            cityName: cityContext.cityName,
            updatedAt: new Date().toISOString()
        });
        selectedGameplayEntryId = id;
        markDirty('已新增' + kindLabel + '条目');
        renderGameplayEditor();
    }

    function duplicateGameplayEntry() {
        var collection = getGameplayCollection();
        var entry = getSelectedGameplayEntry();
        if (!collection || !entry) return;
        var copy = clone(entry);
        copy.id = uniqueGameplayEntryId(collection, entry.id + '-copy');
        copy.name = entry.name + ' 复制';
        copy.updatedAt = new Date().toISOString();
        var index = collection.findIndex(function (item) { return item.id === entry.id; });
        collection.splice(index + 1, 0, copy);
        selectedGameplayEntryId = copy.id;
        selectedGameplayAssetId = '';
        markDirty('已复制玩法条目');
        renderGameplayEditor();
    }

    function deleteGameplayEntry() {
        var collection = getGameplayCollection();
        var entry = getSelectedGameplayEntry();
        if (!collection || !entry) return;
        if (!window.confirm('确定删除「' + entry.name + '」吗？')) return;
        var index = collection.findIndex(function (item) { return item.id === entry.id; });
        if (index === -1) return;
        collection.splice(index, 1);
        selectedGameplayEntryId = collection[index] ? collection[index].id : collection[index - 1] ? collection[index - 1].id : '';
        selectedGameplayAssetId = '';
        markDirty('已删除玩法条目');
        renderGameplayEditor();
    }

    function moveGameplayEntry(direction) {
        var collection = getGameplayCollection();
        var entry = getSelectedGameplayEntry();
        if (!collection || !entry || !direction) return;
        var index = collection.findIndex(function (item) { return item.id === entry.id; });
        var targetIndex = index + direction;
        if (index < 0 || targetIndex < 0 || targetIndex >= collection.length) return;
        var moved = collection.splice(index, 1)[0];
        collection.splice(targetIndex, 0, moved);
        selectedGameplayEntryId = moved.id;
        markDirty(direction < 0 ? '已上移玩法条目' : '已下移玩法条目');
        renderGameplayEditor();
    }

    function getGameplayCollection() {
        var cityContext = getGameplayCityContext();
        if (!cityContext) return null;
        return ensureCityGameplayConfig(cityContext)[activeGameplayTab];
    }

    function getSelectedGameplayEntry(entries) {
        var list = Array.isArray(entries) ? entries : getGameplayCollection();
        if (!Array.isArray(list) || !list.length) return null;
        var found = list.find(function (item) { return item.id === selectedGameplayEntryId; }) || null;
        if (!found) {
            selectedGameplayEntryId = list[0].id;
            found = list[0];
        }
        return found;
    }

    function handleGameplayFormInput(target) {
        var entry = getSelectedGameplayEntry();
        var list = getGameplayCollection();
        if (!entry || !list || !target) return;
        if (target.name === 'name') {
            entry.name = String(target.value || '').trim();
            if (refs.gameplayAssetName && !refs.gameplayAssetName.value) refs.gameplayAssetName.value = entry.name;
            markDirty('已更新玩法条目名称');
            renderGameplayEditor();
            return;
        }
        if (target.name === 'id') {
            var nextId = ensureUniqueGameplayEntryId(list, target.value, entry.id);
            entry.id = nextId;
            selectedGameplayEntryId = nextId;
            if (refs.gameplayId && refs.gameplayId.value !== nextId) refs.gameplayId.value = nextId;
            markDirty('已更新玩法条目 ID');
            renderGameplayEditor();
            return;
        }
        if (target.name === 'tags') {
            entry.tags = String(target.value || '').split(',').map(function (part) { return part.trim(); }).filter(Boolean);
            markDirty('已更新玩法标签');
            renderGameplayEntryList(getFilteredGameplayEntries(), getGameplayCityContext());
            return;
        }
        if (target.name === 'rarity') {
            entry.rarity = String(target.value || '').trim();
            markDirty('已更新玩法稀有度');
            renderGameplayEntryList(getFilteredGameplayEntries(), getGameplayCityContext());
            return;
        }
        if (target.name === 'summary') {
            entry.summary = String(target.value || '');
            markDirty('已更新玩法简介');
            renderGameplayEntryList(getFilteredGameplayEntries(), getGameplayCityContext());
            return;
        }
        if (target.hasAttribute('data-gameplay-placement')) {
            entry.placement = normalizeGameplayPlacement(target.value);
            markDirty('已更新单位部署位置');
            renderGameplayEntryList(getFilteredGameplayEntries(), getGameplayCityContext());
            return;
        }
        if (target.hasAttribute('data-gameplay-stat')) {
            var statKey = target.getAttribute('data-gameplay-stat');
            var numeric = Number(target.value);
            if (!entry.stats || typeof entry.stats !== 'object') entry.stats = {};
            entry.stats[statKey] = Number.isFinite(numeric) ? numeric : 0;
            markDirty('已更新玩法数值');
        }
    }

    function getFilteredGameplayEntries() {
        var config = getGameplayCityContext();
        var collection = config ? ensureCityGameplayConfig(config)[activeGameplayTab] : [];
        var keyword = refs.gameplaySearch ? String(refs.gameplaySearch.value || '').trim().toLowerCase() : '';
        return collection.filter(function (entry) {
            if (!keyword) return true;
            var haystack = [entry.name, entry.id, entry.summary].concat(entry.tags || []).join(' ').toLowerCase();
            return haystack.indexOf(keyword) !== -1;
        });
    }

    function ensureUniqueGameplayEntryId(list, value, currentId) {
        var baseId = String(value || '').trim().replace(/\s+/g, '-');
        if (!baseId) baseId = currentId || uid(activeGameplayTab);
        var candidate = baseId;
        var serial = 1;
        while (list.some(function (item) { return item.id === candidate && item.id !== currentId; })) {
            candidate = baseId + '-' + String(serial);
            serial += 1;
        }
        return candidate;
    }

    function getGameplayAssets(cityContext, assetType) {
        return (state.editorAssetsCatalog || []).filter(function (asset) {
            return asset.cityCode === cityContext.cityCode && asset.assetType === assetType;
        });
    }

    function bindGameplayAsset(assetId, bindKey) {
        var entry = getSelectedGameplayEntry();
        if (!entry) {
            setStatus('请先选择一个玩法条目', 'error');
            return;
        }
        var asset = (state.editorAssetsCatalog || []).find(function (item) { return item.id === assetId; });
        if (!asset) return;
        if (!entry.assetRefs || typeof entry.assetRefs !== 'object') entry.assetRefs = {};
        entry.assetRefs[bindKey] = asset.publicUrl || asset.path;
        if (bindKey === 'modelPath') entry.assetRefs.modelId = asset.id;
        if (bindKey === 'imagePath') entry.assetRefs.imageId = asset.id;
        entry.updatedAt = new Date().toISOString();
        selectedGameplayAssetId = asset.id;
        markDirty('已绑定项目资源');
        renderGameplayEditor();
    }

    async function uploadGameplayAsset(file) {
        var cityContext = getGameplayCityContext();
        if (!cityContext) {
            refs.gameplayAssetUpload.value = '';
            setStatus('请先选择一个城市关卡再上传资源', 'error');
            return;
        }
        var assetType = refs.gameplayAssetType ? refs.gameplayAssetType.value || GAMEPLAY_RESOURCE_CONFIG[activeGameplayTab].assetType : GAMEPLAY_RESOURCE_CONFIG[activeGameplayTab].assetType;
        var assetName = refs.gameplayAssetName && refs.gameplayAssetName.value ? refs.gameplayAssetName.value.trim() : file.name.replace(/\.[^.]+$/, '');
        try {
            setStatus('正在保存城市资源 ' + file.name + '…', 'idle');
            var content = await fileToBase64(file);
            var response = await fetch('/api/editor-assets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: file.name,
                    content: content,
                    cityCode: cityContext.cityCode,
                    cityName: cityContext.cityName,
                    assetType: assetType,
                    resourceKind: activeGameplayTab,
                    assetName: assetName
                })
            });
            if (!response.ok) throw new Error('上传失败: ' + response.status);
            var payload = await response.json();
            var id = String(payload.id || uniqueCatalogId(state.editorAssetsCatalog || [], slugify(cityContext.cityName + '-' + assetName) || 'editor-asset'));
            state.editorAssetsCatalog = state.editorAssetsCatalog || [];
            state.editorAssetsCatalog = state.editorAssetsCatalog.filter(function (item) { return item.id !== id; });
            state.editorAssetsCatalog.push({
                id: id,
                name: String(payload.name || assetName),
                assetType: String(payload.assetType || assetType),
                resourceKind: String(payload.resourceKind || activeGameplayTab),
                cityCode: cityContext.cityCode,
                cityName: cityContext.cityName,
                path: String(payload.projectPath || ''),
                projectPath: String(payload.projectPath || ''),
                publicUrl: String(payload.publicUrl || ''),
                summary: cityContext.cityName + ' · ' + assetName,
                updatedAt: new Date().toISOString()
            });
            if (refs.gameplayAssetName) refs.gameplayAssetName.value = assetName;
            refs.gameplayAssetUpload.value = '';
            markDirty('已保存城市资源到项目');
            var selectedEntry = getSelectedGameplayEntry();
            if (selectedEntry) {
                var bindKey = /\.(png|jpg|jpeg|webp)$/i.test(file.name) ? 'imagePath' : 'modelPath';
                bindGameplayAsset(id, bindKey);
            } else {
                renderGameplayEditor();
            }
            setStatus('已保存到 ' + String(payload.projectPath || 'public/Arts'), 'success');
        } catch (error) {
            refs.gameplayAssetUpload.value = '';
            setStatus('城市资源保存失败: ' + error.message, 'error');
        }
    }

    function getCurrentCityGameplayConfig() {
        var cityContext = getGameplayCityContext();
        return cityContext ? ensureCityGameplayConfig(cityContext) : null;
    }

    function buildGameplayEnemyTypes(level) {
        var cityContext = getGameplayCityContext();
        var config = cityContext ? ensureCityGameplayConfig(cityContext) : null;
        if (!config) return [];
        return config.enemies.map(function (entry) {
            return {
                id: entry.id,
                name: entry.name,
                modelId: entry.assetRefs && entry.assetRefs.modelId ? entry.assetRefs.modelId : '',
                modelPath: entry.assetRefs && entry.assetRefs.modelPath ? entry.assetRefs.modelPath : '',
                hp: Number(entry.stats && entry.stats.hp) || 100,
                speed: Number(entry.stats && entry.stats.speed) || 1,
                reward: Number(entry.stats && entry.stats.reward) || 20,
                source: 'cityGameplay'
            };
        });
    }

    function getAvailableEnemyTypes(level) {
        var localEnemies = Array.isArray(level && level.enemyTypes) ? level.enemyTypes : [];
        var cityEnemies = buildGameplayEnemyTypes(level);
        var merged = [];
        cityEnemies.concat(localEnemies).forEach(function (enemy) {
            if (!enemy || !enemy.id || merged.some(function (item) { return item.id === enemy.id; })) return;
            merged.push(enemy);
        });
        return merged;
    }

    function buildGameplayActorTemplates() {
        var cityContext = getGameplayCityContext();
        var config = cityContext ? ensureCityGameplayConfig(cityContext) : null;
        if (!config) return [];
        return ['enemies', 'characters', 'skills'].flatMap(function (kind) {
            return config[kind].map(function (entry) {
                var category = kind === 'enemies' ? 'enemy' : kind === 'characters' ? 'npc' : 'model';
                return {
                    id: 'city-template-' + kind + '-' + entry.id,
                    name: entry.name,
                    category: category,
                    modelId: entry.assetRefs && entry.assetRefs.modelId ? entry.assetRefs.modelId : '',
                    modelPath: entry.assetRefs && entry.assetRefs.modelPath ? entry.assetRefs.modelPath : '',
                    templateModelScale: 1,
                    icon: kind === 'enemies' ? 'E' : kind === 'characters' ? 'C' : 'S',
                    source: 'cityGameplay',
                    sourceEntryId: entry.id,
                    sourceKind: kind,
                    stats: Object.assign({ hp: 100, attack: 0, range: 1, fireRate: 0, cost: 0, cooldown: 0 }, entry.stats || {})
                };
            });
        });
    }

    function getAvailableActorTemplates() {
        var merged = [];
        state.actorTemplates.concat(buildGameplayActorTemplates()).forEach(function (template) {
            if (!template || !template.id || merged.some(function (item) { return item.id === template.id; })) return;
            merged.push(template);
        });
        return merged;
    }

    function findActorTemplate(templateId) {
        return getAvailableActorTemplates().find(function (item) { return item.id === templateId; }) || state.actorTemplates[0];
    }

    function setGameplayEntryActionButtons(disabled, entries, entry) {
        var list = Array.isArray(entries) ? entries : [];
        var index = entry ? list.findIndex(function (item) { return item.id === entry.id; }) : -1;
        if (refs.btnDuplicateGameplayEntry) refs.btnDuplicateGameplayEntry.disabled = disabled;
        if (refs.btnDeleteGameplayEntry) refs.btnDeleteGameplayEntry.disabled = disabled;
        if (refs.btnMoveGameplayUp) refs.btnMoveGameplayUp.disabled = disabled || index <= 0;
        if (refs.btnMoveGameplayDown) refs.btnMoveGameplayDown.disabled = disabled || index === -1 || index >= list.length - 1;
    }

    function resolveGameplayEntryThumbnail(entry) {
        if (!entry || !entry.assetRefs) return '';
        return isImageAssetPath(entry.assetRefs.imagePath) ? entry.assetRefs.imagePath : '';
    }

    function getSelectedGameplayAsset(entry, assets) {
        if (!entry && !selectedGameplayAssetId) return null;
        var list = Array.isArray(assets) ? assets : [];
        var picked = selectedGameplayAssetId ? list.find(function (asset) { return asset.id === selectedGameplayAssetId; }) : null;
        if (picked) return picked;
        if (selectedGameplayAssetId) {
            picked = (state.editorAssetsCatalog || []).find(function (asset) { return asset.id === selectedGameplayAssetId; }) || null;
            if (picked) return picked;
        }
        if (entry && entry.assetRefs) {
            var refsToTry = [entry.assetRefs.imagePath, entry.assetRefs.modelPath];
            for (var i = 0; i < refsToTry.length; i += 1) {
                var match = list.find(function (asset) { return asset.publicUrl === refsToTry[i] || asset.path === refsToTry[i] || asset.projectPath === refsToTry[i]; }) ||
                    (state.editorAssetsCatalog || []).find(function (asset) { return asset.publicUrl === refsToTry[i] || asset.path === refsToTry[i] || asset.projectPath === refsToTry[i]; });
                if (match) {
                    selectedGameplayAssetId = match.id;
                    return match;
                }
            }
        }
        selectedGameplayAssetId = list[0] ? list[0].id : '';
        return list[0] || null;
    }

    function renderGameplayAssetPreview(asset, entry) {
        var hasImage = asset && isImageAssetPath(asset.publicUrl || asset.path);
        var hasModel = asset && isModelAssetPath(asset.publicUrl || asset.path);
        if (refs.gameplayPreviewTitle) refs.gameplayPreviewTitle.textContent = asset ? asset.name : (entry ? entry.name : '资源预览');
        if (refs.gameplayPreviewMeta) refs.gameplayPreviewMeta.textContent = asset ? (asset.assetType + ' · ' + (asset.cityName || '未命名城市')) : '未选择资源';
        if (refs.gameplayAssetPreviewEmpty) refs.gameplayAssetPreviewEmpty.classList.toggle('view-hidden', !!asset);
        if (refs.gameplayAssetPreviewImage) {
            refs.gameplayAssetPreviewImage.classList.toggle('view-hidden', !hasImage);
            refs.gameplayAssetPreviewImage.src = hasImage ? String(asset.publicUrl || asset.path) : '';
        }
        if (refs.gameplayAssetPreviewHost) refs.gameplayAssetPreviewHost.classList.toggle('view-hidden', !hasModel);
        if (!hasModel) {
            disposeGameplayAssetPreview();
            return;
        }
        ensureGameplayAssetPreview(String(asset.publicUrl || asset.path));
    }

    function ensureGameplayAssetPreview(modelUrl) {
        if (!refs.gameplayAssetPreviewHost) return;
        if (!gameplayAssetPreviewApi) {
            var generation = (gameplayPreviewInitGeneration += 1);
            import('./gameplay-asset-preview.js').then(function (mod) {
                if (generation !== gameplayPreviewInitGeneration || !refs.gameplayAssetPreviewHost) return;
                gameplayAssetPreviewApi = mod.createGameplayAssetPreview({ host: refs.gameplayAssetPreviewHost });
                gameplayAssetPreviewApi.setAsset(modelUrl);
            }).catch(function (error) {
                setStatus('模型预览初始化失败: ' + error.message, 'error');
            });
            return;
        }
        gameplayAssetPreviewApi.setAsset(modelUrl);
    }

    function disposeGameplayAssetPreview() {
        if (gameplayAssetPreviewApi && gameplayAssetPreviewApi.dispose) {
            gameplayAssetPreviewApi.dispose();
            gameplayAssetPreviewApi = null;
        }
    }

    function disposeModelAssetPreview() {
        if (modelAssetPreviewApi && modelAssetPreviewApi.dispose) {
            modelAssetPreviewApi.dispose();
            modelAssetPreviewApi = null;
        }
    }

    function renderExploreGameplayPanels() {
        if (!refs.inspectorPanelBody) return;
        var level = getLevel();
        exploreGameplayFieldSilent += 1;
        try {
            var merged =
                level && level.map.explorationLayout && level.map.explorationLayout.gameplay
                    ? mergeExploreGameplayDisplay(level.map.explorationLayout.gameplay)
                    : mergeExploreGameplayDisplay({});
            refs.inspectorPanelBody.querySelectorAll('[data-explore-gp]').forEach(function (el) {
                var key = el.getAttribute('data-explore-gp');
                if (!key || merged[key] === undefined || merged[key] === null) return;
                var v =
                    key === 'enemyMaxConcurrent'
                        ? String(Math.round(merged[key]))
                        : String(Number(merged[key]));
                el.value = v;
            });
        } finally {
            exploreGameplayFieldSilent -= 1;
        }
    }

    function onExploreGameplayFieldInput(ev) {
        if (exploreGameplayFieldSilent > 0) return;
        var el = ev.target && ev.target.closest ? ev.target.closest('[data-explore-gp]') : null;
        if (!el) return;
        var section = el.closest('.explore-map-gameplay-section');
        if (!section || !refs.inspectorPanelBody || !refs.inspectorPanelBody.contains(el)) return;
        var level = getLevel();
        if (!level) return;
        var layout = ensureExplorationLayout(level.map);
        layout.gameplay = readExploreGameplayRawFromDomSection(section);
        markDirty('已更新探索地图玩法数值');
        renderExploreGameplayPanels();
        renderOverview();
    }

    function mountExploreGameplayFieldTemplates() {
        var tpl = document.getElementById('tplExploreGameplayFields');
        var mLevel = document.getElementById('exploreGameplayMountLevel');
        var mGameplay = document.getElementById('exploreGameplayMountGameplay');
        if (!tpl || !mLevel || !mGameplay || tpl.dataset.mounted === '1') return;
        tpl.dataset.mounted = '1';
        mLevel.appendChild(tpl.content.cloneNode(true));
        mGameplay.appendChild(tpl.content.cloneNode(true));
    }

    function createEnemyTypeFromTemplates(level) {
        var enemyTemplate = buildGameplayActorTemplates().find(function (item) { return item.category === 'enemy'; }) ||
            getAvailableActorTemplates().find(function (item) { return item.category === 'enemy'; });
        var enemy = {
            id: enemyTemplate ? enemyTemplate.id : 'enemy-drone',
            name: enemyTemplate ? enemyTemplate.name : '侦察无人机',
            modelId: enemyTemplate ? enemyTemplate.modelId : '',
            modelPath: enemyTemplate ? enemyTemplate.modelPath || '' : '',
            modelScale:
                enemyTemplate && enemyTemplate.templateModelScale != null && enemyTemplate.templateModelScale > 0
                    ? enemyTemplate.templateModelScale
                    : 1,
            hp: enemyTemplate ? enemyTemplate.stats.hp : 80,
            speed: enemyTemplate ? enemyTemplate.stats.speed || 1 : 1,
            reward: enemyTemplate ? enemyTemplate.stats.reward || 20 : 20
        };
        level.enemyTypes.push(enemy);
        return enemy;
    }

    function getLevel() {
        return state && state.levels.find(function (level) { return level.id === selectedLevelId; });
    }

    function updateLevel(field, value) {
        var level = getLevel();
        if (!level) return;
        level[field] = value;
        markDirty('已更新关卡');
        renderLevelTree();
        renderOverview();
    }

    function findSelectedObject(level) {
        if (!level || !selectedObject) return null;
        var layout = ensureExplorationLayout(level.map);
        var item = null;
        if (selectedObject.kind === 'actor') item = level.map.actors.find(byId(selectedObject.id));
        if (selectedObject.kind === 'spawn') item = activeEditorMode === 'explore' ? layout.startPoint : level.map.spawnPoints.find(byId(selectedObject.id));
        if (selectedObject.kind === 'explorePoint') item = level.map.explorationPoints.find(byId(selectedObject.id));
        if (selectedObject.kind === 'objective') item = activeEditorMode === 'explore' ? layout.exitPoint : level.map.objectivePoint;
        if (selectedObject.kind === 'boardImage') {
            var bile = findBoardImageLayerById(level, selectedObject.id);
            if (!bile) return null;
            return { kind: 'boardImage', item: bile };
        }
        if (item) return { kind: selectedObject.kind, item: item };
        return null;
    }

    function markDirty(message) {
        isDirty = true;
        _persistLocalBackup(state);
        setStatus(message || '已有未保存修改', 'dirty');
    }

    function setStatus(message, mode) {
        refs.statusText.textContent = message;
        refs.statusBadge.textContent = mode === 'error' ? '错误' : mode === 'success' ? '已保存' : mode === 'dirty' ? '未保存' : '运行中';
        refs.statusBadge.className = 'status-badge ' + (mode || 'idle');
    }

    function activateBoardImageTool() {
        activeTool = 'boardImage';
        document.querySelectorAll('[data-tool]').forEach(function (item) {
            item.classList.toggle('active', item.getAttribute('data-tool') === 'boardImage');
        });
        if (refs.activeToolLabel) refs.activeToolLabel.textContent = '当前工具：' + TOOL_LABELS.boardImage;
        updateEraserToolPanelVisibility(refs, activeWorkbench, activeTool);
        updateStageHintText();
    }

    function boardImagesEnv() {
        return {
            getLevel: getLevel,
            getActiveWorkbench: function () {
                return activeWorkbench;
            },
            getViewportViewMode: function () {
                return viewportViewMode;
            },
            getSelectedObject: function () {
                return selectedObject;
            },
            setSelectedObject: function (next) {
                selectedObject = next;
            },
            markDirty: markDirty,
            renderSelectionInspector: renderSelectionInspector,
            renderMap: renderMap,
            schedulePreviewRefresh: schedulePreviewRefresh,
            renderAll: renderAll,
            activateBoardImageTool: activateBoardImageTool,
            getActiveTool: function () {
                return activeTool;
            }
        };
    }

    function globalSettingsEnv() {
        return {
            getState: function () {
                return state;
            },
            getLevel: getLevel,
            getActiveWorkbench: function () {
                return activeWorkbench;
            },
            setActiveWorkbench: function (value) {
                activeWorkbench = value;
            },
            getActiveGlobalSettingsTab: function () {
                return activeGlobalSettingsTab;
            },
            setActiveGlobalSettingsTab: function (value) {
                activeGlobalSettingsTab = value;
            },
            getGlobalCutsceneEditLevelId: function () {
                return globalCutsceneEditLevelId;
            },
            setGlobalCutsceneEditLevelId: function (value) {
                globalCutsceneEditLevelId = value || '';
            },
            renderAll: renderAll,
            renderGlobalAudioPanel: renderGlobalAudioPanel,
            renderGlobalScreenUiForm: renderGlobalScreenUiForm,
            createManualLevel: createManualLevel,
            deleteLevelById: deleteLevelById,
            focusLevelInEditor: focusLevelInEditor,
            markDirty: markDirty,
            setStatus: setStatus,
            uploadVideoFile: uploadVideoFile,
            revealProjectPathInExplorer: revealProjectPathInExplorer
        };
    }

    function mapRenderEnv() {
        return {
            getLevel: getLevel,
            getActiveEditorMode: function () {
                return activeEditorMode;
            },
            getSelectedObject: function () {
                return selectedObject;
            },
            findSelectedObject: findSelectedObject,
            resetEraserPreviewAfterMapRebuild: resetEraserPreviewAfterMapRebuild,
            refreshEraserPreviewIfActive: function (refsArg) {
                refreshEraserPreviewIfActive(refsArg, eraserPreviewEnv());
            }
        };
    }

    function audioEnv() {
        return {
            getLevel: getLevel,
            getState: function () {
                return state;
            },
            markDirty: markDirty,
            setStatus: setStatus,
            uploadFileToProjectUrl: uploadFileToProjectUrl
        };
    }

    /** 供 eraser-tool：用 getter 读取当前工作台/工具，避免闭包捕获过期值 */
    function eraserPreviewEnv() {
        return {
            getLevel: getLevel,
            get activeWorkbench() {
                return activeWorkbench;
            },
            get activeTool() {
                return activeTool;
            },
            mapGridPickCellFromClientPoint: mapGridPickCellFromClientPoint
        };
    }

    /**
     * 当落点落在网格 gap / 容器 padding 上时，用几何换算到格子（与 .map-cell 的 grid 布局一致）。
     */
    function mapGridPickCellFromClientPoint(clientX, clientY, grid) {
        if (!refs.mapGrid || !grid) return null;
        var el = refs.mapGrid;
        var rect = el.getBoundingClientRect();
        var st = getComputedStyle(el);
        var padL = parseFloat(st.paddingLeft) || 0;
        var padT = parseFloat(st.paddingTop) || 0;
        var cols = grid.cols;
        var rows = grid.rows;
        var csStr = el.style.getPropertyValue('--cell-size') || getComputedStyle(el).getPropertyValue('--cell-size');
        var cs = parseFloat(csStr) || 28;
        var gap = parseFloat(st.rowGap || st.columnGap || st.gap) || 1;
        var stride = cs + gap;
        var x = clientX - rect.left - padL;
        var y = clientY - rect.top - padT;
        var col = Math.floor(x / stride);
        var row = Math.floor(y / stride);
        var ox = x - col * stride;
        var oy = y - row * stride;
        if (ox > cs || oy > cs) return null;
        if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
        var wrap = document.createElement('div');
        wrap.setAttribute('data-col', String(col));
        wrap.setAttribute('data-row', String(row));
        return wrap;
    }

    document.addEventListener('DOMContentLoaded', init);
