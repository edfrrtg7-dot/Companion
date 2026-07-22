/**
 * CompanionWindow
 *
 * Base class for draggable, resizable, collapsible windows.
 * Provides common window management: drag, resize, collapse, persist, show/hide.
 *
 * Subclasses create their own DOM and call initWindow() to attach behavior.
 *
 * Two independent layouts: Expanded and Collapsed.
 * Collapsed uses fixed constants — no DOM measurement.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Persisted window state — single source of truth. */
export interface WindowState {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly collapsed: boolean;
    readonly hidden: boolean;
}

/** Configuration for CompanionWindow. */
export interface CompanionWindowConfig {
    /** Target element to append the widget to. Default: document.body. */
    readonly container?: HTMLElement;
    /** CSS class prefix. Default: "ab-window". */
    readonly classPrefix?: string;
    /** localStorage key for persisting state. */
    readonly storageKey: string;
    /** Default state when no persisted state exists. */
    readonly defaultState: WindowState;
    /** Callback when window is closed via ESC or close button. */
    readonly onClose?: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CLASS_PREFIX = "ab-window";

const MIN_WIDTH = 280;
const MIN_HEIGHT = 200;
const MAX_WIDTH = 700;
const MAX_HEIGHT = 600;

const COLLAPSED_WIDTH = 330;
const COLLAPSED_HEIGHT = 44;

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

function loadState(storageKey: string): WindowState | null {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (
            typeof parsed === "object" &&
            parsed !== null &&
            typeof parsed.x === "number" &&
            typeof parsed.y === "number" &&
            typeof parsed.width === "number" && parsed.width > 0 &&
            typeof parsed.height === "number" && parsed.height > 0 &&
            typeof parsed.collapsed === "boolean" &&
            typeof parsed.hidden === "boolean"
        ) {
            return parsed as WindowState;
        }
    } catch {
        // localStorage unavailable or corrupted
    }
    return null;
}

function saveState(storageKey: string, state: WindowState): void {
    try {
        localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
        // localStorage full or unavailable
    }
}

// ---------------------------------------------------------------------------
// CompanionWindow
// ---------------------------------------------------------------------------

export abstract class CompanionWindow {
    protected readonly container: HTMLElement;
    protected readonly classPrefix: string;
    protected readonly storageKey: string;
    protected readonly defaultState: WindowState;
    protected readonly onClose?: () => void;

    protected root: HTMLDivElement | null = null;
    protected contentEl: HTMLDivElement | null = null;
    protected collapseBtn: HTMLButtonElement | null = null;
    protected closeBtn: HTMLButtonElement | null = null;
    protected destroyed = false;

    // Window state model — single source of truth
    protected win: WindowState;

    // Keyboard handler
    private boundOnKeyDown: ((e: KeyboardEvent) => void) | null = null;

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

    constructor(config: CompanionWindowConfig) {
        this.container = config.container ?? document.body;
        this.classPrefix = config.classPrefix ?? DEFAULT_CLASS_PREFIX;
        this.storageKey = config.storageKey;
        this.defaultState = config.defaultState;
        this.onClose = config.onClose;

        // Load persisted state
        const saved = loadState(this.storageKey) ?? this.defaultState;
        this.win = { ...saved };
    }

    // -------------------------------------------------------------------------
    // Initialization — called by subclass after creating DOM
    // -------------------------------------------------------------------------

    /**
     * Attach window behavior to DOM elements.
     * Must be called by subclass after creating root, contentEl, collapseBtn, closeBtn.
     */
    protected initWindow(dragHandle: HTMLElement, resizeHandle: HTMLElement): void {
        // Set up event listeners
        dragHandle.addEventListener("pointerdown", this.onDragPointerDown);
        dragHandle.addEventListener("dblclick", this.onHeaderDoubleClick);
        resizeHandle.addEventListener("pointerdown", this.onResizePointerDown);
        this.collapseBtn?.addEventListener("click", this.onCollapseClick);
        this.closeBtn?.addEventListener("click", this.onCloseClick);

        // Install keyboard listener if visible
        if (!this.win.hidden) {
            this.installKeyboardListener();
        }
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /** Remove the widget from the DOM and clean up listeners. */
    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        this.cancelDrag();
        this.cancelResize();
        this.removeKeyboardListener();
        this.root?.remove();
        this.root = null;
        this.contentEl = null;
        this.collapseBtn = null;
        this.closeBtn = null;
    }

    /** Check if the widget has been destroyed. */
    get isDestroyed(): boolean {
        return this.destroyed;
    }

    /** Show the widget (after close). */
    show(): void {
        if (this.destroyed || !this.root) return;
        this.win = { ...this.win, hidden: false };
        this.root.style.display = "";
        this.installKeyboardListener();
        this.persistState();
    }

    /** Hide the widget (close). */
    hide(): void {
        if (this.destroyed || !this.root) return;
        this.cancelDrag();
        this.cancelResize();
        this.win = { ...this.win, hidden: true };
        this.root.style.display = "none";
        this.removeKeyboardListener();
        this.persistState();
    }

    /** Check if widget is visible. */
    get isVisible(): boolean {
        return !this.win.hidden;
    }

    /** Check if widget is collapsed. */
    get isCollapsed(): boolean {
        return this.win.collapsed;
    }

    // -------------------------------------------------------------------------
    // Collapse / Expand — two independent layouts
    // -------------------------------------------------------------------------

