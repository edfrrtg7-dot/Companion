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

    /** Finance widget unified state (position, size, collapsed, hidden, shift). Single authoritative source. */
    FINANCE_WIDGET_STATE: "ab-finance-widget-state",

    /** Legacy Finance state key — held the shift preset before unification. Removed by migration v1→v2. */
    FINANCE_STATE: "ab-finance-state",

    /** Legacy AgencyBooster widget state key (pre-Companion). Migrated to FINANCE_WIDGET_STATE. */
    LEGACY_FINANCE_WIDGET: "agencybooster-finance-widget",

    /** Legacy AgencyBooster shift preset key (pre-Companion). Migrated to FINANCE_WIDGET_STATE. */
    LEGACY_FINANCE_PRESET: "agencybooster-finance-preset",

    /** Development mode flag. */
    DEV_MODE: "ab-dev",

    /** Settings module preferences (future). */
    SETTINGS: "ab-settings",

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
