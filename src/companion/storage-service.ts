/**
 * StorageService
 *
 * Centralized storage abstraction for Companion.
 * Single point of access for all persistent data.
 *
 * Responsibilities:
 *   - Single storage API (get, set, remove, clear, exists)
 *   - Typed key access through STORAGE_KEYS
 *   - Adapter selection (ChromeStorage preferred, localStorage fallback)
 *   - Future backend replacement
 *   - Versioned storage
 *
 * No module accesses browser storage directly.
 * All storage goes through StorageService.
 */

import { StorageAdapter, LocalStorageAdapter, ChromeStorageAdapter } from "./storage-adapter";
import { STORAGE_KEYS, StorageKey } from "./storage-keys";
import { getPlatform } from "./platform-interface";

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let adapter: StorageAdapter | null = null;

/**
 * Initialize the storage adapter eagerly.
 * Call this during bootstrap to drive adapter creation explicitly.
 * Once called, all storage access goes through the selected adapter.
 * Idempotent — safe to call multiple times.
 */
export function initStorage(): void {
    if (adapter) return;

    if (getPlatform().chromeStorage) {
        adapter = new ChromeStorageAdapter();
    } else {
        adapter = new LocalStorageAdapter();
    }
}

/**
 * Get the active storage adapter.
 * Lazily initializes on first access (e.g. module-scope code in dev.ts).
 * Bootstrap should call initStorage() to drive creation explicitly.
 */
function getAdapter(): StorageAdapter {
    if (!adapter) {
        initStorage();
    }
    return adapter;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Centralized storage service. All storage access goes through here. */
export const StorageService = {
    /**
     * Read a value by key.
     * @param key - Storage key from STORAGE_KEYS
     * @returns The stored value, or null if not found
     */
    get(key: StorageKey): string | null {
        return getAdapter().get(key);
    },

    /**
     * Write a value by key.
     * @param key - Storage key from STORAGE_KEYS
     * @param value - Value to store
     */
    set(key: StorageKey, value: string): void {
        getAdapter().set(key, value);
    },

    /**
     * Remove a value by key.
     * @param key - Storage key from STORAGE_KEYS
     */
    remove(key: StorageKey): void {
        getAdapter().remove(key);
    },

    /** Remove all stored values. Use with caution. */
    clear(): void {
        getAdapter().clear();
    },

    /**
     * Check if a key exists.
     * @param key - Storage key from STORAGE_KEYS
     * @returns true if the key exists
     */
    exists(key: StorageKey): boolean {
        return getAdapter().exists(key);
    },

    /**
     * Get the active adapter type.
     * Useful for diagnostics.
     */
    getAdapterType(): string {
        if (getPlatform().chromeStorage) {
            return "chrome.storage.local";
        }
        return "localStorage";
    },
} as const;