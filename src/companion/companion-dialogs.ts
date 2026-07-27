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
                    <div class="ab-row" style="margin-top: 4px;">
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