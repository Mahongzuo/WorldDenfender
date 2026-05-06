import { CITY_GEO_CONFIGS, DEFAULT_CESIUM_ION_3D_TILES_ASSET_ID, JINAN_MAP_TEXTURE_URL } from './editor/city-geo-configs.js';
import { BUILT_IN_CITY_LAYOUTS, matchBuiltInCity } from './editor/built-in-layouts.js';
import { clamp, clone, normalizeChineseCityName, escapeHtml, escapeAttr, uid, slugify, updatePath, cellsRect, toggleCell, removeCell, hasCell, cloneCells, atCell, notAtCell, inBounds, byId, editorVol01, editorPctFromVol01, readDragPayload, fileToBase64 } from './editor/utils.js';
import { splitRegion, buildRegionLabel, inferCountryCode, normalizeCell, normalizeCells, normalizePoint, defaultObjectivePoint, normalizeStatus, normalizeLocation, normalizeEnvironment, normalizeBoardImageLayers, normalizeStats, normalizeActorTemplate, normalizeActors, normalizeEnemyTypes, normalizeWaveRules, normalizeModeProfiles, normalizeSpawnPoints, normalizeExplorePoints, EXPLORE_GAMEPLAY_STORE_KEYS, normalizeExploreGameplayNormalized, normalizeGeoConfig, makeGeoConfig, visitCoordinatePairs, geometryCenter, fetchCountryCapitalCoords, countryGeoFromFeature, geoFromLonLatArray, normalizeEditorThemeColorHex, normalizeTheme, normalizeEnemyPaths, normalizeExplorationLayout, normalizeCatalog, normalizeCatalogItem, normalizeEditorAssetsCatalog, defaultGlobalAudio, normalizeGlobalAudio, normalizeLevelAudioSource, defaultGlobalScreenUi, normalizeGlobalScreenUi, normalizeGameAssetConfig, mergeDistinctStrings, normalizeGameplayPlacement, normalizeGameplayEntries, normalizeCityGameplayConfigs, createDefaultMap, trimMapToBounds, normalizeMap, normalizeLevel, sortLevels, normalizeState } from './editor/normalizers.js';
import { API_URL, LOCAL_BACKUP_KEY, LEGACY_BACKUP_KEY, ENGINE_VERSION, DEFAULT_GRID_COLS, DEFAULT_GRID_ROWS, DEFAULT_TILE_SIZE, GEO_MAPPING_STORAGE_KEY, SHELL_LEFT_COLLAPSE_KEY, SHELL_RIGHT_COLLAPSE_KEY, TOOL_LABELS, MODEL_CATEGORY_CONFIG, DEFAULT_ACTOR_TEMPLATES, DEFAULT_TOWER_GAMEPLAY_STATS, GAMEPLAY_RESOURCE_CONFIG } from './editor/content.js';
import { sanitizeStateForSave as _sanitizeStateForSave, persistLocalBackup as _persistLocalBackup, readLocalBackup as _readLocalBackup, exportState as _exportState, persistShellCollapsedPrefs as _persistShellCollapsedPrefs } from './editor/storage.js';
import {
    readShellCollapsedPrefsFromStorage as _readShellCollapsedPrefsFromStorage,
    bumpShellLayoutDependentUi as _bumpShellLayoutDependentUi,
    applyPersistedInspectorWidth as _applyPersistedInspectorWidth,
    bindViewportInspectorSplitter as _bindViewportInspectorSplitter,
    applyShellPanelCollapseUi as _applyShellPanelCollapseUi
} from './editor/shell-layout.js';
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
import { statusLabel, actorCategoryLabel, summaryStats, gameplayPlacementLabel, modelBindShortLabel, isImageAssetPath, isModelAssetPath, groupLevels, compareRegionKeys, hasDefenseLayout, hasExploreLayout, isJinanLevel, normalizePlaceSearchResult, levelVideoCityContext, normalizeCityIdentity, pickPreferredGameplayTab } from './editor/display-utils.js';
import { pickLevelId, uniqueLevelId, uniqueTemplateId, findLevelById, uniqueGameplayEntryId } from './editor/id-utils.js';
import { resolveSpecialGeoForLevel, cloneGeoConfig, applyDefenseLayout, applyExploreLayout, createDraftLevel, ensureExplorationLayout } from './editor/layout-presets.js';
import { mergeExploreGameplayDisplay, readExploreGameplayRawFromDomSection } from './editor/explore-gameplay-defaults.js';
import { markerHtml, themeColorInput, findBoardImageLayerById } from './editor/html-builders.js';
import { parseFetchErrorBody } from './editor/fetch-utils.js';
import { ensureWorldOffset, mergeGameplayEntryList } from './editor/level-mutators.js';
import { renderBoardImagesPanel, ensureBoardImagesPanelDelegated, tryConsumeBoardImageFileDrop, bindBoardImageGlobalHandlers, clearBoardImageInteractionState } from './editor/board-images.js';
import { renderLevelAudioFields, renderGlobalAudioPanel, bindLevelAudioUi, bindGlobalAudioUi } from './editor/audio.js';
import {
    refreshGlobalSettingsWorkbench as _refreshGlobalSettingsWorkbench,
    bindGlobalCutscenePanel as _bindGlobalCutscenePanel,
    bindGlobalSettingsChrome as _bindGlobalSettingsChrome,
    renderGlobalCutsceneOverview as _renderGlobalCutsceneOverview
} from './editor/global-settings.js';
import { renderMap as _renderMap } from './editor/map-render.js';
import { handleCellAction as _handleCellAction, moveActor as _moveActor, moveMarker as _moveMarker, eraseCellAt as _eraseCellAt, selectGridCellObject as _selectGridCellObject, mapGridPickCellFromClientPoint as _mapGridPickCellFromClientPoint } from './editor/map-edit.js';
import { bindGameplayUi as _bindGameplayUi, renderGameplayEditor as _renderGameplayEditor, ensureCityGameplayConfig as _ensureCityGameplayConfig, getCurrentCityGameplayConfig as _getCurrentCityGameplayConfig, getAvailableEnemyTypes as _getAvailableEnemyTypes, buildGameplayActorTemplates as _buildGameplayActorTemplates, getAvailableActorTemplates as _getAvailableActorTemplates, findActorTemplate as _findActorTemplate } from './editor/gameplay-editor.js';
import {
    renderModelEditor as _renderModelEditor,
    replaceSelectedModel as _replaceSelectedModel,
    uploadNewModelFromInspector as _uploadNewModelFromInspector,
    renderModelAssets as _renderModelAssets,
    uploadModelAsset as _uploadModelAsset,
    bindActorTemplateModelControls as _bindActorTemplateModelControls,
    applyActorTemplateUploadedModel as _applyActorTemplateUploadedModel
} from './editor/model-editor.js';
import { renderSelectionInspector as _renderSelectionInspector } from './editor/selection-inspector.js';
import { bindWaveEditorUi as _bindWaveEditorUi, renderWaveList as _renderWaveList } from './editor/wave-editor.js';
import {
    normalizeGameModelsForCatalog as _normalizeGameModelsForCatalog,
    rememberEditorAsset as _rememberEditorAsset,
    renderGameAssetPanel as _renderGameAssetPanel,
    bindGameAssetPanel as _bindGameAssetPanel
} from './editor/game-asset-panel.js';
import {
    isContentBrowserFloatOpen as _isContentBrowserFloatOpen,
    clampContentBrowserFloatPanelIntoViewport as _clampContentBrowserFloatPanelIntoViewport,
    toggleContentBrowserFloat as _toggleContentBrowserFloat,
    wireContentBrowserFloating as _wireContentBrowserFloating,
    renderContentBrowser as _renderContentBrowser
} from './editor/content-browser-ui.js';
import {
    prefetchCesiumIonTokenForEditor as _prefetchCesiumIonTokenForEditor,
    schedulePreviewRefresh as _schedulePreviewRefresh,
    refreshPreviewNow as _refreshPreviewNow,
    syncViewportPanels as _syncViewportPanels,
    updateStageHintText as _updateStageHintText,
    initPreviewLayer as _initPreviewLayer,
    disposePreviewLayer as _disposePreviewLayer,
    setPreviewToolbarMode as _setPreviewToolbarMode
} from './editor/preview-layer.js';
import { renderLevelContentBrowser as _renderLevelContentBrowser } from './editor/level-content-browser.js';
import { bindEditorEvents as _bindEditorEvents } from './editor/editor-events.js';
import { ctx } from './editor/context.js';
import {
    ensureLevelCutscenesForLevel,
    revealProjectPathInExplorer as _revealProjectPathInExplorer,
    renderCutsceneEditor as _renderCutsceneEditor,
    bindCutsceneEditorEvents as _bindCutsceneEditorEvents
} from './editor/theme-cutscene-workbench.js';

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
        gameplayTaxonomyPanel: document.getElementById('gameplayTaxonomyPanel'),
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

    function syncEditorCtx() {
        ctx.state = state;
        ctx.selectedLevelId = selectedLevelId;
        ctx.selectedObject = selectedObject;
        ctx.selectedTemplateId = selectedTemplateId;
        ctx.activeTool = activeTool;
        ctx.activeStatusFilter = activeStatusFilter;
        ctx.activeWorkbench = activeWorkbench;
        ctx.activeGlobalSettingsTab = activeGlobalSettingsTab;
        ctx.globalCutsceneEditLevelId = globalCutsceneEditLevelId;
        ctx.activeThemeScope = activeThemeScope;
        ctx.activeThemeWorkbenchTab = activeThemeWorkbenchTab;
        ctx.themeEditorCacheKey = themeEditorCacheKey;
        ctx.themeBoardUrlDebounce = themeBoardUrlDebounce;
        ctx.activeEditorMode = activeEditorMode;
        ctx.activeGameplayTab = activeGameplayTab;
        ctx.selectedGameplayEntryId = selectedGameplayEntryId;
        ctx.selectedGameplayAssetId = selectedGameplayAssetId;
        ctx.activeModelCategory = activeModelCategory;
        ctx.selectedModelId = selectedModelId;
        ctx.modelAssetPreviewApi = modelAssetPreviewApi;
        ctx.modelPreviewInitGeneration = modelPreviewInitGeneration;
        ctx.viewportViewMode = viewportViewMode;
        ctx.previewApi = previewApi;
        ctx.gameplayAssetPreviewApi = gameplayAssetPreviewApi;
        ctx.previewInitGeneration = previewInitGeneration;
        ctx.gameplayPreviewInitGeneration = gameplayPreviewInitGeneration;
        ctx.previewRefreshTimer = previewRefreshTimer;
        ctx.shellLeftCollapsedPref = shellLeftCollapsedPref;
        ctx.shellRightCollapsedPref = shellRightCollapsedPref;
        ctx.inspectorSplitPointerStartX = inspectorSplitPointerStartX;
        ctx.inspectorSplitStartWidthPx = inspectorSplitStartWidthPx;
        ctx.geoMappingEnabled = geoMappingEnabled;
        ctx.isDirty = isDirty;
        ctx.exploreGameplayFieldSilent = exploreGameplayFieldSilent;
        ctx.regionSources = regionSources;
        ctx.contentBrowserMiniApi = contentBrowserMiniApi;
        ctx.contentBrowserFloatGeomTimer = contentBrowserFloatGeomTimer;
        ctx.contentBrowserFloatRo = contentBrowserFloatRo;
        ctx.selectedContentBrowserAssetId = selectedContentBrowserAssetId;
        ctx.levelContentBrowserFilter = levelContentBrowserFilter;
        var k;
        for (k in refs) {
            if (Object.prototype.hasOwnProperty.call(refs, k)) {
                ctx.refs[k] = refs[k];
            }
        }
    }

    function shellLayoutEnv() {
        return {
            setShellLeftCollapsedPref: function (value) {
                shellLeftCollapsedPref = !!value;
            },
            setShellRightCollapsedPref: function (value) {
                shellRightCollapsedPref = !!value;
            },
            getShellLeftCollapsedPref: function () {
                return shellLeftCollapsedPref;
            },
            getShellRightCollapsedPref: function () {
                return shellRightCollapsedPref;
            },
            setInspectorSplitPointerStartX: function (value) {
                inspectorSplitPointerStartX = value;
            },
            getInspectorSplitPointerStartX: function () {
                return inspectorSplitPointerStartX;
            },
            setInspectorSplitStartWidthPx: function (value) {
                inspectorSplitStartWidthPx = value;
            },
            getInspectorSplitStartWidthPx: function () {
                return inspectorSplitStartWidthPx;
            },
            getViewportViewMode: function () {
                return viewportViewMode;
            },
            getPreviewApi: function () {
                return previewApi;
            }
        };
    }

    function readShellCollapsedPrefsFromStorage() {
        _readShellCollapsedPrefsFromStorage(shellLayoutEnv());
    }

    function bumpShellLayoutDependentUi() {
        var env = shellLayoutEnv();
        _bumpShellLayoutDependentUi({
            getViewportViewMode: env.getViewportViewMode,
            getPreviewApi: env.getPreviewApi
        });
    }

    function applyPersistedInspectorWidth() {
        _applyPersistedInspectorWidth(refs, shellLayoutEnv());
    }

    function bindViewportInspectorSplitter() {
        _bindViewportInspectorSplitter(refs, shellLayoutEnv());
    }

    function applyShellPanelCollapseUi() {
        _applyShellPanelCollapseUi(refs, shellLayoutEnv());
    }

    function init() {
        _prefetchCesiumIonTokenForEditor();
        initGeoMappingToggle();
        readShellCollapsedPrefsFromStorage();
        bindEvents();
        bindCreateLevelModalEvents();
        loadState();
        applyShellPanelCollapseUi();
        bindViewportInspectorSplitter();
        syncEditorCtx();
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
        _bindEditorEvents(refs, editorEventsEnv());
    }

    function gameAssetEnv() {
        return {
            getState: function () {
                return state;
            },
            markDirty: markDirty,
            setStatus: setStatus,
            uploadFileToProjectUrl: uploadFileToProjectUrl,
            getBrowsableModelAssets: getBrowsableModelAssets
        };
    }

    function normalizeGameModelsForCatalog() {
        return _normalizeGameModelsForCatalog(gameAssetEnv());
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
            _rememberEditorAsset(gameAssetEnv(), payload, requestBody.resourceKind);
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

    function renderGameAssetPanel() {
        _renderGameAssetPanel(refs, gameAssetEnv());
    }

    function bindGameAssetPanel() {
        _bindGameAssetPanel(refs, gameAssetEnv());
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
        var levelCountryCode = String(level.id || '').replace(/^country-/i, '').toUpperCase();
        var countryName = String(level.location && (level.location.countryName || level.location.regionLabel) || level.name || '').replace(/ · .+$/, '');
        var country = regionSources.countries.find(function (item) {
            var code = String(item.code || '').toUpperCase();
            return (
                code === countryCode ||
                code === levelCountryCode ||
                String(item.name || '').toLowerCase() === countryName.toLowerCase()
            );
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
        syncEditorCtx();
    }

    function renderLevelContentBrowser() {
        _renderLevelContentBrowser(refs, levelContentBrowserEnv());
    }

    function renderPreviewSceneOutline() {
        renderLevelContentBrowser();
        /* 侧栏大纲已迁移至预览区右侧；保留空列表避免遗留脚本报错 */
        if (refs.previewSceneOutlineList) refs.previewSceneOutlineList.innerHTML = '';
    }

    function bindGameplayUi() {
        _bindGameplayUi(refs, gameplayEnv());
    }

    function bindWaveEditorUi() {
        _bindWaveEditorUi(refs, waveEditorEnv());
    }

    function refreshGlobalSettingsWorkbench() {
        _refreshGlobalSettingsWorkbench(refs, globalSettingsEnv());
    }

    function renderGlobalCutsceneOverview() {
        _renderGlobalCutsceneOverview(refs, globalSettingsEnv());
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
        await _revealProjectPathInExplorer(projectPath);
        setStatus('已在资源管理器中定位视频文件', 'success');
    }

    /** 获取或初始化当前关卡的 cutscenes 对象 */
    function ensureLevelCutscenes() {
        return ensureLevelCutscenesForLevel(getLevel());
    }

    function cutsceneWorkbenchEnv() {
        return {
            getLevel: getLevel,
            ensureLevelCutscenes: ensureLevelCutscenes,
            uploadVideoFile: uploadVideoFile,
            markDirty: markDirty,
            setStatus: setStatus,
            renderGlobalCutsceneOverview: renderGlobalCutsceneOverview,
            revealProjectPathInExplorer: revealProjectPathInExplorer,
            refreshCutscenePanel: renderCutsceneEditor
        };
    }

    function renderCutsceneEditor() {
        _renderCutsceneEditor(refs, { getLevel: getLevel });
    }

    function bindCutsceneEditorEvents() {
        _bindCutsceneEditorEvents(refs, cutsceneWorkbenchEnv());
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
            _rememberEditorAsset(gameAssetEnv(), payload, requestBody.resourceKind);
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
        _renderGameplayEditor(refs, gameplayEnv());
    }

    function renderModelEditor() {
        _renderModelEditor(refs, modelEditorEnv());
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

    async function replaceSelectedModel(file) {
        return _replaceSelectedModel(refs, modelEditorEnv(), file);
    }

    async function uploadNewModelFromInspector(file) {
        return _uploadNewModelFromInspector(refs, modelEditorEnv(), file);
    }

    function previewLayerEnv() {
        return {
            getViewportViewMode: function () {
                return viewportViewMode;
            },
            getPreviewApi: function () {
                return previewApi;
            },
            setPreviewApi: function (api) {
                previewApi = api;
            },
            getPreviewInitGeneration: function () {
                return previewInitGeneration;
            },
            bumpPreviewInitGenerationForInit: function () {
                previewInitGeneration += 1;
                return previewInitGeneration;
            },
            bumpPreviewInitGenerationForDispose: function () {
                previewInitGeneration += 1;
            },
            clearPreviewRefreshTimer: function () {
                clearTimeout(previewRefreshTimer);
            },
            setPreviewRefreshTimer: function (id) {
                previewRefreshTimer = id;
            },
            getSelectedObject: function () {
                return selectedObject;
            },
            setSelectedObject: function (value) {
                selectedObject = value;
            },
            getActiveWorkbench: function () {
                return activeWorkbench;
            },
            getActiveTool: function () {
                return activeTool;
            },
            getActiveEditorMode: function () {
                return activeEditorMode;
            },
            getGeoMappingEnabled: function () {
                return geoMappingEnabled;
            },
            getLevel: getLevel,
            getPreviewCatalog: function () {
                return state
                    ? {
                          modelAssets: (state.catalog && state.catalog.modelAssets) || [],
                          editorAssetsCatalog: state.editorAssetsCatalog || [],
                          gameModels: normalizeGameModelsForCatalog()
                      }
                    : { modelAssets: [], editorAssetsCatalog: [], gameModels: [] };
            },
            findActorTemplate: findActorTemplate,
            getBrowsableModelAssets: getBrowsableModelAssets,
            placeActorFromTemplate: placeActorFromTemplate,
            applyWorldHitToActor: applyWorldHitToActor,
            markDirty: markDirty,
            setStatus: setStatus,
            renderSelectionInspector: renderSelectionInspector,
            renderMap: renderMap,
            renderPreviewSceneOutline: renderPreviewSceneOutline,
            renderOverview: renderOverview,
            renderAll: renderAll,
            renderContentBrowser: renderContentBrowser
        };
    }

    function schedulePreviewRefresh() {
        _schedulePreviewRefresh(previewLayerEnv());
    }

    function refreshPreviewNow() {
        _refreshPreviewNow(previewLayerEnv());
    }

    function syncViewportPanels() {
        _syncViewportPanels(refs, previewLayerEnv());
    }

    function updateStageHintText() {
        _updateStageHintText(refs, previewLayerEnv());
    }

    function initPreviewLayer() {
        _initPreviewLayer(refs, previewLayerEnv());
    }

    function disposePreviewLayer() {
        _disposePreviewLayer(previewLayerEnv());
    }

    function setPreviewToolbarMode(mode) {
        _setPreviewToolbarMode(refs, previewLayerEnv(), mode);
    }

    function contentBrowserEnv() {
        return {
            getState: function () {
                return state;
            },
            getActiveWorkbench: function () {
                return activeWorkbench;
            },
            getBrowsableModelAssets: getBrowsableModelAssets,
            getSelectedContentBrowserAssetId: function () {
                return selectedContentBrowserAssetId;
            },
            setSelectedContentBrowserAssetId: function (value) {
                selectedContentBrowserAssetId = value || '';
            },
            getContentBrowserMiniApi: function () {
                return contentBrowserMiniApi;
            },
            setContentBrowserMiniApi: function (api) {
                contentBrowserMiniApi = api;
            },
            clearContentBrowserFloatGeomTimer: function () {
                clearTimeout(contentBrowserFloatGeomTimer);
                contentBrowserFloatGeomTimer = null;
            },
            setContentBrowserFloatGeomTimer: function (id) {
                contentBrowserFloatGeomTimer = id;
            },
            disconnectContentBrowserFloatRo: function () {
                if (contentBrowserFloatRo) contentBrowserFloatRo.disconnect();
                contentBrowserFloatRo = null;
            },
            setContentBrowserFloatRo: function (ro) {
                contentBrowserFloatRo = ro;
            }
        };
    }

    function isContentBrowserFloatOpen() {
        return _isContentBrowserFloatOpen(refs);
    }

    function clampContentBrowserFloatPanelIntoViewport() {
        _clampContentBrowserFloatPanelIntoViewport(refs, contentBrowserEnv());
    }

    function toggleContentBrowserFloat(optOpen) {
        _toggleContentBrowserFloat(refs, contentBrowserEnv(), optOpen);
    }

    function wireContentBrowserFloating() {
        _wireContentBrowserFloating(refs, contentBrowserEnv());
    }

    function renderContentBrowser() {
        _renderContentBrowser(refs, contentBrowserEnv());
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
        syncEditorCtx();
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
        _handleCellAction(mapEditEnv(), col, row);
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
        _moveActor(mapEditEnv(), actorId, col, row);
    }

    function moveMarker(kind, id, col, row) {
        _moveMarker(mapEditEnv(), kind, id, col, row);
    }

    function eraseCellAt(col, row) {
        _eraseCellAt(mapEditEnv(), col, row);
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
        _bindActorTemplateModelControls(refs, actorModelSidebarEnv());
    }

    async function applyActorTemplateUploadedModel(templateId, file) {
        return _applyActorTemplateUploadedModel(refs, actorModelSidebarEnv(), templateId, file);
    }

    function renderSelectionInspector() {
        _renderSelectionInspector(refs, selectionInspectorEnv());
    }

    function renderWaveList() {
        _renderWaveList(refs, waveEditorEnv());
    }

    function renderModelAssets() {
        _renderModelAssets(refs, actorModelSidebarEnv());
    }

    async function uploadModelAsset(file) {
        return _uploadModelAsset(refs, actorModelSidebarEnv(), file);
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
        syncEditorCtx();
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
        syncEditorCtx();
    }

    function selectGridCellObject(kind, col, row) {
        _selectGridCellObject(mapEditEnv(), kind, col, row);
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
            ['enemies', 'characters', 'skills', 'towers', 'cards', 'items'].forEach(function (kind) {
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
        return _ensureCityGameplayConfig(gameplayEnv(), cityContext);
    }

    function getCurrentCityGameplayConfig() {
        return _getCurrentCityGameplayConfig(gameplayEnv());
    }

    function getAvailableEnemyTypes(level) {
        return _getAvailableEnemyTypes(gameplayEnv(), level);
    }

    function buildGameplayActorTemplates() {
        return _buildGameplayActorTemplates(gameplayEnv());
    }

    function getAvailableActorTemplates() {
        return _getAvailableActorTemplates(gameplayEnv());
    }

    function findActorTemplate(templateId) {
        return _findActorTemplate(gameplayEnv(), templateId);
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
        syncEditorCtx();
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

    function mapEditEnv() {
        return {
            getLevel: getLevel,
            getActiveTool: function () {
                return activeTool;
            },
            getActiveEditorMode: function () {
                return activeEditorMode;
            },
            getSelectedTemplateId: function () {
                return selectedTemplateId;
            },
            setSelectedObject: function (next) {
                selectedObject = next;
            },
            selectObject: selectObject,
            renderSelectionInspector: renderSelectionInspector,
            renderMap: renderMap,
            renderAll: renderAll,
            renderPreviewSceneOutline: renderPreviewSceneOutline,
            markDirty: markDirty,
            schedulePreviewRefresh: schedulePreviewRefresh,
            placeActorFromTemplate: placeActorFromTemplate,
            applyEraserBrush: function (col, row) {
                applyEraserBrush(col, row, getLevel, eraseCellAt);
            },
            isPreviewViewport: function () {
                return viewportViewMode === 'preview';
            },
            previewApiHasSelection: function () {
                return !!(previewApi && typeof previewApi.setSelectedActor === 'function');
            },
            setPreviewSelectedActor: function (id) {
                if (previewApi && typeof previewApi.setSelectedActor === 'function') {
                    previewApi.setSelectedActor(id);
                }
            }
        };
    }

    function selectionInspectorEnv() {
        return {
            getLevel: getLevel,
            getSelectedObject: function () {
                return selectedObject;
            },
            setSelectedObject: function (value) {
                selectedObject = value;
            },
            findSelectedObject: findSelectedObject,
            getBrowsableModelAssets: getBrowsableModelAssets,
            markDirty: markDirty,
            renderMap: renderMap,
            renderOverview: renderOverview,
            schedulePreviewRefresh: schedulePreviewRefresh,
            renderBoardImagesPanel: renderBoardImagesPanel,
            boardImagesEnv: boardImagesEnv
        };
    }

    function waveEditorEnv() {
        return {
            getLevel: getLevel,
            getEnemyTypeLookup: getEnemyTypeLookup,
            getAvailableEnemyTypes: getAvailableEnemyTypes,
            createEnemyTypeFromTemplates: createEnemyTypeFromTemplates,
            markDirty: markDirty,
            setStatus: setStatus,
            uploadFileToProjectUrl: uploadFileToProjectUrl,
            renderOverview: renderOverview
        };
    }

    function editorEventsEnv() {
        return {
            mountExploreGameplayFieldTemplates: mountExploreGameplayFieldTemplates,
            onExploreGameplayFieldInput: onExploreGameplayFieldInput,
            setGeoMappingEnabled: function (value) {
                geoMappingEnabled = !!value;
            },
            getGeoMappingEnabled: function () {
                return geoMappingEnabled;
            },
            persistGeoMappingEnabled: function (value) {
                window.localStorage.setItem(GEO_MAPPING_STORAGE_KEY, value ? '1' : '0');
            },
            refreshPreviewPreserveActorSelection: function () {
                if (viewportViewMode === 'preview' && previewApi && typeof previewApi.refresh === 'function') {
                    var sid = selectedObject && selectedObject.kind === 'actor' ? selectedObject.id : null;
                    previewApi.refresh({ preserveView: true, selectActorId: sid });
                }
            },
            reloadState: reloadState,
            saveState: saveState,
            exportState: function () {
                _exportState(state, setStatus);
            },
            createManualLevel: createManualLevel,
            generateRegionLevelSkeletons: generateRegionLevelSkeletons,
            renderLevelTree: renderLevelTree,
            applyMapSize: applyMapSize,
            deleteSelection: deleteSelection,
            createActorTemplateFromSelection: createActorTemplateFromSelection,
            bindWaveEditorUi: bindWaveEditorUi,
            uploadModelAsset: uploadModelAsset,
            setActiveWorkbench: function (value) {
                activeWorkbench = value || 'level';
            },
            getActiveWorkbench: function () {
                return activeWorkbench;
            },
            resetThemeEditorCache: function () {
                themeEditorCacheKey = '';
            },
            disposeGameplayAssetPreview: disposeGameplayAssetPreview,
            disposeModelAssetPreview: disposeModelAssetPreview,
            renderAll: renderAll,
            setActiveThemeScope: function (value) {
                activeThemeScope = value === 'explore' ? 'explore' : 'defense';
            },
            renderThemeEditor: renderThemeEditor,
            setThemeWorkbenchTab: setThemeWorkbenchTab,
            readThemeFormToLevel: readThemeFormToLevel,
            syncThemeColorSwatches: syncThemeColorSwatches,
            debounceReadThemeFormToLevel: function () {
                clearTimeout(themeBoardUrlDebounce);
                themeBoardUrlDebounce = setTimeout(readThemeFormToLevel, 350);
            },
            copyThemeToExplore: function () {
                var level = getLevel();
                if (!level || !level.map) return;
                var layout = ensureExplorationLayout(level.map);
                layout.theme = normalizeTheme(JSON.parse(JSON.stringify(normalizeTheme(level.map.theme))));
                markDirty('已复制防守主题到探索');
                activeThemeScope = 'explore';
                themeEditorCacheKey = '';
                if (refs.themeScopeSelect) refs.themeScopeSelect.value = 'explore';
                fillThemeFormFromLevel();
                renderAll();
            },
            copyThemeToDefense: function () {
                var level = getLevel();
                if (!level || !level.map) return;
                var layout = ensureExplorationLayout(level.map);
                level.map.theme = normalizeTheme(JSON.parse(JSON.stringify(normalizeTheme(layout.theme))));
                markDirty('已复制探索主题到防守');
                activeThemeScope = 'defense';
                themeEditorCacheKey = '';
                if (refs.themeScopeSelect) refs.themeScopeSelect.value = 'defense';
                fillThemeFormFromLevel();
                renderAll();
            },
            bindCutsceneEditorEvents: bindCutsceneEditorEvents,
            bindGameplayUi: bindGameplayUi,
            setActiveModelCategory: function (value) {
                activeModelCategory = value || 'all';
            },
            getActiveModelCategory: function () {
                return activeModelCategory;
            },
            setSelectedModelId: function (value) {
                selectedModelId = value || '';
            },
            renderModelEditor: renderModelEditor,
            replaceSelectedModel: replaceSelectedModel,
            uploadNewModelFromInspector: uploadNewModelFromInspector,
            setActiveStatusFilter: function (value) {
                activeStatusFilter = value || 'all';
            },
            setActiveEditorMode: function (value) {
                activeEditorMode = value || 'defense';
            },
            setSelectedObject: function (value) {
                selectedObject = value;
            },
            refreshPreviewNow: refreshPreviewNow,
            activateTool: function (tool) {
                activeTool = tool || 'select';
                document.querySelectorAll('[data-tool]').forEach(function (item) {
                    item.classList.toggle('active', item.getAttribute('data-tool') === activeTool);
                });
                refs.activeToolLabel.textContent = '当前工具：' + TOOL_LABELS[activeTool];
                updateEraserToolPanelVisibility(refs, activeWorkbench, activeTool);
                updateStageHintText();
            },
            selectLevel: selectLevel,
            selectObject: selectObject,
            handleCellAction: handleCellAction,
            isEraserPreviewActive: function () {
                return activeWorkbench === 'level' && activeTool === 'erase';
            },
            recordEraserPreviewPointer: recordEraserPreviewPointer,
            updateEraserBrushPreview: function (refsArg, x, y) {
                updateEraserBrushPreview(refsArg, x, y, eraserPreviewEnv());
            },
            clearEraserPreviewPointer: clearEraserPreviewPointer,
            clearEraserBrushPreview: clearEraserBrushPreview,
            getLevel: getLevel,
            tryConsumeBoardImageFileDrop: function (event, refsArg) {
                return tryConsumeBoardImageFileDrop(event, refsArg, boardImagesEnv());
            },
            mapGridPickCellFromClientPoint: mapGridPickCellFromClientPoint,
            placeActorFromTemplate: placeActorFromTemplate,
            moveActor: moveActor,
            moveMarker: moveMarker,
            bindLevelFields: bindLevelFields,
            bindGameAssetPanel: bindGameAssetPanel,
            bindLevelAudioUi: function () {
                bindLevelAudioUi(refs, audioEnv());
            },
            bindGlobalAudioUi: function () {
                bindGlobalAudioUi(audioEnv());
            },
            bindGlobalSettingsChrome: bindGlobalSettingsChrome,
            bindGlobalCutscenePanel: bindGlobalCutscenePanel,
            bindGlobalScreenUiPanel: bindGlobalScreenUiPanel,
            wireViewportViewMode: wireViewportViewMode,
            setPreviewToolbarMode: setPreviewToolbarMode,
            focusPreviewSelection: function () {
                if (previewApi && typeof previewApi.focusSelection === 'function') previewApi.focusSelection();
            },
            refreshGameModelsCatalog: refreshGameModelsCatalog,
            renderContentBrowser: renderContentBrowser,
            setStatus: setStatus,
            wireContentBrowserFloating: wireContentBrowserFloating,
            collapseRegionPanel: function () {
                shellLeftCollapsedPref = true;
                _persistShellCollapsedPrefs(
                    { leftKey: SHELL_LEFT_COLLAPSE_KEY, rightKey: SHELL_RIGHT_COLLAPSE_KEY },
                    shellLeftCollapsedPref,
                    shellRightCollapsedPref
                );
                applyShellPanelCollapseUi();
            },
            expandRegionPanel: function () {
                shellLeftCollapsedPref = false;
                _persistShellCollapsedPrefs(
                    { leftKey: SHELL_LEFT_COLLAPSE_KEY, rightKey: SHELL_RIGHT_COLLAPSE_KEY },
                    shellLeftCollapsedPref,
                    shellRightCollapsedPref
                );
                applyShellPanelCollapseUi();
            },
            collapseInspectorPanel: function () {
                shellRightCollapsedPref = true;
                _persistShellCollapsedPrefs(
                    { leftKey: SHELL_LEFT_COLLAPSE_KEY, rightKey: SHELL_RIGHT_COLLAPSE_KEY },
                    shellLeftCollapsedPref,
                    shellRightCollapsedPref
                );
                applyShellPanelCollapseUi();
            },
            expandInspectorPanel: function () {
                shellRightCollapsedPref = false;
                _persistShellCollapsedPrefs(
                    { leftKey: SHELL_LEFT_COLLAPSE_KEY, rightKey: SHELL_RIGHT_COLLAPSE_KEY },
                    shellLeftCollapsedPref,
                    shellRightCollapsedPref
                );
                applyShellPanelCollapseUi();
            },
            resizePreviewIfOpen: function () {
                if (viewportViewMode === 'preview' && previewApi && typeof previewApi.resize === 'function') {
                    previewApi.resize();
                }
            },
            applyShellPanelCollapseUi: applyShellPanelCollapseUi,
            clampContentBrowserFloatPanelIntoViewport: clampContentBrowserFloatPanelIntoViewport,
            toggleContentBrowserFloat: toggleContentBrowserFloat,
            canFocusPreviewSelection: function () {
                return (
                    viewportViewMode === 'preview' &&
                    previewApi &&
                    typeof previewApi.focusSelection === 'function' &&
                    selectedObject &&
                    selectedObject.kind === 'actor'
                );
            },
            isBoardImageSelectedInLevelWorkbench: function () {
                return activeWorkbench === 'level' && selectedObject && selectedObject.kind === 'boardImage';
            },
            clearBoardImageSelection: function () {
                selectedObject = null;
                clearBoardImageInteractionState();
                renderSelectionInspector();
                renderMap();
                renderBoardImagesPanel(refs, boardImagesEnv());
            },
            getSelectedObject: function () {
                return selectedObject;
            },
            bindEraserToolControls: function (refsArg) {
                bindEraserToolControls(refsArg, function () {
                    refreshEraserPreviewIfActive(refsArg, eraserPreviewEnv());
                });
            },
            bindBoardImageGlobalHandlers: function (refsArg) {
                bindBoardImageGlobalHandlers(refsArg, boardImagesEnv());
            },
            ensureBoardImagesPanelDelegated: function (refsArg) {
                ensureBoardImagesPanelDelegated(refsArg, boardImagesEnv());
            }
        };
    }

    function gameplayEnv() {
        return {
            getState: function () {
                return state;
            },
            getGameplayCityContext: getGameplayCityContext,
            getActiveGameplayTab: function () {
                return activeGameplayTab;
            },
            setActiveGameplayTab: function (value) {
                activeGameplayTab = value || 'enemies';
            },
            getSelectedGameplayEntryId: function () {
                return selectedGameplayEntryId;
            },
            setSelectedGameplayEntryId: function (value) {
                selectedGameplayEntryId = value || '';
            },
            getSelectedGameplayAssetId: function () {
                return selectedGameplayAssetId;
            },
            setSelectedGameplayAssetId: function (value) {
                selectedGameplayAssetId = value || '';
            },
            getActiveWorkbench: function () {
                return activeWorkbench;
            },
            resolveCityGameplayConfigKey: resolveCityGameplayConfigKey,
            markDirty: markDirty,
            setStatus: setStatus,
            renderExploreGameplayPanels: renderExploreGameplayPanels,
            ensureGameplayAssetPreview: ensureGameplayAssetPreview,
            disposeGameplayAssetPreview: disposeGameplayAssetPreview
        };
    }

    function modelEditorEnv() {
        return {
            getBrowsableModelAssets: getBrowsableModelAssets,
            getActiveWorkbench: function () {
                return activeWorkbench;
            },
            getActiveModelCategory: function () {
                return activeModelCategory;
            },
            setActiveModelCategory: function (value) {
                activeModelCategory = value || 'all';
            },
            getSelectedModelId: function () {
                return selectedModelId;
            },
            setSelectedModelId: function (value) {
                selectedModelId = value || '';
            },
            ensureModelAssetPreview: ensureModelAssetPreview,
            disposeModelAssetPreview: disposeModelAssetPreview,
            setStatus: setStatus,
            refreshGameModelsCatalog: refreshGameModelsCatalog,
            markDirty: markDirty
        };
    }

    function actorModelSidebarEnv() {
        return {
            getBrowsableModelAssets: getBrowsableModelAssets,
            getState: function () {
                return state;
            },
            setStatus: setStatus,
            markDirty: markDirty,
            renderAll: renderAll,
            renderActorPalette: renderActorPalette,
            schedulePreviewRefresh: schedulePreviewRefresh,
            uploadFileToProjectUrl: uploadFileToProjectUrl,
            createActorTemplateFromModel: createActorTemplateFromModel
        };
    }

    function levelContentBrowserEnv() {
        return {
            getState: function () {
                return state;
            },
            getLevel: getLevel,
            getSelectedObject: function () {
                return selectedObject;
            },
            selectObject: selectObject,
            selectGridCellObject: selectGridCellObject,
            getLevelContentBrowserFilter: function () {
                return levelContentBrowserFilter;
            },
            setLevelContentBrowserFilter: function (value) {
                levelContentBrowserFilter = value || 'all';
            },
            getActiveWorkbench: function () {
                return activeWorkbench;
            },
            getViewportViewMode: function () {
                return viewportViewMode;
            },
            getActiveEditorMode: function () {
                return activeEditorMode;
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
        return _mapGridPickCellFromClientPoint(refs, clientX, clientY, grid);
    }

    document.addEventListener('DOMContentLoaded', init);
