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
     * Format the shift date range for display.
     */
    static formatDateRange(range: ShiftDateRange): string {
        return `${FinanceShift.formatDate(range.from)} — ${FinanceShift.formatDate(range.to)}`;
    }
}
