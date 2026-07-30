export interface GlobalState {
    has(key: string): boolean;
    get<T = unknown>(key: string): T | undefined;
    set(key: string, value: unknown): void;
}

let currentState: GlobalState | undefined;

export function getGlobalState(): GlobalState {
    if (!currentState) {
        throw new Error("GlobalState not initialized. Call setGlobalState() during bootstrap.");
    }
    return currentState;
}

export function setGlobalState(state: GlobalState): void {
    currentState = state;
}

export class ChromeGlobalState implements GlobalState {
    has(key: string): boolean {
        try {
            return (window as any)[key] !== undefined;
        } catch {
            return false;
        }
    }

    get<T = unknown>(key: string): T | undefined {
        try {
            return (window as any)[key] as T | undefined;
        } catch {
            return undefined;
        }
    }

    set(key: string, value: unknown): void {
        try {
            (window as any)[key] = value;
        } catch {
            // Window not available
        }
    }
}
