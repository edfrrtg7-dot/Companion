/**
 * Storage Key Registry
 *
 * Centralized registry for all storage keys used by Companion.
 * No hardcoded strings allowed elsewhere. All keys must be registered here.
 *
 * Future modules must register their keys here before use.
 */

/** All known storage keys. */
export const STORAGE_KEYS = {
    /** Finance widget window state (position, size, collapsed, hidden). */
    COMPANION_WINDOW_STATE: "ab-companion-window-state",

    /** Finance widget window state (legacy key for migration). */
    FINANCE_WIDGET_STATE: "ab-finance-widget-state",

    /** Development mode flag. */
    DEV_MODE: "ab-dev",

    /** Settings module preferences (future). */
    SETTINGS: "ab-settings",

    /** Finance module state (future). */
    FINANCE_STATE: "ab-finance-state",

    /** Active tab in the Companion modal. */
    COMPANION_ACTIVE_TAB: "ab-companion-active-tab",

    /** Storage version marker. */
    STORAGE_VERSION: "ab-storage-version",

    /** Diagnostics error history. */
    DIAGNOSTICS_ERROR_HISTORY: "ab-diag-error-history",

    /** Diagnostics import history. */
    DIAGNOSTICS_IMPORT_HISTORY: "ab-diag-import-history",

    /** Session memory history (persistent between browser restarts). */
    SESSION_MEMORY: "ab-session-memory",
} as const;

/** Type-safe key type. */
export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
