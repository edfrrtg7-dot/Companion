/**
 * ServiceRegistry 1.0 — Centralized service discovery.
 *
 * Platform-owned registry that maps service names to their implementations.
 * Only ModuleManager may mutate registry state — modules are consumers only.
 */

import { ModuleId } from "./platform";

export type ServiceKey = string;

export class ServiceRegistry {
    private readonly services = new Map<ServiceKey, { moduleId: ModuleId; implementation: unknown }>();
    private readonly moduleServices = new Map<ModuleId, Set<ServiceKey>>();

    /**
     * Register a module's exported services. Called by ModuleManager during register().
     *
     * Duplicate module IDs and duplicate service names throw deterministically.
     * Platform must never silently replace services.
     */
    registerModule(id: ModuleId, services: Record<string, unknown>): void {
        if (this.moduleServices.has(id)) {
            throw new Error(`ServiceRegistry: module '${id}' is already registered`);
        }

        const keys = new Set<ServiceKey>();

        for (const [name, implementation] of Object.entries(services)) {
            if (this.services.has(name)) {
                const owner = this.services.get(name)!.moduleId;
                throw new Error(
                    `ServiceRegistry: service '${name}' is already registered by module '${owner}'`
                );
            }
            // Freeze objects to prevent external mutation of registry-owned state
            const stored = implementation !== null && typeof implementation === "object"
                ? Object.freeze(implementation)
                : implementation;
            this.services.set(name, { moduleId: id, implementation: stored });
            keys.add(name);
        }

        if (keys.size > 0) {
            this.moduleServices.set(id, keys);
        }
    }

    /**
     * Check if a service is registered.
     */
    has(service: ServiceKey): boolean {
        return this.services.has(service);
    }

    /**
     * Get the implementation of a service.
     * Returns undefined if the service is not registered.
     */
    get<T = unknown>(service: ServiceKey): T | undefined {
        return this.services.get(service)?.implementation as T | undefined;
    }

    /**
     * Get the module ID that owns a service.
     * Returns undefined if the service is not registered.
     */
    getOwner(service: ServiceKey): ModuleId | undefined {
        return this.services.get(service)?.moduleId;
    }

    /**
     * Get all service keys exported by a specific module.
     * Returns undefined if the module has no registered services.
     */
    getServices(moduleId: ModuleId): ReadonlyArray<ServiceKey> | undefined {
        const keys = this.moduleServices.get(moduleId);
        return keys ? Object.freeze(Array.from(keys)) : undefined;
    }

    /**
     * Get all registered service keys.
     */
    getAllServices(): ReadonlyArray<ServiceKey> {
        return Object.freeze(Array.from(this.services.keys()));
    }

    /**
     * Get the count of registered services.
     */
    get serviceCount(): number {
        return this.services.size;
    }
}