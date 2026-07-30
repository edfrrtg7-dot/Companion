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

    /**
     * Read current delay values from profile data.
     * Skips first message (set to 0 by applyDelays) and returns first non-zero delay.
     */
    static readDelays(data: Record<string, unknown>): { priv: number; broad: number } {
        const detectDelay = (messages: any): number => {
            if (!messages || typeof messages !== "object") return DEFAULT_DELAY;
            const items = Object.values(messages);
            if (items.length === 0) return DEFAULT_DELAY;

            // Detect delay property from first item
            const first = items[0];
            if (!first || typeof first !== "object") return DEFAULT_DELAY;
            const property = DELAY_PROPERTIES.find((p) => p in first);
            if (!property) return DEFAULT_DELAY;

            // Skip first item (set to 0), find first non-zero delay
            for (let i = 1; i < items.length; i++) {
                const item = items[i];
                if (item && typeof item === "object") {
                    const value = item[property];
                    if (typeof value === "number" && value > 0) return value;
                }
            }

            // Fallback: check first item if nothing else found
            const firstValue = first[property];
            if (typeof firstValue === "number" && firstValue >= 0) return firstValue;

            return DEFAULT_DELAY;
        };

        return {
            priv: detectDelay((data as any).messages),
            broad: detectDelay((data as any).broadcast?.messages),
        };
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

    /**
     * Detect the text property name from existing messages.
     * Returns "text" by default if not found.
     */
    private static detectTextProperty(messages: Record<string, unknown> | undefined): string {
        if (!messages || typeof messages !== "object") return "text";
        const items = Object.values(messages);
        if (items.length === 0) return "text";
        const first = items[0];
        if (first && typeof first === "object") {
            for (const key in first) {
                if (typeof (first as any)[key] === "string" && key !== "intervalSeconds" && key !== "delay" && key !== "interval" && key !== "timeout" && key !== "seconds") {
                    return key;
                }
            }
        }
        return "text";
    }

    /**
     * Detect the delay property name from existing messages.
     * Uses DELAY_PROPERTIES constant for known delay property names.
     */
    private static detectDelayProperty(messages: Record<string, unknown> | undefined): string | null {
        if (!messages || typeof messages !== "object") return null;
        const items = Object.values(messages);
        if (items.length === 0) return null;
        const first = items[0];
        if (first && typeof first === "object") {
            const match = DELAY_PROPERTIES.find((p) => p in (first as object));
            if (match) return match;
        }
        return null;
    }

    /**
     * Import snippets into a messages container using canonical message structure.
     * - Detects text/delay properties from existing messages
     * - Uses first existing message as template
     * - Generates sequential numeric IDs (1, 2, 3...)
     * - Sets first message delay to 0, subsequent to detected delay value
     * @param messages - The messages object to import into (IceBreaker or Broadcast)
     * @param snippets - Array of snippet texts to import
     * @returns Number of snippets actually imported (after deduplication)
     */
    static importSnippets(messages: Record<string, unknown>, snippets: string[]): number {
        if (!messages || typeof messages !== "object") return 0;

        const existingTexts = new Set<string>();
        for (const msg of Object.values(messages)) {
            if (msg && typeof msg === "object") {
                const textProp = Object.keys(msg).find(k => typeof (msg as any)[k] === "string" && k !== "intervalSeconds" && k !== "delay" && k !== "interval" && k !== "timeout" && k !== "seconds");
                if (textProp && (msg as any)[textProp]) {
                    existingTexts.add((msg as any)[textProp]);
                }
            }
        }

        // Detect properties from existing messages
        const textProp = CrmService.detectTextProperty(messages);
        const delayProp = CrmService.detectDelayProperty(messages) ?? "intervalSeconds";

        // Get template from first existing message
        const template = Object.values(messages)[0] as Record<string, unknown> | undefined;

        // Determine next sequential ID
        let nextId = 1;
        for (const key of Object.keys(messages)) {
            const num = parseInt(key, 10);
            if (!isNaN(num) && num >= nextId) {
                nextId = num + 1;
            }
        }

        // Determine delay value (first non-zero delay from existing, or 60 default)
        let delayValue = 60;
        if (template && typeof template === "object" && delayProp in template) {
            const templateDelay = template[delayProp];
            if (typeof templateDelay === "number" && templateDelay > 0) {
                delayValue = templateDelay;
            }
        }

        let importedCount = 0;
        for (const snippet of snippets) {
            if (!existingTexts.has(snippet)) {
                const id = String(nextId++);
                const newMsg: Record<string, unknown> = template ? { ...template } : {};
                newMsg[textProp] = snippet;
                newMsg[delayProp] = importedCount === 0 ? 0 : delayValue;
                messages[id] = newMsg;
                existingTexts.add(snippet);
                importedCount++;
            }
        }
        return importedCount;
    }

    /**
     * Import snippets into a profile (IceBreaker or Broadcast).
     * Handles profile lookup, validation, storage update, and history logging.
     * @param target - "icebreaker" or "broadcast"
     * @param snippets - Array of snippet texts to import
     * @returns Result object with importedCount and message
     */
    static importSnippetsToProfile(target: "icebreaker" | "broadcast", snippets: string[]): { importedCount: number; message: string } {
        if (snippets.length === 0) {
            return { importedCount: 0, message: "No valid snippets to import." };
        }

        const key = CrmService.findProfileKey();
        if (!key) {
            return { importedCount: 0, message: "No CRM profile found." };
        }

        const data = CrmService.readProfile(key);
        if (!data || !CrmService.validateProfile(data)) {
            return { importedCount: 0, message: "Invalid profile structure." };
        }

        let importedCount = 0;
        const profileData = data as any;

        if (target === "icebreaker") {
            if (!profileData.messages || typeof profileData.messages !== "object") {
                profileData.messages = {};
            }
            importedCount = CrmService.importSnippets(profileData.messages, snippets);
        } else if (target === "broadcast") {
            if (!profileData.broadcast || typeof profileData.broadcast !== "object") {
                profileData.broadcast = {};
            }
            if (!profileData.broadcast.messages || typeof profileData.broadcast.messages !== "object") {
                profileData.broadcast.messages = {};
            }
            importedCount = CrmService.importSnippets(profileData.broadcast.messages, snippets);
        } else {
            return { importedCount: 0, message: "Target collection not found in profile." };
        }

        if (importedCount === 0) {
            return { importedCount: 0, message: "No new snippets to import (all were duplicates)." };
        }

        CrmService.writeProfile(key, data);

        const profileKey = key.replace("chat-sender-", "");
        import("./dev").then(({ addImportHistory }) => {
            addImportHistory({
                timestamp: new Date().toISOString(),
                profileKey,
                importedCount,
                result: "success",
            });
        }).catch(() => { /* ignore */ });

        const targetName = target === "icebreaker" ? "IceBreaker" : "Broadcast";
        return { importedCount, message: `Imported ${importedCount} snippets to ${targetName}.` };
    }
}
