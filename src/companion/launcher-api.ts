/**
 * Launcher API 1.0 — Stable contract for launcher registration and lifecycle.
 *
 * LauncherRegistry is owned by ModuleManager.
 * Launchers cannot self-register globally.
 */

import { ModuleId } from "./platform";
import { EventBus } from "./event-bus";
import { DiagnosticsService } from "./diagnostics-service";
import { CapabilityRegistry } from "./capability-registry";
import { ServiceRegistry } from "./service-registry";

export interface LauncherEntry {
    readonly id: ModuleId;
    readonly label: string;
    readonly moduleId: ModuleId;
    readonly order: number;
}

/**
 * Read-only context exposed to launcher UI components.
 * ModuleManager is never exposed.
 */
export interface LauncherContext {
    readonly eventBus: EventBus;
    readonly diagnostics: DiagnosticsService;
    readonly capabilities: CapabilityRegistry;
    readonly services: ServiceRegistry;
}

export class LauncherRegistry {
    private readonly entries = new Map<ModuleId, LauncherEntry>();

    /**
     * Register a launcher entry. Called by ModuleManager during register().
     * Duplicate module IDs throw deterministically.
     */
    register(id: ModuleId, label: string, moduleId: ModuleId, order: number = 0): void {
        if (this.entries.has(id)) {
            throw new Error(`LauncherRegistry: entry '${id}' is already registered`);
        }
        this.entries.set(id, Object.freeze({ id, label, moduleId, order }));
    }

    /**
     * Unregister a launcher entry.
     */
    unregister(id: ModuleId): void {
        this.entries.delete(id);
    }

    /**
     * Get a launcher entry by id.
     */
    get(id: ModuleId): Readonly<LauncherEntry> | undefined {
        return this.entries.get(id);
    }

    /**
     * Get all launcher entries, sorted by order.
     */
    getAll(): ReadonlyArray<Readonly<LauncherEntry>> {
        return Object.freeze(
            Array.from(this.entries.values()).sort((a, b) => a.order - b.order)
        );
    }

    /**
     * Get the count of registered launchers.
     */
    get count(): number {
        return this.entries.size;
    }
}