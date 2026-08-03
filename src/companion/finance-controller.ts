/**
 * FinanceController
 *
 * Orchestrates Finance data flow: owns state, triggers requests,
 * manages cancellation, and notifies subscribers.
 *
 * Non-responsibilities:
 *   - HTTP communication (see FinanceApiClient)
 *   - Response mapping (see FinanceMapper)
 *   - Business logic, caching, persistence, UI
 */

import { FinanceApiClient, FinanceApiError, FinanceApiAbortError } from "./finance-api-client";
import { FinanceMapper, FinanceResponse, type FinanceTransaction } from "./finance-mapper";
import { FinanceShift, ShiftType } from "./finance-shift";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Finance controller state. */
export interface FinanceState {
    readonly status: FinanceStatus;
    readonly data: FinanceResponse | null;
    readonly error: string | null;
    readonly from: Date;
    readonly to: Date;
    readonly shift: ShiftType;
    readonly unviewedTransactions: number;
}

/** Finance controller status. */
export type FinanceStatus = "idle" | "loading" | "loaded" | "error";

/** Callback for state changes. */
export type FinanceStateListener = (state: FinanceState) => void;

/** Configuration for FinanceController. */
export interface FinanceControllerConfig {
    readonly shift?: ShiftType;
    readonly timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a stable identity key for a transaction.
 *
 * Fallback identity — the API does not expose a stable transaction ID.
 * Composed of: date.getTime() + ladyID + userID + operation + sum.
 */
export function txIdentity(tx: FinanceTransaction): string {
    return `${tx.date.getTime()}_${tx.ladyID}_${tx.userID}_${tx.operation}_${tx.sum}`;
}

// ---------------------------------------------------------------------------
// FinanceController
// ---------------------------------------------------------------------------

export class FinanceController {
    private state: FinanceState;
    private readonly listeners: Set<FinanceStateListener> = new Set();
    private readonly client: FinanceApiClient;
    private readonly timeoutMs: number;
    private abortController: AbortController | null = null;
    private unviewedTxIds: Set<string> = new Set();
    private allSeenTxIds: Set<string> = new Set();
    private requestSeq = 0;

