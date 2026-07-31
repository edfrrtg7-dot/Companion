import { StorageService } from "./storage-service";
import { STORAGE_KEYS } from "./storage-keys";

const MAX_SESSION_EVENTS = 100;
const TRACK_INTERVAL_MS = 1000;
const SAVE_DEBOUNCE_MS = 300;

export interface SessionEvent {
    readonly url: string;
    readonly title: string;
    readonly timestamp: number;
}

interface StoredSession {
    createdAt: number;
    updatedAt: number;
    events: SessionEvent[];
}

export class SessionMemory {
    private events: SessionEvent[] = [];
    private currentUrl: string = "";
    private currentTitle: string = "";
    private trackingId: ReturnType<typeof setInterval> | null = null;
    private visibilityBound = false;
    private exitBound = false;
    private newEventCallback: (() => void) | null = null;
    private storage: typeof StorageService | null = null;
    private saveTimer: ReturnType<typeof setTimeout> | null = null;
    private dirty: boolean = false;

    constructor(storage?: typeof StorageService) {
        this.storage = storage ?? null;
    }

    start(): void {
        if (this.storage) {
            this.load();
        }
        const latestUrl = this.events.length > 0 ? this.events[0].url : "";
        if (window.location.href !== latestUrl) {
            this.recordCurrent();
        } else {
            this.currentUrl = window.location.href;
            this.currentTitle = document.title || window.location.href;
        }
        this.installVisibilityListener();
        this.installExitListener();
        this.resumeTracking();
    }

    stop(): void {
        this.removeExitListener();
        this.removeVisibilityListener();
        this.pauseTracking();
        this.flush();
    }

    private resumeTracking(): void {
        if (document.hidden || this.trackingId !== null) return;
        this.trackingId = setInterval(() => this.checkPageChange(), TRACK_INTERVAL_MS);
    }

    private pauseTracking(): void {
        if (this.trackingId !== null) {
            clearInterval(this.trackingId);
            this.trackingId = null;
        }
        if (this.saveTimer !== null) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
    }

    private installVisibilityListener(): void {
        if (this.visibilityBound) return;
        this.visibilityBound = true;
        document.addEventListener("visibilitychange", this.onVisibilityChange);
    }

    private removeVisibilityListener(): void {
        if (!this.visibilityBound) return;
        this.visibilityBound = false;
        document.removeEventListener("visibilitychange", this.onVisibilityChange);
    }

    private installExitListener(): void {
        if (this.exitBound) return;
        this.exitBound = true;
        window.addEventListener("pagehide", this.onPageHide);
    }

    private removeExitListener(): void {
        if (!this.exitBound) return;
        this.exitBound = false;
        window.removeEventListener("pagehide", this.onPageHide);
    }

    private onPageHide = (): void => {
        this.pauseTracking();
        this.flush();
    };

    private onVisibilityChange = (): void => {
        if (document.hidden) {
            this.pauseTracking();
            this.flush();
        } else {
            this.resumeTracking();
            this.checkPageChange();
        }
    };

    getEvents(): readonly SessionEvent[] {
        return this.events;
    }

    getRecentCount(): number {
        return this.events.length;
    }

    setNewEventCallback(callback: (() => void) | null): void {
        this.newEventCallback = callback;
    }

    /** Export session as pretty-printed JSON. */
    exportToJson(): string {
        let createdAt = Date.now();
        if (this.storage) {
            const existing = this.storage.get(STORAGE_KEYS.SESSION_MEMORY);
            if (existing) {
                try {
                    const prev: unknown = JSON.parse(existing);
                    if (prev && typeof prev === "object" && typeof (prev as StoredSession).createdAt === "number") {
                        createdAt = (prev as StoredSession).createdAt;
                    }
                } catch { /* ignore */ }
            }
        }
        const data = { version: 1, createdAt, updatedAt: Date.now(), events: this.events };
        return JSON.stringify(data, null, 2);
    }

