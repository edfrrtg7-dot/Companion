/**
 * DependencyRegistry 1.0 — Centralized dependency metadata.
 *
 * Platform-owned registry that tracks module dependency declarations.
 * Enables deterministic validation before initialization.
 * Only ModuleManager may mutate registry state — modules are consumers only.
 */

import { ModuleId } from "./platform";

export interface ModuleDependencies {
    readonly services?: readonly string[];
    readonly capabilities?: readonly string[];
    readonly modules?: readonly ModuleId[];
}

export interface DependencyValidationResult {
    readonly moduleId: ModuleId;
    readonly valid: boolean;
    readonly missingModules: readonly ModuleId[];
    readonly missingServices: readonly string[];
    readonly missingCapabilities: readonly string[];
}

export class DependencyRegistry {
    private readonly dependencies = new Map<ModuleId, Readonly<ModuleDependencies>>();
    private readonly registeredModules = new Set<ModuleId>();
    private readonly registeredServices = new Set<string>();
    private readonly registeredCapabilities = new Set<string>();

    /**
     * Mark a module as registered (for dependency validation against other modules).
     * Called by ModuleManager during register().
     */
    markModuleRegistered(id: ModuleId): void {
        this.registeredModules.add(id);
    }

    /**
     * Mark a service as registered (for dependency validation against services).
     * Called by ModuleManager during register().
     */
    markServiceRegistered(name: string): void {
        this.registeredServices.add(name);
    }

    /**
     * Mark a capability as registered (for dependency validation against capabilities).
     * Called by ModuleManager during register().
     */
    markCapabilityRegistered(name: string): void {
        this.registeredCapabilities.add(name);
    }

    /**
     * Register a module's declared dependencies.
     * Duplicate module IDs throw deterministically.
     */
    registerModule(id: ModuleId, deps: ModuleDependencies): void {
        if (this.dependencies.has(id)) {
            throw new Error(`DependencyRegistry: module '${id}' is already registered`);
        }
        this.dependencies.set(id, Object.freeze({
            services: deps.services ? Object.freeze([...deps.services]) : undefined,
            capabilities: deps.capabilities ? Object.freeze([...deps.capabilities]) : undefined,
            modules: deps.modules ? Object.freeze([...deps.modules]) : undefined,
        }));
    }

    /**
     * Get the declared dependencies of a module.
     * Returns undefined if the module has no registered dependencies.
     */
    getDependencies(moduleId: ModuleId): Readonly<ModuleDependencies> | undefined {
        return this.dependencies.get(moduleId);
    }

    /**
     * Get all module IDs that declare a dependency on the given module.
     */
    getDependents(moduleId: ModuleId): ReadonlyArray<ModuleId> {
        const result: ModuleId[] = [];
        for (const [id, deps] of this.dependencies) {
            if (deps.modules?.includes(moduleId)) {
                result.push(id);
            }
        }
        return Object.freeze(result);
    }

    /**
     * Validate a specific module's dependencies.
     * Checks that all declared module, service, and capability dependencies are registered.
     */
    validateModule(moduleId: ModuleId): DependencyValidationResult {
        const deps = this.dependencies.get(moduleId);
        if (!deps) {
            return Object.freeze({
                moduleId,
                valid: true,
                missingModules: Object.freeze([]),
                missingServices: Object.freeze([]),
                missingCapabilities: Object.freeze([]),
            });
        }

        const missingModules = (deps.modules ?? []).filter(
            (id) => !this.registeredModules.has(id)
        );
        const missingServices = (deps.services ?? []).filter(
            (s) => !this.registeredServices.has(s)
        );
        const missingCapabilities = (deps.capabilities ?? []).filter(
            (c) => !this.registeredCapabilities.has(c)
        );

        return Object.freeze({
            moduleId,
            valid: missingModules.length === 0 && missingServices.length === 0 && missingCapabilities.length === 0,
            missingModules: Object.freeze(missingModules),
            missingServices: Object.freeze(missingServices),
            missingCapabilities: Object.freeze(missingCapabilities),
        });
    }

    /**
     * Validate all registered modules' dependencies.
     */
    validateAll(): ReadonlyArray<DependencyValidationResult> {
        const results: DependencyValidationResult[] = [];
        for (const id of this.dependencies.keys()) {
            results.push(this.validateModule(id));
        }
        return Object.freeze(results);
    }

    /**
     * Get all module IDs that have declared dependencies.
     */
    getAllModules(): ReadonlyArray<ModuleId> {
        return Object.freeze(Array.from(this.dependencies.keys()));
    }

    /**
     * Get the count of modules with declared dependencies.
     */
    get moduleCount(): number {
        return this.dependencies.size;
    }
}