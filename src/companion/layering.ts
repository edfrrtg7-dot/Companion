/**
 * Companion UI Layering System
 *
 * Centralized z-index management for all Companion UI components.
 * Ensures deterministic stacking order and launcher accessibility.
 *
 * Layer hierarchy (bottom to top):
 *   Base layer:            Page content
 *   Finance Widget layer:  Floating widget
 *   Modal/Dialog layer:    Overlays and modals
 *   Toast layer:           Notifications (below launcher)
 *   Launcher layer:        Emergency entry point (always top)
 */

// Non-overlapping bands for deterministic layering
// Ranges are chosen to prevent overlap even with internal sub-layering
const LAUNCHER_START = 2147483647;    // MAX_SAFE_INTEGER
const TOAST_START = LAUNCHER_START - 100;     // 2147483547
const MODAL_START = TOAST_START - 100;        // 2147483447
const WIDGET_START = MODAL_START - 100;       // 2147483347

/** Layer definitions - each layer occupies a discrete band */
export const enum Layer {
    /** Finance widget and similar floating widgets */
    WIDGET = WIDGET_START,
    /** Modal overlays, dialogs, main modal */
    MODAL = MODAL_START,
    /** Toast notifications - below launcher, above modal */
    TOAST = TOAST_START,
    /** Launcher - absolute top, emergency entry point */
    LAUNCHER = LAUNCHER_START,
}

/** Internal sub-layers within a layer band - safe to add up to 99 without overlap */
export const enum SubLayer {
    BASE = 0,
    CONTENT = 10,
    DROPDOWN = 20,
    HEADER = 30,
    OVERLAY = 40,
    BACKDROP = 50,
}

/**
 * Compose a z-index from layer and sub-layer.
 * Example: zIndex(Layer.MODAL, SubLayer.DROPDOWN) = 2147483447 + 20 = 2147483467
 */
export function zIndex(layer: Layer, subLayer: SubLayer = SubLayer.BASE): number {
    return layer + subLayer;
}

/** Convenience: get raw layer value */
export function layerValue(layer: Layer): number {
    return layer;
}

/** Named exports for common combinations */
export const Z = {
    widget: Layer.WIDGET,
    widgetDropdown: zIndex(Layer.WIDGET, SubLayer.DROPDOWN),
    widgetHeader: zIndex(Layer.WIDGET, SubLayer.HEADER),
    widgetResize: zIndex(Layer.WIDGET, SubLayer.BASE),
    modal: Layer.MODAL,
    modalContent: zIndex(Layer.MODAL, SubLayer.CONTENT),
    modalDropdown: zIndex(Layer.MODAL, SubLayer.DROPDOWN),
    toast: Layer.TOAST,
    launcher: Layer.LAUNCHER,
} as const;

export type ZIndex = number;