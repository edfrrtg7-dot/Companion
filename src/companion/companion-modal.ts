/**
 * CompanionModal
 *
 * Compact control panel with unified Status, Actions, and Finance sections.
 * No tab navigation — all content visible at once.
 *
 * Responsibilities:
 *   - Create/destroy overlay + modal DOM
 *   - Render Status (dashboard cards), Actions (operation buttons), Finance
 *   - Close on ESC, overlay click, or X button
 */

import { renderDashboard, updateDashboard, start, stop } from "./dashboard";
import { CrmService } from "./crm-service";
import { diag } from "./dev";
import { showAlert, showConfirm, showDelayModal, showImportSnippetsModal } from "./companion-dialogs";
import { injectStyles } from "./companion-styles";
import { COMPANION_LOGO_DATA_URI } from "./brand-logo";
import { getSessionMemory } from "./session-memory";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMPANION_VERSION = "v2.0.0";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let modalOverlay: HTMLElement | null = null;
let sessionCleanup: (() => void) | null = null;
let fadingOverlay: HTMLElement | null = null;

// ---------------------------------------------------------------------------
// Section renderers
// ---------------------------------------------------------------------------

function renderActionsSection(container: HTMLElement, onFinanceClick: () => void): void {
    // Row 1: destructive / workflow actions
    const row1 = document.createElement("div");
    row1.className = "ab-actions-row";

    const resetBtn = document.createElement("button");
    resetBtn.className = "ab-btn";
    resetBtn.innerHTML = `<svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg> Reset IceBreaker`;
    resetBtn.addEventListener("click", async () => {
        const key = CrmService.findProfileKey();
        if (!key) { await showAlert("No CRM profile found."); return; }
        const data = CrmService.readProfile(key);
        if (!data || !CrmService.validateProfile(data)) { await showAlert("Invalid profile structure."); return; }
        if (!await CrmService.stopSenderSafely()) {
            if (!await showConfirm("Stop verification failed. Force continue?")) return;
        }
        const resetStart = Date.now();
        CrmService.resetIceBreaker(data);
        CrmService.writeProfile(key, data);
        const resetDuration = Date.now() - resetStart;
        try { localStorage.setItem("ab-last-reset", JSON.stringify({ timestamp: new Date().toISOString(), type: "resetIceBreaker", profileKey: key, durationMs: resetDuration })); } catch { /* ignore */ }
        updateDashboard();
        await showAlert("IceBreaker reset successfully.");
    });
    row1.appendChild(resetBtn);

    const newShiftBtn = document.createElement("button");
    newShiftBtn.className = "ab-btn danger";
    newShiftBtn.innerHTML = `<svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M19 4H15.5L14.5 3H9.5L8.5 4H5V6H19V4ZM6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V8H6V19Z"/></svg> New Shift`;
    newShiftBtn.addEventListener("click", async () => {
        const key = CrmService.findProfileKey();
        if (!key) { await showAlert("No CRM profile found."); return; }
        const data = CrmService.readProfile(key);
        if (!data || !CrmService.validateProfile(data)) { await showAlert("Invalid profile structure."); return; }
        if (!await CrmService.stopSenderSafely()) {
            if (!await showConfirm("Stop verification failed. Force continue?")) return;
        }
        CrmService.newShift(data);
        CrmService.writeProfile(key, data);
        updateDashboard();
        await showAlert("New Shift started.");
    });
    row1.appendChild(newShiftBtn);

    container.appendChild(row1);

    // Divider
    container.appendChild(createDivider());

    // Row 2: maintenance / configuration actions
    const row2 = document.createElement("div");
    row2.className = "ab-actions-row";

    const delaysBtn = document.createElement("button");
    delaysBtn.className = "ab-btn primary";
    delaysBtn.innerHTML = `<svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg> Change Delays`;
    delaysBtn.addEventListener("click", async () => {
        const key = CrmService.findProfileKey();
        if (!key) { await showAlert("No CRM profile found."); return; }
        const data = CrmService.readProfile(key);
        if (!data || !CrmService.validateProfile(data)) { await showAlert("Invalid profile structure."); return; }
        if (CrmService.isEngineActive(data)) {
            await showAlert("Please stop IceBreaker and Broadcast before changing delays.");
            return;
        }
        if (!await CrmService.stopSenderSafely()) {
            if (!await showConfirm("Stop verification failed. Force continue?")) return;
        }
        const currentDelays = CrmService.readDelays(data);
        const delays = await showDelayModal(currentDelays);
        if (!delays) return;
        CrmService.applyDelays(data, delays.priv, delays.broad);
        CrmService.writeProfile(key, data);
        await showAlert("Delays successfully updated and verified.");
    });
    row2.appendChild(delaysBtn);

    // Import Snippets - opens paste dialog
    const importBtn = document.createElement("button");
    importBtn.className = "ab-btn";
    importBtn.innerHTML = `<svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg> Import Snippets`;
    importBtn.addEventListener("click", async () => {
        const result = await showImportSnippetsModal();
        if (!result) return;

        const { snippets, target } = result;
        const importResult = CrmService.importSnippetsToProfile(target, snippets);
        if (importResult.importedCount > 0) {
            updateDashboard();
            await showAlert(importResult.message);
        } else {
            await showAlert(importResult.message);
        }
    });
    row2.appendChild(importBtn);

    container.appendChild(row2);
}