    constructor(config: FinanceControllerConfig = {}) {
        const shift = config.shift ?? FinanceShift.getSavedOrDetect();
        const range = FinanceShift.computeDateRange(shift);

        this.state = {
            status: "idle",
            data: null,
            error: null,
            from: range.from,
            to: range.to,
            shift,
            unviewedTransactions: 0,
        };

        this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        this.client = new FinanceApiClient({ timeoutMs: this.timeoutMs });
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /** Get current state (immutable snapshot). */
    getState(): FinanceState {
        return { ...this.state };
    }

    /** Get the current shift type. */
    getCurrentShift(): ShiftType {
        return this.state.shift;
    }

    /**
     * Set the active shift and optionally refresh.
     * Computes the correct date range and persists the selection.
     *
     * @param shift - The shift type to activate.
     * @param autoRefresh - If true, automatically fetch after setting shift. Default: true.
     */
    setShift(shift: ShiftType, autoRefresh: boolean = true): void {
        if (this.state.shift === shift) {
            // Same shift — just refresh if requested
            if (autoRefresh) {
                this.refresh();
            }
            return;
        }

        this.cancelPending();
        FinanceShift.save(shift);

        const range = FinanceShift.computeDateRange(shift);
        this.setState({
            shift,
            from: range.from,
            to: range.to,
            data: null,
            status: "idle",
            error: null,
        });

        if (autoRefresh) {
            this.refresh();
        }
    }

    /**
     * Fetch finance data for the current date range.
     * Cancels any in-flight request before starting a new one.
     */
    async refresh(): Promise<void> {
        this.cancelPending();
        this.setState({ status: "loading", error: null });

        const controller = new AbortController();
        this.abortController = controller;
        const seq = ++this.requestSeq;

        try {
            const raw = await this.client.fetchTransactions(
                this.state.from,
                this.state.to,
                {
                    signal: controller.signal,
                    timeoutMs: this.timeoutMs,
                }
            );

            if (seq !== this.requestSeq) {
                // Superseded by a newer request — discard the stale result.
                return;
            }

            if (controller.signal.aborted) {
                // Cancelled with no successor — exit loading without dropping data.
                this.exitLoadingOnCancellation();
                return;
            }

            const mapped = FinanceMapper.mapResponse(raw);
            if (seq !== this.requestSeq) {
                return;
            }

            const currentIds = new Set((mapped.list ?? []).map(tx => txIdentity(tx)));

            // Prune unviewed IDs no longer in current data
            for (const id of this.unviewedTxIds) {
                if (!currentIds.has(id)) {
                    this.unviewedTxIds.delete(id);
                }
            }

            // Mark newly seen transactions as unviewed
            for (const id of currentIds) {
                if (!this.allSeenTxIds.has(id)) {
                    this.unviewedTxIds.add(id);
                }
                this.allSeenTxIds.add(id);
            }

            this.setState({ status: "loaded", data: mapped, error: null, unviewedTransactions: this.unviewedTxIds.size });
        } catch (error: unknown) {
            if (seq !== this.requestSeq) {
                return;
            }

            if (controller.signal.aborted) {
                // Cancelled with no successor — exit loading without dropping data.
                this.exitLoadingOnCancellation();
                return;
            }

            if (error instanceof FinanceApiAbortError) {
                this.setState({ status: "error", error: "Request timed out" });
            } else if (error instanceof FinanceApiError) {
                this.setState({ status: "error", error: error.message });
            } else if (error instanceof Error) {
                this.setState({ status: "error", error: error.message });
            } else {
                this.setState({ status: "error", error: "Unknown error" });
            }
        } finally {
            if (this.abortController === controller) {
                this.abortController = null;
            }
        }
    }

    /**
     * Set the date range and optionally refresh.
     * Cancels any in-flight request.
     *
     * @param from - Start date (inclusive).
     * @param to   - End date (inclusive).
     * @param autoRefresh - If true, automatically fetch after setting dates. Default: false.
     */
    setDateRange(from: Date, to: Date, autoRefresh: boolean = false): void {
        this.cancelPending();
        this.setState({ from, to, data: null, status: "idle", error: null });

        if (autoRefresh) {
            this.refresh();
        }
    }

    /** Cancel any in-flight request. */
    cancelPending(): void {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }

    /** Check if a request is in progress. */
    get isLoading(): boolean {
        return this.state.status === "loading";
    }

    /** Mark a specific transaction as viewed by its identity key. */
    markTxViewed(txId: string): void {
        if (this.unviewedTxIds.delete(txId)) {
            this.setState({ unviewedTransactions: this.unviewedTxIds.size });
        }
    }

    /** Check if a transaction is unviewed by its identity key. */
    isTxUnviewed(txId: string): boolean {
        return this.unviewedTxIds.has(txId);
    }

    /** Subscribe to state changes. Returns an unsubscribe function. */
    subscribe(listener: FinanceStateListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /** Unsubscribe from state changes. */
    unsubscribe(listener: FinanceStateListener): void {
        this.listeners.delete(listener);
    }

    /** Get the number of active subscribers. */
    get subscriberCount(): number {
        return this.listeners.size;
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    private setState(partial: Partial<FinanceState>): void {
        this.state = { ...this.state, ...partial };
        this.notify();
    }

    /**
     * Exit the loading state after the active request was cancelled with no
     * successor. Preserves existing data, clears the current error, and
     * publishes exactly one terminal state. Guarded on status so it never
     * overwrites a terminal state already produced by setShift() or
     * setDateRange(). Callers must only invoke this for the current request
     * (seq === this.requestSeq).
     */
    private exitLoadingOnCancellation(): void {
        if (this.state.status === "loading") {
            this.setState({ status: "idle", error: null });
        }
    }

    private notify(): void {
        for (const listener of this.listeners) {
            try {
                listener(this.state);
            } catch {
                // Listener threw — skip, don't break other listeners
            }
        }
    }
}
