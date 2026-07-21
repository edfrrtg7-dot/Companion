/**
 * FinanceShift
 *
 * Defines Morning / Day / Night shift intervals and computes date ranges.
 * Handles persistence via localStorage and auto-detection of current shift.
 *
 * Non-responsibilities:
 *   - HTTP communication (see FinanceApiClient)
 *   - Response mapping (see FinanceMapper)
 *   - State management (see FinanceController)
 *   - UI rendering (see FinanceWidget)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Available shift types. */
export type ShiftType = "morning" | "day" | "night";

/** Shift definition with start and end hours. */
export interface ShiftDefinition {
    readonly type: ShiftType;
    readonly startHour: number;
    readonly startMinute: number;
    readonly endHour: number;
    readonly endMinute: number;
    readonly label: string;
    readonly timeDisplay: string;
}

/** Date range computed from a shift. */
export interface ShiftDateRange {
    readonly from: Date;
    readonly to: Date;
}

// ---------------------------------------------------------------------------
// Shift Definitions
// ---------------------------------------------------------------------------

const SHIFT_DEFINITIONS: ReadonlyMap<ShiftType, ShiftDefinition> = new Map([
    [
        "morning",
        {
            type: "morning",
            startHour: 7,
            startMinute: 0,
            endHour: 14,
            endMinute: 59,
            label: "Morning",
            timeDisplay: "07:00 – 14:59",
        },
    ],
    [
        "day",
        {
            type: "day",
            startHour: 15,
            startMinute: 0,
            endHour: 22,
            endMinute: 59,
            label: "Day",
            timeDisplay: "15:00 – 22:59",
        },
    ],
    [
        "night",
        {
            type: "night",
            startHour: 23,
            startMinute: 0,
            endHour: 6,
            endMinute: 59,
            label: "Night",
            timeDisplay: "23:00 – 06:59",
        },
    ],
]);

const ALL_SHIFTS: readonly ShiftType[] = ["morning", "day", "night"];

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = "agencybooster-finance-shift";

function loadShift(): ShiftType | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw && isShiftType(raw)) {
            return raw;
        }
    } catch {
        // localStorage unavailable or corrupted
    }
    return null;
}

function saveShift(shift: ShiftType): void {
    try {
        localStorage.setItem(STORAGE_KEY, shift);
    } catch {
        // localStorage full or unavailable
    }
}