function renderFinanceSection(container: HTMLElement, onFinanceClick: () => void): void {
    const financeBtn = document.createElement("button");
    financeBtn.className = "ab-btn ab-btn-full";
    financeBtn.innerHTML = `<svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg> Finance Widget`;
    financeBtn.addEventListener("click", onFinanceClick);
    container.appendChild(financeBtn);
}

function renderSessionSection(container: HTMLElement): { refresh: () => void; destroy: () => void } {
    // Clear any existing content to prevent DOM duplication on re-render
    container.innerHTML = "";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "ab-session-search";
    input.placeholder = "Search pages...";
    container.appendChild(input);

    const listEl = document.createElement("div");
    listEl.className = "ab-session-list";
    container.appendChild(listEl);

    function formatTime(ts: number): string {
        const diff = Date.now() - ts;
        if (diff < 60000) return "just now";
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        return `${Math.floor(diff / 3600000)}h ago`;
    }

    function highlight(text: string, query: string): string {
        if (!query) return text;
        const idx = text.toLowerCase().indexOf(query.toLowerCase());
        if (idx === -1) return text;
        const before = text.slice(0, idx);
        const match = text.slice(idx, idx + query.length);
        const after = text.slice(idx + query.length);
        return `${before}<mark class="ab-session-highlight">${match}</mark>${after}`;
    }

    function renderList(query: string): void {
        const events = getSessionMemory().getEvents();
        const lower = query.toLowerCase().trim();
        const filtered = lower
            ? events.filter(e => e.title.toLowerCase().includes(lower) || e.url.toLowerCase().includes(lower))
            : events;

        listEl.innerHTML = "";

        if (filtered.length === 0) {
            const empty = document.createElement("div");
            empty.className = "ab-session-empty";
            empty.textContent = lower ? "No matching pages." : "No pages visited yet.";
            listEl.appendChild(empty);
            return;
        }

        for (const event of filtered) {
            const item = document.createElement("div");
            item.className = "ab-session-item";

            const title = document.createElement("span");
            title.className = "ab-session-title";
            if (lower) {
                title.innerHTML = highlight(event.title, query);
            } else {
                title.textContent = event.title;
            }
            item.appendChild(title);

            const time = document.createElement("span");
            time.className = "ab-session-time";
            time.textContent = formatTime(event.timestamp);
            item.appendChild(time);

            item.addEventListener("click", () => { window.location.href = event.url; });
            item.style.cursor = "pointer";
            listEl.appendChild(item);
        }
    }

    renderList("");
    input.addEventListener("input", () => renderList(input.value));

    // Subscribe to session updates for live refresh while modal is open
    const sessionMemory = getSessionMemory();
    const callback = () => renderList(input.value);
    const sessionCleanup = sessionMemory.addNewEventCallback(callback);

    return {
        refresh: () => renderList(input.value),
        destroy: () => {
            sessionCleanup();
            container.innerHTML = "";
        }
    };
}

