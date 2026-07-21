/**
 * FinanceWidget
 *
 * DOM-based widget that displays live finance data from FinanceController.
 * Subscribes to state changes and renders loading/error/loaded states.
 * Includes a shift selector for Morning / Day / Night intervals.
 *
 * Non-responsibilities:
 *   - HTTP communication (see FinanceApiClient)
 *   - Response mapping (see FinanceMapper)
 *   - State management (see FinanceController)
 *   - Business logic, caching, persistence
 */

import { FinanceController, FinanceState, FinanceStateListener } from "./finance-controller";
import { FinanceTransaction } from "./finance-mapper";
import { FinanceShift, ShiftType } from "./finance-shift";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration for FinanceWidget. */
export interface FinanceWidgetConfig {
    /** Target element to append the widget to. Default: document.body. */
    readonly container?: HTMLElement;
    /** CSS class prefix. Default: "ab-finance". */
    readonly classPrefix?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CLASS_PREFIX = "ab-finance";

// ---------------------------------------------------------------------------
// FinanceWidget
// ---------------------------------------------------------------------------

export class FinanceWidget {
    private readonly controller: FinanceController;
    private readonly container: HTMLElement;
    private readonly classPrefix: string;
    private readonly unsubscribe: () => void;
    private root: HTMLDivElement | null = null;
    private dragHandle: HTMLDivElement | null = null;
    private refreshBtn: HTMLButtonElement | null = null;
    private shiftBtn: HTMLButtonElement | null = null;
    private shiftDropdown: HTMLDivElement | null = null;
    private contentEl: HTMLDivElement | null = null;
    private destroyed = false;
    private isDragging = false;
    private dragStartX = 0;
    private dragStartY = 0;
    private dragOrigX = 0;
    private dragOrigY = 0;

    constructor(controller: FinanceController, config: FinanceWidgetConfig = {}) {
        this.controller = controller;
        this.container = config.container ?? document.body;
        this.classPrefix = config.classPrefix ?? DEFAULT_CLASS_PREFIX;

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
        this.destroyed = true;
        this.unsubscribe();
        this.controller.cancelPending();
        this.removeDragListeners();
        this.root?.remove();
        this.root = null;
        this.dragHandle = null;
        this.refreshBtn = null;
        this.shiftBtn = null;
        this.shiftDropdown = null;
        this.contentEl = null;
    }

    /** Check if the widget has been destroyed. */
    get isDestroyed(): boolean {
        return this.destroyed;
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

        this.updateRefreshButton(state.status);
        this.updateShiftButton(state.shift);
        this.updateContent(state);
    }

    // -------------------------------------------------------------------------
    // DOM creation
    // -------------------------------------------------------------------------

    private createRoot(): void {
        const root = document.createElement("div");
        root.className = this.classPrefix;
        root.id = `${this.classPrefix}-widget`;
        root.style.width = "360px";
        root.style.height = "380px";

        // Drag handle
        const dragHandle = document.createElement("div");
        dragHandle.className = `${this.classPrefix}-header`;
        dragHandle.id = `${this.classPrefix}-drag-handle`;

        // Title
        const title = document.createElement("div");
        title.className = `${this.classPrefix}-header-title`;
        title.textContent = "Finance";

        // Header actions
        const actions = document.createElement("div");
        actions.className = `${this.classPrefix}-header-actions`;

        // Shift button
        const shiftBtn = document.createElement("button");
        shiftBtn.className = `${this.classPrefix}-shift-btn`;
        shiftBtn.title = "Shift";
        shiftBtn.addEventListener("click", this.onShiftToggle);
        shiftBtn.addEventListener("pointerdown", this.onButtonPointerDown);

        // Shift dropdown
        const shiftDropdown = document.createElement("div");
        shiftDropdown.className = `${this.classPrefix}-shift-dropdown`;
        shiftDropdown.style.display = "none";

        for (const def of FinanceShift.getAllDefinitions()) {
            const option = document.createElement("button");
            option.className = `${this.classPrefix}-shift-option`;
            option.dataset.shift = def.type;
            option.innerHTML = `<span class="${this.classPrefix}-shift-name">${def.label}</span><span class="${this.classPrefix}-shift-time">${def.timeDisplay}</span>`;
            option.addEventListener("click", this.onShiftSelect);
            option.addEventListener("pointerdown", this.onButtonPointerDown);
            shiftDropdown.appendChild(option);
        }

        // Refresh button
        const refreshBtn = document.createElement("button");
        refreshBtn.className = `${this.classPrefix}-btn`;
        refreshBtn.title = "Refresh";
        refreshBtn.textContent = "↻";
        refreshBtn.addEventListener("click", this.onRefreshClick);
        refreshBtn.addEventListener("pointerdown", this.onButtonPointerDown);

        actions.appendChild(shiftBtn);
        actions.appendChild(shiftDropdown);
        actions.appendChild(refreshBtn);

        dragHandle.appendChild(title);
        dragHandle.appendChild(actions);

        // Content
        const content = document.createElement("div");
        content.className = `${this.classPrefix}-body`;

        root.appendChild(dragHandle);
        root.appendChild(content);

        this.root = root;
        this.dragHandle = dragHandle;
        this.refreshBtn = refreshBtn;
        this.shiftBtn = shiftBtn;
        this.shiftDropdown = shiftDropdown;
        this.contentEl = content;

        // Initialize drag
        this.initDrag();

        this.container.appendChild(root);
    }

