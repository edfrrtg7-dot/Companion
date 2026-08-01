/**
 * Storage Versioning
 *
 * Tracks the storage schema version.
 * Enables migration pipeline when schema changes.
 *
 * Version history:
 *   - 1: initial schema (Finance shift persisted under FINANCE_STATE)
 *   - 2: unified Finance widget state (shift merged into FINANCE_WIDGET_STATE)
 */

import { StorageService } from "./storage-service";
import { STORAGE_KEYS } from "./storage-keys";

/** Current storage schema version. */
export const STORAGE_VERSION = 2;

/** Key used to persist the storage version. */
const VERSION_KEY = STORAGE_KEYS.STORAGE_VERSION;

/** Stored version value structure. */
interface StoredVersion {
    readonly version: number;
}

/**
 * Get the currently stored storage version.
 * Returns 0 if no version has been stored (first run).
 */
export function getStoredVersion(): number {
    const raw = StorageService.get(VERSION_KEY);
    if (!raw) return 0;

    try {
        const parsed = JSON.parse(raw) as StoredVersion;
        if (typeof parsed === "object" && parsed !== null && typeof parsed.version === "number") {
            return parsed.version;
        }
    } catch {
        // Corrupted version data
    }

    return 0;
}

/**
 * Persist the current storage version.
 * Called after successful migration.
 */
export function setStoredVersion(version: number): void {
    const data: StoredVersion = { version };
    StorageService.set(VERSION_KEY, JSON.stringify(data));
}

/**
 * Check if migration is needed.
 * Returns true if stored version differs from current version.
 */
export function isMigrationNeeded(): boolean {
    return getStoredVersion() !== STORAGE_VERSION;
}
