/**
 * FinanceMapper
 *
 * Maps the verified Finance API response into typed Companion models.
 * Converts raw server data (millisecond timestamps, string operations)
 * into domain objects (Date, Operation enum).
 *
 * Non-responsibilities:
 *   - HTTP communication (see FinanceApiClient)
 *   - Business logic, caching, persistence, UI
 *
 * Contract: The raw response shape is verified from a live API capture.
 * See docs/storage/finance-response.json and docs/storage/finance-schema.md.
 */

// ---------------------------------------------------------------------------
// Raw Response Types (as returned by the server)
// ---------------------------------------------------------------------------

/** Raw transaction object from the server. */
export interface FinanceRawTransaction {
    readonly date: number;
    readonly ladyID: number;
    readonly name: string;
    readonly sum: number;
    readonly userID: number;
    readonly operation: string;
    readonly isFinish?: boolean;
}

/** Raw finance response from the server. */
export interface FinanceRawResponse {
    readonly total: number;
    readonly from: string;
    readonly to: string;
    readonly list: FinanceRawTransaction[];
    readonly success: boolean;
}

// ---------------------------------------------------------------------------
// Operation Enum
// ---------------------------------------------------------------------------

/** All operation types supported by the Finance API. */
export enum Operation {
    EmailSend = "EmailSend",
    EmailRead = "EmailRead",
    TextChat = "TextChat",
    VideoChat = "VideoChat",
    TextChatBonusCoins = "TextChatBonusCoins",
    TextChatSatellite = "TextChatSatellite",
    EmailSendSatellite = "EmailSendSatellite",
    VideoChatSatellite = "VideoChatSatellite",
}

/** Set of all valid operation strings for runtime validation. */
const VALID_OPERATIONS = new Set<string>(Object.values(Operation));

// ---------------------------------------------------------------------------
// Mapped Model Types
// ---------------------------------------------------------------------------

/** A single finance transaction in the Companion domain. */
export interface FinanceTransaction {
    readonly date: Date;
    readonly ladyID: number;
    readonly name: string;
    readonly sum: number;
    readonly userID: number;
    readonly operation: Operation;
    readonly isFinish: boolean;
}

/** Finance response in the Companion domain. */
export interface FinanceResponse {
    readonly total: number;
    readonly from: Date;
    readonly to: Date;
    readonly list: FinanceTransaction[];
    readonly success: boolean;
}

// ---------------------------------------------------------------------------
// Typed Errors
// ---------------------------------------------------------------------------

/** Base class for all FinanceMapper errors. */
export class FinanceMapperError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "FinanceMapperError";
    }
}

/** The raw response is missing required fields. */
export class FinanceMapperValidationError extends FinanceMapperError {
    public readonly field: string;
    public readonly value: unknown;

    constructor(field: string, value: unknown, message: string) {
        super(`Validation failed for '${field}': ${message}`);
        this.name = "FinanceMapperValidationError";
        this.field = field;
        this.value = value;
    }
}

// ---------------------------------------------------------------------------
// FinanceMapper
// ---------------------------------------------------------------------------

export class FinanceMapper {
    /**
     * Map a raw Finance API response into the Companion domain model.
     *
     * @param raw - The raw JSON response from the server.
     * @returns A fully mapped FinanceResponse.
     * @throws {FinanceMapperValidationError} If required fields are missing or invalid.
     * @throws {FinanceMapperError} If the raw response is not an object.
     */
    static mapResponse(raw: unknown): FinanceResponse {
        if (typeof raw !== "object" || raw === null) {
            throw new FinanceMapperError("Response is not an object");
        }

        const obj = raw as Record<string, unknown>;

        return {
            total: FinanceMapper.parseTotal(obj.total),
            from: FinanceMapper.parseDate(obj.from),
            to: FinanceMapper.parseDate(obj.to),
            list: FinanceMapper.parseList(obj.list),
            success: FinanceMapper.parseSuccess(obj.success),
        };
    }

