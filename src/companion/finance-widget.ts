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
import { COMPANION_LOGO_SVG } from "./brand-logo";

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

const MIN_WIDTH = 280;
const MIN_HEIGHT = 200;
const MAX_WIDTH = 700;
const MAX_HEIGHT = 600;

// ---------------------------------------------------------------------------
// FinanceWidget
// ---------------------------------------------------------------------------

export class FinanceWidget {
    private readonly controller: FinanceController;
    private readonly container: HTMLElement;
    private readonly classPrefix: string;
    private readonly unsubscribe: () => void;
    private root: HTMLDivElement | null = null;
    private refreshBtn: HTMLButtonElement | null = null;
    private shiftBtn: HTMLButtonElement | null = null;
    private shiftDropdown: HTMLDivElement | null = null;
    private contentEl: HTMLDivElement | null = null;
    private destroyed = false;

    // Drag state
    private isDragging = false;
    private dragStartX = 0;
    private dragStartY = 0;
    private dragOrigX = 0;
    private dragOrigY = 0;
    private boundOnDragPointerMove: ((e: PointerEvent) => void) | null = null;
    private boundOnDragPointerUp: (() => void) | null = null;

    // Resize state
    private isResizing = false;
    private resizeStartX = 0;
    private resizeStartY = 0;
    private resizeOrigW = 0;
    private resizeOrigH = 0;
    private boundOnResizePointerMove: ((e: PointerEvent) => void) | null = null;
    private boundOnResizePointerUp: (() => void) | null = null;

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
        this.removeResizeListeners();
        this.root?.remove();
        this.root = null;
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
        titleText.textContent = "Finance";

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
            shiftDropdown.appendChild(option);
        }

        // Refresh button
        const refreshBtn = document.createElement("button");
        refreshBtn.className = `${this.classPrefix}-btn`;
        refreshBtn.title = "Refresh";
        refreshBtn.textContent = "\u21BB";

        actions.appendChild(shiftBtn);
        actions.appendChild(shiftDropdown);
        actions.appendChild(refreshBtn);

        dragHandle.appendChild(title);
        dragHandle.appendChild(actions);

        // Content
        const content = document.createElement("div");
        content.className = `${this.classPrefix}-body`;

        // Resize handle
        const resizeHandle = document.createElement("div");
        resizeHandle.className = `${this.classPrefix}-resize-handle`;

        root.appendChild(dragHandle);
        root.appendChild(content);
        root.appendChild(resizeHandle);

        this.root = root;
        this.refreshBtn = refreshBtn;
        this.shiftBtn = shiftBtn;
        this.shiftDropdown = shiftDropdown;
        this.contentEl = content;

        // Attach event listeners
        dragHandle.addEventListener("pointerdown", this.onDragPointerDown);
        resizeHandle.addEventListener("pointerdown", this.onResizePointerDown);
        shiftBtn.addEventListener("click", this.onShiftToggle);
        refreshBtn.addEventListener("click", this.onRefreshClick);

        this.container.appendChild(root);
    }

    // -------------------------------------------------------------------------
    // Drag handling
    // -------------------------------------------------------------------------

    private onDragPointerDown = (e: PointerEvent): void => {
        if (this.destroyed || !this.root) return;

        // Don't drag when clicking buttons or interactive elements
        const target = e.target as HTMLElement;
        if (target.closest("button") || target.closest("select") || target.closest("input")) {
            return;
        }

        e.preventDefault();
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;

        const rect = this.root.getBoundingClientRect();
        this.dragOrigX = rect.left;
        this.dragOrigY = rect.top;

        // Set cursor on header
        const header = this.root.querySelector(`.${this.classPrefix}-header`) as HTMLElement | null;
        if (header) {
            header.style.cursor = "grabbing";
        }

        // Create bound handlers for this drag session
        this.boundOnDragPointerMove = this.onDragPointerMove;
        this.boundOnDragPointerUp = this.onDragPointerUp;

        document.addEventListener("pointermove", this.boundOnDragPointerMove);
        document.addEventListener("pointerup", this.boundOnDragPointerUp);
        document.addEventListener("pointercancel", this.boundOnDragPointerUp);

        // Also handle window blur to cancel drag if cursor leaves browser
        window.addEventListener("blur", this.boundOnDragPointerUp);
    };

    private onDragPointerMove = (e: PointerEvent): void => {
        if (!this.isDragging || !this.root) return;
        e.preventDefault();

        const newX = this.dragOrigX + (e.clientX - this.dragStartX);
        const newY = this.dragOrigY + (e.clientY - this.dragStartY);

        this.root.style.left = newX + "px";
        this.root.style.top = newY + "px";
        this.root.style.bottom = "auto";
        this.root.style.right = "auto";
    };

    private onDragPointerUp = (): void => {
        this.isDragging = false;

        // Restore cursor on header
        if (this.root) {
            const header = this.root.querySelector(`.${this.classPrefix}-header`) as HTMLElement | null;
            if (header) {
                header.style.cursor = "grab";
            }
        }

        this.removeDragListeners();
    };

    private removeDragListeners(): void {
        if (this.boundOnDragPointerMove) {
            document.removeEventListener("pointermove", this.boundOnDragPointerMove);
        }
        if (this.boundOnDragPointerUp) {
            document.removeEventListener("pointerup", this.boundOnDragPointerUp);
            document.removeEventListener("pointercancel", this.boundOnDragPointerUp);
            window.removeEventListener("blur", this.boundOnDragPointerUp);
        }
        this.boundOnDragPointerMove = null;
        this.boundOnDragPointerUp = null;
    }

    // -------------------------------------------------------------------------
    // Resize handling
    // -------------------------------------------------------------------------

    private onResizePointerDown = (e: PointerEvent): void => {
        if (this.destroyed || !this.root) return;
        e.preventDefault();
        e.stopPropagation();

        this.isResizing = true;
        this.resizeStartX = e.clientX;
        this.resizeStartY = e.clientY;

        const rect = this.root.getBoundingClientRect();
        this.resizeOrigW = rect.width;
        this.resizeOrigH = rect.height;

        this.boundOnResizePointerMove = this.onResizePointerMove;
        this.boundOnResizePointerUp = this.onResizePointerUp;

        document.addEventListener("pointermove", this.boundOnResizePointerMove);
        document.addEventListener("pointerup", this.boundOnResizePointerUp);
        document.addEventListener("pointercancel", this.boundOnResizePointerUp);
        window.addEventListener("blur", this.boundOnResizePointerUp);
    };

    private onResizePointerMove = (e: PointerEvent): void => {
        if (!this.isResizing || !this.root) return;
        e.preventDefault();

        const dx = e.clientX - this.resizeStartX;
        const dy = e.clientY - this.resizeStartY;

        const newW = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, this.resizeOrigW + dx));
        const newH = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, this.resizeOrigH + dy));

        this.root.style.width = newW + "px";
        this.root.style.height = newH + "px";
    };

    private onResizePointerUp = (): void => {
        this.isResizing = false;
        this.removeResizeListeners();
    };

    private removeResizeListeners(): void {
        if (this.boundOnResizePointerMove) {
            document.removeEventListener("pointermove", this.boundOnResizePointerMove);
        }
        if (this.boundOnResizePointerUp) {
            document.removeEventListener("pointerup", this.boundOnResizePointerUp);
            document.removeEventListener("pointercancel", this.boundOnResizePointerUp);
            window.removeEventListener("blur", this.boundOnResizePointerUp);
        }
        this.boundOnResizePointerMove = null;
        this.boundOnResizePointerUp = null;
    }

    // -------------------------------------------------------------------------
    // State-based rendering
    // -------------------------------------------------------------------------

    private updateRefreshButton(status: string): void {
        if (!this.refreshBtn) return;
        this.refreshBtn.disabled = status === "loading";
        this.refreshBtn.textContent = status === "loading" ? "\u2026" : "\u21BB";
    }

    private updateShiftButton(shift: ShiftType): void {
        if (!this.shiftBtn || !this.shiftDropdown) return;
        const def = FinanceShift.getDefinition(shift);
        this.shiftBtn.textContent = `${def.label} \u25BE`;

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
        const message = this.createMessage("Loading\u2026");
        this.contentEl.appendChild(message);
    }

    private renderLoaded(state: FinanceState): void {
        if (!this.contentEl) return;
        this.contentEl.innerHTML = "";

        const def = FinanceShift.getDefinition(state.shift);
        const allTransactions = state.data?.list ?? [];

        // Smart filtering: handles night shift phases
        const { filtered, isWaiting } = FinanceShift.filterByShiftSmart(
            allTransactions,
            state.shift
        );

        // Compute sum of filtered transactions
        const filteredSum = filtered.reduce((acc, tx) => acc + tx.sum, 0);

        // Shift info section
        const shiftInfo = document.createElement("div");
        shiftInfo.className = `${this.classPrefix}-shift-info`;

        // Today row
        const row1 = document.createElement("div");
        row1.className = `${this.classPrefix}-shift-info-row`;
        const label1 = document.createElement("span");
        label1.className = `${this.classPrefix}-label`;
        label1.textContent = "Date:";
        const value1 = document.createElement("span");
        value1.className = `${this.classPrefix}-value`;
        const today = new Date();
        value1.textContent = FinanceShift.formatDate(today);
        row1.appendChild(label1);
        row1.appendChild(value1);

        // Shift row
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

        // Divider
        const divider1 = document.createElement("div");
        divider1.className = `${this.classPrefix}-divider`;

        // Credits row — sum of filtered transactions
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

        // Divider
        const divider2 = document.createElement("div");
        divider2.className = `${this.classPrefix}-divider`;

        this.contentEl.appendChild(shiftInfo);
        this.contentEl.appendChild(divider1);
        this.contentEl.appendChild(creditsRow);
        this.contentEl.appendChild(divider2);

        // Night shift waiting state
        if (isWaiting) {
            const waitingMsg = this.createMessage(`Waiting for Night shift (${def.timeDisplay}).`);
            this.contentEl.appendChild(waitingMsg);
            return;
        }

        if (filtered.length === 0) {
            const empty = this.createMessage("No transactions for this shift.");
            this.contentEl.appendChild(empty);
        } else {
            const txContainer = document.createElement("div");
            txContainer.className = `${this.classPrefix}-tx-container`;

            // Header row: Time | Operation | Target | Credits
            const headerRow = document.createElement("div");
            headerRow.className = `${this.classPrefix}-tx-header`;
            headerRow.appendChild(this.createTxHeaderCell("Time"));
            headerRow.appendChild(this.createTxHeaderCell("Operation"));
            headerRow.appendChild(this.createTxHeaderCell("Target"));
            headerRow.appendChild(this.createTxHeaderCell("Credits"));
            txContainer.appendChild(headerRow);

            // Transaction rows
            for (const tx of filtered) {
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

        // Time: HH:mm
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

    private onRefreshClick = (): void => {
        if (this.destroyed) return;
        this.controller.refresh();
    };

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
