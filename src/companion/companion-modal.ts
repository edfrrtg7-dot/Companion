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

import { CrmService } from "./crm-service";
import { renderDashboard, start, stop } from "./dashboard";
import { diag } from "./dev";
import { showAlert, showConfirm, showDelayModal } from "./companion-dialogs";
import { injectStyles } from "./companion-styles";
import { COMPANION_LOGO_DATA_URI } from "./brand-logo";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMPANION_VERSION = "v2.0.0";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let modalOverlay: HTMLElement | null = null;

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
        await showAlert("IceBreaker reset successfully. Reloading...");
        window.location.reload();
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
        await showAlert("New Shift started. Reloading...");
        window.location.reload();
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

    // Import Snippets (hidden file input)
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".txt";
    fileInput.style.display = "none";
    fileInput.id = "ab-file-import";
    fileInput.addEventListener("change", async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        const key = CrmService.findProfileKey();
        if (!key) { await showAlert("No CRM profile found."); return; }
        const data = CrmService.readProfile(key);
        if (!data || !CrmService.validateProfile(data)) { await showAlert("Invalid profile structure."); return; }
        const text = await file.text();
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        let importedCount = 0;
        if ((data as any).messages) {
            const msgs = (data as any).messages;
            const existing = new Set(Object.values(msgs).flatMap((m: any) => m.text ? [m.text] : []));
            for (const line of lines) {
                if (!existing.has(line)) {
                    const id = `snip_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
                    msgs[id] = { text: line, intervalSeconds: 60 };
                    existing.add(line);
                    importedCount++;
                }
            }
        }
        CrmService.writeProfile(key, data);
        const profileKey = key.replace("chat-sender-", "");
        const { addImportHistory } = await import("./dev");
        addImportHistory({
            timestamp: new Date().toISOString(),
            profileKey,
            importedCount,
            result: importedCount > 0 ? "success" : "partial",
        });
        await showAlert(importedCount > 0 ? `Imported ${importedCount} snippets.` : "No new snippets to import.");
        fileInput.value = "";
    });
    container.appendChild(fileInput);

    const importBtn = document.createElement("button");
    importBtn.className = "ab-btn";
    importBtn.innerHTML = `<svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg> Import Snippets`;
    importBtn.addEventListener("click", () => fileInput.click());
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

    // Fade out
    modalOverlay.classList.remove("visible");
    const overlay = modalOverlay;
    setTimeout(() => overlay?.remove(), 150);
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

    static getInstance(): CompanionModal {
        if (!CompanionModal.instance) {
            CompanionModal.instance = new CompanionModal();
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