function createDivider(): HTMLDivElement {
    const div = document.createElement("div");
    div.style.borderTop = "1px solid var(--ab-border)";
    div.style.margin = "8px 0";
    return div;
}

function createSectionTitle(text: string): HTMLDivElement {
    const title = document.createElement("div");
    title.className = "ab-section-title";
    title.textContent = text;
    return title;
}

// ---------------------------------------------------------------------------
// Close handlers
// ---------------------------------------------------------------------------

function handleClose(): void {
    hide();
}

function onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") handleClose();
}

function onOverlayClick(e: MouseEvent): void {
    if (e.target === modalOverlay) handleClose();
}

// ---------------------------------------------------------------------------
// Show / Hide
// ---------------------------------------------------------------------------

function show(onFinanceClick: () => void): void {
    // If there's a fading overlay, remove it immediately to prevent duplicates
    if (fadingOverlay) {
        fadingOverlay.remove();
        fadingOverlay = null;
    }
    if (modalOverlay) return;

    injectStyles();

    const overlay = document.createElement("div");
    overlay.className = "ab-overlay";
    overlay.id = "ab-overlay";
    overlay.innerHTML = `
        <div class="ab-modal large">
            <div class="ab-header">
                <div class="ab-header-brand">
                    <img class="ab-header-logo" src="${COMPANION_LOGO_DATA_URI}" alt="" />
                    <span class="ab-header-title">Companion</span>
                </div>
                <div class="ab-header-right">
                    <span class="ab-header-version">${COMPANION_VERSION}</span>
                    <div class="ab-close-icon" id="ab-main-close">
                        <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                    </div>
                </div>
            </div>
            <div class="ab-content" id="ab-unified-content"></div>
        </div>
    `;

    document.body.appendChild(overlay);
    modalOverlay = overlay;

    // Close button
    document.getElementById("ab-main-close")?.addEventListener("click", handleClose);

    // ESC key
    document.addEventListener("keydown", onKeyDown);

    // Overlay click
    overlay.addEventListener("click", onOverlayClick);

    // Render unified content
    const content = document.getElementById("ab-unified-content");
    if (content) {
        // Status section
        const statusSection = document.createElement("div");
        statusSection.className = "ab-section";
        statusSection.appendChild(createSectionTitle("Status"));
        const statusGrid = document.createElement("div");
        statusGrid.id = "ab-status-grid";
        statusSection.appendChild(statusGrid);
        content.appendChild(statusSection);

        // Actions section
        const actionsSection = document.createElement("div");
        actionsSection.className = "ab-section";
        actionsSection.appendChild(createSectionTitle("Actions"));
        const actionsContent = document.createElement("div");
        actionsSection.appendChild(actionsContent);
        content.appendChild(actionsSection);

        // Session section
        const sessionSection = document.createElement("div");
        sessionSection.className = "ab-section";
        const sessionHeader = document.createElement("div");
        sessionHeader.className = "ab-section-header";
        sessionHeader.appendChild(createSectionTitle("Session"));
        const sessionActions = document.createElement("div");
        sessionActions.className = "ab-section-actions";

        const exportBtn = document.createElement("button");
        exportBtn.className = "ab-btn ab-btn-sm";
        exportBtn.title = "Export session to JSON file";
        exportBtn.innerHTML = `<svg style="width:14px;height:14px;fill:currentColor" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg> Export`;
        exportBtn.addEventListener("click", () => {
            const json = getSessionMemory().exportToJson();
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `companion-session-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        });
        sessionActions.appendChild(exportBtn);

        const importBtn = document.createElement("button");
        importBtn.className = "ab-btn ab-btn-sm";
        importBtn.title = "Import session from JSON file";
        importBtn.innerHTML = `<svg style="width:14px;height:14px;fill:currentColor" viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5z"/></svg> Import`;
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".json";
        fileInput.style.display = "none";
        fileInput.addEventListener("change", async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                const count = getSessionMemory().importFromJson(text);
                sessionAPI.refresh();
                await showAlert(`Imported ${count} session entries.`);
            } catch {
                await showAlert("Invalid session file.", true);
            }
            fileInput.value = "";
        });
        importBtn.addEventListener("click", () => fileInput.click());
        sessionActions.appendChild(importBtn);
        sessionActions.appendChild(fileInput);

        sessionHeader.appendChild(sessionActions);
        sessionSection.appendChild(sessionHeader);
        const sessionContent = document.createElement("div");
        sessionSection.appendChild(sessionContent);
        content.appendChild(sessionSection);

        // Finance section
        const financeSection = document.createElement("div");
        financeSection.className = "ab-section";
        financeSection.appendChild(createSectionTitle("Finance"));
        const financeContent = document.createElement("div");
        financeSection.appendChild(financeContent);
        content.appendChild(financeSection);

        // Render content into sections
        renderDashboard(statusGrid);
        renderActionsSection(actionsContent, onFinanceClick);
        const sessionAPI = renderSessionSection(sessionContent);
        sessionCleanup = sessionAPI.destroy;
        renderFinanceSection(financeContent, onFinanceClick);
    }

    // Fade in
    requestAnimationFrame(() => overlay.classList.add("visible"));

    start();

    diag("CompanionModal shown");

    // Notify listeners of visibility change
    CompanionModal.getInstance().onVisibilityChange?.();
}

