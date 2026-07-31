/**
 * VersionManager 2.0 - Full Infrastructure
 *
 * Single source of truth for platform version history.
 * Owns all version history, IDs, storage, and subscriptions.
 */

export type VersionId = string;

export type ModuleName = string;

export type VersionReason = 'startup' | 'refresh' | 'api_response' | 'manual_import' | 'storage_load' | 'shift_change' | 'settings_change' | 'user_click' | 'launcher_move' | 'launcher_resize' | 'launcher_toggle' | 'close' | 'open';

/**
 * Immutable snapshot interface
 * Contains the complete state at a specific version
 */
export interface Snapshot<TState> {
    readonly state: TState;
}

/**
 * Full version object
 * Contains version ID, timestamp, module info, reason, snapshot, and diff
 */
export interface Version<TSnapshot extends Snapshot<any>, TDiff> {
    readonly id: VersionId;
    readonly timestamp: number;
    readonly module: ModuleName;
    readonly reason: VersionReason;
    readonly snapshot: TSnapshot;
    readonly diff: TDiff;
    readonly metadata?: Record<string, unknown>;
}

/**
 * Comprehensive VersionManager with complete history management
 * Manages entire platform version history
 */
export class VersionManager {
    private counter = 0;
    private historyMap: Map<VersionId, Version<Snapshot<unknown>, unknown>> = new Map();
    private subscribers: Set<(v: Version<Snapshot<unknown>, unknown>) => void> = new Set();

    /**
     * Create a new immutable version
     * VersionManager generates IDs, stores history, and notifies subscribers
     */
    createVersion<TState extends Record<string, any>>(
        module: ModuleName,
        reason: VersionReason,
        snapshotData: TState,
        diff: Record<string, any>
    ): Version<Snapshot<unknown>, unknown> {
        const id = `v${++this.counter}`;
        const timestamp = Date.now();
        
        // Create immutable snapshot
        const snapshot: Snapshot<unknown> = {
            state: Object.freeze({ ...snapshotData })
        };
        
        // Create immutable diff
        const frozenDiff = Object.freeze({ ...diff });
        
        // Create version object
        const version: Version<Snapshot<unknown>, unknown> = {
            id,
            timestamp,
            module,
            reason,
            snapshot,
            diff: frozenDiff
        };
        
        // Store immutable version in history
        this.historyMap.set(id, Object.freeze(version));
        
        // Notify all subscribers
        for (const subscriber of this.subscribers) {
            subscriber(Object.freeze(version));
        }
        
        return Object.freeze(version);
    }

    /**
     * Subscribe to new versions.
     * Returns a function to unsubscribe.
     */
    subscribe(callback: (v: Version<Snapshot<unknown>, unknown>) => void): () => void {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    /**
     * Get the latest version.
     */
    latest(): Version<Snapshot<unknown>, unknown> | undefined {
        const latest = this.historyMap.get(`v${this.counter}`);
        return latest;
    }

    /**
     * Get full history as immutable array.
     */
    history(): ReadonlyArray<Version<Snapshot<unknown>, unknown>> {
        return Object.freeze(Array.from(this.historyMap.values()));
    }

    /**
     * Get a specific version by ID.
     */
    get(id: VersionId): Version<Snapshot<unknown>, unknown> | undefined {
        return this.historyMap.get(id);
    }

    /**
     * Clear all history and subscribers.
     */
    clear(): void {
        this.historyMap.clear();
        this.subscribers.clear();
        this.counter = 0;
    }
}