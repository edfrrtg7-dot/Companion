/**
 * Plugin API 1.0 — Stable contract between the Companion Platform and platform modules.
 *
 * PluginContext exposes only stable platform infrastructure.
 * ModuleManager is never exposed to plugins.
 */

import { VersionManager } from "./versioning";
import { EventBus } from "./event-bus";
import { DiagnosticsService } from "./diagnostics-service";
import { PlatformStorage } from "./platform-storage";
import { CapabilityRegistry } from "./capability-registry";
import { ServiceRegistry } from "./service-registry";
import { DependencyRegistry } from "./dependency-registry";
import { ModuleManager, InitializableModule, PlatformServices } from "./module-manager";
import { CompanionModule, ModuleId, ModuleMetadata, ModuleCapabilities } from "./platform";

/**
 * Canonical plugin context.
 *
 * Read-only snapshot of platform services available to plugins.
 * Plugins receive this during initialization and must not store mutable references.
 */
export interface PluginContext {
    readonly versionManager: VersionManager;
    readonly eventBus: EventBus;
    readonly diagnostics: DiagnosticsService;
    readonly storage: PlatformStorage;
    readonly capabilities: CapabilityRegistry;
    readonly services: ServiceRegistry;
    readonly dependencies: DependencyRegistry;
}

/**
 * Plugin module interface.
 *
 * Plugins implement this contract. They receive PluginContext instead of
 * PlatformServices to prevent access to ModuleManager internals.
 */
export interface PluginModule<TSnapshot, TDiff> extends CompanionModule<TSnapshot, TDiff> {
    initialize(context: PluginContext): Promise<void>;
    dispose(): Promise<void>;
}

/**
 * Single canonical construction path for PluginContext.
 * Both createPluginContext and the adapter use this internally.
 */
function buildPluginContext(services: PlatformServices): PluginContext {
    return Object.freeze({
        versionManager: services.versionManager,
        eventBus: services.eventBus,
        diagnostics: services.diagnostics,
        storage: services.storage,
        capabilities: services.capabilities,
        services: services.services,
        dependencies: services.dependencies,
    });
}

/**
 * Create a PluginContext from ModuleManager's internal services.
 *
 * This is the only way ModuleManager exposes its services to plugins.
 * ModuleManager itself is never passed to plugins.
 */
export function createPluginContext(manager: ModuleManager): PluginContext {
    return buildPluginContext(manager.getPlatformServices());
}

/**
 * Adapter that bridges PluginModule to ModuleManager's InitializableModule.
 *
 * The adapter receives PlatformServices during injectPlatformServices(),
 * calls the canonical buildPluginContext(), and passes it to the plugin's initialize().
 *
 * Plugins never see PlatformServices or ModuleManager directly.
 */
export function wrapPluginModule<TSnapshot, TDiff>(
    plugin: PluginModule<TSnapshot, TDiff>
): InitializableModule<TSnapshot, TDiff> {
    let context: PluginContext | null = null;

    return {
        get id() { return plugin.id; },
        get metadata() { return plugin.metadata; },
        get capabilities() { return plugin.capabilities; },
        get services() { return plugin.services; },
        get dependencies() { return plugin.dependencies; },

        injectPlatformServices(services: PlatformServices): void {
            context = buildPluginContext(services);
        },

        async initialize(): Promise<void> {
            if (!context) {
                throw new Error("PluginModule: injectPlatformServices must be called before initialize");
            }
            await plugin.initialize(context);
        },

        async dispose(): Promise<void> {
            await plugin.dispose();
        },

        createSnapshot(): TSnapshot {
            return plugin.createSnapshot();
        },

        createDiff(previous: TSnapshot, current: TSnapshot): TDiff {
            return plugin.createDiff(previous, current);
        },
    };
}