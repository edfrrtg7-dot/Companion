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

import { CompanionWindow, CompanionWindowConfig, WindowState } from "./companion-window";
import { FinanceController, FinanceState, FinanceStateListener, type FinanceStatus, txIdentity } from "./finance-controller";
import { FinanceTransaction } from "./finance-mapper";
import { FinanceShift, ShiftType } from "./finance-shift";
import { COMPANION_LOGO_SVG } from "./brand-logo";
import { STORAGE_KEYS } from "./storage-keys";
import { diag, isDevMode } from "./dev";

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
    /**
     * Route-enforced presentation: when true (non-chat route) the widget starts
     * collapsed regardless of the saved chat preference. The saved chat
     * preference is preserved and restored via applyChatPreference().
     */
    readonly forceCollapsed?: boolean;
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
    collapsed: true,
    hidden: false,
    chatCollapsed: true,
};

/** Highlight duration in milliseconds. */
const HIGHLIGHT_DURATION_MS = 2_000;

// ---------------------------------------------------------------------------
// FinanceWidget
// ---------------------------------------------------------------------------

export class FinanceWidget extends CompanionWindow {
    private readonly controller: FinanceController;
    private readonly unsubscribe: () => void;
    private txContainerEl: HTMLDivElement | null = null;
    private cashRefreshEl: HTMLSpanElement | null = null;
    private cashIndicatorEl: HTMLElement | null = null;
    private newTxIndicatorEl: HTMLElement | null = null;
    private shiftBtn: HTMLButtonElement | null = null;
    private shiftDropdown: HTMLDivElement | null = null;
    private boundHeaderDblClick: ((e: MouseEvent) => void) | null = null;

    /** Monotonic id of the latest user-triggered CASH refresh. */
    private manualRefreshSeq = 0;

    /** Number of loading states observed; used to detect superseded refreshes. */
    private loadingCount = 0;

    /** Date+shift key of the last successful loaded render. */
    private lastLoadedKey: string | null = null;

    /** Transaction identities of the last successful loaded render (filtered). */
    private lastLoadedIds: Set<string> = new Set();

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

    /** Whether the first expand has occurred (for auto-refresh). */
    private firstExpandDone = false;

