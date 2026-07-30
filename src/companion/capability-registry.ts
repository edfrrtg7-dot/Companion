/**
 * CapabilityRegistry 1.0 — Centralized capability discovery.
 *
 * Platform-owned registry that maps ModuleIds to their declared capabilities.
 * Only ModuleManager may mutate registry state — modules are consumers only.
 */

import { ModuleCapabilities, ModuleId } from "./platform";

type CapabilityName = keyof ModuleCapabilities;

export class CapabilityRegistry {
    private readonly moduleCapabilities = new Map<ModuleId, Readonly<ModuleCapabilities>>();
    private readonly capabilityModules = new Map<CapabilityName, Set<ModuleId>>();

    /**
     * Register a module's capabilities. Called by ModuleManager during register().
     *
     * Duplicate module IDs throw deterministically — silent failure is not acceptable.
     * A capability may be claimed by multiple modules.
     *
     * An immutable copy of capabilities is stored internally.
     * Subsequent external mutation cannot affect registry state.
     */
    registerModule(id: ModuleId, capabilities: ModuleCapabilities): void {
        if (this.moduleCapabilities.has(id)) {
            throw new Error(`CapabilityRegistry: module '${id}' is already registered`);
        }

        this.moduleCapabilities.set(id, Object.freeze({ ...capabilities }));

        for (const [cap, enabled] of Object.entries(capabilities)) {
            if (!enabled) continue;
            const name = cap as CapabilityName;
            if (!this.capabilityModules.has(name)) {
                this.capabilityModules.set(name, new Set());
            }
            this.capabilityModules.get(name)!.add(id);
        }
    }

    /**
     * Check if any registered module has the given capability.
     */
    has(capability: CapabilityName): boolean {
        const modules = this.capabilityModules.get(capability);
        return modules !== undefined && modules.size > 0;
    }

    /**
     * Get all module IDs that claim the given capability.
     * Returns an empty readonly array for unknown capabilities — never throws.
     */
    getModulesWith(capability: CapabilityName): ReadonlyArray<ModuleId> {
        const modules = this.capabilityModules.get(capability);
        return modules ? Object.freeze(Array.from(modules)) : Object.freeze([]);
    }

    /**
     * Get the capabilities declared by a specific module.
     * Returns undefined if the module is not registered.
     */
    getCapabilities(moduleId: ModuleId): Readonly<ModuleCapabilities> | undefined {
        const caps = this.moduleCapabilities.get(moduleId);
        return caps ? Object.freeze({ ...caps }) : undefined;
    }

    /**
     * Get all capability names that have at least one claiming module.
     */
    getAllCapabilities(): ReadonlyArray<CapabilityName> {
        return Object.freeze(Array.from(this.capabilityModules.keys()));
    }

    /**
     * Get all module IDs that have at least one capability registered.
     */
    getAllModules(): ReadonlyArray<ModuleId> {
        return Object.freeze(Array.from(this.moduleCapabilities.keys()));
    }
}