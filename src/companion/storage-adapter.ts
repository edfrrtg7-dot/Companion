/**
 * Storage Adapter Architecture
 *
 * Abstract storage interface with two implementations:
 * - LocalStorageAdapter: synchronous browser localStorage
 * - ChromeStorageAdapter: chrome.storage.local with sync cache
 *
 * StorageService chooses the best adapter automatically.
 * Chrome Storage is preferred when available (extension context).
 * localStorage is used as fallback (userscript context).
 */

import { getPlatform } from "./platform-interface";

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Abstract storage adapter interface. */
export interface StorageAdapter {
    /** Read a value by key. Returns null if not found. */
    get(key: string): string | null;

    /** Write a value by key. */
    set(key: string, value: string): void;

    /** Remove a value by key. */
    remove(key: string): void;

    /** Remove all values. */
    clear(): void;

    /** Check if a key exists. */
    exists(key: string): boolean;
}

// ---------------------------------------------------------------------------
// LocalStorage Adapter
// ---------------------------------------------------------------------------

/** Synchronous localStorage adapter. */
export class LocalStorageAdapter implements StorageAdapter {
    get(key: string): string | null {
        try {
            return getPlatform().localStorage.getItem(key);
        } catch {
            return null;
        }
    }

    set(key: string, value: string): void {
        try {
            getPlatform().localStorage.setItem(key, value);
        } catch {
            // localStorage full or unavailable
        }
    }

    remove(key: string): void {
        try {
            getPlatform().localStorage.removeItem(key);
        } catch {
            // localStorage unavailable
        }
    }

    clear(): void {
        try {
            getPlatform().localStorage.clear();
        } catch {
            // localStorage unavailable
        }
    }

    exists(key: string): boolean {
        try {
            return getPlatform().localStorage.getItem(key) !== null;
        } catch {
            return false;
        }
    }
}

// ---------------------------------------------------------------------------
// Chrome Storage Adapter
// ---------------------------------------------------------------------------

/**
 * chrome.storage.local adapter.
 *
 * Uses synchronous in-memory cache backed by async chrome.storage.local.
 * Cache is populated on construction (sync read from memory).
 * Writes go to both cache and chrome.storage.local (async background sync).
 *
 * For the content script context, chrome.storage.local is available
 * through the extension's isolated world.
 */
export class ChromeStorageAdapter implements StorageAdapter {
    private cache: Map<string, string> = new Map();
    private ready = false;

    constructor() {
        this.hydrate();
    }

    /**
     * Hydrate cache from chrome.storage.local.
     * This is async but we don't await it — the cache starts empty
     * and gets populated in the background. Subsequent get() calls
     * will return from cache once hydrated.
     */
    private hydrate(): void {
        const cs = getPlatform().chromeStorage;
        if (cs) {
            cs.getAll().then((all) => {
                for (const [key, value] of Object.entries(all)) {
                    if (typeof value === "string") {
                        this.cache.set(key, value);
                    }
                }
                this.ready = true;
            }).catch(() => {
                this.ready = true;
            });
        } else {
            this.ready = true;
        }
    }

    get(key: string): string | null {
        return this.cache.get(key) ?? null;
    }

    set(key: string, value: string): void {
        this.cache.set(key, value);
        this.persist(key, value);
    }

    remove(key: string): void {
        this.cache.delete(key);
        this.persistRemove(key);
    }

    clear(): void {
        this.cache.clear();
        this.persistClear();
    }

    exists(key: string): boolean {
        return this.cache.has(key);
    }

    /** Whether the cache has been hydrated from chrome.storage. */
    get isReady(): boolean {
        return this.ready;
    }

    private persist(key: string, value: string): void {
        try {
            getPlatform().chromeStorage?.set(key, value);
        } catch {
            // chrome.storage not available
        }
    }

    private persistRemove(key: string): void {
        try {
            getPlatform().chromeStorage?.remove(key);
        } catch {
            // chrome.storage not available
        }
    }

    private persistClear(): void {
        try {
            getPlatform().chromeStorage?.clear();
        } catch {
            // chrome.storage not available
        }
    }
}
