import type { Platform, PlatformChromeStorage, PlatformLocalStorage } from "./platform-interface";

/**
 * ArenaPlatform — Platform implementation for the Arena runtime.
 *
 * Arena is an embedded runtime with no Chrome Extension APIs.
 * All Chrome-specific features return null/false/empty as appropriate.
 */
export class ArenaPlatform implements Platform {
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

    localStorage: PlatformLocalStorage = {
        getItem(key: string): string | null {
            try {
                return localStorage.getItem(key);
            } catch {
                return null;
            }
        },
        setItem(key: string, value: string): void {
            try {
                localStorage.setItem(key, value);
            } catch {
                // localStorage full or unavailable
            }
        },
        removeItem(key: string): void {
            try {
                localStorage.removeItem(key);
            } catch {
                // localStorage unavailable
            }
        },
        clear(): void {
            try {
                localStorage.clear();
            } catch {
                // localStorage unavailable
            }
        },
    };

    chromeStorage: PlatformChromeStorage | null = null;

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

    getReadyState(): "loading" | "interactive" | "complete" {
        try {
            return document.readyState as "loading" | "interactive" | "complete";
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
