/**
 * CrmService
 *
 * CRM integration boundary. Owns:
 *   - CRM profile access (read/write/validate)
 *   - CRM profile mutation (resetIceBreaker, newShift, applyDelays)
 *   - CRM page interaction (stopSenderSafely, isSenderStopped)
 *
 * All functions directly relate to CRM integration.
 * No generic utilities. No UI logic.
 *
 * Restored from b44e683 — the last userscript commit.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CRM_STORAGE_PREFIX = "chat-sender-";
const DELAY_PROPERTIES = ["intervalSeconds", "delay", "interval", "timeout", "seconds"];
const DEFAULT_DELAY = 65;
const MAX_WAIT_MS = 5000;
const POLL_INTERVAL_MS = 250;
const REQUIRED_STOP_TICKS = 4;

// ---------------------------------------------------------------------------
// Profile access
// ---------------------------------------------------------------------------

export class CrmService {
    /** Find the first chat-sender-* key in localStorage. */
    static findProfileKey(): string | null {
        try {
            const keys = Object.keys(localStorage);
            return keys.find((k) => k.startsWith(CRM_STORAGE_PREFIX) && k !== CRM_STORAGE_PREFIX && !k.includes("backup")) ?? null;
        } catch {
            return null;
        }
    }

    /** Read and parse a CRM profile from localStorage. */
    static readProfile(key: string): Record<string, unknown> | null {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    /** Write a CRM profile to localStorage. */
    static writeProfile(key: string, data: Record<string, unknown>): void {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch { /* storage full or unavailable */ }
    }

    /** Validate that the data has the expected CRM profile structure. */
    static validateProfile(data: unknown): boolean {
        if (!data || typeof data !== "object" || Array.isArray(data)) return false;
        return "status" in data && "chainProgress" in data;
    }

    // -------------------------------------------------------------------------
    // Business logic — restored from b44e683:440-510
    // -------------------------------------------------------------------------

    /**
     * Reset IceBreaker progress.
     * Filters chainProgress to remove private channel entries,
     * cleans sended list, clears delivered, sets status = "stopped".
     */
    static resetIceBreaker(data: Record<string, unknown>): boolean {
        const chain = (data as any).chainProgress || {};
        const privateIds = new Set<string>();
        const cleanChain: Record<string, unknown> = {};

        if (typeof chain === "object" && !Array.isArray(chain)) {
            for (const [id, value] of Object.entries(chain)) {
                if (value && (value as any).channel === "private") {
                    privateIds.add(id);
                } else if (value) {
                    cleanChain[id] = value;
                }
            }
        }

        (data as any).chainProgress = cleanChain;

        if ((data as any).sended) {
            (data as any).sended = (data as any).sended
                .split(";")
                .filter((id: string) => id && !privateIds.has(id))
                .join(";");
        }

        if ("delivered" in data) {
            (data as any).delivered = "";
        }

        (data as any).status = "stopped";
        return true;
    }

    /**
     * Start a new shift.
     * Clears ALL chainProgress, sended, delivered for both IB and BR.
     * Sets status = "stopped".
     */
    static newShift(data: Record<string, unknown>): boolean {
        (data as any).chainProgress = {};
        (data as any).sended = "";
        (data as any).delivered = "";
        (data as any).status = "stopped";

        if ((data as any).broadcast && typeof (data as any).broadcast === "object") {
            (data as any).broadcast.chainProgress = {};
            (data as any).broadcast.sended = "";
            (data as any).broadcast.status = "stopped";
        }

        return true;
    }

    /**
     * Apply delay values to message entries.
     * Sets intervalSeconds on the first entry to 0, others to the delay value.
     */
    static applyDelays(data: Record<string, unknown>, privDelay: number, broadDelay: number): boolean {
        CrmService.applyPropertyUpdates((data as any).messages, privDelay);
        if ((data as any).broadcast && (data as any).broadcast.messages) {
            CrmService.applyPropertyUpdates((data as any).broadcast.messages, broadDelay);
        }
        return true;
    }

    /** Check if IB or BR engines are active. */
    static isEngineActive(data: Record<string, unknown>): boolean {
        const ibStatus = CrmService.getModuleStatus(data, "icebreaker");
        const brStatus = CrmService.getModuleStatus(data, "broadcast");
        return CrmService.isStatusActive(ibStatus) || CrmService.isStatusActive(brStatus);
    }

    // -------------------------------------------------------------------------
    // Page interaction — restored from b44e683:345-377
    // -------------------------------------------------------------------------

    /** Check if the sender is stopped by inspecting DOM buttons. */
    static isSenderStopped(): boolean {
        const startBtn = CrmService.findButton("start");
        const stopBtn = CrmService.findButton("stop");
        const startExists = !!startBtn;
        const stopDisabled = !!(stopBtn && (stopBtn.disabled || stopBtn.getAttribute("disabled") !== null || stopBtn.classList.contains("disabled")));
        const stopDisappeared = !stopBtn;
        return startExists || stopDisabled || stopDisappeared;
    }

    /** Click the stop button and wait for sender to stop. Returns true if stopped. */
    static async stopSenderSafely(): Promise<boolean> {
        const stopBtn = CrmService.findButton("stop");
        if (!stopBtn) return true;
        if (stopBtn.disabled || stopBtn.getAttribute("disabled") !== null) return true;

        try {
            stopBtn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
            stopBtn.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
            stopBtn.click();
        } catch {
            return false;
        }

        const startLimit = Date.now();
        let checkTicks = 0;
        while (Date.now() - startLimit < MAX_WAIT_MS) {
            if (CrmService.isSenderStopped()) {
                checkTicks++;
                if (checkTicks >= REQUIRED_STOP_TICKS) return true;
            } else {
                checkTicks = 0;
            }
            await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        }
        return false;
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    private static getModuleStatus(data: Record<string, unknown>, moduleType: string): string {
        if (!data) return "Unknown";
        const statusRaw = moduleType === "broadcast" ? (data as any).broadcast?.status : (data as any).status;
        if (!statusRaw) return "Unknown";

        const s = statusRaw.toString().toLowerCase();
        if (s === "stopped") return "Stopped";
        if (s === "progress") return "Progress";
        if (s === "running") return "Running";
        if (s === "paused") return "Paused";
        return "Unknown";
    }

    private static isStatusActive(status: string): boolean {
        return status === "Running" || status === "Progress" || status === "Paused";
    }

    private static detectDelayProperty(messages: Record<string, unknown>): string | null {
        if (!messages || typeof messages !== "object") return null;
        const items = Object.values(messages);
        if (items.length === 0) return null;
        const item = items[0];
        if (item && typeof item === "object") {
            const match = DELAY_PROPERTIES.find((p) => p in (item as object));
            if (match) return match;
        }
        return null;
    }

    private static applyPropertyUpdates(messages: Record<string, unknown> | undefined, delayValue: number): void {
        if (!messages || typeof messages !== "object") return;
        const property = CrmService.detectDelayProperty(messages);
        if (!property) return;

        const items = Object.values(messages);
        items.forEach((item, index) => {
            if (item && typeof item === "object") {
                (item as any)[property] = index === 0 ? 0 : delayValue;
            }
        });
    }

    private static findButton(targetId: string): HTMLElement | null {
        const lowerTarget = targetId.toLowerCase();
        try {
            const elements = Array.from(document.querySelectorAll("button, [role='button'], input[type='button'], input[type='submit']"));
            for (const el of elements) {
                const labelText = ((el as HTMLElement).textContent || (el as HTMLInputElement).value || (el as HTMLElement).innerText || el.getAttribute("aria-label") || "").trim().toLowerCase();
                if (labelText === lowerTarget) {
                    return el as HTMLElement;
                }
            }
        } catch { /* ignore */ }
        return null;
    }
}
