/**
 * FinanceWidget
 *
 * DOM-based widget that displays live finance data from FinanceController.
 * Subscribes to state changes and renders loading/error/loaded states.
 * Includes a shift selector for Morning / Day / Night intervals.
 * Manual refresh only — no automatic polling.
 *
 * Transaction identity:
 *   The API does not expose a stable transaction ID. Fallback identity is
 *   composed of: date.getTime() + ladyID + userID + operation + sum.
 *   This combination is unique in practice — two transactions with identical
 *   timestamp, lady, user, operation, and sum would be extremely rare.
 *
 * Incremental rendering:
 *   - Preserves exact transaction ordering from FinanceController.
 *   - Supports new, removed, and replaced transactions.
 *   - Falls back to full rebuild on structural changes (shift, waiting, empty).
 *   - Reuses existing DOM nodes where possible for performance.
 *
 * Inherits window management (drag, resize, collapse, persist) from CompanionWindow.
 *
 * Non-responsibilities:
 *   - HTTP communication (see FinanceApiClient)
 *   - Response mapping (see FinanceMapper)
 *   - State management (see FinanceController)
 *   - Business logic, caching, persistence
 *   - Window management (see CompanionWindow)
 */

import { CompanionWindow, CompanionWindowConfig } from "./companion-window";
import { FinanceController, FinanceState, FinanceStateListener } from "./finance-controller";
import { FinanceTransaction } from "./finance-mapper";
import { FinanceShift, ShiftType } from "./finance-shift";
import { COMPANION_LOGO_SVG } from "./brand-logo";
import { STORAGE_KEYS } from "./storage-keys";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration for FinanceWidget. */
export interface FinanceWidgetConfig {
    /** Target element to append the widget to. Default: document.body. */
    readonly container?: HTMLElement;
    /** CSS class prefix. Default: "ab-finance". */
    readonly classPrefix?: string;
    /** Callback when widget is closed. */
    readonly onClose?: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CLASS_PREFIX = "ab-finance";
const STORAGE_KEY = STORAGE_KEYS.FINANCE_WIDGET_STATE;

const DEFAULT_STATE = {
    x: 24,
    y: 24,
    width: 360,
    height: 380,
    collapsed: false,
    hidden: false,
};

/** Highlight duration in milliseconds. */
const HIGHLIGHT_DURATION_MS = 2_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a stable identity key for a transaction.
 *
 * Fallback identity — the API does not expose a stable transaction ID.
 * Composed of: date.getTime() + ladyID + userID + operation + sum.
 * This combination is unique in practice.
 */
function txIdentity(tx: FinanceTransaction): string {
    return `${tx.date.getTime()}_${tx.ladyID}_${tx.userID}_${tx.operation}_${tx.sum}`;
}

// ---------------------------------------------------------------------------
// FinanceWidget
// ---------------------------------------------------------------------------

export class FinanceWidget extends CompanionWindow {
    private readonly controller: FinanceController;
    private readonly unsubscribe: () => void;
    private shiftBtn: HTMLButtonElement | null = null;
    private shiftDropdown: HTMLDivElement | null = null;
    private shiftOptions: HTMLElement[] = [];
    private txContainerEl: HTMLDivElement | null = null;
    private bodyRefreshBtn: HTMLButtonElement | null = null;

    /** Currently displayed transaction identity keys in order. */
    private displayedTxIds: string[] = [];

    /** Map of identity → row DOM element for reuse. */
    private txRowCache: Map<string, HTMLDivElement> = new Map();

    /** Previous shift for structural change detection. */
    private prevShift: ShiftType | null = null;

    /** Previous waiting state for structural change detection. */
    private prevIsWaiting: boolean | null = null;

    /** Previous filtered count for structural change detection. */
    private prevFilteredCount: number = -1;

