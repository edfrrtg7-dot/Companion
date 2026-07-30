import type { Platform, PlatformChromeStorage, PlatformLocalStorage } from "./platform-interface";

export class ChromePlatform implements Platform {
    isExtension(): boolean {
        try {
            return typeof chrome !== "undefined" && !!chrome.runtime?.id;
        } catch {
            return false;
        }
    }

    isTopFrame(): boolean {
        try {
            return window === window.top;
        } catch {
            return true;
        }
    }

    getExtensionVersion(): string {
        try {
            if (typeof chrome !== "undefined" && chrome.runtime?.getManifest) {
                return chrome.runtime.getManifest().version;
            }
        } catch {
            // Not in extension context
        }
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

    chromeStorage: PlatformChromeStorage | null = (() => {
        try {
            if (typeof chrome !== "undefined" && chrome.storage?.local) {
                return {
                    getAll(): Promise<Record<string, string>> {
                        return chrome.storage.local.get(null).then((all) => {
                            const result: Record<string, string> = {};
                            for (const [key, value] of Object.entries(all)) {
                                if (typeof value === "string") {
                                    result[key] = value;
                                }
                            }
                            return result;
                        });
                    },
                    set(key: string, value: string): Promise<void> {
                        return chrome.storage.local.set({ [key]: value });
                    },
                    remove(key: string): Promise<void> {
                        return chrome.storage.local.remove(key);
                    },
                    clear(): Promise<void> {
                        return chrome.storage.local.clear();
                    },
                };
            }
        } catch {
            // chrome.storage not available
        }
        return null;
    })();

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
