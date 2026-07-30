/**
 * PlatformStorage — platform-wide persistence layer.
 *
 * Owned by ModuleManager, injected into modules through PlatformServices.
 * The storage provider is replaceable without modifying consumers.
 *
 * PlatformStorage owns exactly one provider instance.
 * Provider replacement occurs only through construction — no runtime swapping.
 */

import { StorageKey } from "./storage-keys";
import { StorageProvider, MemoryStorageProvider } from "./storage-provider";

export class PlatformStorage {
    private readonly provider: StorageProvider;

    constructor(provider?: StorageProvider) {
        this.provider = provider ?? new MemoryStorageProvider();
    }

    async get<T>(key: StorageKey): Promise<T | null> {
        const raw = await this.provider.get(key);
        if (raw === null) return null;
        return JSON.parse(raw) as T;
    }

    async set<T>(key: StorageKey, value: T): Promise<void> {
        await this.provider.set(key, JSON.stringify(value));
    }

    async remove(key: StorageKey): Promise<void> {
        await this.provider.remove(key);
    }

    async has(key: StorageKey): Promise<boolean> {
        return this.provider.has(key);
    }

    async clear(): Promise<void> {
        await this.provider.clear();
    }
}