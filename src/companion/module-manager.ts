/**
 * ModuleManager
 *
 * Manages registration, lookup, and lifecycle of Companion modules.
 * CompanionApp delegates all module operations to this class.
 *
 * Responsibilities:
 *   - Register modules
 *   - Find modules by name
 *   - Open / close modules
 *   - Expose module list
 */

import { CompanionModule } from "./companion-module";

export class ModuleManager {
    private readonly modules: Map<string, CompanionModule> = new Map();

    /** Register a module. Ignores duplicates. */
    register(module: CompanionModule): void {
        if (this.modules.has(module.name)) return;
        this.modules.set(module.name, module);
    }

    /** Get a module by name. */
    get(name: string): CompanionModule | undefined {
        return this.modules.get(name);
    }

    /** Get all registered modules. */
    getAll(): CompanionModule[] {
        return Array.from(this.modules.values());
    }

    /** Open a module by name. No-op if not found or already open. */
    open(name: string): void {
        const mod = this.modules.get(name);
        if (mod && !mod.isOpen) {
            mod.open();
        }
    }

    /** Close a module by name. No-op if not found or already closed. */
    close(name: string): void {
        const mod = this.modules.get(name);
        if (mod && mod.isOpen) {
            mod.close();
        }
    }

    /** Toggle a module open/closed. No-op if not found. */
    toggle(name: string): void {
        const mod = this.modules.get(name);
        if (!mod) return;
        if (mod.isOpen) {
            mod.close();
        } else {
            mod.open();
        }
    }

    /** Check if a module is open. Returns false if not found. */
    isOpen(name: string): boolean {
        return this.modules.get(name)?.isOpen ?? false;
    }
}
