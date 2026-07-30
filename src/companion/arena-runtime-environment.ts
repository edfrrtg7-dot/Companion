import type { RuntimeEnvironment, RuntimeReadyState } from "./runtime-environment";

/**
 * ArenaRuntimeEnvironment — RuntimeEnvironment implementation for the Arena runtime.
 *
 * Arena is an embedded runtime with no Chrome Extension APIs.
 * All extension-specific methods return sane defaults for non-extension contexts.
 */
export class ArenaRuntimeEnvironment implements RuntimeEnvironment {
    isExtension(): boolean {
        return false;
    }

    isTopFrame(): boolean {
        try {
            return window === window.top;
        } catch {
            return true;
        }
    }

    getExtensionVersion(): string {
        return "0.0.0";
    }

    getGlobal<T = unknown>(key: string): T | undefined {
        try {
            return (window as any)[key] as T | undefined;
        } catch {
            return undefined;
        }
    }

    setGlobal(key: string, value: unknown): void {
        try {
            (window as any)[key] = value;
        } catch {
            // Window not available
        }
    }

    getReadyState(): RuntimeReadyState {
        try {
            return document.readyState as RuntimeReadyState;
        } catch {
            return "complete";
        }
    }

    onDomReady(callback: () => void): void {
        try {
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", callback);
            } else {
                queueMicrotask(callback);
            }
        } catch {
            queueMicrotask(callback);
        }
    }
}