    // -------------------------------------------------------------------------
    // Drag handling
    // -------------------------------------------------------------------------

    private initDrag(): void {
        if (!this.dragHandle) return;
        this.dragHandle.addEventListener("pointerdown", this.onDragPointerDown);
    }

    private onDragPointerDown = (e: PointerEvent): void => {
        if (this.destroyed) return;
        // Don't drag when clicking buttons
        if ((e.target as HTMLElement).closest("button")) return;

        e.preventDefault();
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;

        const rect = this.root!.getBoundingClientRect();
        this.dragOrigX = rect.left;
        this.dragOrigY = rect.top;

        this.dragHandle!.style.cursor = "grabbing";
        this.dragHandle!.setPointerCapture(e.pointerId);

        document.addEventListener("pointermove", this.onDragPointerMove);
        document.addEventListener("pointerup", this.onDragPointerUp);
        document.addEventListener("pointercancel", this.onDragPointerUp);
    };

    private onDragPointerMove = (e: PointerEvent): void => {
        if (!this.isDragging || !this.root) return;
        e.preventDefault();

        const newX = this.dragOrigX + (e.clientX - this.dragStartX);
        const newY = this.dragOrigY + (e.clientY - this.dragStartY);

        this.root.style.left = newX + "px";
        this.root.style.top = newY + "px";
        this.root.style.bottom = "auto";
    };

    private onDragPointerUp = (): void => {
        if (!this.isDragging) return;
        this.isDragging = false;

        if (this.dragHandle) {
            this.dragHandle.style.cursor = "grab";
        }

        this.removeDragListeners();
    };

    private removeDragListeners(): void {
        document.removeEventListener("pointermove", this.onDragPointerMove);
        document.removeEventListener("pointerup", this.onDragPointerUp);
        document.removeEventListener("pointercancel", this.onDragPointerUp);
    }

    private onButtonPointerDown = (e: PointerEvent): void => {
        // Stop button clicks from triggering drag
        e.stopPropagation();
    };

    // -------------------------------------------------------------------------
    // State-based rendering
    // -------------------------------------------------------------------------

    private updateRefreshButton(status: string): void {
        if (!this.refreshBtn) return;
        this.refreshBtn.disabled = status === "loading";
        this.refreshBtn.textContent = status === "loading" ? "…" : "↻";
    }

