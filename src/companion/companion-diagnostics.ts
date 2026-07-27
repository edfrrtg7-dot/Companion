// APACHE-2.0 LICENSE

/**
 * Companion Diagnostics
 *
 * Development-only diagnostics object.
 * Provides runtime information about the Companion application.
 *
 * Usage:
 *   import { CompanionDiagnostics } from "./companion-diagnostics";
 *   CompanionDiagnostics.log(); // logs all diagnostics to console
 *
 * No UI. Console only. Development only.
 */

import { STORAGE_VERSION, getStoredVersion } from "./storage-version";
import { StorageService } from "./storage-service";
import { STORAGE_KEYS } from "./storage-keys";
import { diag, isDevMode } from "./dev";

/** Diagnostics information structure. */
export interface CompanionDiagnosticsInfo {
    /** Extension version from manifest or package.json. */
    readonly version: string;
    /** Registered module names. */
    readonly modules: string[];
    /** Storage adapter type. */
    readonly storage: string;
    /** Current storage schema version. */
    readonly storageVersion: number;
    /** Runtime environment detection. */
    readonly environment: "extension" | "userscript" | "unknown";
    /** Runtime context information. */
    readonly runtime: {
        /** Whether running in top frame. */
        readonly isTopFrame: boolean;
        /** Whether running in extension context. */
        readonly isExtension: boolean;
        /** Whether dev mode is active. */
        readonly devMode: boolean;
        /** Document ready state. */
        readonly readyState: string;
    };
}

/** Singleton diagnostics state. */
let moduleNames: string[] = [];

/**
 * Set the list of registered module names.
 * Called by bootstrap after module registration.
 */
export function setRegisteredModules(names: string[]): void {
    moduleNames = names;
}

/**
 * Detect the runtime environment.
 */
function detectEnvironment(): "extension" | "userscript" | "unknown" {
    if (typeof chrome !== "undefined" && chrome.runtime?.id) {
        return "extension";
    }
    if (typeof GM_info !== "undefined" || typeof Tampermonkey !== "undefined") {
        return "userscript";
    }
    return "unknown";
}

/**
 * Get the extension/package version.
 */
function getVersion(): string {
    try {
        if (typeof chrome !== "undefined" && chrome.runtime?.getManifest) {
            return chrome.runtime.getManifest().version;
        }
    } catch {
        // Not in extension context
    }
    return "1.0.0";
}

/**
 * Collect all diagnostics information.
 */
export function collectDiagnostics(): CompanionDiagnosticsInfo {
    return {
        version: getVersion(),
        modules: [...moduleNames],
        storage: StorageService.getAdapterType(),
        storageVersion: getStoredVersion(),
        environment: detectEnvironment(),
        runtime: {
            isTopFrame: window === window.top,
            isExtension: typeof chrome !== "undefined" && !!chrome.runtime?.id,
            devMode: isDevMode(),
            readyState: document.readyState,
        },
    };
}

/**
 * Log all diagnostics to console.
 * Development only. No-op in production.
 */
export function logDiagnostics(): void {
    if (!isDevMode()) return;

    const info = collectDiagnostics();

    console.groupCollapsed("[Companion] Diagnostics");
    console.log("Version:", info.version);
    console.log("Environment:", info.environment);
    console.log("Modules:", info.modules);
    console.log("Storage:", info.storage);
    console.log("Storage Version:", info.storageVersion);
    console.log("Runtime:", info.runtime);
    console.groupEnd();
}

/**
 * Expose diagnostics globally in dev mode.
 * Access via window.__COMPANION_DIAGNOSTICS__ in console.
 */
export function exposeDiagnostics(): void {
    if (!isDevMode()) return;

    try {
        (window as any).__COMPANION_DIAGNOSTICS__ = {
            info: collectDiagnostics,
            log: logDiagnostics,
        };
        diag("Diagnostics exposed at window.__COMPANION_DIAGNOSTICS__");
    } catch {
        // Window not available
    }
}