    constructor(controller: FinanceController, config: FinanceWidgetConfig = {}) {
        const windowConfig: CompanionWindowConfig = {
            container: config.container,
            classPrefix: config.classPrefix ?? DEFAULT_CLASS_PREFIX,
            storageKey: STORAGE_KEY,
            defaultState: DEFAULT_STATE,
            onClose: config.onClose,
        };
        super(windowConfig);

        this.controller = controller;
        this.unsubscribe = this.controller.subscribe(this.onStateChange);
        this.render(this.controller.getState());
        this.controller.refresh();
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /** Remove the widget from the DOM and unsubscribe from the controller. */
    destroy(): void {
        if (this.destroyed) return;
        this.unsubscribe();
        this.controller.cancelPending();

        // Remove shift option listeners
        for (const option of this.shiftOptions) {
            option.removeEventListener("click", this.onShiftSelect);
        }
        this.shiftOptions = [];

        this.shiftBtn = null;
        this.shiftDropdown = null;
        this.txContainerEl = null;
        this.bodyRefreshBtn = null;
        this.txRowCache.clear();
        this.displayedTxIds = [];
        super.destroy();
    }

    /** Show the widget. */
    show(): void {
        super.show();
    }

    /** Hide the widget. */
    hide(): void {
        super.hide();
    }

    // -------------------------------------------------------------------------
    // Structural change detection
    // -------------------------------------------------------------------------

    /** Check if a full rebuild is required. */
    private needsFullRebuild(shift: ShiftType, isWaiting: boolean, filteredCount: number): boolean {
        if (this.prevShift !== shift) return true;
        if (this.prevIsWaiting !== isWaiting) return true;
        if (this.prevFilteredCount === -1) return true; // First render
        if (this.prevFilteredCount === 0 && filteredCount > 0) return true;
        if (this.prevFilteredCount > 0 && filteredCount === 0) return true;
        return false;
    }

    private recordStructuralState(shift: ShiftType, isWaiting: boolean, filteredCount: number): void {
        this.prevShift = shift;
        this.prevIsWaiting = isWaiting;
        this.prevFilteredCount = filteredCount;
    }

    // -------------------------------------------------------------------------
    // Incremental transaction rendering
    // -------------------------------------------------------------------------

    /**
     * Rebuild the transaction container's children in correct order.
     * Reuses existing DOM nodes from cache. Highlights newly added rows.
     */
    private updateTxRows(filtered: FinanceTransaction[]): void {
        if (!this.txContainerEl) return;

        const newIds: string[] = [];
        const newIdSet = new Set<string>();

        for (const tx of filtered) {
            const id = txIdentity(tx);
            newIds.push(id);
            if (!this.txRowCache.has(id)) {
                newIdSet.add(id);
                this.txRowCache.set(id, this.createTransactionRow(tx));
            }
        }

        // Detect removed transactions
        const newIdLookup = new Set(newIds);
        for (const oldId of this.displayedTxIds) {
            if (!newIdLookup.has(oldId)) {
                this.txRowCache.delete(oldId);
            }
        }

        // Rebuild children in correct order
        const fragment = document.createDocumentFragment();
        for (const id of newIds) {
            const row = this.txRowCache.get(id);
            if (row) {
                if (newIdSet.has(id)) {
                    this.applyHighlight(row);
                }
                fragment.appendChild(row);
            }
        }

        // Remove header, then replace all rows
        const header = this.txContainerEl.querySelector(`.${this.classPrefix}-tx-header`);
        this.txContainerEl.innerHTML = "";
        if (header) {
            this.txContainerEl.appendChild(header);
        }
        this.txContainerEl.appendChild(fragment);

        this.displayedTxIds = newIds;
    }

    /** Apply a temporary highlight to a row. */
    private applyHighlight(row: HTMLDivElement): void {
        row.classList.remove(`${this.classPrefix}-tx-new`);
        // Force reflow to restart animation
        void row.offsetWidth;
        row.classList.add(`${this.classPrefix}-tx-new`);
        setTimeout(() => {
            row.classList.remove(`${this.classPrefix}-tx-new`);
        }, HIGHLIGHT_DURATION_MS);
    }

    // -------------------------------------------------------------------------
    // State rendering
    // -------------------------------------------------------------------------

    private onStateChange: FinanceStateListener = (state) => {
        if (this.destroyed) return;
        this.render(state);
    };

    private render(state: FinanceState): void {
        if (!this.root) {
            this.createRoot();
        }

        this.updateShiftButton(state.shift);
        if (!this.win.collapsed) {
            this.updateContent(state);
        }
    }

    // -------------------------------------------------------------------------
    // DOM creation
    // -------------------------------------------------------------------------

    private createRoot(): void {
        const saved = this.win;

        const root = document.createElement("div");
        root.className = this.classPrefix;
        root.id = `${this.classPrefix}-widget`;

        // JS controls geometry
        root.style.left = saved.x + "px";
        root.style.top = saved.y + "px";
        root.style.bottom = "auto";
        root.style.right = "auto";

        if (saved.hidden) {
            root.style.display = "none";
        }

        if (saved.collapsed) {
            root.classList.add(`${this.classPrefix}-collapsed`);
            root.style.width = "330px";
            root.style.height = "44px";
            root.style.overflow = "hidden";
        } else {
            root.style.width = saved.width + "px";
            root.style.height = saved.height + "px";
        }

        // Drag handle (header)
        const dragHandle = document.createElement("div");
        dragHandle.className = `${this.classPrefix}-header`;
        dragHandle.id = `${this.classPrefix}-drag-handle`;

        // Title with logo
        const title = document.createElement("div");
        title.className = `${this.classPrefix}-header-title`;

        const logo = document.createElement("span");
        logo.className = `${this.classPrefix}-logo`;
        logo.innerHTML = COMPANION_LOGO_SVG;

        const titleText = document.createElement("span");
        titleText.textContent = "FINANCE";

        title.appendChild(logo);
        title.appendChild(titleText);

        // Header actions
        const actions = document.createElement("div");
        actions.className = `${this.classPrefix}-header-actions`;

        // Shift button
        const shiftBtn = document.createElement("button");
        shiftBtn.className = `${this.classPrefix}-shift-btn`;
        shiftBtn.title = "Shift";

        // Shift dropdown
        const shiftDropdown = document.createElement("div");
        shiftDropdown.className = `${this.classPrefix}-shift-dropdown`;

        for (const def of FinanceShift.getAllDefinitions()) {
            const option = document.createElement("button");
            option.className = `${this.classPrefix}-shift-option`;
            option.dataset.shift = def.type;
            option.innerHTML = `<span class="${this.classPrefix}-shift-name">${def.label}</span><span class="${this.classPrefix}-shift-time">${def.timeDisplay}</span>`;
            option.addEventListener("click", this.onShiftSelect);
            this.shiftOptions.push(option);
            shiftDropdown.appendChild(option);
        }

        // Collapse button
        const collapseBtn = document.createElement("button");
        collapseBtn.className = `${this.classPrefix}-btn ${this.classPrefix}-collapse-btn`;
        collapseBtn.title = "Collapse";
        collapseBtn.textContent = saved.collapsed ? "\u25B6" : "\u25BC";

        // Close button
        const closeBtn = document.createElement("button");
        closeBtn.className = `${this.classPrefix}-btn ${this.classPrefix}-close-btn`;
        closeBtn.title = "Close";
        closeBtn.textContent = "\u2715";

        actions.appendChild(shiftBtn);
        actions.appendChild(shiftDropdown);
        actions.appendChild(collapseBtn);
        actions.appendChild(closeBtn);

        dragHandle.appendChild(title);
        dragHandle.appendChild(actions);

        // Content
        const content = document.createElement("div");
        content.className = `${this.classPrefix}-body`;

        if (saved.collapsed) {
            content.style.display = "none";
        }

        // Resize handle
        const resizeHandle = document.createElement("div");
        resizeHandle.className = `${this.classPrefix}-resize-handle`;

        root.appendChild(dragHandle);
        root.appendChild(content);
        root.appendChild(resizeHandle);

        this.root = root;
        this.shiftBtn = shiftBtn;
        this.shiftDropdown = shiftDropdown;
        this.contentEl = content;
        this.collapseBtn = collapseBtn;
        this.closeBtn = closeBtn;

        // Attach Finance-specific event listeners
        shiftBtn.addEventListener("click", this.onShiftToggle);

        this.container.appendChild(root);

        // Initialize window behavior (drag, resize, keyboard, collapse/close buttons)
        this.initWindow(dragHandle, resizeHandle);
    }

    // -------------------------------------------------------------------------
    // State-based rendering
    // -------------------------------------------------------------------------

    private updateShiftButton(shift: ShiftType): void {
        if (!this.shiftBtn || !this.shiftDropdown) return;
        const def = FinanceShift.getDefinition(shift);
        this.shiftBtn.textContent = `${def.label} \u25BE`;

        const options = this.shiftDropdown.querySelectorAll(`.${this.classPrefix}-shift-option`);
        options.forEach((opt) => {
            const htmlOpt = opt as HTMLElement;
            if (htmlOpt.dataset.shift === shift) {
                htmlOpt.classList.add("active");
            } else {
                htmlOpt.classList.remove("active");
            }
        });
    }

    private updateContent(state: FinanceState): void {
        if (!this.contentEl) return;

        // Update body refresh button state
        this.updateBodyRefreshButton(state.status);

        switch (state.status) {
            case "idle":
                this.renderIdle();
                break;
            case "loading":
                // Preserve existing content during refreshes
                // Only show loading state on initial load
                if (this.displayedTxIds.length === 0 && !this.txContainerEl) {
                    this.renderLoading();
                }
                break;
            case "loaded":
                this.renderLoaded(state);
                break;
            case "error":
                this.renderError(state);
                break;
        }
    }

    private renderIdle(): void {
        if (!this.contentEl) return;
        this.contentEl.innerHTML = "";
        this.resetTxState();
        const message = this.createMessage("Ready to load finance data.");
        this.contentEl.appendChild(message);
    }

    private renderLoading(): void {
        if (!this.contentEl) return;
        this.contentEl.innerHTML = "";
        this.resetTxState();
        const message = this.createMessage("Loading\u2026");
        this.contentEl.appendChild(message);
    }

    private renderLoaded(state: FinanceState): void {
        if (!this.contentEl) return;

        const def = FinanceShift.getDefinition(state.shift);
        const allTransactions = state.data?.list ?? [];

        const { filtered, isWaiting } = FinanceShift.filterByShiftSmart(
            allTransactions,
            state.shift
        );

        const filteredSum = filtered.reduce((acc, tx) => acc + tx.sum, 0);

        // Check if structural rebuild is needed
        const needsRebuild = this.needsFullRebuild(state.shift, isWaiting, filtered.length);

        if (needsRebuild) {
            this.fullRebuild(state.shift, isWaiting, filtered, filteredSum, def);
        } else {
            this.incrementalUpdate(filtered, filteredSum);
        }

        this.recordStructuralState(state.shift, isWaiting, filtered.length);
    }

    /** Full rebuild of the entire content area. */
    private fullRebuild(
        shift: ShiftType,
        isWaiting: boolean,
        filtered: FinanceTransaction[],
        filteredSum: number,
        def: ReturnType<typeof FinanceShift.getDefinition>
    ): void {
        if (!this.contentEl) return;

        this.contentEl.innerHTML = "";
        this.resetTxState();

        // Shift info section
        const shiftInfo = document.createElement("div");
        shiftInfo.className = `${this.classPrefix}-shift-info`;

        const row1 = document.createElement("div");
        row1.className = `${this.classPrefix}-shift-info-row`;
        const label1 = document.createElement("span");
        label1.className = `${this.classPrefix}-label`;
        label1.textContent = "Date:";
        const value1 = document.createElement("span");
        value1.className = `${this.classPrefix}-value`;
        value1.textContent = FinanceShift.formatDate(new Date());
        row1.appendChild(label1);
        row1.appendChild(value1);

        const row2 = document.createElement("div");
        row2.className = `${this.classPrefix}-shift-info-row`;
        const label2 = document.createElement("span");
        label2.className = `${this.classPrefix}-label`;
        label2.textContent = "Shift:";
        const value2 = document.createElement("span");
        value2.className = `${this.classPrefix}-value ${this.classPrefix}-accent`;
        value2.textContent = `${def.label} (${def.timeDisplay})`;
        row2.appendChild(label2);
        row2.appendChild(value2);

        shiftInfo.appendChild(row1);
        shiftInfo.appendChild(row2);

        const divider1 = document.createElement("div");
        divider1.className = `${this.classPrefix}-divider`;

        const creditsRow = document.createElement("div");
        creditsRow.className = `${this.classPrefix}-row`;
        const creditsLabel = document.createElement("span");
        creditsLabel.className = `${this.classPrefix}-label`;
        creditsLabel.textContent = "Credits";
        const creditsValue = document.createElement("span");
        creditsValue.className = `${this.classPrefix}-value ${this.classPrefix}-accent`;
        creditsValue.textContent = isWaiting ? "0" : filteredSum.toLocaleString();
        creditsRow.appendChild(creditsLabel);
        creditsRow.appendChild(creditsValue);

        this.contentEl.appendChild(shiftInfo);
        this.contentEl.appendChild(divider1);
        this.contentEl.appendChild(creditsRow);

        // Refresh button
        const refreshBtn = document.createElement("button");
        refreshBtn.className = `${this.classPrefix}-btn ${this.classPrefix}-btn-full`;
        refreshBtn.textContent = "Refresh";
        refreshBtn.addEventListener("click", this.onBodyRefreshClick);
        this.bodyRefreshBtn = refreshBtn;
        this.contentEl.appendChild(refreshBtn);

        if (isWaiting) {
            const divider2 = document.createElement("div");
            divider2.className = `${this.classPrefix}-divider`;
            this.contentEl.appendChild(divider2);
            const waitingMsg = this.createMessage(`Waiting for Night shift (${def.timeDisplay}).`);
            this.contentEl.appendChild(waitingMsg);
            return;
        }

        if (filtered.length === 0) {
            const divider2 = document.createElement("div");
            divider2.className = `${this.classPrefix}-divider`;
            this.contentEl.appendChild(divider2);
            const empty = this.createMessage("No transactions for this shift.");
            this.contentEl.appendChild(empty);
        } else {
            const divider2 = document.createElement("div");
            divider2.className = `${this.classPrefix}-divider`;
            this.contentEl.appendChild(divider2);

            const txContainer = document.createElement("div");
            txContainer.className = `${this.classPrefix}-tx-container`;

            const headerRow = document.createElement("div");
            headerRow.className = `${this.classPrefix}-tx-header`;
            headerRow.appendChild(this.createTxHeaderCell("Time"));
            headerRow.appendChild(this.createTxHeaderCell("Operation"));
            headerRow.appendChild(this.createTxHeaderCell("Target ID"));
            headerRow.appendChild(this.createTxHeaderCell("Credits"));
            txContainer.appendChild(headerRow);

            // Build rows in order, populate cache
            const newIds: string[] = [];
            for (const tx of filtered) {
                const id = txIdentity(tx);
                const row = this.createTransactionRow(tx);
                this.txRowCache.set(id, row);
                txContainer.appendChild(row);
                newIds.push(id);
            }
            this.displayedTxIds = newIds;

            this.contentEl.appendChild(txContainer);
            this.txContainerEl = txContainer;
        }
    }

    /** Incremental update: reuse rows, preserve order, highlight new. */
    private incrementalUpdate(filtered: FinanceTransaction[], filteredSum: number): void {
        // Update credits value
        this.updateCreditsValue(filteredSum);

        // Update transaction rows if container exists
        if (this.txContainerEl && filtered.length > 0) {
            this.updateTxRows(filtered);
        }
    }

    /** Update the credits value without rebuilding the entire section. */
    private updateCreditsValue(sum: number): void {
        if (!this.contentEl) return;
        const creditsValue = this.contentEl.querySelector(
            `.${this.classPrefix}-row .${this.classPrefix}-value.${this.classPrefix}-accent`
        ) as HTMLSpanElement | null;
        if (creditsValue) {
            creditsValue.textContent = sum.toLocaleString();
        }
    }

    private renderError(state: FinanceState): void {
        if (!this.contentEl) return;
        this.contentEl.innerHTML = "";
        this.resetTxState();

        const errorEl = document.createElement("div");
        errorEl.className = `${this.classPrefix}-error`;
        errorEl.textContent = state.error ?? "Unknown error";

        this.contentEl.appendChild(errorEl);
    }

    /** Reset transaction rendering state. */
    private resetTxState(): void {
        this.txContainerEl = null;
        this.displayedTxIds = [];
        this.txRowCache.clear();
        this.prevShift = null;
        this.prevIsWaiting = null;
        this.prevFilteredCount = -1;
    }

    // -------------------------------------------------------------------------
    // Transaction row
    // -------------------------------------------------------------------------

    private createTransactionRow(tx: FinanceTransaction): HTMLDivElement {
        const row = document.createElement("div");
        row.className = `${this.classPrefix}-tx-row`;

        const timeStr = FinanceShift.formatTime(tx.date);

        row.appendChild(this.createTxCell(timeStr));
        row.appendChild(this.createTxCell(tx.operation, true));
        row.appendChild(this.createTxCell(String(tx.userID)));
        row.appendChild(this.createTxCell(tx.sum.toLocaleString(), false, true));

        return row;
    }

    private createTxHeaderCell(text: string): HTMLSpanElement {
        const cell = document.createElement("span");
        cell.className = `${this.classPrefix}-tx-cell ${this.classPrefix}-tx-header-cell`;
        cell.textContent = text;
        return cell;
    }

    private createTxCell(text: string, isOp: boolean = false, isCredits: boolean = false): HTMLSpanElement {
        const cell = document.createElement("span");
        let className = `${this.classPrefix}-tx-cell`;
        if (isOp) className += ` ${this.classPrefix}-tx-op`;
        if (isCredits) className += ` ${this.classPrefix}-accent`;
        cell.className = className;
        cell.textContent = text;
        return cell;
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private createMessage(text: string): HTMLDivElement {
        const el = document.createElement("div");
        el.className = `${this.classPrefix}-message`;
        el.textContent = text;
        return el;
    }

    private onBodyRefreshClick = (): void => {
        if (this.destroyed) return;
        this.controller.refresh();
    };

    private updateBodyRefreshButton(status: string): void {
        if (!this.bodyRefreshBtn) return;
        this.bodyRefreshBtn.disabled = status === "loading";
    }

    private onShiftToggle = (): void => {
        if (this.destroyed || !this.shiftDropdown) return;
        const isVisible = this.shiftDropdown.classList.contains("open");
        if (isVisible) {
            this.shiftDropdown.classList.remove("open");
        } else {
            this.shiftDropdown.classList.add("open");
        }
    };

    private onShiftSelect = (event: Event): void => {
        if (this.destroyed) return;
        const target = event.currentTarget as HTMLElement;
        const shift = target.dataset.shift as ShiftType | undefined;
        if (shift && (shift === "morning" || shift === "day" || shift === "night")) {
            this.controller.setShift(shift);
            if (this.shiftDropdown) {
                this.shiftDropdown.classList.remove("open");
            }
        }
    };
}