function isShiftType(value: string): value is ShiftType {
    return (ALL_SHIFTS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// FinanceShift
// ---------------------------------------------------------------------------

export class FinanceShift {
    /**
     * Get the definition for a shift type.
     */
    static getDefinition(type: ShiftType): ShiftDefinition {
        const def = SHIFT_DEFINITIONS.get(type);
        if (!def) {
            throw new Error(`Unknown shift type: ${type}`);
        }
        return def;
    }

    /**
     * Get all available shift definitions.
     */
    static getAllDefinitions(): ShiftDefinition[] {
        return ALL_SHIFTS.map((type) => FinanceShift.getDefinition(type));
    }

    /**
     * Auto-detect the current shift based on local time.
     */
    static detectCurrentShift(): ShiftType {
        const now = new Date();
        const hour = now.getHours();

        if (hour >= 7 && hour < 15) {
            return "morning";
        }
        if (hour >= 15 && hour < 23) {
            return "day";
        }
        // 23:00 → 06:59 (night)
        return "night";
    }

    /**
     * Get the saved shift or auto-detect if none saved.
     * On first launch: auto-detect based on current time.
     * On subsequent launches: restore saved shift.
     */
    static getSavedOrDetect(): ShiftType {
        return loadShift() ?? FinanceShift.detectCurrentShift();
    }

    /**
     * Save the selected shift to localStorage.
     */
    static save(shift: ShiftType): void {
        saveShift(shift);
    }

    /**
     * Compute the date range for a shift on a given date.
     *
     * Morning (07:00 → 14:59): same day
     * Day (15:00 → 22:59): same day
     * Night (23:00 → 06:59): spans midnight
     *   - from: today at 23:00
     *   - to: tomorrow at 06:59
     *
     * For API purposes:
     *   - from: start of the shift day (YYYY-MM-DD)
     *   - to: end of the shift day (YYYY-MM-DD)
     *
     * @param type - Shift type.
     * @param referenceDate - The date to compute ranges for. Default: today.
     */
    static computeDateRange(type: ShiftType, referenceDate?: Date): ShiftDateRange {
        const def = FinanceShift.getDefinition(type);
        const date = referenceDate ? new Date(referenceDate) : new Date();

        const from = new Date(date);
        const to = new Date(date);

        if (type === "night") {
            // Night spans midnight: from today 23:00 to tomorrow 06:59
            // For API: from = today, to = tomorrow
            from.setHours(def.startHour, def.startMinute, 0, 0);
            to.setDate(to.getDate() + 1);
            to.setHours(def.endHour, def.endMinute, 0, 0);
        } else {
            // Same day
            from.setHours(def.startHour, def.startMinute, 0, 0);
            to.setHours(def.endHour, def.endMinute, 0, 0);
        }

        return { from, to };
    }

    /**
     * Format a date for display (dd.MM.yyyy).
     */
    static formatDate(date: Date): string {
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    }

    /**
     * Format time for display (HH:mm).
     */
    static formatTime(date: Date): string {
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        return `${hours}:${minutes}`;
    }

    /**
     * Check if a timestamp falls within a shift's time window.
     *
     * Morning (07:00–14:59): hour >= 7 && hour < 15
     * Day (15:00–22:59): hour >= 15 && hour < 23
     * Night (23:00–06:59): hour >= 23 || hour < 7
     *
     * @param timestamp - The transaction timestamp to check.
     * @param shiftType - The shift type to test against.
     * @returns true if the timestamp falls within the shift.
     */
    static isInShift(timestamp: Date, shiftType: ShiftType): boolean {
        const hour = timestamp.getHours();
        switch (shiftType) {
            case "morning":
                return hour >= 7 && hour < 15;
            case "day":
                return hour >= 15 && hour < 23;
            case "night":
                return hour >= 23 || hour < 7;
        }
    }

    /**
     * Filter a list of transactions to those falling within the given shift.
     */
    static filterByShift<T extends { date: Date }>(
        transactions: readonly T[],
        shiftType: ShiftType
    ): T[] {
        return transactions.filter((tx) => FinanceShift.isInShift(tx.date, shiftType));
    }

    /**
     * Format the shift date range for display.
     */
    static formatDateRange(range: ShiftDateRange): string {
        return `${FinanceShift.formatDate(range.from)} — ${FinanceShift.formatDate(range.to)}`;
    }

    // -------------------------------------------------------------------------
    // Smart Night Shift Logic
    // -------------------------------------------------------------------------

    /**
     * Night shift phase based on current local time.
     *
     * - "active-23": 23:00–23:59 — night is active, show transactions from 23:00 to now
     * - "active-00": 00:00–06:59 — night is active, show transactions from yesterday 23:00 to now
     * - "waiting": 07:00–22:59 — night has not started, show waiting message
     */
    static getNightPhase(now?: Date): "active-23" | "active-00" | "waiting" {
        const current = now ?? new Date();
        const hour = current.getHours();

        if (hour >= 23) {
            return "active-23";
        }
        if (hour < 7) {
            return "active-00";
        }
        return "waiting";
    }

    /**
     * Check if night shift is currently active (23:00–06:59).
     */
    static isNightActive(now?: Date): boolean {
        const phase = FinanceShift.getNightPhase(now);
        return phase === "active-23" || phase === "active-00";
    }

    /**
     * Compute the time-bounded filter range for night shift.
     *
     * Case 1 (23:00–23:59): today 23:00 → now
     * Case 2 (00:00–06:59): yesterday 23:00 → now
     * Case 3 (07:00–22:59): no range (waiting)
     */
    static computeNightFilterRange(now?: Date): { from: Date; to: Date } | null {
        const current = now ?? new Date();
        const phase = FinanceShift.getNightPhase(current);

        if (phase === "waiting") {
            return null;
        }

        const to = new Date(current);
        const from = new Date(current);

        if (phase === "active-23") {
            // Today 23:00 → now
            from.setHours(23, 0, 0, 0);
        } else {
            // active-00: Yesterday 23:00 → now
            from.setDate(from.getDate() - 1);
            from.setHours(23, 0, 0, 0);
        }

        return { from, to };
    }

    /**
     * Smart filter: applies time-bounded filtering for night shift.
     * For morning/day: uses standard hour-based filtering.
     * For night: uses time range filtering based on current phase.
     *
     * @returns Filtered transactions, or null if night shift is in waiting state.
     */
    static filterByShiftSmart<T extends { date: Date }>(
        transactions: readonly T[],
        shiftType: ShiftType,
        now?: Date
    ): { filtered: T[]; isWaiting: boolean } {
        if (shiftType !== "night") {
            // Morning/Day: standard hour-based filtering
            return {
                filtered: FinanceShift.filterByShift(transactions, shiftType),
                isWaiting: false,
            };
        }

        // Night shift: smart filtering
        const phase = FinanceShift.getNightPhase(now);

        if (phase === "waiting") {
            return { filtered: [], isWaiting: true };
        }

        const range = FinanceShift.computeNightFilterRange(now);
        if (!range) {
            return { filtered: [], isWaiting: true };
        }

        // Filter transactions within the time range
        const filtered = transactions.filter((tx) => {
            const txTime = tx.date.getTime();
            return txTime >= range.from.getTime() && txTime <= range.to.getTime();
        });

        return { filtered, isWaiting: false };
    }
}