    private updateShiftButton(shift: ShiftType): void {
        if (!this.shiftBtn || !this.shiftDropdown) return;
        const def = FinanceShift.getDefinition(shift);
        this.shiftBtn.textContent = `${def.label} ▾`;

        // Update active state in dropdown
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

        switch (state.status) {
            case "idle":
                this.renderIdle();
                break;
            case "loading":
                this.renderLoading();
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
        const message = this.createMessage("Ready to load finance data.");
        this.contentEl.appendChild(message);
    }

    private renderLoading(): void {
        if (!this.contentEl) return;
        this.contentEl.innerHTML = "";
        const message = this.createMessage("Loading…");
        this.contentEl.appendChild(message);
    }

    private renderLoaded(state: FinanceState): void {
        if (!this.contentEl) return;
        this.contentEl.innerHTML = "";

        const def = FinanceShift.getDefinition(state.shift);
        const dateRange = FinanceShift.computeDateRange(state.shift);

        // Shift info
        const shiftInfo = document.createElement("div");
        shiftInfo.className = `${this.classPrefix}-shift-info`;

        const shiftInfoRow1 = document.createElement("div");
        shiftInfoRow1.className = `${this.classPrefix}-shift-info-row`;
        const shiftLabel1 = document.createElement("span");
        shiftLabel1.className = `${this.classPrefix}-label`;
        shiftLabel1.textContent = "Today:";
        const shiftValue1 = document.createElement("span");
        shiftValue1.className = `${this.classPrefix}-value`;
        shiftValue1.textContent = FinanceShift.formatDate(dateRange.from);
        shiftInfoRow1.appendChild(shiftLabel1);
        shiftInfoRow1.appendChild(shiftValue1);

        const shiftInfoRow2 = document.createElement("div");
        shiftInfoRow2.className = `${this.classPrefix}-shift-info-row`;
        const shiftLabel2 = document.createElement("span");
        shiftLabel2.className = `${this.classPrefix}-label`;
        shiftLabel2.textContent = "Shift:";
        const shiftValue2 = document.createElement("span");
        shiftValue2.className = `${this.classPrefix}-value ${this.classPrefix}-accent`;
        shiftValue2.textContent = def.label;
        shiftInfoRow2.appendChild(shiftLabel2);
        shiftInfoRow2.appendChild(shiftValue2);

        const shiftInfoRow3 = document.createElement("div");
        shiftInfoRow3.className = `${this.classPrefix}-shift-info-row`;
        const shiftLabel3 = document.createElement("span");
        shiftLabel3.className = `${this.classPrefix}-label`;
        shiftLabel3.textContent = "Schedule:";
        const shiftValue3 = document.createElement("span");
        shiftValue3.className = `${this.classPrefix}-value ${this.classPrefix}-shift-time-display`;
        shiftValue3.textContent = def.timeDisplay;
        shiftInfoRow3.appendChild(shiftLabel3);
        shiftInfoRow3.appendChild(shiftValue3);

        shiftInfo.appendChild(shiftInfoRow1);
        shiftInfo.appendChild(shiftInfoRow2);
        shiftInfo.appendChild(shiftInfoRow3);

        // Divider
        const divider1 = document.createElement("div");
        divider1.className = `${this.classPrefix}-divider`;

        // Credits row
        const creditsRow = document.createElement("div");
        creditsRow.className = `${this.classPrefix}-row`;
        const creditsLabel = document.createElement("span");
        creditsLabel.className = `${this.classPrefix}-label`;
        creditsLabel.textContent = "Credits";
        const creditsValue = document.createElement("span");
        creditsValue.className = `${this.classPrefix}-value ${this.classPrefix}-accent`;
        creditsValue.textContent = state.data?.total?.toLocaleString() ?? "—";
        creditsRow.appendChild(creditsLabel);
        creditsRow.appendChild(creditsValue);

        // Divider
        const divider2 = document.createElement("div");
        divider2.className = `${this.classPrefix}-divider`;

        // Transaction list
        const transactions = state.data?.list ?? [];

        this.contentEl.appendChild(shiftInfo);
        this.contentEl.appendChild(divider1);
        this.contentEl.appendChild(creditsRow);
        this.contentEl.appendChild(divider2);

        if (transactions.length === 0) {
            const empty = this.createMessage("No transactions found.");
            this.contentEl.appendChild(empty);
        } else {
            const txContainer = document.createElement("div");
            txContainer.className = `${this.classPrefix}-tx-container`;

            // Header row
            const headerRow = document.createElement("div");
            headerRow.className = `${this.classPrefix}-tx-header`;
            headerRow.appendChild(this.createTxCell("Date"));
            headerRow.appendChild(this.createTxCell("Time"));
            headerRow.appendChild(this.createTxCell("Op"));
            headerRow.appendChild(this.createTxCell("Target"));
            headerRow.appendChild(this.createTxCell("Cr"));
            txContainer.appendChild(headerRow);

            // Transaction rows
            for (const tx of transactions) {
                txContainer.appendChild(this.createTransactionRow(tx));
            }

            this.contentEl.appendChild(txContainer);
        }
    }

    private renderError(state: FinanceState): void {
        if (!this.contentEl) return;
        this.contentEl.innerHTML = "";

        const errorEl = document.createElement("div");
        errorEl.className = `${this.classPrefix}-error`;
        errorEl.textContent = state.error ?? "Unknown error";

        this.contentEl.appendChild(errorEl);
    }

    // -------------------------------------------------------------------------
    // Transaction row
    // -------------------------------------------------------------------------

    private createTransactionRow(tx: FinanceTransaction): HTMLDivElement {
        const row = document.createElement("div");
        row.className = `${this.classPrefix}-tx-row`;

        const dateStr = FinanceShift.formatDate(tx.date);
        const timeStr = FinanceShift.formatTime(tx.date);

        row.appendChild(this.createTxCell(dateStr));
        row.appendChild(this.createTxCell(timeStr));
        row.appendChild(this.createTxCell(tx.operation, true));
        row.appendChild(this.createTxCell(tx.name));
        row.appendChild(this.createTxCell(tx.sum.toLocaleString(), false, true));

        return row;
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

    private onRefreshClick = (): void => {
        if (this.destroyed) return;
        this.controller.refresh();
    };

    private onShiftToggle = (): void => {
        if (this.destroyed || !this.shiftDropdown) return;
        const isVisible = this.shiftDropdown.style.display !== "none";
        this.shiftDropdown.style.display = isVisible ? "none" : "flex";
    };

    private onShiftSelect = (event: Event): void => {
        if (this.destroyed) return;
        const target = event.currentTarget as HTMLElement;
        const shift = target.dataset.shift as ShiftType | undefined;
        if (shift && (shift === "morning" || shift === "day" || shift === "night")) {
            this.controller.setShift(shift);
            if (this.shiftDropdown) {
                this.shiftDropdown.style.display = "none";
            }
        }
    };
}
