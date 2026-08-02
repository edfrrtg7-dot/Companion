/**
 * Companion Dialogs
 *
 * Reusable dialog helpers for alerts, confirms, and input modals.
 * Extracted from companion-modal.ts to improve separation of concerns.
 */

import { injectStyles } from "./companion-styles";

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

/** Show a confirmation dialog with Yes/No buttons. */
export function showConfirm(msgHtml: string): Promise<boolean> {
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
                    <button class="ab-btn primary" id="ab-confirm-yes">Yes</button>
                    <button class="ab-btn" id="ab-confirm-no">No</button>
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
                    <label style="display:block; margin-bottom:6px; font-size:12px; color:var(--ab-text-dim); font-weight:500;">
                        Paste snippets (one per line):
                    </label>
                    <textarea class="ab-import-textarea" id="ab-import-textarea" 
                        placeholder="Snippet 1
Snippet 2
Snippet 3
..."></textarea>
                    <button class="ab-btn ab-btn-cancel" id="ab-import-cancel">Cancel</button>
                </div>
            </div>
        `;

        const textarea = document.getElementById("ab-import-textarea") as HTMLTextAreaElement;
        textarea.focus();

        const parseSnippets = (): string[] => {
            return textarea.value
                .split(/\r?\n/)
                .map(l => l.trim())
                .filter(l => l.length > 0);
        };

        document.getElementById("ab-import-cancel")!.onclick = () => {
            closeDialogOverlay(overlay);
            resolve(null);
        };

        document.getElementById("ab-import-icebreaker")!.onclick = () => {
            const snippets = parseSnippets();
            closeDialogOverlay(overlay);
            resolve({ snippets, target: "icebreaker" });
        };

        document.getElementById("ab-import-broadcast")!.onclick = () => {
            const snippets = parseSnippets();
            closeDialogOverlay(overlay);
            resolve({ snippets, target: "broadcast" });
        };
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