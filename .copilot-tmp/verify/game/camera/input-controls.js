import { clamp } from "../core/runtime-grid";
export function bindGameInputHandlers(options) {
    const { windowRef, domElement, themeStorageKey, onThemeStorageChanged, onResize, onPointerMove, onPointerLeave, onPointerDown, onPointerUp, onWheel, onEscape, onPauseToggle, onGachaToggle, isGachaOpen, onModeToggle, onCameraModeToggle, resolveBuildHotkey, onSelectBuild, resolveMapHotkey, onSelectMap, onActiveSkill, onKeyStateChange, onClearAllKeys, } = options;
    windowRef.addEventListener("storage", (event) => {
        if (event.key !== themeStorageKey) {
            return;
        }
        onThemeStorageChanged();
    });
    windowRef.addEventListener("resize", onResize);
    domElement.addEventListener("pointermove", onPointerMove);
    domElement.addEventListener("pointerleave", onPointerLeave);
    domElement.addEventListener("pointerdown", onPointerDown);
    domElement.addEventListener("pointerup", onPointerUp);
    domElement.addEventListener("contextmenu", (event) => event.preventDefault());
    domElement.addEventListener("wheel", (event) => {
        event.preventDefault();
        onWheel(Math.sign(event.deltaY));
    });
    windowRef.addEventListener("keydown", (event) => {
        if (event.code === "Escape") {
            onEscape();
            return;
        }
        if (event.code === "KeyP") {
            onPauseToggle();
            return;
        }
        if (event.code === "KeyG") {
            onGachaToggle();
            return;
        }
        if (isGachaOpen()) {
            return;
        }
        if (event.code === "Tab") {
            event.preventDefault();
            onModeToggle();
            return;
        }
        if (event.code === "KeyZ") {
            onCameraModeToggle();
            return;
        }
        if (event.code === "KeyF") {
            onActiveSkill();
            return;
        }
        const buildId = resolveBuildHotkey(event.code);
        if (buildId) {
            onSelectBuild(buildId);
        }
        const mapIndex = resolveMapHotkey(event.key);
        if (mapIndex !== null) {
            onSelectMap(mapIndex);
        }
        onKeyStateChange(event.code, true, { repeat: event.repeat });
    });
    windowRef.addEventListener("keyup", (event) => onKeyStateChange(event.code, false));
    // Release all held keys when the window loses focus (alt-tab, tab-switch, etc.)
    // so the camera/player can't drift uncontrolled afterward.
    windowRef.addEventListener("blur", () => onClearAllKeys());
}
export function shouldStartCameraDrag(gachaOpen, mode, button) {
    if (gachaOpen) {
        return false;
    }
    if (mode === "explore") {
        // Left click (0) is reserved for basic attack in explore mode; only right-click rotates camera
        return button === 2;
    }
    return button === 1 || button === 2;
}
export function beginCameraDrag(state, domElement, event) {
    domElement.setPointerCapture(event.pointerId);
    return {
        ...state,
        isCameraDragging: true,
        cameraDragButton: event.button,
        cameraDragMoved: false,
        lastPointerX: event.clientX,
        lastPointerY: event.clientY,
    };
}
export function rotateCameraFromPointer(dragState, orbitState, mode, event) {
    const dx = event.clientX - dragState.lastPointerX;
    const dy = event.clientY - dragState.lastPointerY;
    const nextDragState = {
        ...dragState,
        lastPointerX: event.clientX,
        lastPointerY: event.clientY,
        cameraDragMoved: dragState.cameraDragMoved || Math.abs(dx) + Math.abs(dy) > 2,
    };
    const yawDelta = -dx * 0.006;
    if (mode === "explore") {
        return {
            dragState: nextDragState,
            orbitState: {
                ...orbitState,
                exploreCameraYaw: orbitState.exploreCameraYaw + yawDelta,
                exploreCameraPitch: clamp(orbitState.exploreCameraPitch - dy * 0.0035, 0.22, 0.95),
            },
        };
    }
    return {
        dragState: nextDragState,
        orbitState: {
            ...orbitState,
            freeCameraYaw: orbitState.freeCameraYaw + yawDelta,
            freeCameraPitch: clamp(orbitState.freeCameraPitch + dy * 0.004, 0.24, 1.12),
        },
    };
}
export function endCameraDrag(state, domElement, event) {
    domElement.releasePointerCapture(event.pointerId);
    return {
        ...state,
        isCameraDragging: false,
        cameraDragButton: -1,
    };
}
export function applyCameraZoom(zoomState, mode, cameraMode, direction) {
    if (mode === "explore") {
        return {
            ...zoomState,
            exploreCameraDistance: clamp(zoomState.exploreCameraDistance + direction * Math.max(0.8, zoomState.exploreCameraDistance * 0.12), 5.2, 180),
        };
    }
    if (cameraMode === "free") {
        return {
            ...zoomState,
            freeCameraDistance: clamp(zoomState.freeCameraDistance + direction * Math.max(4, zoomState.freeCameraDistance * 0.12), 16, 4200),
        };
    }
    return {
        ...zoomState,
        topdownDistance: clamp(zoomState.topdownDistance + direction * Math.max(5, zoomState.topdownDistance * 0.12), 22, 5200),
    };
}
export function resizeViewport(camera, renderer, width, height) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}
