/**
 * StorageProvider — replaceable persistence backend interface.
 *
 * Consumers depend only on this contract.
 * PlatformStorage selects implementation at construction time.
 */

import { StorageKey } from "./storage-keys";

export interface StorageProvider {
    get(key: StorageKey): Promise<string | null>;
    set(key: StorageKey, value: string): Promise<void>;
    remove(key: StorageKey): Promise<void>;
    has(key: StorageKey): Promise<boolean>;
    clear(): Promise<void>;
}

/**
 * In-memory storage provider.
 * Deterministic, test-friendly, no browser APIs.
 */
export class MemoryStorageProvider implements StorageProvider {
    private readonly store = new Map<string, string>();

    async get(key: StorageKey): Promise<string | null> {
        return this.store.get(key) ?? null;
    }

    async set(key: StorageKey, value: string): Promise<void> {
        this.store.set(key, value);
    }

    async remove(key: StorageKey): Promise<void> {
        this.store.delete(key);
    }

    async has(key: StorageKey): Promise<boolean> {
        return this.store.has(key);
    }

    async clear(): Promise<void> {
        this.store.clear();
    }
}