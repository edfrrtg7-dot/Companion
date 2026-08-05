/**
 * Companion Dialogs
 *
 * Reusable dialog helpers for alerts, confirms, and input modals.
 * Extracted from companion-modal.ts to improve separation of concerns.
 */

import { injectStyles } from "./companion-styles";
import { CrmService } from "./crm-service";

const DEFAULT_DELAY = 65;
const MIN_DELAY = 1;
const MAX_DELAY = 3600;

/** Create a dialog overlay element and append to body. */
export function createDialogOverlay(): HTMLElement {
    injectStyles();
    const overlay = document.createElement("div");
    overlay.className = "ab-overlay";
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("visible"));
    return overlay;
}

/** Close and remove a dialog overlay. */
export function closeDialogOverlay(overlay: HTMLElement): void {
    overlay.classList.remove("visible");
    setTimeout(() => overlay.remove(), 150);
}

/** Show an alert dialog with OK button. */
export function showAlert(msgHtml: string): Promise<void> {
    return new Promise((resolve) => {
        const overlay = createDialogOverlay();
        overlay.innerHTML = `
            <div class="ab-modal small">
                <div class="ab-header">
                    <h2>Attention</h2>
                </div>
                <div class="ab-content" style="text-align: center; font-size: 14px; line-height: 1.5;">
                    ${msgHtml}
                </div>
                <div class="ab-content" style="padding-top: 0;">
                    <button class="ab-btn primary" id="ab-alert-ok">OK</button>
                </div>
            </div>
        `;
        document.getElementById("ab-alert-ok")!.onclick = () => {
            closeDialogOverlay(overlay);
            resolve();
        };
    });
}

/** Show a confirmation dialog with configurable Yes/No labels. */
export function showConfirm(msgHtml: string, confirmLabel = "Yes", cancelLabel = "No"): Promise<boolean> {
    return new Promise((resolve) => {
        const overlay = createDialogOverlay();
        overlay.innerHTML = `
            <div class="ab-modal small">
                <div class="ab-header">
                    <h2>Confirm Action</h2>
                </div>
                <div class="ab-content" style="text-align: center; font-size: 14px; line-height: 1.5;">
                    ${msgHtml}
                </div>
                <div class="ab-content" style="padding-top: 0; display:flex; gap:10px;">
                    <button class="ab-btn primary" id="ab-confirm-yes">${confirmLabel}</button>
                    <button class="ab-btn" id="ab-confirm-no">${cancelLabel}</button>
                </div>
            </div>
        `;
        document.getElementById("ab-confirm-yes")!.onclick = () => {
            closeDialogOverlay(overlay);
            resolve(true);
        };
        document.getElementById("ab-confirm-no")!.onclick = () => {
            closeDialogOverlay(overlay);
            resolve(false);
        };
    });
}

/** Result of the import snippets modal. */
export interface ImportSnippetsResult {
    /** Parsed snippets (one per non-empty line, trimmed). */
    snippets: string[];
    /** Target collection: "icebreaker" or "broadcast". */
    target: "icebreaker" | "broadcast";
}