function hide(): void {
    if (!modalOverlay) return;

    stop();

    // Remove event listeners
    document.removeEventListener("keydown", onKeyDown);

    // Clean up session subscription
    if (sessionCleanup) {
        sessionCleanup();
        sessionCleanup = null;
    }

    // Fade out - track fading overlay to prevent race
    modalOverlay.classList.remove("visible");
    const overlay = modalOverlay;
    fadingOverlay = overlay;
    setTimeout(() => {
        overlay?.remove();
        if (fadingOverlay === overlay) {
            fadingOverlay = null;
        }
    }, 150);
    modalOverlay = null;

    diag("CompanionModal hidden");

    // Notify listeners of visibility change
    CompanionModal.getInstance().onVisibilityChange?.();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class CompanionModal {
    private static instance: CompanionModal | null = null;
    private onFinanceClick: (() => void) | null = null;
    private onVisibilityChange: (() => void) | null = null;

    static initInstance(modal: CompanionModal): void {
        if (CompanionModal.instance) {
            throw new Error("CompanionModal instance already initialized.");
        }
        CompanionModal.instance = modal;
    }

    static getInstance(): CompanionModal {
        if (!CompanionModal.instance) {
            throw new Error("CompanionModal not initialized. Call CompanionModal.initInstance() during bootstrap.");
        }
        return CompanionModal.instance;
    }

    /** Set the callback for the Finance Widget button. */
    setFinanceClickHandler(handler: () => void): void {
        this.onFinanceClick = handler;
    }

    /** Set the callback for visibility changes (show/hide). */
    setOnVisibilityChange(callback: (() => void) | null): void {
        this.onVisibilityChange = callback;
    }

    /** Show the Companion modal. */
    show(): void {
        show(this.onFinanceClick ?? (() => {}));
    }

    /** Hide the Companion modal. */
    hide(): void {
        hide();
    }

    /** Toggle the Companion modal. */
    toggle(): void {
        if (modalOverlay) {
            hide();
        } else {
            this.show();
        }
    }

    /** Whether the modal is currently visible. */
    get isVisible(): boolean {
        return modalOverlay !== null;
    }
}
