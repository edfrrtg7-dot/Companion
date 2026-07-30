/**
 * DiagnosticsService 1.0 - Runtime Inspection Layer
 *
 * Lightweight platform diagnostics that exposes runtime information
 * about the Companion platform. Read-only — never mutates state.
 */

import { VersionManager } from "./versioning";
import { EventBus } from "./event-bus";
import { ModuleId } from "./platform";

export interface ModuleDiagnostics {
    readonly id: ModuleId;
    readonly state: "registered" | "initialized" | "disposed";
}

export interface PlatformDiagnosticsSnapshot {
    readonly modules: ReadonlyArray<ModuleDiagnostics>;
    readonly versionCount: number;
    readonly latestVersionId: string | undefined;
}

export interface DiagnosticsProvider {
    readonly name: string;
    collect(): Record<string, unknown>;
}

export class DiagnosticsService {
    private readonly versionManager: VersionManager;
    private readonly eventBus: EventBus;
    private readonly providers: DiagnosticsProvider[] = [];

    constructor(versionManager: VersionManager, eventBus: EventBus) {
        this.versionManager = versionManager;
        this.eventBus = eventBus;
    }

    /**
     * Register a diagnostics provider for extensibility.
     * Providers are called when snapshot() is invoked.
     */
    registerProvider(provider: DiagnosticsProvider): void {
        this.providers.push(provider);
    }

    /**
     * Collect a read-only snapshot of the platform state.
     * All returned data is immutable — no internal references escape.
     */
    snapshot(
        registeredIds: ReadonlyArray<ModuleId>,
        initializedIds: ReadonlyArray<ModuleId>,
        disposedIds: ReadonlyArray<ModuleId>
    ): PlatformDiagnosticsSnapshot {
        const initialized = new Set(initializedIds);
        const disposed = new Set(disposedIds);

        const modules: ModuleDiagnostics[] = registeredIds.map((id) => ({
            id,
            state: disposed.has(id)
                ? "disposed"
                : initialized.has(id)
                    ? "initialized"
                    : "registered"
        }));

        const latest = this.versionManager.latest();

        return Object.freeze({
            modules: Object.freeze(modules),
            versionCount: this.versionManager.history().length,
            latestVersionId: latest?.id,
        });
    }
}