/** Show a modal for importing snippets from pasted text. */
export function showImportSnippetsModal(): Promise<ImportSnippetsResult | null> {
    return new Promise((resolve) => {
        const overlay = createDialogOverlay();
        overlay.innerHTML = `
            <div class="ab-modal medium">
                <div class="ab-header">
                    <h2>Import Snippets</h2>
                </div>
                <div class="ab-content" style="gap: 12px; padding: 20px;">
                    <div class="ab-import-buttons">
                        <button class="ab-btn ab-btn-import icebreaker" id="ab-import-icebreaker">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><line x1="6" y1="20" x2="6.01" y2="20"/></svg>
                            Import to IceBreaker
                        </button>
                        <button class="ab-btn ab-btn-import broadcast" id="ab-import-broadcast">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                            Import to Broadcast
                        </button>
                    </div>
                    <div class="ab-import-warning" id="ab-import-warning">
                        Pasting snippets will replace the current message list of the selected target.
                    </div>
                    <label style="display:block; margin-bottom:6px; font-size:12px; color:var(--ab-text-dim); font-weight:500;">
                        Paste snippets (one per line):
                    </label>
                    <div class="ab-import-editor" id="ab-import-editor">
                        <div class="ab-import-gutter" id="ab-import-gutter">
                            <div class="ab-import-gutter-numbers" id="ab-import-gutter-numbers">1</div>
                        </div>
                        <textarea class="ab-import-textarea" id="ab-import-textarea" 
                            placeholder="Snippet 1
Snippet 2
Snippet 3
..."></textarea>
                    </div>
                    <div class="ab-import-stats" id="ab-import-stats" hidden>
                        <div class="ab-import-stats-title">Detected snippets</div>
                        <div class="ab-import-stats-grid">
                            <span class="ab-import-stat-label">Lines</span>
                            <span class="ab-import-stat-value" id="ab-import-stat-lines">0</span>
                            <span class="ab-import-stat-label">Unique</span>
                            <span class="ab-import-stat-value" id="ab-import-stat-unique">0</span>
                            <span class="ab-import-stat-label">Duplicates</span>
                            <span class="ab-import-stat-value" id="ab-import-stat-duplicates">0</span>
                            <span class="ab-import-stat-label">Empty</span>
                            <span class="ab-import-stat-value" id="ab-import-stat-empty">0</span>
                        </div>
                    </div>
                    <div class="ab-import-error" id="ab-import-error" hidden>
                        Please paste at least one non-empty snippet before importing.
                    </div>
                    <button class="ab-btn ab-btn-cancel" id="ab-import-cancel">Cancel</button>
                </div>
            </div>
        `;

        const textarea = document.getElementById("ab-import-textarea") as HTMLTextAreaElement;
        const gutterNumbers = document.getElementById("ab-import-gutter-numbers") as HTMLDivElement;
        const errorBox = document.getElementById("ab-import-error") as HTMLDivElement;
        const editor = document.getElementById("ab-import-editor") as HTMLDivElement;
        const statsPanel = document.getElementById("ab-import-stats") as HTMLDivElement;
        const statLines = document.getElementById("ab-import-stat-lines") as HTMLSpanElement;
        const statUnique = document.getElementById("ab-import-stat-unique") as HTMLSpanElement;
        const statDuplicates = document.getElementById("ab-import-stat-duplicates") as HTMLSpanElement;
        const statEmpty = document.getElementById("ab-import-stat-empty") as HTMLSpanElement;
        textarea.focus();

        const updateLineNumbers = (): void => {
            const count = Math.max(1, textarea.value.split("\n").length);
            gutterNumbers.textContent = Array.from({ length: count }, (_, i) => String(i + 1)).join("\n");
            gutterNumbers.style.transform = "translateY(0px)";
            if (errorBox.hidden === false) {
                errorBox.hidden = true;
                editor.classList.remove("ab-import-editor-error");
            }
        };

        /**
         * Live import preview — reuses the exact importer pipeline
         * (CrmService.normalizeSnippets), so the statistics always match the
         * actual import result. Pure preview: no import, no profile, no storage.
         * Lines = non-empty trimmed lines (as the importer counts "Lines
         * entered"); Empty = remaining raw lines the importer skips.
         */
        const updateStats = (): void => {
            const rawLines = textarea.value.split(/\r?\n/);
            const { linesEntered, unique, duplicatesSkipped } = CrmService.normalizeSnippets(rawLines);
            statLines.textContent = String(linesEntered);
            statUnique.textContent = String(unique.length);
            statDuplicates.textContent = String(duplicatesSkipped);
            statEmpty.textContent = String(Math.max(0, rawLines.length - linesEntered));
            statsPanel.hidden = false;
        };

        const syncGutterScroll = (): void => {
            gutterNumbers.style.transform = `translateY(${-textarea.scrollTop}px)`;
        };

        const onInput = (): void => {
            updateLineNumbers();
            updateStats();
        };
        const onScroll = (): void => syncGutterScroll();
        textarea.addEventListener("input", onInput);
        textarea.addEventListener("scroll", onScroll);

        const parseSnippets = (): string[] => {
            return textarea.value
                .split(/\r?\n/)
                .map(l => l.trim())
                .filter(l => l.length > 0);
        };

        const confirmImport = (target: "icebreaker" | "broadcast"): void => {
            const snippets = parseSnippets();
            if (snippets.length === 0) {
                errorBox.hidden = false;
                editor.classList.add("ab-import-editor-error");
                textarea.focus();
                return;
            }
            textarea.removeEventListener("input", onInput);
            textarea.removeEventListener("scroll", onScroll);
            closeDialogOverlay(overlay);
            resolve({ snippets, target });
        };

        document.getElementById("ab-import-cancel")!.onclick = () => {
            textarea.removeEventListener("input", onInput);
            textarea.removeEventListener("scroll", onScroll);
            closeDialogOverlay(overlay);
            resolve(null);
        };

        document.getElementById("ab-import-icebreaker")!.onclick = () => confirmImport("icebreaker");
        document.getElementById("ab-import-broadcast")!.onclick = () => confirmImport("broadcast");
    });
}

/** Show a delay input modal for private/broadcast delays. */
export function showDelayModal(initialDelays?: { priv: number; broad: number }): Promise<{ priv: number; broad: number } | null> {
    return new Promise((resolve) => {
        const overlay = createDialogOverlay();
        const initialPriv = initialDelays?.priv ?? DEFAULT_DELAY;
        const initialBroad = initialDelays?.broad ?? DEFAULT_DELAY;
        overlay.innerHTML = `
            <div class="ab-modal small">
                <div class="ab-header">
                    <h2>Change Delays</h2>
                </div>
                <div class="ab-content">
                    <div class="ab-input-group">
                        <label>Private Delay (seconds)</label>
                        <input type="number" id="ab-delay-priv" value="${initialPriv}" min="1" max="3600">
                    </div>
                    <div class="ab-input-group">
                        <label>Broadcast Delay (seconds)</label>
                        <input type="number" id="ab-delay-broad" value="${initialBroad}" min="1" max="3600">
                    </div>
                    <div class="ab-actions-container">
                        <button class="ab-btn primary" id="ab-delay-apply">Apply</button>
                        <button class="ab-btn" id="ab-delay-cancel">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById("ab-delay-apply")!.onclick = () => {
            const privInput = document.getElementById("ab-delay-priv") as HTMLInputElement;
            const broadInput = document.getElementById("ab-delay-broad") as HTMLInputElement;
            const priv = parseInt(privInput.value, 10);
            const broad = parseInt(broadInput.value, 10);
            
            // Validation
            if (isNaN(priv) || isNaN(broad)) {
                showAlert("Invalid numeric value. Please enter valid numbers.");
                return;
            }
            if (priv < 1 || priv > 3600 || broad < 1 || broad > 3600) {
                showAlert("Delay values must be between 1 and 3600 seconds.");
                return;
            }
            if (!Number.isInteger(priv) || !Number.isInteger(broad)) {
                showAlert("Delay values must be whole numbers.");
                return;
            }
            
            closeDialogOverlay(overlay);
            resolve({ priv, broad });
        };
        document.getElementById("ab-delay-cancel")!.onclick = () => {
            closeDialogOverlay(overlay);
            resolve(null);
        };
    });
}