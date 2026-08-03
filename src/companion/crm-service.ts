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

import { addImportHistory } from "./dev";
import type { ImportHistoryEntry } from "./dev";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CRM_STORAGE_PREFIX = "chat-sender-";
const DELAY_PROPERTIES = ["intervalSeconds", "delay", "interval", "timeout", "seconds"];
const DEFAULT_DELAY = 65;
const MAX_WAIT_MS = 5000;
const POLL_INTERVAL_MS = 250;
const REQUIRED_STOP_TICKS = 4;

/**
 * Result of a snippet import operation.
 */
export interface SnippetImportResult {
    readonly outcome: "success" | "no-change" | "failure" | "cancelled";
    readonly targetName: string;
    readonly linesEntered: number;
    readonly uniqueSnippets: number;
    readonly previousMessageCount: number;
    readonly finalMessageCount: number;
    readonly duplicatesSkipped: number;
    readonly message: string;
}

/**
 * Options controlling snippet import behaviour.
 */
export interface SnippetImportOptions {
    /** Optional confirmation gate invoked before replacement when the target already has messages. */
    readonly confirmReplace?: (message: string) => Promise<boolean>;
}

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
     * Normalize raw textarea lines into an ordered, deduplicated snippet list.
     * Pure function: trims each line, drops empty lines, keeps the first
     * occurrence of duplicated text (case-sensitive compare), and counts the
     * duplicates that were skipped. Performs no storage, profile, history,
     * or UI access.
     */
    static normalizeSnippets(lines: readonly string[]): { linesEntered: number; unique: string[]; duplicatesSkipped: number } {
        const seen = new Set<string>();
        const unique: string[] = [];
        let duplicatesSkipped = 0;
        let linesEntered = 0;
        for (const raw of lines) {
            const trimmed = String(raw).trim();
            if (trimmed.length === 0) continue;
            linesEntered++;
            if (seen.has(trimmed)) {
                duplicatesSkipped++;
            } else {
                seen.add(trimmed);
                unique.push(trimmed);
            }
        }
        return { linesEntered, unique, duplicatesSkipped };
    }

    /**
     * Import snippets into a profile (IceBreaker or Broadcast) using
     * deterministic replacement semantics.
     *
     * The pasted snippet list is treated as the authoritative, ordered
     * message collection. The target collection is rebuilt from scratch with
     * sequential keys "1".."N" and the canonical { text, intervalSeconds }
     * message schema, preserving the currently configured target delay.
     *
     * Flow: fresh profile read -> count current target messages -> optional
     * confirmation gate -> re-read profile after confirmation -> delay
     * detection -> sequential rebuild -> canonical no-change compare -> one
     * atomic write -> read-back verification -> rollback on failure.
     *
     * History is recorded through a static import of addImportHistory and is
     * deterministic for success / no-change / failed outcomes. Cancelled
     * operations record nothing and never touch storage.
     */
    static async importSnippetsToProfile(target: "icebreaker" | "broadcast", snippets: readonly string[], options: SnippetImportOptions = {}): Promise<SnippetImportResult> {
        const targetName = target === "icebreaker" ? "IceBreaker" : "Broadcast";
        const { linesEntered, unique, duplicatesSkipped } = CrmService.normalizeSnippets(snippets);

        const base = (overrides: Partial<SnippetImportResult>): SnippetImportResult => ({
            outcome: "failure",
            targetName,
            linesEntered,
            uniqueSnippets: unique.length,
            previousMessageCount: 0,
            finalMessageCount: 0,
            duplicatesSkipped,
            message: "",
            ...overrides,
        });

        if (unique.length === 0) {
            return base({ message: "No valid snippets entered. Existing messages were not changed." });
        }

        const key = CrmService.findProfileKey();
        if (!key) {
            return base({ message: "No CRM profile found." });
        }
        const profileId = key.replace(CRM_STORAGE_PREFIX, "");

        const initial = CrmService.readProfile(key);
        if (!initial || !CrmService.validateProfile(initial)) {
            return base({ message: "Invalid profile structure." });
        }

        const initialMessages = CrmService.getTargetMessages(initial, target);
        if (initialMessages === undefined) {
            return base({ message: "Target collection not found in profile." });
        }
        const previousMessageCount = Object.keys(initialMessages).length;

        if (previousMessageCount > 0 && options.confirmReplace) {
            const confirmed = await options.confirmReplace(
                `${targetName} currently has ${previousMessageCount} message(s).\n\nReplacing them will remove ${previousMessageCount} existing message(s) and rebuild the list from your snippets.`,
            );
            if (!confirmed) {
                return base({
                    outcome: "cancelled",
                    previousMessageCount,
                    finalMessageCount: previousMessageCount,
                    message: "Import cancelled. Existing messages were not changed.",
                });
            }
        }

        // Re-read the profile fresh after confirmation to operate on latest state.
        const data = CrmService.readProfile(key);
        if (!data || !CrmService.validateProfile(data)) {
            return base({ message: "Invalid profile structure." });
        }

        const messages = CrmService.getTargetMessages(data, target);
        if (messages === undefined) {
            return base({ message: "Target collection not found in profile." });
        }

        const delayValue = target === "icebreaker" ? CrmService.readDelays(data).priv : CrmService.readDelays(data).broad;
        const rebuilt = CrmService.buildReplacementMessages(messages, unique, delayValue);

        if (CrmService.messagesEquivalent(messages, rebuilt)) {
            CrmService.recordImportHistory(profileId, {
                result: "no-change",
                target,
                linesEntered,
                uniqueSnippets: unique.length,
                previousMessageCount,
                finalMessageCount: previousMessageCount,
                duplicatesSkipped,
            });
            return base({
                outcome: "no-change",
                previousMessageCount,
                finalMessageCount: previousMessageCount,
                message: "No changes applied — the target list already matches the entered snippets.",
            });
        }

        // Immutable deep copy of the original target collection for rollback.
        const originalCollection = CrmService.deepCopyCollection(messages);

        CrmService.replaceTargetMessages(data, target, rebuilt);
        CrmService.writeProfile(key, data);

        const verified = CrmService.verifyReplacement(CrmService.readProfile(key), target, rebuilt);
        if (!verified) {
            const rollbackRestored = CrmService.rollbackTargetCollection(key, target, originalCollection, previousMessageCount);
            CrmService.recordImportHistory(profileId, {
                result: "failed",
                target,
                linesEntered,
                uniqueSnippets: unique.length,
                previousMessageCount,
                finalMessageCount: 0,
                duplicatesSkipped,
            });
            const message = rollbackRestored
                ? "Storage write verification failed. The original messages were restored."
                : "Storage write verification failed AND the original messages could not be restored. Manual recovery is required.";
            return base({ message });
        }

        const finalMessageCount = Object.keys(rebuilt).length;
        CrmService.recordImportHistory(profileId, {
            result: "success",
            target,
            linesEntered,
            uniqueSnippets: unique.length,
            previousMessageCount,
            finalMessageCount,
            duplicatesSkipped,
        });

        return base({
            outcome: "success",
            previousMessageCount,
            finalMessageCount,
            message: `${targetName} snippets updated.\n\nLines entered: ${linesEntered}\nUnique snippets: ${unique.length}\nMessages replaced: ${previousMessageCount}\nMessages created: ${finalMessageCount}\nDuplicate lines skipped: ${duplicatesSkipped}\nFinal message count: ${finalMessageCount}`,
        });
    }

    /** Resolve the target messages collection, or undefined when the target container is missing. */
    private static getTargetMessages(data: Record<string, unknown>, target: "icebreaker" | "broadcast"): Record<string, unknown> | undefined {
        if (target === "icebreaker") {
            const messages = (data as any).messages;
            return messages && typeof messages === "object" && !Array.isArray(messages) ? (messages as Record<string, unknown>) : undefined;
        }
        const broadcast = (data as any).broadcast;
        if (!broadcast || typeof broadcast !== "object" || Array.isArray(broadcast)) return undefined;
        const messages = (broadcast as any).messages;
        return messages && typeof messages === "object" && !Array.isArray(messages) ? (messages as Record<string, unknown>) : undefined;
    }

    /** Replace the target messages collection with the rebuilt collection. */
    private static replaceTargetMessages(data: Record<string, unknown>, target: "icebreaker" | "broadcast", rebuilt: Record<string, unknown>): void {
        if (target === "icebreaker") {
            (data as any).messages = rebuilt;
        } else {
            ((data as any).broadcast as any).messages = rebuilt;
        }
    }

    /**
     * Build the replacement collection: sequential keys "1".."N", canonical
     * { text, intervalSeconds } schema, first message delay 0, later messages
     * use the detected target delay value. No runtime/progress fields copied.
     */
    private static buildReplacementMessages(messages: Record<string, unknown>, snippets: string[], delayValue: number): Record<string, unknown> {
        const textProp = CrmService.detectTextProperty(messages);
        const delayProp = CrmService.detectDelayProperty(messages) ?? "intervalSeconds";
        const rebuilt: Record<string, unknown> = {};
        snippets.forEach((snippet, index) => {
            rebuilt[String(index + 1)] = {
                [textProp]: snippet,
                [delayProp]: index === 0 ? 0 : delayValue,
            } as Record<string, unknown>;
        });
        return rebuilt;
    }

    /** Canonical snapshot used for equivalence and verification: ordered by numeric key, text and delay only. */
    private static canonicalSnapshot(messages: Record<string, unknown>): unknown[] {
        const textProp = CrmService.detectTextProperty(messages);
        const delayProp = CrmService.detectDelayProperty(messages) ?? "intervalSeconds";
        return Object.keys(messages)
            .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
            .map((key) => {
                const item = messages[key];
                if (!item || typeof item !== "object") return { key, text: undefined, delay: undefined };
                return { key, text: (item as any)[textProp], delay: (item as any)[delayProp] };
            });
    }

    /** True when both collections carry identical sequential keys, text order, canonical fields, and delay values. */
    private static messagesEquivalent(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
        return JSON.stringify(CrmService.canonicalSnapshot(a)) === JSON.stringify(CrmService.canonicalSnapshot(b));
    }

    private static deepCopyCollection(messages: Record<string, unknown>): Record<string, unknown> {
        return JSON.parse(JSON.stringify(messages)) as Record<string, unknown>;
    }

    /** Read the persisted profile back and confirm the target collection matches the expected rebuilt collection. */
    private static verifyReplacement(saved: Record<string, unknown> | null, target: "icebreaker" | "broadcast", expected: Record<string, unknown>): boolean {
        if (!saved || !CrmService.validateProfile(saved)) return false;
        const messages = CrmService.getTargetMessages(saved, target);
        if (messages === undefined) return false;
        return CrmService.messagesEquivalent(messages, expected);
    }

    /** Restore the original target collection after a failed verification. Returns true only when the restore is confirmed. */
    private static rollbackTargetCollection(key: string, target: "icebreaker" | "broadcast", original: Record<string, unknown>, previousCount: number): boolean {
        const data = CrmService.readProfile(key);
        if (!data || !CrmService.validateProfile(data)) return false;
        if (target === "icebreaker") {
            (data as any).messages = original;
        } else {
            const broadcast = (data as any).broadcast;
            if (!broadcast || typeof broadcast !== "object" || Array.isArray(broadcast)) return false;
            (broadcast as any).messages = original;
        }
        CrmService.writeProfile(key, data);
        const saved = CrmService.readProfile(key);
        const messages = saved ? CrmService.getTargetMessages(saved, target) : undefined;
        if (messages === undefined) return false;
        return Object.keys(messages).length === previousCount;
    }

    /** Record an import history entry through the static dev import. Best-effort, never throws. */
    private static recordImportHistory(
        profileId: string,
        entry: Omit<ImportHistoryEntry, "timestamp" | "profileKey" | "importedCount"> & { result: "success" | "no-change" | "failed" },
    ): void {
        try {
            addImportHistory({
                timestamp: new Date().toISOString(),
                profileKey: profileId,
                importedCount: entry.result === "success" ? (entry.finalMessageCount ?? 0) : 0,
                ...entry,
            });
        } catch { /* history is best-effort */ }
    }
}