    /** Expand the widget. Restores exact previous dimensions from state. */
    expand(): void {
        if (!this.win.collapsed || !this.root || !this.contentEl) return;

        // Restore body
        this.contentEl.style.display = "";
        this.contentEl.style.overflow = "";
        this.contentEl.style.height = "";
        this.contentEl.style.minHeight = "";
        this.contentEl.style.padding = "";

        // Restore geometry from state
        this.root.style.width = this.win.width + "px";
        this.root.style.height = this.win.height + "px";
        this.root.style.minHeight = "";
        this.root.style.minWidth = "";
        this.root.style.overflow = "";

        // Update state
        this.win = { ...this.win, collapsed: false };
        this.root.classList.remove(`${this.classPrefix}-collapsed`);
        this.updateCollapseButton();
        this.persistState();
    }

    /**
     * Collapse the widget to a compact title bar.
     * Uses fixed constants — no DOM measurement.
     */
    collapse(): void {
        if (this.win.collapsed || !this.root || !this.contentEl) return;

        // Save current expanded dimensions to state
        const rect = this.root.getBoundingClientRect();
        this.win = {
            ...this.win,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            collapsed: true,
        };

        // Hide body completely
        this.contentEl.style.display = "none";

        // Set fixed collapsed dimensions
        this.root.style.width = COLLAPSED_WIDTH + "px";
        this.root.style.height = COLLAPSED_HEIGHT + "px";
        this.root.style.minHeight = COLLAPSED_HEIGHT + "px";
        this.root.style.minWidth = COLLAPSED_WIDTH + "px";
        this.root.style.overflow = "hidden";

        // Update UI
        this.root.classList.add(`${this.classPrefix}-collapsed`);
        this.updateCollapseButton();
        this.persistState();
    }

    /** Toggle collapse state. */
    toggleCollapse(): void {
        if (this.win.collapsed) {
            this.expand();
        } else {
            this.collapse();
        }
    }

    // -------------------------------------------------------------------------
    // State persistence
    // -------------------------------------------------------------------------

    protected persistState(): void {
        if (this.win.width <= 0 || this.win.height <= 0) {
            return;
        }
        saveState(this.storageKey, { ...this.win });
    }

    // -------------------------------------------------------------------------
    // Keyboard shortcuts
    // -------------------------------------------------------------------------

    private installKeyboardListener(): void {
        if (this.boundOnKeyDown) return;
        this.boundOnKeyDown = this.onKeyDown;
        document.addEventListener("keydown", this.boundOnKeyDown);
    }

    private removeKeyboardListener(): void {
        if (this.boundOnKeyDown) {
            document.removeEventListener("keydown", this.boundOnKeyDown);
            this.boundOnKeyDown = null;
        }
    }

    private onKeyDown = (e: KeyboardEvent): void => {
        if (this.destroyed || this.win.hidden) return;
        if (e.key === "Escape") {
            this.hide();
            this.onClose?.();
        }
    };

    // -------------------------------------------------------------------------
    // Window controls
    // -------------------------------------------------------------------------

    protected updateCollapseButton(): void {
        if (!this.collapseBtn) return;
        this.collapseBtn.textContent = this.win.collapsed ? "\u25B6" : "\u25BC";
        this.collapseBtn.title = this.win.collapsed ? "Expand" : "Collapse";
    }

    private onCollapseClick = (): void => {
        if (this.destroyed) return;
        this.toggleCollapse();
    };

    private onCloseClick = (): void => {
        if (this.destroyed) return;
        this.hide();
        this.onClose?.();
    };

    private onHeaderDoubleClick = (e: MouseEvent): void => {
        if (this.destroyed) return;
        const target = e.target as HTMLElement;
        if (target.closest("button")) return;
        this.toggleCollapse();
    };

    // -------------------------------------------------------------------------
    // Drag handling — bulletproof state management
    // -------------------------------------------------------------------------

    private cancelDrag(): void {
        if (!this.isDragging) return;
        this.isDragging = false;
        if (this.root) {
            const header = this.root.querySelector(`.${this.classPrefix}-header`) as HTMLElement | null;
            if (header) {
                header.style.cursor = "grab";
            }
        }
        this.removeDragListeners();
    }

    private onDragPointerDown = (e: PointerEvent): void => {
        if (this.destroyed || !this.root) return;

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

        const header = this.root.querySelector(`.${this.classPrefix}-header`) as HTMLElement | null;
        if (header) {
            header.style.cursor = "grabbing";
        }

        this.boundOnDragPointerMove = this.onDragPointerMove;
        this.boundOnDragPointerUp = this.onDragPointerUp;

        document.addEventListener("pointermove", this.boundOnDragPointerMove);
        document.addEventListener("pointerup", this.boundOnDragPointerUp);
        document.addEventListener("pointercancel", this.boundOnDragPointerUp);
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

        if (this.root) {
            const header = this.root.querySelector(`.${this.classPrefix}-header`) as HTMLElement | null;
            if (header) {
                header.style.cursor = "grab";
            }
        }

        // Persist new position
        if (this.root) {
            const rect = this.root.getBoundingClientRect();
            this.win = { ...this.win, x: Math.round(rect.left), y: Math.round(rect.top) };
        }
        this.persistState();
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
    // Resize handling — bulletproof state management
    // -------------------------------------------------------------------------

    private cancelResize(): void {
        if (!this.isResizing) return;
        this.isResizing = false;
        this.removeResizeListeners();
    }

    private onResizePointerDown = (e: PointerEvent): void => {
        if (this.destroyed || !this.root || this.win.collapsed) return;
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

        // Persist new dimensions to state
        if (this.root) {
            const rect = this.root.getBoundingClientRect();
            this.win = {
                ...this.win,
                width: Math.round(rect.width),
                height: Math.round(rect.height),
            };
        }
        this.persistState();
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
}