    constructor(controller: FinanceController, config: FinanceWidgetConfig = {}) {
        const windowConfig: CompanionWindowConfig = {
            container: config.container,
            classPrefix: config.classPrefix ?? DEFAULT_CLASS_PREFIX,
            storageKey: STORAGE_KEY,
            defaultState: DEFAULT_STATE,
            onClose: config.onClose,
        };
        super(windowConfig);

        // Route presentation: a non-chat construction forces collapsed without
        // touching the saved chat preference; a chat/unknown construction
        // applies the saved chat preference to the live presentation.
        this.win = {
            ...this.win,
            collapsed: config.forceCollapsed ? true : this.win.chatCollapsed,
        };

        if (isDevMode()) {
            diag("[FinanceWidget] constructor start");
        }

        this.controller = controller;
        this.unsubscribe = this.controller.subscribe(this.onStateChange);
        if (isDevMode()) {
            diag("[FinanceWidget] before initial render, state:", this.controller.getState().status);
        }
        this.render(this.controller.getState());
        if (isDevMode()) {
            diag("[FinanceWidget] after initial render, contentEl:", this.contentEl?.childElementCount, "isConnected:", this.contentEl?.isConnected);
        }
        if (!this.win.collapsed) {
            // Restored in the expanded state (persisted after a previous
            // session). expand() only refreshes on a collapsed->expanded
            // transition, so trigger the initial refresh here to populate the
            // body without requiring a manual refresh.
            this.firstExpandDone = true;
            if (isDevMode()) diag("[FinanceWidget] restored expanded, triggering refresh");
            this.controller.refresh();
        } else if (isDevMode()) {
            diag("[FinanceWidget] constructor end, deferred refresh to first expand");
        }
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /** Remove the widget from the DOM and unsubscribe from the controller. */
    destroy(): void {
        if (this.destroyed) return;
        this.unsubscribe();
        this.controller.cancelPending();

        // Remove header double-click listener (Part B)
        if (this.boundHeaderDblClick && this.root) {
            const dragHandle = this.root.querySelector(`.${this.classPrefix}-header`);
            if (dragHandle) {
                dragHandle.removeEventListener("dblclick", this.boundHeaderDblClick);
            }
            this.boundHeaderDblClick = null;
        }

        this.txContainerEl = null;
        this.cashRefreshEl = null;
        this.cashIndicatorEl = null;
        this.newTxIndicatorEl = null;
        this.shiftBtn = null;
        this.shiftDropdown = null;
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

    /**
     * Persist window state together with the current shift, keeping the
     * unified finance widget state (geometry + shift) under one storage key.
     * Guarded against the base-constructor window where the controller is
     * not yet assigned.
     */
    protected override persistState(): void {
        const shift = this.controller?.getCurrentShift();
        if (shift) {
            this.win = { ...this.win, shift } as WindowState;
        }
        super.persistState();
    }

    /** Expand the widget and trigger initial refresh on first expand. */
    override expand(): void {
        const wasCollapsed = this.win.collapsed;
        super.expand();
        if (wasCollapsed) {
            if (!this.firstExpandDone) {
                this.firstExpandDone = true;
                if (isDevMode()) diag("[FinanceWidget] first expand, triggering refresh");
                this.controller.refresh();
            } else {
                // Re-expand: render the controller's current state so the body
                // never shows stale content (e.g. a "Loading…" rendered before
                // a collapse) after the widget is reopened. No new request.
                if (isDevMode()) diag("[FinanceWidget] re-expand, re-rendering current state");
                this.render(this.controller.getState());
            }
        }
    }

    /**
     * Apply the saved chat-route collapse preference to the live presentation.
     * On an expanded restore (SPA non-chat -> chat), triggers exactly one data
     * refresh. Route-forced collapse uses collapse()/expand() directly and
     * therefore never updates the saved preference.
     */
    override applyChatPreference(): void {
        const wasCollapsed = this.win.collapsed;
        // Suppress the expand() override's first-expand auto-refresh — the
        // refresh below is the single controlled refresh for this transition.
        this.firstExpandDone = true;
        super.applyChatPreference();
        if (!this.win.collapsed && wasCollapsed) {
            if (isDevMode()) diag("[FinanceWidget] chat preference applied expanded, triggering refresh");
            this.controller.refresh();
        }
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
        if (isDevMode()) {
            diag("[FinanceWidget] onStateChange:", state.status, "destroyed:", this.destroyed);
        }
        this.render(state);
    };

    private render(state: FinanceState): void {
        if (isDevMode()) {
            diag("[FinanceWidget] render() start, state:", state.status, "root:", !!this.root, "collapsed:", this.win.collapsed);
        }
        if (!this.root) {
            if (isDevMode()) {
                diag("[FinanceWidget] render() - no root, calling createRoot()");
            }
            this.createRoot();
        }

        this.updateCashRefreshIndicator(state.status);
        this.updateShiftButton(state.shift);
        this.updateNewTxIndicator(state);
        if (!this.win.collapsed) {
            if (isDevMode()) {
                diag("[FinanceWidget] render() - not collapsed, calling updateContent()");
            }
            this.updateContent(state);
        } else if (isDevMode()) {
            diag("[FinanceWidget] render() - WIDGET IS COLLAPSED, skipping updateContent");
        }
        if (isDevMode()) {
            diag("[FinanceWidget] render() end");
        }
    }

    // -------------------------------------------------------------------------
    // DOM creation
    // -------------------------------------------------------------------------

    private createRoot(): void {
        if (isDevMode()) diag("[FinanceWidget] createRoot() start, saved:", this.win);
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
            if (isDevMode()) diag("[FinanceWidget] createRoot() - widget is HIDDEN");
            root.style.display = "none";
        }

        if (saved.collapsed) {
            if (isDevMode()) diag("[FinanceWidget] createRoot() - widget is COLLAPSED");
            root.classList.add(`${this.classPrefix}-collapsed`);
            root.style.width = saved.width + "px";
            root.style.height = "44px";
            // Override the CSS min-height/min-width (200px/320px) so the
            // persisted collapsed bar restores as header-only, not half-open.
            root.style.minHeight = "44px";
            root.style.minWidth = saved.width + "px";
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

        // CASH refresh control — clicking it refreshes the finance data
        const cashIndicator = document.createElement("button");
        cashIndicator.type = "button";
        cashIndicator.className = `${this.classPrefix}-cash-indicator`;
        cashIndicator.title = "Refresh";

        const cashIcon = document.createElement("span");
        cashIcon.className = `${this.classPrefix}-cash-icon`;
        cashIcon.textContent = "\uD83D\uDCB0";

        const cashLabel = document.createElement("span");
        cashLabel.className = `${this.classPrefix}-cash-label`;
        cashLabel.textContent = "CASH";

        const cashRefresh = document.createElement("span");
        cashRefresh.className = `${this.classPrefix}-cash-refresh`;
        cashRefresh.textContent = "\u27F3";
        this.cashRefreshEl = cashRefresh;

        cashIndicator.appendChild(cashIcon);
        cashIndicator.appendChild(cashLabel);
        cashIndicator.appendChild(cashRefresh);

        // New-transaction indicator — hidden by default, shown only when a
        // manual CASH refresh finds at least one new transaction identity.
        const newTxIndicator = document.createElement("span");
        newTxIndicator.className = `${this.classPrefix}-new-indicator`;
        newTxIndicator.title = "New transaction";
        newTxIndicator.setAttribute("aria-label", "New transaction");
        newTxIndicator.textContent = "\u0021";
        this.newTxIndicatorEl = newTxIndicator;

        // Header actions
        const actions = document.createElement("div");
        actions.className = `${this.classPrefix}-header-actions`;

        // Flexible empty drag surface — expands to consume remaining width.
        const headerSpacer = document.createElement("div");
        headerSpacer.className = `${this.classPrefix}-header-spacer`;

        // Left flexible spacer — mirrors the right spacer so the CASH cluster
        // (CASH + indicator) is visually centred between FINANCE and actions.
        const headerSpacerLeft = document.createElement("div");
        headerSpacerLeft.className = `${this.classPrefix}-header-spacer`;

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

        actions.appendChild(collapseBtn);
        actions.appendChild(closeBtn);

        dragHandle.appendChild(title);
        dragHandle.appendChild(headerSpacerLeft);
        dragHandle.appendChild(cashIndicator);
        dragHandle.appendChild(newTxIndicator);
        dragHandle.appendChild(headerSpacer);
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
        this.contentEl = content;
        this.collapseBtn = collapseBtn;
        this.closeBtn = closeBtn;
        this.cashIndicatorEl = cashIndicator;
        this.newTxIndicatorEl = newTxIndicator;

        // Attach Finance-specific event listeners
        cashIndicator.addEventListener("click", this.onHeaderRefreshClick);

        // Header double-click to toggle collapse/expand (Part B)
        this.boundHeaderDblClick = this.onHeaderDblClick.bind(this);
        dragHandle.addEventListener("dblclick", this.boundHeaderDblClick);

        this.container.appendChild(root);

        // Initialize window behavior (drag, resize, keyboard, collapse/close buttons)
        this.initWindow(dragHandle, resizeHandle);

        if (isDevMode()) diag("[FinanceWidget] createRoot() end, contentEl:", !!this.contentEl, "root in DOM:", this.root.isConnected);
    }

    // -------------------------------------------------------------------------
    // State-based rendering
    // -------------------------------------------------------------------------

    private updateCashRefreshIndicator(status: FinanceStatus): void {
        if (!this.cashIndicatorEl || !this.cashRefreshEl) return;
        const isLoading = status === "loading";
        this.cashIndicatorEl.disabled = isLoading;
        this.cashRefreshEl.classList.toggle("spinning", isLoading);
    }

    private updateShiftButton(shift: ShiftType): void {
        if (!this.shiftBtn || !this.shiftDropdown) return;
        const def = FinanceShift.getDefinition(shift);
        this.shiftBtn.textContent = `${def.label} \u25BE`;

        // Keep the Shift-section time-range caption in sync with the shift.
        const caption = this.contentEl?.querySelector(`.${this.classPrefix}-shift-time-range`);
        if (caption) {
            caption.textContent = `${def.label} (${def.timeDisplay})`;
        }

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

    /** Build the shift selector (button + dropdown) used inside the body. */
    private createShiftSelector(): HTMLDivElement {
        const select = document.createElement("div");
        select.className = `${this.classPrefix}-shift-select`;

        const shiftBtn = document.createElement("button");
        shiftBtn.className = `${this.classPrefix}-shift-btn`;
        shiftBtn.title = "Shift";
        shiftBtn.addEventListener("click", this.onShiftToggle);

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

        this.shiftBtn = shiftBtn;
        this.shiftDropdown = shiftDropdown;

        select.appendChild(shiftBtn);
        select.appendChild(shiftDropdown);
        return select;
    }

    private onShiftToggle = (): void => {
        if (this.destroyed || !this.shiftDropdown) return;
        const isOpen = this.shiftDropdown.classList.contains("open");
        if (isOpen) {
            this.shiftDropdown.classList.remove("open");
        } else {
            this.shiftDropdown.classList.add("open");
        }
    };

    private onShiftSelect = (event: Event): void => {
        if (this.destroyed) return;
        const target = event.currentTarget as HTMLElement;
        const shift = target.dataset.shift as ShiftType | undefined;
        if (!shift) return;
        if (this.shiftDropdown) {
            this.shiftDropdown.classList.remove("open");
        }
        this.controller.setShift(shift);
    };

    // -------------------------------------------------------------------------
    // New-transaction indicator
    // -------------------------------------------------------------------------

    /**
     * Snapshot key for a date+shift context. Indicator comparisons are scoped
     * to the exact selected date + shift; a change in either resets the
     * baseline and hides the indicator.
     */
    private snapshotKey(state: FinanceState): string {
        return `${state.from.getTime()}|${state.to.getTime()}|${state.shift}`;
    }

    /**
     * Evaluate the new-transaction indicator from a state change.
     *
     * Rules:
     * - Hidden by default, on initial load, on automatic refresh, and on
     *   date/shift change.
     * - The first successful load for a date+shift establishes the baseline
     *   (no indicator).
     * - A user-triggered CASH refresh compares the new filtered identity set
     *   against the previous successful snapshot for the same date+shift.
     * - Shows only when a new transaction identity appears; reordering existing
     *   transactions is not "new".
     * - Failed, cancelled, stale, or aborted refreshes never show it.
     */
    private updateNewTxIndicator(state: FinanceState): void {
        if (!this.newTxIndicatorEl) return;

        if (state.status === "loading") {
            // Each refresh emits exactly one loading state; counting lets the
            // manual-refresh completion detect when it was superseded.
            this.loadingCount++;
            return;
        }

        const key = this.snapshotKey(state);

        // Date or shift changed since the last successful snapshot: hide the
        // indicator and reset the baseline so it never carries across a
        // date/shift change and comparisons never cross contexts.
        if (this.lastLoadedKey !== null && key !== this.lastLoadedKey) {
            this.lastLoadedKey = key;
            this.lastLoadedIds = new Set();
            this.hideNewTxIndicator();
        }

        if (state.status !== "loaded") return;

        const filtered = FinanceShift.filterByShiftSmart(state.data?.list ?? [], state.shift).filtered;
        const currentIds = new Set(filtered.map((tx) => txIdentity(tx)));

        // First successful load for this date+shift: establishes the baseline.
        if (this.lastLoadedKey === null) {
            this.lastLoadedKey = key;
            this.lastLoadedIds = currentIds;
            this.hideNewTxIndicator();
            return;
        }

        // Any non-manual refresh for the same date+shift: update the baseline
        // but never reveal the indicator.
        this.lastLoadedIds = currentIds;
    }

    private showNewTxIndicator(): void {
        if (this.newTxIndicatorEl) {
            this.newTxIndicatorEl.classList.add("visible");
        }
    }

    private hideNewTxIndicator(): void {
        if (this.newTxIndicatorEl) {
            this.newTxIndicatorEl.classList.remove("visible");
        }
    }

    private updateContent(state: FinanceState): void {
        if (isDevMode()) {
            diag("[FinanceWidget] updateContent() start, state:", state.status, "contentEl:", !!this.contentEl);
        }
        if (!this.contentEl) {
            if (isDevMode()) {
                diag("[FinanceWidget] updateContent() - NO contentEl!");
            }
            return;
        }

        switch (state.status) {
            case "idle":
                if (isDevMode()) diag("[FinanceWidget] updateContent() - rendering IDLE");
                this.renderIdle();
                break;
            case "loading":
                if (isDevMode()) diag("[FinanceWidget] updateContent() - rendering LOADING");
                // Preserve existing content during refreshes
                // Only show loading state on initial load
                if (this.displayedTxIds.length === 0 && !this.txContainerEl) {
                    if (isDevMode()) diag("[FinanceWidget] updateContent() - initial load, showing loading");
                    this.renderLoading();
                } else if (isDevMode()) {
                    diag("[FinanceWidget] updateContent() - refresh, preserving content, displayedTxIds:", this.displayedTxIds.length, "txContainerEl:", !!this.txContainerEl);
                }
                break;
            case "loaded":
                if (isDevMode()) diag("[FinanceWidget] updateContent() - rendering LOADED, data:", !!state.data, "list length:", state.data?.list?.length);
                this.renderLoaded(state);
                break;
            case "error":
                if (isDevMode()) diag("[FinanceWidget] updateContent() - rendering ERROR:", state.error);
                this.renderError(state);
                break;
        }
        if (isDevMode()) {
            diag("[FinanceWidget] updateContent() end, contentEl children:", this.contentEl.childElementCount);
        }
    }

    private renderIdle(): void {
        if (isDevMode()) diag("[FinanceWidget] renderIdle()");
        if (!this.contentEl) return;
        this.contentEl.innerHTML = "";
        this.resetTxState();
        const message = this.createMessage("Ready to load finance data.");
        this.contentEl.appendChild(message);
    }

    private renderLoading(): void {
        if (isDevMode()) diag("[FinanceWidget] renderLoading()");
        if (!this.contentEl) return;
        this.contentEl.innerHTML = "";
        this.resetTxState();
        const message = this.createMessage("Loading\u2026");
        this.contentEl.appendChild(message);
    }

    private renderLoaded(state: FinanceState): void {
        if (isDevMode()) diag("[FinanceWidget] renderLoaded() start");
        if (!this.contentEl) return;

        const def = FinanceShift.getDefinition(state.shift);
        const allTransactions = state.data?.list ?? [];

        if (isDevMode()) diag("[FinanceWidget] renderLoaded() - allTransactions:", allTransactions.length);

        const { filtered, isWaiting } = FinanceShift.filterByShiftSmart(
            allTransactions,
            state.shift
        );

        if (isDevMode()) diag("[FinanceWidget] renderLoaded() - filtered:", filtered.length, "isWaiting:", isWaiting);

        const filteredSum = filtered.reduce((acc, tx) => acc + tx.sum, 0);

        // Check if structural rebuild is needed
        const needsRebuild = this.needsFullRebuild(state.shift, isWaiting, filtered.length);

        if (isDevMode()) diag("[FinanceWidget] renderLoaded() - needsRebuild:", needsRebuild);

        if (needsRebuild) {
            if (isDevMode()) diag("[FinanceWidget] renderLoaded() - calling fullRebuild");
            this.fullRebuild(state.shift, isWaiting, filtered, filteredSum, def);
        } else {
            if (isDevMode()) diag("[FinanceWidget] renderLoaded() - calling incrementalUpdate");
            this.incrementalUpdate(filtered, filteredSum);
        }

        this.recordStructuralState(state.shift, isWaiting, filtered.length);
        if (isDevMode()) diag("[FinanceWidget] renderLoaded() end");
    }

    /** Full rebuild of the entire content area. */
    private fullRebuild(
        shift: ShiftType,
        isWaiting: boolean,
        filtered: FinanceTransaction[],
        filteredSum: number,
        def: ReturnType<typeof FinanceShift.getDefinition>
    ): void {
        if (isDevMode()) diag("[FinanceWidget] fullRebuild() start, isWaiting:", isWaiting, "filtered:", filtered.length);
        if (!this.contentEl) return;

        this.contentEl.innerHTML = "";
        this.resetTxState();

        // Shift info section
        const shiftInfo = document.createElement("div");
        shiftInfo.className = `${this.classPrefix}-shift-info`;

        // Shift section — the first control inside the body, visually separated
        // from the rest with a divider. Caption updates together with the shift.
        const shiftSection = document.createElement("div");
        shiftSection.className = `${this.classPrefix}-shift-section`;

        const shiftSectionLabel = document.createElement("div");
        shiftSectionLabel.className = `${this.classPrefix}-shift-section-label`;
        shiftSectionLabel.textContent = "Shift";

        // Shift selector — lives in the expanded body, first control inside it.
        const select = this.createShiftSelector();

        const shiftCaption = document.createElement("div");
        shiftCaption.className = `${this.classPrefix}-shift-time-range`;
        shiftCaption.textContent = `${def.label} (${def.timeDisplay})`;

        shiftSection.appendChild(shiftSectionLabel);
        shiftSection.appendChild(select);
        shiftSection.appendChild(shiftCaption);
        shiftInfo.appendChild(shiftSection);

        const shiftDivider = document.createElement("div");
        shiftDivider.className = `${this.classPrefix}-divider`;
        shiftInfo.appendChild(shiftDivider);

        // Date row — displayed below the Shift section.
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

        shiftInfo.appendChild(row1);

        this.updateShiftButton(shift);

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

        if (isWaiting) {
            const divider2 = document.createElement("div");
            divider2.className = `${this.classPrefix}-divider`;
            this.contentEl.appendChild(divider2);
            const waitingMsg = this.createMessage(`Waiting for Night shift (${def.timeDisplay}).`);
            this.contentEl.appendChild(waitingMsg);
            if (isDevMode()) diag("[FinanceWidget] fullRebuild() - isWaiting, returning early");
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
        if (isDevMode()) diag("[FinanceWidget] fullRebuild() end, contentEl children:", this.contentEl.childElementCount);
    }

    /** Incremental update: reuse rows, preserve order, highlight new. */
    private incrementalUpdate(filtered: FinanceTransaction[], filteredSum: number): void {
        if (isDevMode()) diag("[FinanceWidget] incrementalUpdate() start, filtered:", filtered.length, "txContainerEl:", !!this.txContainerEl);
        // Update credits value
        this.updateCreditsValue(filteredSum);

        // Update transaction rows if container exists
        if (this.txContainerEl && filtered.length > 0) {
            if (isDevMode()) diag("[FinanceWidget] incrementalUpdate() - calling updateTxRows");
            this.updateTxRows(filtered);
        } else if (isDevMode()) {
            diag("[FinanceWidget] incrementalUpdate() - SKIPPED, txContainerEl:", !!this.txContainerEl, "filtered.length:", filtered.length);
        }
        if (isDevMode()) diag("[FinanceWidget] incrementalUpdate() end");
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
        if (isDevMode()) diag("[FinanceWidget] renderError() start, error:", state.error);
        if (!this.contentEl) return;
        this.contentEl.innerHTML = "";
        this.resetTxState();

        const errorEl = document.createElement("div");
        errorEl.className = `${this.classPrefix}-error`;
        errorEl.textContent = state.error ?? "Unknown error";

this.contentEl.appendChild(errorEl);
        if (isDevMode()) diag("[FinanceWidget] renderError() end");
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
        const id = txIdentity(tx);
        row.dataset.txId = id;

        const timeStr = FinanceShift.formatTime(tx.date);

        row.appendChild(this.createTxCell(timeStr));
        row.appendChild(this.createTxCell(tx.operation, true));
        row.appendChild(this.createTxCell(String(tx.userID)));
        row.appendChild(this.createTxCell(tx.sum.toLocaleString(), false, true));

        row.addEventListener("click", () => {
            if (this.destroyed) return;
            this.controller.markTxViewed(id);
        });

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

    private onHeaderDblClick = (event: MouseEvent): void => {
        if (this.destroyed) return;
        const target = event.target as HTMLElement;
        if (!target) return;

        // Filter out interactive header controls — double-clicking them must not toggle collapse
        const classPrefix = this.classPrefix;
        const isInteractiveTarget =
            target.closest(`.${classPrefix}-cash-indicator`) !== null ||
            target.closest(`.${classPrefix}-new-indicator`) !== null ||
            target.closest(`.${classPrefix}-shift-btn`) !== null ||
            target.closest(`.${classPrefix}-shift-dropdown`) !== null ||
            target.closest(`.${classPrefix}-collapse-btn`) !== null ||
            target.closest(`.${classPrefix}-close-btn`) !== null;

        if (isInteractiveTarget) return;

        this.toggleCollapse();
    };

    private onHeaderRefreshClick = (): void => {
        if (isDevMode()) diag("[FinanceWidget] onHeaderRefreshClick()");
        if (this.destroyed) return;
        if (this.controller.isLoading) return;

        // Clear the previous indicator at the start of a manual refresh.
        this.hideNewTxIndicator();

        const manualId = ++this.manualRefreshSeq;
        const prevKey = this.lastLoadedKey;
        const prevIds = new Set(this.lastLoadedIds);

        void this.controller.refresh().then(() => {
            if (this.destroyed || manualId !== this.manualRefreshSeq) return;
            // The manual refresh's 'loading' was emitted synchronously and
            // counted into loadingCount. If loadingCount advanced beyond our
            // generation, a newer refresh superseded this one (cancelled or
            // stale) — never reveal the indicator in that case.
            if (manualGen !== this.loadingCount) return;

            const state = this.controller.getState();
            // Failed, cancelled, stale, or aborted refreshes never reveal it.
            if (state.status !== "loaded") return;
            // First load or a date/shift change establishes/refreshes the
            // baseline without a comparison.
            const key = this.snapshotKey(state);
            if (prevKey === null || key !== prevKey) return;

            const filtered = FinanceShift.filterByShiftSmart(state.data?.list ?? [], state.shift).filtered;
            const currentIds = new Set(filtered.map((tx) => txIdentity(tx)));
            const hasNew = [...currentIds].some((id) => !prevIds.has(id));
            if (hasNew) {
                this.showNewTxIndicator();
            } else {
                this.hideNewTxIndicator();
            }
        });
        // controller.refresh() emits its 'loading' state synchronously, so
        // loadingCount now includes this manual refresh's generation.
        const manualGen = this.loadingCount;
    };
}
