/**
 * Storage Migration Framework
 *
 * Manages storage schema migrations.
 * Migrations execute automatically when version mismatch is detected.
 *
 * Version history:
 *   Version 1 → Version 2: unify Finance widget state.
 *   Finance shift (previously a bare string under "ab-finance-state") and the
 *   pre-Companion AgencyBooster keys ("agencybooster-finance-widget",
 *   "agencybooster-finance-preset") are merged into the single authoritative
 *   "ab-finance-widget-state" object. Superseded keys are removed.
 */

import { STORAGE_VERSION, getStoredVersion, setStoredVersion } from "./storage-version";
import { StorageService } from "./storage-service";
import { STORAGE_KEYS } from "./storage-keys";
import { diag } from "./dev";

// ---------------------------------------------------------------------------
// Migration type
// ---------------------------------------------------------------------------

/** A single migration step. */
export interface Migration {
    /** Version this migration migrates FROM. */
    readonly from: number;
    /** Version this migration migrates TO. */
    readonly to: number;
    /** Migration function. Synchronous. */
    readonly migrate: () => void;
}

// ---------------------------------------------------------------------------
// Finance unified state
// ---------------------------------------------------------------------------

type FinanceShiftType = "morning" | "day" | "night";

const FINANCE_SHIFT_TYPES: readonly FinanceShiftType[] = ["morning", "day", "night"];

/** Unified Finance widget state — single authoritative persistence object. */
interface UnifiedFinanceState {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly collapsed: boolean;
    readonly hidden: boolean;
    readonly shift?: FinanceShiftType;
}

const DEFAULT_FINANCE_STATE: UnifiedFinanceState = {
    x: 24,
    y: 24,
    width: 360,
    height: 380,
    collapsed: true,
    hidden: false,
};

function isFinanceShift(value: unknown): value is FinanceShiftType {
    return typeof value === "string" && (FINANCE_SHIFT_TYPES as readonly string[]).includes(value);
}

/** Parse a unified state value if it validates. Preserves a valid shift field. */
function readValidatedState(raw: string | null): UnifiedFinanceState | null {
    if (!raw) return null;
    try {
        const value = JSON.parse(raw);
        if (
            value &&
            typeof value === "object" &&
            typeof value.x === "number" &&
            typeof value.y === "number" &&
            typeof value.width === "number" && value.width > 0 &&
            typeof value.height === "number" && value.height > 0 &&
            typeof value.collapsed === "boolean" &&
            typeof value.hidden === "boolean"
        ) {
            const state: UnifiedFinanceState = {
                x: value.x,
                y: value.y,
                width: value.width,
                height: value.height,
                collapsed: value.collapsed,
                hidden: value.hidden,
            };
            if (isFinanceShift(value.shift)) {
                state.shift = value.shift;
            }
            return state;
        }
    } catch {
        // Corrupted value
    }
    return null;
}

/** Parse the pre-Companion widget state (width, height, collapsed, closed). */
function readLegacyWidgetState(raw: string | null): UnifiedFinanceState | null {
    if (!raw) return null;
    try {
        const value = JSON.parse(raw);
        if (!value || typeof value !== "object") return null;
        const state: UnifiedFinanceState = { ...DEFAULT_FINANCE_STATE };
        if (typeof value.width === "number" && value.width > 0) {
            state.width = value.width;
        }
        if (typeof value.height === "number" && value.height > 0) {
            state.height = value.height;
        }
        if (typeof value.collapsed === "boolean") {
            state.collapsed = value.collapsed;
        }
        if (typeof value.closed === "boolean") {
            state.hidden = value.closed;
        }
        return state;
    } catch {
        // Corrupted value
    }
    return null;
}

/** Parse a shift from either a bare JSON string or an object with a shift field. */
function readShift(raw: string | null): FinanceShiftType | null {
    if (!raw) return null;
    try {
        const value = JSON.parse(raw);
        if (isFinanceShift(value)) {
            return value;
        }
        if (value && typeof value === "object" && isFinanceShift(value.shift)) {
            return value.shift;
        }
    } catch {
        // Corrupted value
    }
    return null;
}

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------

/**
 * v1 → v2: unify Finance widget persistence.
 *
 * Merges the legacy shift sources and the pre-Companion widget geometry into
 * the single authoritative "ab-finance-widget-state" object, then removes the
 * superseded keys. Idempotent: once the superseded keys are gone, re-running
 * produces no further writes.
 */
function migrateFinanceStateV1toV2(): void {
    const existingRaw = StorageService.get(STORAGE_KEYS.FINANCE_WIDGET_STATE);
    const financeStateRaw = StorageService.get(STORAGE_KEYS.FINANCE_STATE);
    const legacyWidgetRaw = StorageService.get(STORAGE_KEYS.LEGACY_FINANCE_WIDGET);
    const legacyPresetRaw = StorageService.get(STORAGE_KEYS.LEGACY_FINANCE_PRESET);

    if (existingRaw || financeStateRaw || legacyWidgetRaw || legacyPresetRaw) {
        const state = readValidatedState(existingRaw)
            ?? readLegacyWidgetState(legacyWidgetRaw)
            ?? { ...DEFAULT_FINANCE_STATE };

        const shift = readShift(existingRaw)
            ?? readShift(financeStateRaw)
            ?? readShift(legacyPresetRaw);

        if (shift) {
            state.shift = shift;
        }

        try {
            StorageService.set(STORAGE_KEYS.FINANCE_WIDGET_STATE, JSON.stringify(state));
        } catch (error) {
            diag("Finance state migration: failed to write unified state", error);
        }
    }

    StorageService.remove(STORAGE_KEYS.FINANCE_STATE);
    StorageService.remove(STORAGE_KEYS.LEGACY_FINANCE_WIDGET);
    StorageService.remove(STORAGE_KEYS.LEGACY_FINANCE_PRESET);
}

/**
 * Registered migrations.
 * Add new migrations here as new versions are introduced.
 */
export const MIGRATIONS: Migration[] = [
    { from: 1, to: 2, migrate: migrateFinanceStateV1toV2 },
];

// ---------------------------------------------------------------------------
// Migration runner
// ---------------------------------------------------------------------------

/**
 * Run all pending migrations from stored version to current version.
 * Migrations execute in order (from → to).
 *
 * Safe to call multiple times — no-op if already at current version.
 */
export function runMigrations(): void {
    const storedVersion = getStoredVersion();

    if (storedVersion >= STORAGE_VERSION) {
        return; // Already up to date
    }

    if (storedVersion === 0) {
        // First run — set version, no migrations needed
        setStoredVersion(STORAGE_VERSION);
        diag("Storage initialized at version", STORAGE_VERSION);
        return;
    }

    diag("Storage migration needed:", storedVersion, "→", STORAGE_VERSION);

    // Find and execute applicable migrations
    let currentVersion = storedVersion;

    for (const migration of MIGRATIONS) {
        if (migration.from === currentVersion) {
            try {
                diag("Running migration:", migration.from, "→", migration.to);
                migration.migrate();
                currentVersion = migration.to;
            } catch (error) {
                diag("Migration failed:", migration.from, "→", migration.to, error);
                // Stop migration chain on failure
                return;
            }
        }
    }

    // Update stored version
    setStoredVersion(STORAGE_VERSION);
    diag("Storage migration complete at version", STORAGE_VERSION);
}