    /**
     * Map a single raw transaction into the domain model.
     *
     * @param raw - A raw transaction object.
     * @returns A mapped FinanceTransaction.
     * @throws {FinanceMapperValidationError} If required fields are missing or invalid.
     */
    static mapTransaction(raw: unknown): FinanceTransaction {
        if (typeof raw !== "object" || raw === null) {
            throw new FinanceMapperError("Transaction is not an object");
        }

        const obj = raw as Record<string, unknown>;

        return {
            date: FinanceMapper.parseTransactionDate(obj.date),
            ladyID: FinanceMapper.parseNumber(obj.ladyID, "ladyID"),
            name: FinanceMapper.parseString(obj.name, "name"),
            sum: FinanceMapper.parseSum(obj.sum),
            userID: FinanceMapper.parseNumber(obj.userID, "userID"),
            operation: FinanceMapper.parseOperation(obj.operation),
            isFinish: FinanceMapper.parseBoolean(obj.isFinish),
        };
    }

    // -------------------------------------------------------------------------
    // Field parsers
    // -------------------------------------------------------------------------

    private static parseTotal(value: unknown): number {
        if (typeof value !== "number") {
            throw new FinanceMapperValidationError("total", value, "expected number");
        }
        return value;
    }

    private static parseDate(value: unknown): Date {
        if (typeof value !== "string") {
            throw new FinanceMapperValidationError("date", value, "expected string (YYYY-MM-DD)");
        }
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
        if (!match) {
            throw new FinanceMapperValidationError("date", value, "expected YYYY-MM-DD format");
        }
        const [, yearStr, monthStr, dayStr] = match;
        const year = Number(yearStr);
        const month = Number(monthStr) - 1;
        const day = Number(dayStr);
        const date = new Date(year, month, day);
        if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
            throw new FinanceMapperValidationError("date", value, "invalid date");
        }
        return date;
    }

    private static parseTransactionDate(value: unknown): Date {
        if (typeof value !== "number") {
            throw new FinanceMapperValidationError("date", value, "expected number (milliseconds)");
        }
        if (!Number.isFinite(value) || value <= 0) {
            throw new FinanceMapperValidationError("date", value, "expected positive finite number");
        }
        const date = new Date(value);
        if (isNaN(date.getTime())) {
            throw new FinanceMapperValidationError("date", value, "invalid timestamp");
        }
        return date;
    }

    private static parseList(value: unknown): FinanceTransaction[] {
        if (!Array.isArray(value)) {
            throw new FinanceMapperValidationError("list", value, "expected array");
        }
        return value.map((item, index) => {
            try {
                return FinanceMapper.mapTransaction(item);
            } catch (error) {
                if (error instanceof FinanceMapperError) {
                    throw new FinanceMapperValidationError(
                        `list[${index}]`,
                        item,
                        error.message
                    );
                }
                throw error;
            }
        });
    }

    private static parseSuccess(value: unknown): boolean {
        if (typeof value !== "boolean") {
            throw new FinanceMapperValidationError("success", value, "expected boolean");
        }
        return value;
    }

    private static parseNumber(value: unknown, field: string): number {
        if (typeof value !== "number" || !Number.isFinite(value)) {
            throw new FinanceMapperValidationError(field, value, "expected finite number");
        }
        return value;
    }

    private static parseString(value: unknown, field: string): string {
        if (typeof value !== "string") {
            throw new FinanceMapperValidationError(field, value, "expected string");
        }
        return value;
    }

    private static parseSum(value: unknown): number {
        if (typeof value !== "number" || !Number.isFinite(value)) {
            throw new FinanceMapperValidationError("sum", value, "expected finite number");
        }
        return value;
    }

    private static parseOperation(value: unknown): Operation {
        if (typeof value !== "string") {
            throw new FinanceMapperValidationError("operation", value, "expected string");
        }
        if (!VALID_OPERATIONS.has(value)) {
            throw new FinanceMapperValidationError("operation", value, `unknown operation type`);
        }
        return value as Operation;
    }

    private static parseBoolean(value: unknown): boolean {
        if (value === undefined || value === null) {
            return false;
        }
        if (typeof value !== "boolean") {
            throw new FinanceMapperValidationError("isFinish", value, "expected boolean");
        }
        return value;
    }
}
