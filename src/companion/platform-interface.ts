export type PlatformReadyState = "loading" | "interactive" | "complete";

export interface PlatformLocalStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
    clear(): void;
}

export interface PlatformChromeStorage {
    getAll(): Promise<Record<string, string>>;
    set(key: string, value: string): Promise<void>;
    remove(key: string): Promise<void>;
    clear(): Promise<void>;
}

export interface Platform {
    isExtension(): boolean;
    isTopFrame(): boolean;
    getExtensionVersion(): string;
    localStorage: PlatformLocalStorage;
    chromeStorage: PlatformChromeStorage | null;
    getGlobal<T = unknown>(key: string): T | undefined;
    setGlobal(key: string, value: unknown): void;
    getReadyState(): PlatformReadyState;
    onDomReady(callback: () => void): void;
}

let currentPlatform: Platform | undefined;

export function getPlatform(): Platform {
    if (!currentPlatform) {
        throw new Error("Platform not initialized. Call setPlatform() during bootstrap.");
    }
    return currentPlatform;
}

export function setPlatform(platform: Platform): void {
    currentPlatform = platform;
}
