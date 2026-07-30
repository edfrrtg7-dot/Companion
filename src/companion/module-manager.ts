/**
 * ModuleManager 2.0 - Platform Orchestrator
 *
 * Single orchestration point of the Companion Platform.
 * Manages platform lifecycle, dependency injection, infrastructure ownership and module orchestration.
 */

import { CompanionModule, ModuleId } from "./platform";
import { VersionManager } from "./versioning";
import { EventBus } from "./event-bus";
import { DiagnosticsService, PlatformDiagnosticsSnapshot } from "./diagnostics-service";
import { PlatformStorage } from "./platform-storage";
import { CapabilityRegistry } from "./capability-registry";
import { ServiceRegistry } from "./service-registry";
import { DependencyRegistry, DependencyValidationResult } from "./dependency-registry";
import { LauncherRegistry } from "./launcher-api";

/**
 * Platform services owned and managed by ModuleManager.
 * Modules receive these through dependency injection.
 */
export interface PlatformServices {
    readonly versionManager: VersionManager;
    readonly eventBus: EventBus;
    readonly diagnostics: DiagnosticsService;
    readonly storage: PlatformStorage;
    readonly capabilities: CapabilityRegistry;
    readonly services: ServiceRegistry;
    readonly dependencies: DependencyRegistry;
    readonly launchers: LauncherRegistry;
}

/**
 * Extended module interface that includes platform service injection.
 * Modules implement CompanionModule but receive PlatformServices during initialization.
 */
export interface InitializableModule<TSnapshot, TDiff> extends CompanionModule<TSnapshot, TDiff> {
    /**
     * Inject platform services into the module.
     * Called by ModuleManager before initialize().
     * Modules must store service references for later use.
     */
    injectPlatformServices(services: PlatformServices): void;
}

export class ModuleManager {
    private readonly modules: Map<ModuleId, InitializableModule<any, any>> = new Map();
    private readonly versionManager: VersionManager;
    private readonly eventBus: EventBus;
    private readonly diagnostics: DiagnosticsService;
    private readonly storage: PlatformStorage;
    private readonly capabilities: CapabilityRegistry;
    private readonly services: ServiceRegistry;
    private readonly dependencies: DependencyRegistry;
    private readonly launchers: LauncherRegistry;
    private initializedModules: Set<ModuleId> = new Set();
    private disposedModules: Set<ModuleId> = new Set();
    private initializationOrder: ModuleId[] = [];
    private initializationFailures: Map<ModuleId, string> = new Map();

    /**
     * Create ModuleManager with owned platform services.
     * ModuleManager owns all platform infrastructure.
     */
    constructor() {
        this.versionManager = new VersionManager();
        this.eventBus = new EventBus();
        this.diagnostics = new DiagnosticsService(this.versionManager, this.eventBus);
        this.storage = new PlatformStorage();
        this.capabilities = new CapabilityRegistry();
        this.services = new ServiceRegistry();
        this.dependencies = new DependencyRegistry();
        this.launchers = new LauncherRegistry();

        // Register diagnostics provider for capability registry
        this.diagnostics.registerProvider({
            name: "capabilities",
            collect: () => ({
                all: this.capabilities.getAllCapabilities(),
                modules: Object.fromEntries(
                    this.capabilities.getAllModules().map((id) => [
                        id,
                        this.capabilities.getCapabilities(id)
                    ])
                )
            })
        });

        // Register diagnostics provider for service registry
        this.diagnostics.registerProvider({
            name: "services",
            collect: () => ({
                count: this.services.serviceCount,
                all: this.services.getAllServices(),
                owners: Object.fromEntries(
                    this.services.getAllServices().map((key) => [key, this.services.getOwner(key)])
                )
            })
        });

        // Register diagnostics provider for dependency registry
        this.diagnostics.registerProvider({
            name: "dependencies",
            collect: () => ({
                count: this.dependencies.moduleCount,
                modules: this.dependencies.getAllModules(),
                validation: Object.fromEntries(
                    this.dependencies.validateAll().map((r) => [r.moduleId, r])
                )
            })
        });

        // Register diagnostics provider for launcher registry
        this.diagnostics.registerProvider({
            name: "launchers",
            collect: () => ({
                count: this.launchers.count,
                entries: this.launchers.getAll().map((e) => ({ id: e.id, label: e.label, moduleId: e.moduleId }))
            })
        });
    }

    /**
     * Register a module. Passive registration - no side effects.
     * Rules:
     *   - no initialization
     *   - no dependency resolution
     *   - no async work
     *   - no service injection
     *
     * Capability and service registration is automatic — read from module metadata.
     */
    register(module: InitializableModule<any, any>): void {
        if (this.modules.has(module.id)) return;
        this.modules.set(module.id, module);
        this.capabilities.registerModule(module.id, module.capabilities);
        this.dependencies.markModuleRegistered(module.id);

        for (const [cap, enabled] of Object.entries(module.capabilities)) {
            if (enabled) {
                this.dependencies.markCapabilityRegistered(cap);
            }
        }

        if (module.services) {
            this.services.registerModule(module.id, module.services);
            for (const name of Object.keys(module.services)) {
                this.dependencies.markServiceRegistered(name);
            }
        }

        if (module.dependencies) {
            this.dependencies.registerModule(module.id, module.dependencies);
        }
    }

    /**
     * Get a module by id.
     */
    get(id: ModuleId): InitializableModule<any, any> | undefined {
        return this.modules.get(id);
    }