    /** Import session from JSON string. Returns number of imported events. */
    importFromJson(json: string): number {
        const data: unknown = JSON.parse(json);
        if (!data || typeof data !== "object") throw new Error("Invalid JSON structure");
        const version = (data as Record<string, unknown>).version;
        if (version !== 1) throw new Error(`Unsupported version: ${version}`);
        const events = (data as StoredSession).events;
        if (!Array.isArray(events)) throw new Error("Missing events array");
        const valid: SessionEvent[] = [];
        for (const e of events) {
            if (e && typeof e.url === "string" && typeof e.title === "string" && typeof e.timestamp === "number") {
                valid.push(e);
            }
        }
        this.events = valid.slice(0, MAX_SESSION_EVENTS);
        this.dirty = true;
        if (this.events.length > 0) {
            this.currentUrl = this.events[0].url;
            this.currentTitle = this.events[0].title;
        } else {
            this.currentUrl = "";
            this.currentTitle = "";
        }
        this.newEventCallback?.();
        this.flush();
        return this.events.length;
    }

    private load(): void {
        try {
            const raw = this.storage!.get(STORAGE_KEYS.SESSION_MEMORY);
            if (!raw) return;
            const data: unknown = JSON.parse(raw);
            if (!data || typeof data !== "object" || !Array.isArray((data as StoredSession).events)) {
                this.clearStorage();
                return;
            }
            const valid: SessionEvent[] = [];
            for (const e of (data as StoredSession).events) {
                if (e && typeof e.url === "string" && typeof e.title === "string" && typeof e.timestamp === "number") {
                    valid.push(e);
                }
            }
            this.events = valid.slice(0, MAX_SESSION_EVENTS);
            this.dirty = false;
            if (this.events.length > 0) {
                this.currentUrl = this.events[0].url;
                this.currentTitle = this.events[0].title;
            }
        } catch {
            this.clearStorage();
        }
    }

    private flush(): void {
        if (!this.storage || !this.dirty) return;
        this.save();
    }

    private save(): void {
        if (!this.storage) return;
        let createdAt = Date.now();
        const existing = this.storage.get(STORAGE_KEYS.SESSION_MEMORY);
        if (existing) {
            try {
                const prev: unknown = JSON.parse(existing);
                if (prev && typeof prev === "object" && typeof (prev as StoredSession).createdAt === "number") {
                    createdAt = (prev as StoredSession).createdAt;
                }
            } catch { /* use current time */ }
        }
        const data: StoredSession = { createdAt, updatedAt: Date.now(), events: this.events };
        this.storage.set(STORAGE_KEYS.SESSION_MEMORY, JSON.stringify(data));
        this.dirty = false;
    }

    private scheduleSave(): void {
        if (!this.storage) return;
        if (!this.dirty) {
            this.dirty = true;
        }
        if (this.saveTimer !== null) {
            clearTimeout(this.saveTimer);
        }
        this.saveTimer = setTimeout(() => {
            this.save();
            this.saveTimer = null;
        }, SAVE_DEBOUNCE_MS);
    }

    private clearStorage(): void {
        this.storage?.remove(STORAGE_KEYS.SESSION_MEMORY);
        this.events = [];
        this.dirty = false;
    }

    private checkPageChange(): void {
        if (window.location.href !== this.currentUrl) {
            this.recordCurrent();
        }
    }

    private recordCurrent(): void {
        const url = window.location.href;
        const title = document.title || url;
        this.currentUrl = url;
        this.currentTitle = title;

        const event: SessionEvent = { url, title, timestamp: Date.now() };
        this.events.unshift(event);
        if (this.events.length > MAX_SESSION_EVENTS) {
            this.events.pop();
        }
        this.newEventCallback?.();
        this.scheduleSave();
    }
}

let currentInstance: SessionMemory | undefined;

export function getSessionMemory(): SessionMemory {
    if (!currentInstance) {
        currentInstance = new SessionMemory();
    }
    return currentInstance;
}

export function setSessionMemory(instance: SessionMemory): void {
    currentInstance = instance;
}
