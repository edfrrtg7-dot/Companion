export type RuntimeReadyState = "loading" | "interactive" | "complete";

export interface RuntimeEnvironment {
    isExtension(): boolean;
    isTopFrame(): boolean;
    getExtensionVersion(): string;
    getGlobal<T = unknown>(key: string): T | undefined;
    setGlobal(key: string, value: unknown): void;
    getReadyState(): RuntimeReadyState;
    onDomReady(callback: () => void): void;
    /** Detect if current GoldenBride route is the chat/mail route. */
    isChatRoute(): boolean;
    /** Get current route category for Finance startup logic. */
    getRouteCategory(): "chat" | "non-chat" | "unknown";
}

let currentRuntime: RuntimeEnvironment | undefined;

export function getRuntimeEnvironment(): RuntimeEnvironment {
    if (!currentRuntime) {
        throw new Error("RuntimeEnvironment not initialized. Call setRuntimeEnvironment() during bootstrap.");
    }
    return currentRuntime;
}

export function setRuntimeEnvironment(runtime: RuntimeEnvironment): void {
    currentRuntime = runtime;
}

import { getPlatform } from "./platform-interface";

export class ChromeRuntimeEnvironment implements RuntimeEnvironment {
    isExtension(): boolean {
        return getPlatform().isExtension();
    }

    isTopFrame(): boolean {
        try {
            return window === window.top;
        } catch {
            return true;
        }
    }

    getExtensionVersion(): string {
        return getPlatform().getExtensionVersion();
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

    /** Detect if current GoldenBride route is the chat/mail route (e.g., #!VIEWMAIL;0;ALLMAIL). */
    isChatRoute(): boolean {
        try {
            const hash = window.location.hash;
            return hash.includes("VIEWMAIL");
        } catch {
            return false;
        }
    }

    /** Get current route category for Finance startup logic. */
    getRouteCategory(): "chat" | "non-chat" | "unknown" {
        if (this.isChatRoute()) return "chat";
        try {
            const hash = window.location.hash;
            // GoldenBride non-chat routes typically start with #!HOME or other non-VIEWMAIL routes
            if (hash.startsWith("#!")) return "non-chat";
        } catch {
            // ignore
        }
        return "unknown";
    }
}
