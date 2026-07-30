/**
 * Platform Foundation Types
 *
 * Canonical contracts for Companion platform infrastructure.
 * All future modules must implement CompanionModule.
 */

export type ModuleId = string;

export interface ModuleMetadata {
    readonly name: string;
    readonly version: string;
    readonly description?: string;
}

export interface ModuleCapabilities {
    readonly snapshot: boolean;
    readonly diagnostics: boolean;
    readonly versioning: boolean;
    readonly export: boolean;
    readonly events: boolean;
}

export interface CompanionModule<TSnapshot, TDiff> {
    readonly id: ModuleId;
    readonly metadata: ModuleMetadata;
    readonly capabilities: ModuleCapabilities;

    /** Optional services exported by this module for cross-module discovery. */
    readonly services?: Record<string, unknown>;

    /** Optional dependency declarations for initialization ordering and validation. */
    readonly dependencies?: {
        readonly services?: readonly string[];
        readonly capabilities?: readonly string[];
        readonly modules?: readonly ModuleId[];
    };

    initialize(): Promise<void>;
    dispose(): Promise<void>;

    createSnapshot(): TSnapshot;
    createDiff(previous: TSnapshot, current: TSnapshot): TDiff;
}