    /**
     * Get all registered modules.
     */
    getAll(): InitializableModule<any, any>[] {
        return Array.from(this.modules.values());
    }

    /**
     * Get registered module ids.
     */
    getRegisteredIds(): ModuleId[] {
        return Array.from(this.modules.keys());
    }

    /**
     * Inject platform services into all registered modules.
     * Must be called after registration and before initializeAll().
     * Modules receive services through dependency injection.
     */
    injectPlatformServices(): void {
        const services: PlatformServices = {
            versionManager: this.versionManager,
            eventBus: this.eventBus,
            diagnostics: this.diagnostics,
            storage: this.storage,
            capabilities: this.capabilities,
            services: this.services,
            dependencies: this.dependencies,
            launchers: this.launchers
        };

        for (const module of this.modules.values()) {
            module.injectPlatformServices(services);
        }
    }

    /**
     * Initialize all registered modules in deterministic order.
     * Platform lifecycle: register -> injectPlatformServices -> initializeAll
     * Initialization order is deterministic and reproducible.
     */
    async initializeAll(): Promise<void> {
        // Reset tracking
        this.initializedModules.clear();
        this.initializationOrder = [];
        this.initializationFailures.clear();

        // Initialize modules in registration order (deterministic)
        for (const [id, module] of this.modules.entries()) {
            if (this.initializedModules.has(id)) {
                throw new Error(`Module ${id} already initialized`);
            }
            if (this.disposedModules.has(id)) {
                throw new Error(`Module ${id} has been disposed and cannot be reinitialized`);
            }

            try {
                await module.initialize();
                this.initializedModules.add(id);
                this.initializationOrder.push(id);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.initializationFailures.set(id, message);
                throw error;
            }
        }
    }

    /**
     * Dispose all modules in reverse initialization order.
     * Platform lifecycle runs in reverse: disposeAll -> ...
     * Disposal order must be exactly the reverse of initialization.
     */
    async disposeAll(): Promise<void> {
        // Dispose in reverse initialization order
        for (let i = this.initializationOrder.length - 1; i >= 0; i--) {
            const id = this.initializationOrder[i];
            const module = this.modules.get(id);

            if (!module) continue;
            if (this.disposedModules.has(id)) {
                throw new Error(`Module ${id} already disposed`);
            }
            if (!this.initializedModules.has(id)) {
                throw new Error(`Module ${id} not initialized`);
            }

            await module.dispose();
            this.disposedModules.add(id);
            this.initializedModules.delete(id);
        }

        // Clear tracking after disposal
        this.initializationOrder = [];
    }

    /**
     * Collect platform diagnostics snapshot.
     */
    collectDiagnostics(): PlatformDiagnosticsSnapshot {
        return this.diagnostics.snapshot(
            this.getRegisteredIds(),
            Array.from(this.initializedModules),
            Array.from(this.disposedModules)
        );
    }

    /**
     * Get the initialization order of modules.
     */
    getInitializationOrder(): ReadonlyArray<ModuleId> {
        return Object.freeze([...this.initializationOrder]);
    }

    /**
     * Get module initialization failures (module id -> error message).
     */
    getInitializationFailures(): ReadonlyMap<ModuleId, string> {
        return new Map(this.initializationFailures);
    }

    /**
     * Check if a module is initialized.
     */
    isInitialized(id: ModuleId): boolean {
        return this.initializedModules.has(id);
    }

    /**
     * Check if a module is disposed.
     */
    isDisposed(id: ModuleId): boolean {
        return this.disposedModules.has(id);
    }

    /**
     * Get the VersionManager owned by ModuleManager.
     */
    getVersionManager(): VersionManager {
        return this.versionManager;
    }

    /**
     * Get the EventBus owned by ModuleManager.
     */
    getEventBus(): EventBus {
        return this.eventBus;
    }

    /**
     * Get the DiagnosticsService owned by ModuleManager.
     */
    getDiagnostics(): DiagnosticsService {
        return this.diagnostics;
    }

    /**
     * Get the PlatformStorage owned by ModuleManager.
     */
    getStorage(): PlatformStorage {
        return this.storage;
    }

    /**
     * Get the CapabilityRegistry owned by ModuleManager.
     */
    getCapabilityRegistry(): CapabilityRegistry {
        return this.capabilities;
    }

    /**
     * Get the ServiceRegistry owned by ModuleManager.
     */
    getServiceRegistry(): ServiceRegistry {
        return this.services;
    }

    /**
     * Get the DependencyRegistry owned by ModuleManager.
     */
    getDependencyRegistry(): DependencyRegistry {
        return this.dependencies;
    }

    /**
     * Get the LauncherRegistry owned by ModuleManager.
     */
    getLauncherRegistry(): LauncherRegistry {
        return this.launchers;
    }

    /**
     * Validate all registered modules' dependencies.
     * Throws if any module has unmet dependencies.
     */
    validateDependencies(): ReadonlyArray<DependencyValidationResult> {
        return this.dependencies.validateAll();
    }

    /**
     * Get platform services for platform-level operations.
     */
    getPlatformServices(): PlatformServices {
        return {
            versionManager: this.versionManager,
            eventBus: this.eventBus,
            diagnostics: this.diagnostics,
            storage: this.storage,
            capabilities: this.capabilities,
            services: this.services,
            dependencies: this.dependencies,
            launchers: this.launchers
        };
    }
}